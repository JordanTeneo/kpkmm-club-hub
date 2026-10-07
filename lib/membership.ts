import {createCipheriv,createDecipheriv,createHmac,hkdfSync,randomBytes} from 'node:crypto';
import {db} from './shop';
export type Applicant={name:string;email:string;phone:string;identityType:'mykad'|'passport';identity:string;country:string;address:string;addressLine?:string;postcode?:string;state?:string;mailingCountry?:string;vehicles?:string[]};
export function validateApplicant(form:FormData,structuredAddress=false):Applicant{
 const read=(key:string,max:number)=>{const value=String(form.get(key)||'').trim();if(!value||value.length>max)throw Error('invalid');return value;};
 const name=read('name',150),email=read('email',254).toLowerCase(),phone=read('phone',30),identityType=read('identityType',10),country=read('country',80),address=read('address',1000);
 let identity=read('identity',30).toUpperCase();
 if(identityType==='mykad')identity=identity.replace(/[- ]/g,'');
 if(!['mykad','passport'].includes(identityType)||name.length<2||!/^\S+@\S+\.\S+$/.test(email)||!/^[+\d ()-]{7,30}$/.test(phone)||phone.replace(/\D/g,'').length<7||address.length<10)throw Error('invalid');
 if(identityType==='mykad'&&!/^\d{12}$/.test(identity)||identityType==='passport'&&!/^[A-Z0-9-]{5,20}$/.test(identity))throw Error('invalid');
 let mailing:Pick<Applicant,'addressLine'|'postcode'|'state'|'mailingCountry'>={};
 let fullAddress=address;
 if(structuredAddress){
  const postcode=read('postcode',20),state=read('state',100),mailingCountry=read('mailingCountry',80);
  if(mailingCountry.toLowerCase()==='malaysia'&&!/^\d{5}$/.test(postcode))throw Error('invalid postcode');
  mailing={addressLine:address,postcode,state,mailingCountry};
  fullAddress=[address,postcode+' '+state,mailingCountry].join('\n');
 }
 const vehicleText=String(form.get('vehicles')||'');
 if(vehicleText.length>2000)throw Error('invalid vehicles');
 const vehicles=[...new Set(vehicleText.split(/[,\n\r]+/).map(v=>v.trim().toUpperCase()).filter(Boolean))];
 if(vehicles.length>30||vehicles.some(v=>v.length>80||/[\u0000-\u001f\u007f]/.test(v)))throw Error('invalid vehicles');
 return {vehicles,name,email,phone,identityType:identityType as Applicant['identityType'],identity,country:identityType==='mykad'?'Malaysia':country,address:fullAddress,...mailing};
}
function useV2(){return !process.env.ADMIN_SESSION_SECRET||process.env.ADMIN_SESSION_SECRET.length<24;}
function key(v2=useV2()){const secret=v2?process.env.GMAIL_ENCRYPTION_KEY:process.env.ADMIN_SESSION_SECRET;if(!secret||secret.length<(v2?32:24))throw Error('Secure storage unavailable');return Buffer.from(hkdfSync('sha256',secret,v2?'kpkmm-membership-v2':'kpkmm-membership-v1','encrypted-applications',32));}
export function fingerprint(value:string){return createHmac('sha256',key()).update(value).digest('hex');}
export function seal(applicant:Applicant){const v2=useV2(),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(v2),iv);const encrypted=Buffer.concat([cipher.update(JSON.stringify(applicant),'utf8'),cipher.final()]);return (v2?'v2.':'')+[iv,cipher.getAuthTag(),encrypted].map(b=>b.toString('base64')).join('.');}
export function unseal(value:string):Applicant{const v2=value.startsWith('v2.');const [iv,tag,data]=(v2?value.slice(3):value).split('.').map(s=>Buffer.from(s,'base64'));const decipher=createDecipheriv('aes-256-gcm',key(v2),iv);decipher.setAuthTag(tag);return JSON.parse(Buffer.concat([decipher.update(data),decipher.final()]).toString('utf8'));}
let ready:Promise<void>|undefined;
export async function membershipReady(){
 key();
 if(process.env.KPKMM_SCHEMA_VERSION==='performance-v1')return;
 if(!ready)ready=(async()=>{
  await db()`CREATE TABLE IF NOT EXISTS club_applications(id uuid PRIMARY KEY, identity_hash text UNIQUE NOT NULL, payload text NOT NULL,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),consent_version text NOT NULL DEFAULT '2026-10-05',created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now())`;
  await db()`ALTER TABLE club_applications ADD COLUMN IF NOT EXISTS membership_year integer CHECK(membership_year BETWEEN 2000 AND 2200)`;
  await db()`ALTER TABLE club_applications ADD COLUMN IF NOT EXISTS name_hash text`;
  await db()`CREATE INDEX IF NOT EXISTS club_applications_name ON club_applications(name_hash)`;
  await db()`CREATE TABLE IF NOT EXISTS membership_limits(key text PRIMARY KEY,count integer NOT NULL,expires_at timestamptz NOT NULL)`;
 })().catch(error=>{ready=undefined;throw error;});
 await ready;
}
export async function applicationLimit(key:string){const result=await db()`INSERT INTO membership_limits(key,count,expires_at) VALUES(${key},1,now()+interval '1 hour') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN membership_limits.expires_at<now() THEN 1 ELSE membership_limits.count+1 END,expires_at=CASE WHEN membership_limits.expires_at<now() THEN now()+interval '1 hour' ELSE membership_limits.expires_at END RETURNING count`;return result[0].count<=5;}
