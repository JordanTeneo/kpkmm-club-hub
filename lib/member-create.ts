import {randomUUID} from 'node:crypto';
import {db,isAdmin} from './shop';
import {validateApplicant} from './membership';
import {adminRosterReady,validYear} from './member-admin';
import {nameKey} from './roster';
import {renewalHash,sealRenewal} from './renewals';
export const memberPrefixes:Record<string,string>={'perak':'A','selangor':'B','johor':'J','kedah':'K','kelantan':'D','melaka':'M','negeri sembilan':'N','pahang':'C','pulau pinang':'P','penang':'P','perlis':'R','terengganu':'T','kuala lumpur':'W','putrajaya':'F','labuan':'L'};
export function nextMemberNumber(numbers:string[],prefix:string,year:number){
 let max=BigInt(0);for(const number of numbers){const suffix=number.match(/-(\d+)$/)?.[1];if(suffix&&BigInt(suffix)>max)max=BigInt(suffix);}
 if(max>=BigInt('9999999999'))throw Error('Number range exhausted');
 return prefix+'-'+String(year).slice(-2)+'-'+String(max+BigInt(1)).padStart(3,'0');
}
export async function createMember(form:FormData){
 if(!(await isAdmin()))throw Error('Unauthorised');
 const details=validateApplicant(form,true),year=validYear(form.get('year'));
 const status=String(form.get('status')||''),reason=String(form.get('reason')||'').trim();
 if(!['active','inactive'].includes(status)||reason.length<3||reason.length>500)throw Error('Invalid details');
 const prefix=memberPrefixes[details.state!.toLowerCase()];
 if(details.mailingCountry!.toLowerCase()!=='malaysia'||!prefix)return {error:'The club has not configured an ID prefix for this state/country. Contact the committee; do not use an incorrect address. / Awalan nombor ahli bagi negeri/negara ini belum ditetapkan.'};
 const hash=renewalHash(details.identityType+':'+details.country.toLowerCase()+':'+details.identity);
 await adminRosterReady();
 return db().begin(async sql=>{
  await sql`LOCK TABLE club_member_roster IN SHARE ROW EXCLUSIVE MODE`;
  const duplicate=await sql`SELECT member_number FROM club_member_roster WHERE identity_hash=${hash} LIMIT 1`;
  if(duplicate.length)return {error:'This identification number already belongs to a member. Edit or reinstate the existing member instead. / Nombor pengenalan ini telah didaftarkan.'};
  const numbers=await sql`SELECT member_number AS number FROM club_member_roster UNION SELECT old_number AS number FROM club_member_id_history UNION SELECT new_number AS number FROM club_member_id_history`;
  const memberNumber=nextMemberNumber(numbers.map(r=>String(r.number)),prefix,year);
  const member={...details,memberNumber,active:status==='active',sourceRow:2};
  const payload=sealRenewal(JSON.stringify(member));
  await sql`INSERT INTO club_member_roster(member_number,membership_year,name_hash,identity_hash,payload,active,status_override) VALUES(${memberNumber},${year},${nameKey(details.name)},${hash},${payload},${member.active},true)`;
  await sql`INSERT INTO club_roster_edits(id,member_number,membership_year,before_payload,after_payload,reason) VALUES(${randomUUID()},${memberNumber},${year},${sealRenewal('null')},${payload},${sealRenewal('Admin added member: '+reason)})`;
  return {memberNumber};
 });
}
