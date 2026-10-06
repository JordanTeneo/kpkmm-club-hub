import {randomUUID} from 'node:crypto';
import {db,isAdmin} from './shop';
import {rosterReady,validateRoster,nameKey,identityKey,type RosterMember} from './roster';
import {membershipReady,fingerprint} from './membership';
import {renewalsReady,renewalHash,sealRenewal,openRenewal} from './renewals';

export type ManagedMember=RosterMember & {year:number;recordYear:number;revision:string;override:boolean};
export function compareMemberNumbers(a:{memberNumber:string},b:{memberNumber:string}){
 const aSuffix=a.memberNumber.match(/-(\d+)$/)?.[1],bSuffix=b.memberNumber.match(/-(\d+)$/)?.[1];
 if(aSuffix!==undefined&&bSuffix!==undefined){
  const left=BigInt(aSuffix),right=BigInt(bSuffix);
  if(left!==right)return left<right?-1:1;
 }else if(aSuffix!==undefined)return -1;
 else if(bSuffix!==undefined)return 1;
 return a.memberNumber.localeCompare(b.memberNumber,'en');
}
export function validYear(value:unknown){const year=Number(value);if(!Number.isInteger(year)||year<2000||year>2200)throw Error('Invalid year');return year;}
export async function adminRosterReady(){
 await rosterReady();
 await db()`CREATE TABLE IF NOT EXISTS club_roster_edits(id uuid PRIMARY KEY,member_number text NOT NULL,membership_year integer NOT NULL,before_payload text NOT NULL,after_payload text NOT NULL,reason text NOT NULL,created_at timestamptz NOT NULL DEFAULT now())`;
}
export async function listMembers(year:number):Promise<ManagedMember[]>{
 validYear(year);await Promise.all([adminRosterReady(),membershipReady(),renewalsReady()]);
 const [rows,apps,renewals]=await Promise.all([
  db()`SELECT DISTINCT ON(member_number) member_number,membership_year,payload,active,status_override,updated_at::text AS revision FROM club_member_roster WHERE membership_year<=${year} ORDER BY member_number,membership_year DESC LIMIT 10001`,
  db()`SELECT identity_hash FROM club_applications WHERE status='approved' AND membership_year=${year}`,
  db()`SELECT identity_hash FROM club_renewals WHERE review_status='approved' AND renewal_year=${year}`
 ]);
 if(rows.length>10000)throw Error('Roster too large');
 const appHashes=new Set(apps.map(r=>r.identity_hash)),renewHashes=new Set(renewals.map(r=>r.identity_hash));
 return rows.map(r=>{
  const m=JSON.parse(openRenewal(r.payload)) as RosterMember;
  const key=/^\d{12}$/.test(m.identity)?'mykad:malaysia:'+m.identity:null;
  const override=r.membership_year===year&&r.status_override;
  const active=override?r.active:(r.membership_year===year&&r.active)||!!(key&&(appHashes.has(fingerprint(key))||renewHashes.has(renewalHash(key))));
  return {...m,memberNumber:r.member_number,active,year,recordYear:r.membership_year,revision:r.revision,override};
 }).sort(compareMemberNumbers);
}
export function editedMember(form:FormData){
 const memberNumber=String(form.get('memberNumber')||''),year=validYear(form.get('year')),status=String(form.get('status')||'');
 if(!['active','inactive'].includes(status))throw Error('Invalid status');
 const text=(k:string)=>String(form.get(k)||'').trim();
 const member=validateRoster({year,source:'Admin edit',members:[{memberNumber,name:text('name'),active:status==='active',identity:text('identity'),phone:text('phone'),email:text('email'),address:text('address'),sourceRow:2}]}).members[0];
 if(member.email&&!/^\S+@\S+\.\S+$/.test(member.email))throw Error('Invalid email');
 const reason=text('reason');if(reason.length<3||reason.length>500)throw Error('Reason required');
 const revision=text('revision');if(!revision||revision.length>100)throw Error('Invalid revision');
 return {member,year,reason,revision};
}
export async function saveMember(form:FormData){
 if(!(await isAdmin()))throw Error('Unauthorised');
 const {member,year,reason,revision}=editedMember(form);await adminRosterReady();
 return db().begin(async sql=>{
  await sql`SELECT pg_advisory_xact_lock(hashtext(${member.memberNumber}))`;
  const rows=await sql`SELECT payload,active,membership_year,status_override,updated_at::text AS revision FROM club_member_roster WHERE member_number=${member.memberNumber} AND membership_year<=${year} ORDER BY membership_year DESC LIMIT 1 FOR UPDATE`;
  if(!rows[0]||rows[0].revision!==revision)return 'conflict';
  const previous=JSON.parse(openRenewal(rows[0].payload));
  // Number is a lookup key, never regenerated when address or status changes.
  const updated={...member,sourceRow:previous.sourceRow};
  const payload=sealRenewal(JSON.stringify(updated));
  await sql`INSERT INTO club_roster_edits(id,member_number,membership_year,before_payload,after_payload,reason) VALUES(${randomUUID()},${member.memberNumber},${year},${sealRenewal(JSON.stringify(rows[0]))},${payload},${sealRenewal(reason)})`;
  await sql`INSERT INTO club_member_roster(member_number,membership_year,name_hash,identity_hash,payload,active,status_override) VALUES(${member.memberNumber},${year},${nameKey(member.name)},${identityKey(member.identity)},${payload},${member.active},true) ON CONFLICT(member_number,membership_year) DO UPDATE SET name_hash=excluded.name_hash,identity_hash=excluded.identity_hash,payload=excluded.payload,active=excluded.active,status_override=true,updated_at=now()`;
  return 'saved';
 });
}
