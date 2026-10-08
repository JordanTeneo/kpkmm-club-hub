import {getFees} from './membership-fees';
import {feeQuote,savedFee,feeText,type FeeQuote} from './membership-pricing';
import {randomBytes,randomUUID} from 'node:crypto';
import {db,isAdmin,uuid} from './shop';
import {membershipPaymentsReady,paymentActor,recordMembershipPayment} from './membership-payments';
import {membershipReady,unseal,type Applicant} from './membership';
import {renewalsReady,renewalHash,sealRenewal,openRenewal,sendClubMessage} from './renewals';
import {adminRosterReady,validYear} from './member-admin';
import {memberPrefixes,nextMemberNumber} from './member-create';
import {nameKey} from './roster';
import {CLUB_EMAIL,SITE_ORIGIN} from './gmail';

let ready:Promise<void>|undefined;
export async function enrolmentReady(){
 if(!ready)ready=(async()=>{
  await membershipReady();await renewalsReady();
  await db()`CREATE TABLE IF NOT EXISTS club_enrolments(application_id uuid PRIMARY KEY REFERENCES club_applications(id),stage text NOT NULL CHECK(stage IN ('awaiting_payment','proof_submitted','active')),membership_year integer NOT NULL,token_hash text UNIQUE NOT NULL,token_encrypted text NOT NULL,expires_at timestamptz NOT NULL,proof text,proof_type text,proof_version uuid,member_number text,updated_at timestamptz NOT NULL DEFAULT now())`;
  await db()`ALTER TABLE club_enrolments ADD COLUMN IF NOT EXISTS fee_quote jsonb`;
  await db()`CREATE TABLE IF NOT EXISTS club_enrolment_mail(id uuid PRIMARY KEY,application_id uuid NOT NULL REFERENCES club_applications(id),kind text NOT NULL,context text NOT NULL,payload text NOT NULL,status text NOT NULL DEFAULT 'queued',attempt_at timestamptz,mail_id text,UNIQUE(application_id,kind,context))`;
 })().catch(e=>{ready=undefined;throw e;});
 await ready;
}
export function validPaymentToken(token:string){return /^[a-f0-9]{64}$/.test(token);}
export function enrolmentMessage(to:string,subject:string,body:string){
 // A single mailbox only; never accept MIME headers from application input.
 if(!/^[A-Za-z0-9.!#$%&'*+\-/=?^_`{|}~]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(to)||to.length>254)throw Error('Invalid recipient');
 const b64=(text:string)=>Buffer.from(text).toString('base64');
 return Buffer.from(`From: KPKMM <${CLUB_EMAIL}>\r\nTo: ${to}\r\nSubject: =?UTF-8?B?${b64(subject)}?=\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${b64(body).match(/.{1,76}/g)?.join('\r\n')||''}`).toString('base64url');
}
function invitation(person:Applicant,token:string,year:number,quote:FeeQuote){
 return enrolmentMessage(person.email,'KPKMM — application approved / Permohonan diluluskan',
  `Dear / Salam ${person.name},\n\nYour application has been approved. Membership is not active yet. Please pay ${feeText(quote)} (annual fee + administrative fee - discount; membership year ${year}).\nPermohonan anda diluluskan. Keahlian belum aktif. Sila bayar ${feeText(quote)} (yuran tahunan + pentadbiran - diskaun; tahun ${year}).\n\nMaybank\nKelab Peminat Kereta Mini Malaysia\n5123 4360 5508\n\nUpload payment proof using your private link (valid for 30 days):\nMuat naik bukti bayaran melalui pautan sulit anda (sah 30 hari):\n${SITE_ORIGIN}/join/payment/${token}\n\nDo not forward this link. The committee will verify payment before assigning your membership number. Membership ends on 31 December ${year}.\nJangan kongsi pautan ini. Jawatankuasa akan mengesahkan bayaran sebelum memberikan nombor ahli. Keahlian tamat pada 31 Disember ${year}.\n\nKPKMM Committee / Jawatankuasa KPKMM`);
}
function welcome(person:Applicant,number:string,year:number,invoiceLink:string){
 return enrolmentMessage(person.email,'Welcome to KPKMM / Selamat datang ke KPKMM',
  `Dear / Salam ${person.name},\n\nWelcome to Kelab Peminat Kereta Mini Malaysia! Your payment has been verified and your membership is now active. We look forward to sharing many memorable drives and club activities with you.\n\nSelamat datang ke Kelab Peminat Kereta Mini Malaysia! Bayaran anda telah disahkan dan keahlian anda kini aktif. Kami menantikan penyertaan anda dalam konvoi dan aktiviti kelab.\n\nMembership number / Nombor ahli: ${number}\nValid until / Sah sehingga: 31 December / Disember ${year}\n\nPlease keep your membership number for future reference. / Sila simpan nombor ahli untuk rujukan.\n\nPaid invoice / Invois berbayar (private / sulit):\n${invoiceLink}\nDo not forward this link. / Jangan kongsi pautan ini.\n\nSmall Cars, Big Spirit!\nKPKMM Committee / Jawatankuasa KPKMM`);
}
// Save the message in the same transaction as the decision. Delivery can fail
// independently without losing the decision or allocating another member ID.
async function queue(sql:any,id:string,kind:string,context:string,raw:string){
 await sql`INSERT INTO club_enrolment_mail(id,application_id,kind,context,payload) VALUES(${randomUUID()},${id},${kind},${context},${sealRenewal(raw)}) ON CONFLICT(application_id,kind,context) DO NOTHING`;
}
export async function approveApplication(id:string,year:number,previous:string){
 if(!(await isAdmin('membership')))throw Error('Unauthorised');
 if(!uuid(id)||!['pending','rejected'].includes(previous))throw Error('Invalid request');
 validYear(year);const current=Number(new Intl.DateTimeFormat('en',{year:'numeric',timeZone:'Asia/Kuala_Lumpur'}).format(new Date()));
 if(year!==current)throw Error('Use the current membership year');
 await enrolmentReady();await adminRosterReady();const quote=feeQuote((await getFees()).settings,'new');
 return db().begin(async sql=>{
  const rows=await sql`SELECT * FROM club_applications WHERE id=${id} FOR UPDATE`;
  const row=rows[0];if(!row||row.status!==previous)return 'changed';
  const existing=await sql`SELECT application_id FROM club_enrolments WHERE application_id=${id}`;
  if(existing.length)return 'changed';
  const token=randomBytes(32).toString('hex'),person=unseal(row.payload);
  if((person.mailingCountry||'').trim().toLowerCase()!=='malaysia'||!memberPrefixes[(person.state||'').trim().toLowerCase()])return 'prefix';
  const identity=renewalHash(person.identityType+':'+person.country.toLowerCase()+':'+person.identity);
  const duplicate=await sql`SELECT member_number FROM club_member_roster WHERE identity_hash=${identity} LIMIT 1`;
  if(duplicate.length)return 'duplicate';
  const raw=invitation(person,token,year,quote);
  await sql`INSERT INTO club_enrolments(application_id,stage,membership_year,token_hash,token_encrypted,expires_at) VALUES(${id},'awaiting_payment',${year},${renewalHash(token)},${sealRenewal(token)},now()+interval '30 days')`;
  await sql`UPDATE club_enrolments SET fee_quote=${JSON.stringify(quote)}::jsonb WHERE application_id=${id}`;
  // NULL is essential: existing status checks must not grant unpaid membership.
  await sql`UPDATE club_applications SET status='approved',membership_year=NULL,updated_at=now() WHERE id=${id}`;
  await queue(sql,id,'invitation',renewalHash(token),raw);
  return 'saved';
 });
}
export async function paymentPage(token:string){
 if(!validPaymentToken(token))return null;
 await enrolmentReady();
 const rows=await db()`SELECT stage,membership_year,fee_quote,expires_at>now() AS valid FROM club_enrolments WHERE token_hash=${renewalHash(token)}`;
 return rows[0]??null;
}
export async function savePayment(token:string,proof:{bytes:Buffer;type:string}){
 if(!validPaymentToken(token))return 'invalid';
 await enrolmentReady();
 return db().begin(async sql=>{
  const rows=await sql`SELECT * FROM club_enrolments WHERE token_hash=${renewalHash(token)} AND expires_at>now() FOR UPDATE`;
  const row=rows[0];if(!row||row.stage!=='awaiting_payment')return 'invalid';
  const version=randomUUID();
  await sql`UPDATE club_enrolments SET proof=${sealRenewal(proof.bytes.toString('base64'))},proof_type=${proof.type},proof_version=${version},stage='proof_submitted',updated_at=now() WHERE application_id=${row.application_id}`;
  await queue(sql,row.application_id,'payment_notice',version,enrolmentMessage(CLUB_EMAIL,'KPKMM — new member payment awaiting verification',`Payment proof is ready for committee review.\nBukti bayaran sedia untuk semakan jawatankuasa.\n\n${SITE_ORIGIN}/admin/members/${row.application_id}\n\nSign in to verify. No membership has been activated yet.`));
  return row.application_id as string;
 });
}
export async function approvePayment(id:string,version:string,paidOn=''){
 if(!(await isAdmin('membership')))throw Error('Unauthorised');
 if(!uuid(id)||!uuid(version))return 'invalid';
 await enrolmentReady();await adminRosterReady();await membershipPaymentsReady();const actor=await paymentActor();
 return db().begin(async sql=>{
  await sql`LOCK TABLE club_member_roster IN SHARE ROW EXCLUSIVE MODE`;
  const apps=await sql`SELECT * FROM club_applications WHERE id=${id} FOR UPDATE`;
  const rows=await sql`SELECT * FROM club_enrolments WHERE application_id=${id} FOR UPDATE`;
  const row=rows[0],app=apps[0];if(!row||!app)return 'invalid';
  if(row.stage==='active')return 'already';
  if(row.stage!=='proof_submitted'||row.proof_version!==version||!row.proof||app.status!=='approved')return 'changed';
  const person=unseal(app.payload),year=validYear(row.membership_year);
  const current=Number(new Intl.DateTimeFormat('en',{year:'numeric',timeZone:'Asia/Kuala_Lumpur'}).format(new Date()));
  if(year!==current)return 'year';
  const prefix=memberPrefixes[(person.state||'').trim().toLowerCase()];
  if((person.mailingCountry||'').trim().toLowerCase()!=='malaysia'||!prefix)return 'prefix';
  const hash=renewalHash(person.identityType+':'+person.country.toLowerCase()+':'+person.identity);
  const duplicates=await sql`SELECT member_number FROM club_member_roster WHERE identity_hash=${hash} LIMIT 1`;
  if(duplicates.length)return 'duplicate';
  const numbers=await sql`SELECT member_number AS number FROM club_member_roster UNION SELECT old_number AS number FROM club_member_id_history UNION SELECT new_number AS number FROM club_member_id_history`;
  const number=nextMemberNumber(numbers.map(r=>String(r.number)),prefix,year);
  const payload=sealRenewal(JSON.stringify({...person,memberNumber:number,active:true,joinedYear:year,sourceRow:2}));
  await sql`INSERT INTO club_member_roster(member_number,membership_year,name_hash,identity_hash,payload,active,status_override) VALUES(${number},${year},${nameKey(person.name)},${hash},${payload},true,true)`;
  await sql`INSERT INTO club_roster_edits(id,member_number,membership_year,before_payload,after_payload,reason) VALUES(${randomUUID()},${number},${year},${sealRenewal('null')},${payload},${sealRenewal('Verified new member payment: '+id+' proof '+version)})`;
  await sql`UPDATE club_enrolments SET stage='active',member_number=${number},updated_at=now() WHERE application_id=${id}`;
  await sql`UPDATE club_enrolment_mail SET status='superseded' WHERE application_id=${id} AND kind<>'welcome' AND status IN ('queued','failed','unknown')`;
  await sql`UPDATE club_applications SET membership_year=${year},updated_at=now() WHERE id=${id}`;
  const invoiceLink=await recordMembershipPayment(sql,{kind:'new',quote:savedFee(row.fee_quote,'new'),sourceId:id,year,paidOn,name:person.name,memberNumber:number,actor,proof:row.proof,proofType:row.proof_type});
  await queue(sql,id,'welcome','active',welcome(person,number,year,invoiceLink));
  return 'activated';
 });
}
export async function reissuePayment(id:string,version:string){
 if(!(await isAdmin('membership')))throw Error('Unauthorised');
 if(!uuid(id))return 'invalid';await enrolmentReady();
 return db().begin(async sql=>{
  const apps=await sql`SELECT * FROM club_applications WHERE id=${id} FOR UPDATE`;
  const rows=await sql`SELECT * FROM club_enrolments WHERE application_id=${id} FOR UPDATE`;
  const row=rows[0];if(!apps[0]||!row||row.stage==='active'||(row.proof_version||'')!==version)return 'changed';
  const token=randomBytes(32).toString('hex');
  await sql`UPDATE club_enrolments SET stage='awaiting_payment',token_hash=${renewalHash(token)},token_encrypted=${sealRenewal(token)},expires_at=now()+interval '30 days',updated_at=now() WHERE application_id=${id}`;
  // Superseded links must not be retried after a replacement invitation.
  await sql`UPDATE club_enrolment_mail SET status='superseded' WHERE application_id=${id} AND kind='invitation' AND status IN ('queued','failed','unknown')`;
  await queue(sql,id,'invitation',renewalHash(token),invitation(unseal(apps[0].payload),token,row.membership_year,savedFee(row.fee_quote,'new')));
  return 'saved';
 });
}
export async function deliverEnrolment(id:string,allowUncertain=false,mailId?:string){
 await enrolmentReady();
 if(!uuid(id)||(mailId&&!uuid(mailId)))return;
 const rows=await db()`UPDATE club_enrolment_mail m SET status='sending',attempt_at=now() FROM club_enrolments e WHERE m.application_id=${id} AND e.application_id=m.application_id AND (${mailId||null}::uuid IS NULL OR m.id=${mailId||null}::uuid) AND (m.status IN ('queued','failed') OR (${allowUncertain} AND (m.status='unknown' OR (m.status='sending' AND m.attempt_at<now()-interval '2 minutes')))) AND ((m.kind='invitation' AND e.stage='awaiting_payment' AND m.context=e.token_hash AND e.expires_at>now()) OR (m.kind='payment_notice' AND e.stage='proof_submitted' AND m.context=e.proof_version::text) OR (m.kind='welcome' AND e.stage='active')) RETURNING m.id,m.payload`;
 for(const row of rows){
  const welcomeRows=await db()`SELECT e.member_number FROM club_enrolment_mail m JOIN club_enrolments e ON e.application_id=m.application_id WHERE m.id=${row.id} AND m.kind='welcome'`;
  if(welcomeRows[0]?.member_number){
   const members=await db()`SELECT payload FROM club_member_roster WHERE member_number=${welcomeRows[0].member_number} ORDER BY membership_year DESC LIMIT 1`;
   if(!members[0]||JSON.parse(openRenewal(members[0].payload)).deceased){
    await db()`UPDATE club_enrolment_mail SET status='skipped' WHERE id=${row.id} AND status='sending'`;
    continue;
   }
  }
  let result:{state:string;id?:string}={state:'unknown'};
  try{result=await sendClubMessage(openRenewal(row.payload));}catch{/* Ambiguous sends require manual reconciliation, never automatic retry. */}
  await db()`UPDATE club_enrolment_mail SET status=${result.state},mail_id=${result.id||null} WHERE id=${row.id} AND status='sending'`;
 }
}
