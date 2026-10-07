import {db} from './shop';
import {membershipReady,fingerprint} from './membership';
import {renewalsReady,renewalHash} from './renewals';
import {lookupName,normalizeName,lookupMyKadRoster} from './roster';
// Keep older result names type-compatible during rolling deployments; only active/inactive are returned.
export type MembershipStatus={status:'active'|'expired'|'pending'|'future'|'verification'|'inactive'|'unmatched'|'ambiguous';year?:number;pending?:boolean;lifetime?:boolean;newMember?:boolean};
export type StatusRecord={status:string;year:number|null};
export function malaysiaYear(now=new Date()){return Number(new Intl.DateTimeFormat('en',{year:'numeric',timeZone:'Asia/Kuala_Lumpur'}).format(now));}
export function calculateStatus(records:StatusRecord[],now=new Date()):MembershipStatus{
 const year=malaysiaYear(now);
 return {status:records.some(r=>r.status==='approved'&&r.year===year)?'active':'inactive',year};
}
export function validateLookup(form:FormData){
 const name=form.get('name');
 if(typeof name==='string'){
  if(name.length>150||normalizeName(name).length<2||/[\u0000-\u001f]/u.test(name))throw Error('Invalid name');
  return {email:'',identityKey:'name:'+normalizeName(name)};
 }
 const identity=String(form.get('identity')||'').trim().replace(/[- ]/g,'');
 if(!/^\d{12}$/.test(identity))throw Error('Invalid MyKad');
 return {email:'',identityKey:'mykad:malaysia:'+identity};
}
export async function lookupMembership(identityKeyOrEmail:string,legacyIdentityKey?:string){
 const identityKey=legacyIdentityKey??identityKeyOrEmail;
 if(identityKey.startsWith('name:'))return lookupName(identityKey.slice(5),malaysiaYear());
 if(!/^mykad:malaysia:\d{12}$/.test(identityKey))throw Error('Invalid MyKad');
 await Promise.all([membershipReady(),renewalsReady()]);
 const year=malaysiaYear();
 // Only check approved current-year records. No personal payload is loaded or decrypted.
 const [applications,renewals,roster]=await Promise.all([
  db()`SELECT 1 FROM club_applications WHERE identity_hash=${fingerprint(identityKey)} AND status='approved' AND membership_year=${year} LIMIT 1`,
  db()`SELECT 1 FROM club_renewals WHERE identity_hash=${renewalHash(identityKey)} AND review_status='approved' AND renewal_year=${year} LIMIT 1`,
  lookupMyKadRoster(identityKey,year)
 ]);
 if(roster)return roster;
 return {status:applications.length||renewals.length?'active':'inactive',year} as MembershipStatus;
}
