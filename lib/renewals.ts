import {createCipheriv,createDecipheriv,createHmac,hkdfSync,randomBytes} from 'node:crypto';
import {db,uuid} from './shop';
import {type Applicant} from './membership';
import {CLUB_EMAIL,decryptToken,gmailReady,tokenRequest} from './gmail';

export type RenewalDetails=Applicant & {year:number;rosterMemberNumber?:string};
export type MailState='queued'|'sending'|'accepted'|'failed'|'unknown';
function key(){
 const secret=process.env.GMAIL_ENCRYPTION_KEY;
 if(!secret||secret.length<32)throw Error('Secure storage unavailable');
 // A distinct derived key keeps membership data separate from OAuth tokens.
 return Buffer.from(hkdfSync('sha256',secret,'kpkmm-renewals-v1','private-renewals',32));
}
export function renewalHash(value:string){return createHmac('sha256',key()).update(value).digest('hex');}
export function sealRenewal(value:string){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),iv);const data=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return [iv,cipher.getAuthTag(),data].map(b=>b.toString('base64')).join('.');}
export function openRenewal(value:string){const [iv,tag,data]=value.split('.').map(v=>Buffer.from(v,'base64'));const cipher=createDecipheriv('aes-256-gcm',key(),iv);cipher.setAuthTag(tag);return Buffer.concat([cipher.update(data),cipher.final()]).toString('utf8');}
let ready:Promise<void>|undefined;
export async function renewalsReady(){
 key();
 if(!ready)ready=(async()=>{
 await db()`CREATE TABLE IF NOT EXISTS club_renewals(id uuid PRIMARY KEY,identity_hash text NOT NULL,renewal_year integer NOT NULL,amount integer NOT NULL DEFAULT 15000 CHECK(amount=15000),payload text NOT NULL,proof text NOT NULL,proof_type text NOT NULL,review_status text NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending','approved','rejected')),mail_status text NOT NULL DEFAULT 'queued' CHECK(mail_status IN ('queued','sending','accepted','failed','unknown')),mail_id text,mail_attempt_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(identity_hash,renewal_year))`;
 await db()`ALTER TABLE club_renewals ADD COLUMN IF NOT EXISTS member_mail_status text NOT NULL DEFAULT 'not_queued'`;
 await db()`CREATE TABLE IF NOT EXISTS renewal_limits(key text PRIMARY KEY,count integer NOT NULL,expires_at timestamptz NOT NULL)`;
 })().catch(error=>{ready=undefined;throw error;});
 await ready;
}
export async function renewalLimit(value:string,maximum:number){
 const rows=await db()`INSERT INTO renewal_limits(key,count,expires_at) VALUES(${renewalHash(value)},1,now()+interval '1 hour') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN renewal_limits.expires_at<now() THEN 1 ELSE LEAST(renewal_limits.count+1,100000) END,expires_at=CASE WHEN renewal_limits.expires_at<now() THEN now()+interval '1 hour' ELSE renewal_limits.expires_at END RETURNING count`;
 return rows[0].count<=maximum;
}
const wrapped=(value:Buffer)=>value.toString('base64').match(/.{1,76}/g)?.join('\r\n')||'';
const extensions:Record<string,string>={'image/jpeg':'jpg','image/png':'png','application/pdf':'pdf','text/plain':'txt'};
export function clubMessage(id:string,text:string,proof:{bytes:Buffer;type:string},test=false){
 if(!uuid(id)||!extensions[proof.type]||proof.bytes.length>700*1024)throw Error('Invalid message');
 const boundary='kpkmm-'+randomBytes(18).toString('hex');
 const lines=[`From: KPKMM <${CLUB_EMAIL}>`,`To: ${CLUB_EMAIL}`,`Subject: ${test?'KPKMM email delivery test':'KPKMM membership renewal'} - ${id}`,`Message-ID: <${id}@kpkmm-club-hub.vercel.app>`,`Date: ${new Date().toUTCString()}`,'MIME-Version: 1.0',`Content-Type: multipart/mixed; boundary="${boundary}"`,'',`--${boundary}`,'Content-Type: text/plain; charset=utf-8','Content-Transfer-Encoding: base64','',wrapped(Buffer.from(text,'utf8')),`--${boundary}`,`Content-Type: ${proof.type}`,`Content-Disposition: attachment; filename="${test?'test-attachment':'payment-proof'}.${extensions[proof.type]}"`,'Content-Transfer-Encoding: base64','',wrapped(proof.bytes),`--${boundary}--`,''];
 return Buffer.from(lines.join('\r\n'),'utf8').toString('base64url');
}
export async function sendClubMessage(raw:string):Promise<{state:'accepted'|'failed'|'unknown';id?:string}>{
 let access:string;
 try{
  await gmailReady();const rows=await db()`SELECT token FROM club_gmail_connection WHERE id=1 AND email=${CLUB_EMAIL}`;
  if(!rows[0])return {state:'failed'};
  const tokens=await tokenRequest({grant_type:'refresh_token',refresh_token:decryptToken(rows[0].token)});
  if(!tokens.access_token)return {state:'failed'};access=tokens.access_token;
 }catch{return {state:'failed'};}
 // Gmail has no idempotent-send guarantee. Never retry an ambiguous send automatically.
 try{
  const response=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{Authorization:'Bearer '+access,'Content-Type':'application/json'},body:JSON.stringify({raw}),cache:'no-store',signal:AbortSignal.timeout(20000)});
  if(!response.ok)return {state:response.status>=500?'unknown':'failed'};
  const result=await response.json();return typeof result.id==='string'?{state:'accepted',id:result.id}:{state:'unknown'};
 }catch{return {state:'unknown'};}
}
export async function deliverRenewal(id:string,allowUncertain=false):Promise<MailState>{
 if(!uuid(id))throw Error('Invalid reference');
 const rows=await db()`UPDATE club_renewals SET mail_status='sending',mail_attempt_at=now() WHERE id=${id} AND (mail_status IN ('queued','failed') OR (${allowUncertain} AND (mail_status='unknown' OR (mail_status='sending' AND mail_attempt_at<now()-interval '2 minutes')))) RETURNING payload,proof,proof_type`;
 if(!rows[0])return 'sending';
 let raw:string;
 try{
  const d=JSON.parse(openRenewal(rows[0].payload)) as RenewalDetails;
  const text=[`Membership renewal / Pembaharuan keahlian`, `Reference / Rujukan: ${id}`,`Year / Tahun: ${d.year}`,`Fee / Yuran: RM150`, `Name / Nama: ${d.name}`,`Identity type / Jenis pengenalan: ${d.identityType}`,`IC or passport / KP atau pasport: ${d.identity}`,`Country / Negara: ${d.country}`,`Email / E-mel: ${d.email}`,`Mobile / Telefon: ${d.phone}`,`Mailing address / Alamat: ${d.address}`,'','Payment proof is attached. Verify payment and membership before approving. / Bukti bayaran dilampirkan. Semak bayaran dan keahlian sebelum meluluskan.'].join('\n');
  raw=clubMessage(id,text,{bytes:Buffer.from(openRenewal(rows[0].proof),'base64'),type:rows[0].proof_type});
 }catch{await db()`UPDATE club_renewals SET mail_status='failed' WHERE id=${id}`;return 'failed';}
 const sent=await sendClubMessage(raw);
 await db()`UPDATE club_renewals SET mail_status=${sent.state},mail_id=${sent.id||null} WHERE id=${id}`;
 return sent.state;
}
