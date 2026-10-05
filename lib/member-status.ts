import {db} from './shop';
import {membershipReady,fingerprint,unseal,type Applicant} from './membership';
import {renewalsReady,renewalHash,openRenewal} from './renewals';
export type MembershipStatus={status:'active'|'expired'|'pending'|'future'|'verification'|'inactive'|'unmatched';year?:number;pending?:boolean};
export type StatusRecord={status:string;year:number|null};
export function malaysiaYear(now=new Date()){return Number(new Intl.DateTimeFormat('en',{year:'numeric',timeZone:'Asia/Kuala_Lumpur'}).format(now));}
export function calculateStatus(records:StatusRecord[],now=new Date()):MembershipStatus{
 if(!records.length)return {status:'unmatched'};
 const current=malaysiaYear(now),pending=records.some(r=>r.status==='pending');
 const years=records.filter(r=>r.status==='approved'&&Number.isInteger(r.year)&&r.year!>=2000&&r.year!<=2200).map(r=>r.year!);
 if(years.includes(current))return {status:'active',year:current,pending};
 const past=years.filter(y=>y<current);
 if(past.length)return {status:'expired',year:Math.max(...past),pending};
 const future=years.filter(y=>y>current);
 if(future.length)return {status:'future',year:Math.min(...future),pending};
 if(records.some(r=>r.status==='approved'&&r.year===null))return {status:'verification',pending};
 return {status:pending?'pending':'inactive'};
}
export function validateLookup(form:FormData){
 const email=String(form.get('email')||'').trim().toLowerCase();
 const type=String(form.get('identityType')||'');
 let identity=String(form.get('identity')||'').trim().toUpperCase();
 const country=type==='mykad'?'Malaysia':String(form.get('country')||'').trim();
 if(type==='mykad')identity=identity.replace(/[- ]/g,'');
 if(email.length>254||!/^\S+@\S+\.\S+$/.test(email)||!['mykad','passport'].includes(type)||!country||country.length>80||(type==='mykad'?!/^\d{12}$/.test(identity):!/^[A-Z0-9-]{5,20}$/.test(identity)))throw Error('Invalid details');
 return {email,identityKey:type+':'+country.toLowerCase()+':'+identity};
}
export async function lookupMembership(email:string,identityKey:string){
 await Promise.all([membershipReady(),renewalsReady()]);
 const [applications,renewals]=await Promise.all([
  db()`SELECT payload,status,membership_year FROM club_applications WHERE identity_hash=${fingerprint(identityKey)}`,
  db()`SELECT payload,review_status,renewal_year FROM club_renewals WHERE identity_hash=${renewalHash(identityKey)} ORDER BY renewal_year DESC LIMIT 100`
 ]);
 const records:StatusRecord[]=[];
 for(const row of applications){const p=unseal(row.payload);if(p.email.toLowerCase()===email)records.push({status:row.status,year:row.membership_year});}
 for(const row of renewals){const p=JSON.parse(openRenewal(row.payload)) as Applicant;if(p.email.toLowerCase()===email)records.push({status:row.review_status,year:row.renewal_year});}
 return calculateStatus(records);
}
