import {annualStatus,type AnnualStatus} from './annual-status';
import {randomUUID} from 'node:crypto';
import {db,isAdmin} from './shop';
import {rosterReady,validateRoster,nameKey,identityKey,type RosterMember} from './roster';
import {membershipReady,fingerprint} from './membership';
import {renewalsReady,renewalHash,sealRenewal,openRenewal} from './renewals';

export type ManagedMember=RosterMember & {year:number;recordYear:number;revision:string;override:boolean;annualStatus:AnnualStatus};
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
let ready:Promise<void>|undefined;
export async function adminRosterReady(){
 if(!ready)ready=(async()=>{
 await rosterReady();
 await db()`CREATE TABLE IF NOT EXISTS club_roster_edits(id uuid PRIMARY KEY,member_number text NOT NULL,membership_year integer NOT NULL,before_payload text NOT NULL,after_payload text NOT NULL,reason text NOT NULL,created_at timestamptz NOT NULL DEFAULT now())`;
 })().catch(error=>{ready=undefined;throw error;});
 await ready;
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
  const key=m.identityType==='passport'?'passport:'+(m.country||'Malaysia').toLowerCase()+':'+m.identity:/^\d{12}$/.test(m.identity)?'mykad:malaysia:'+m.identity:null;
  const override=r.membership_year===year&&r.status_override;
  const lifetime=Number.isInteger(m.lifetimeSince)&&m.lifetimeSince!<=year;
  const active=lifetime||(override?r.active:(r.membership_year===year&&r.active)||!!(key&&(appHashes.has(fingerprint(key))||renewHashes.has(renewalHash(key)))));
  return {...m,memberNumber:r.member_number,active:active&&!m.deceased,annualStatus:annualStatus({...m,active},year),year,recordYear:r.membership_year,revision:r.revision,override};
 }).sort(compareMemberNumbers);
}
export function editedMember(form:FormData){
 const memberNumber=String(form.get('memberNumber')||''),year=validYear(form.get('year'));
 const text=(k:string)=>String(form.get(k)||'').trim();
 const member=validateRoster({year,source:'Admin edit',members:[{memberNumber,name:text('name'),active:false,identity:text('identity'),phone:text('phone'),email:text('email'),address:[text('address'),[text('postcode'),text('state')].filter(Boolean).join(' '),text('mailingCountry')].filter(Boolean).join('\n'),...(form.has('postcode')?{addressLine:text('address'),postcode:text('postcode'),state:text('state'),mailingCountry:text('mailingCountry')}:{}),sourceRow:2}]}).members[0];
 if(member.email&&!/^\S+@\S+\.\S+$/.test(member.email))throw Error('Invalid email');
 const reason=text('reason');if(reason.length<3||reason.length>500)throw Error('Reason required');
 const revision=text('revision');if(!revision||revision.length>100)throw Error('Invalid revision');
 return {member,year,reason,revision};
}
export async function saveMember(form:FormData){
 if(!(await isAdmin('membership')))throw Error('Unauthorised');
 const {member,year,reason,revision}=editedMember(form);
 const corrected=String(form.get('correctedMemberNumber')||member.memberNumber).trim().toUpperCase();
 const changing=corrected!==member.memberNumber;
 if(changing && (!/^[ABJKDMNCPRTWFL]-\d{2}-\d{3,10}$/.test(corrected)||/^-?0+$/.test(corrected.split('-')[2])))return 'invalid-id';
 if(changing && form.get('confirmIdCorrection')!=='yes')return 'confirm-id';
 await adminRosterReady();await membershipReady();await renewalsReady();
 return db().begin(async sql=>{
  // Serialize corrections, regular edits and imports so an ID cannot split across years.
  await sql`LOCK TABLE club_member_roster IN SHARE ROW EXCLUSIVE MODE`;
  await sql`SELECT pg_advisory_xact_lock(hashtext(${member.memberNumber}))`;
  const rows=await sql`SELECT payload,active,membership_year,status_override,updated_at::text AS revision FROM club_member_roster WHERE member_number=${member.memberNumber} AND membership_year<=${year} ORDER BY membership_year DESC LIMIT 1 FOR UPDATE`;
  if(!rows[0]||rows[0].revision!==revision)return 'conflict';
  const previous=JSON.parse(openRenewal(rows[0].payload));
  if(changing){
   const suffix=corrected.split('-')[2].replace(/^0+/,'');
   const duplicate=await sql`SELECT member_number FROM club_member_roster WHERE member_number<>${member.memberNumber} AND (upper(member_number)=${corrected} OR ltrim(substring(member_number from '-([0-9]+)$'),'0')=${suffix}) LIMIT 1`;
   const retired=await sql`SELECT old_number FROM club_member_id_history WHERE upper(old_number)=${corrected} LIMIT 1`;
   if(duplicate.length||retired.length)return 'duplicate-id';
   const allYears=await sql`SELECT membership_year,payload FROM club_member_roster WHERE member_number=${member.memberNumber} FOR UPDATE`;
   for(const record of allYears){
    const correctedPayload=sealRenewal(JSON.stringify({...JSON.parse(openRenewal(record.payload)),memberNumber:corrected}));
    await sql`UPDATE club_member_roster SET member_number=${corrected},payload=${correctedPayload},updated_at=now() WHERE member_number=${member.memberNumber} AND membership_year=${record.membership_year}`;
   }
   await sql`INSERT INTO club_member_id_history(old_number,new_number) VALUES(${member.memberNumber},${corrected})`;
   await sql`UPDATE club_roster_edits SET member_number=${corrected} WHERE member_number=${member.memberNumber}`;
  }
  const identity=previous.identityType==='passport'?'passport:'+(previous.country||'Malaysia').toLowerCase()+':'+previous.identity:/^\d{12}$/.test(previous.identity||'')?'mykad:malaysia:'+previous.identity:null;
  const apps=identity?await sql`SELECT 1 FROM club_applications WHERE identity_hash=${fingerprint(identity)} AND status='approved' AND membership_year=${year} LIMIT 1`:[];
  const renewals=identity?await sql`SELECT 1 FROM club_renewals WHERE identity_hash=${renewalHash(identity)} AND review_status='approved' AND renewal_year=${year} LIMIT 1`:[];
  const active=rows[0].membership_year===year&&rows[0].status_override?rows[0].active:!!((rows[0].membership_year===year&&rows[0].active)||apps.length||renewals.length);
  // Ignore any submitted status, including forms opened before this release.
  const updated={...previous,...member,active,memberNumber:corrected,sourceRow:previous.sourceRow};
  if(form.has('vehicles')){const text=String(form.get('vehicles')||'');if(text.length>2000)throw Error('Too many vehicle numbers');updated.vehicles=[...new Set(text.split(/[,\n\r]+/).map(v=>v.trim().toUpperCase()).filter(Boolean))];if(updated.vehicles.length>30||updated.vehicles.some((v:string)=>v.length>80))throw Error('Invalid vehicle numbers');}
  if(previous.identityType==='passport')updated.identity=String(form.get('identity')||'').trim().toUpperCase();
  const payload=sealRenewal(JSON.stringify(updated));
  await sql`INSERT INTO club_roster_edits(id,member_number,membership_year,before_payload,after_payload,reason) VALUES(${randomUUID()},${corrected},${year},${sealRenewal(JSON.stringify({...rows[0],memberNumber:member.memberNumber}))},${payload},${sealRenewal(changing?'ID correction '+member.memberNumber+' → '+corrected+': '+reason:reason)})`;
  await sql`INSERT INTO club_member_roster(member_number,membership_year,name_hash,identity_hash,payload,active,status_override) VALUES(${corrected},${year},${nameKey(member.name)},${identityKey(updated.identity,updated.identityType,updated.country)},${payload},${active},true) ON CONFLICT(member_number,membership_year) DO UPDATE SET name_hash=excluded.name_hash,identity_hash=excluded.identity_hash,payload=excluded.payload,active=excluded.active,status_override=true,updated_at=now()`;
  return 'saved';
 });
}
