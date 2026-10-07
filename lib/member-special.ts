import {randomUUID} from 'node:crypto';
import {db,isAdmin} from './shop';
import {adminRosterReady} from './member-admin';
import {openRenewal,sealRenewal} from './renewals';
export async function setDeceased(form:FormData){
 if(!(await isAdmin('membership')))throw Error('Unauthorised');
 const number=String(form.get('memberNumber')||''),reason=String(form.get('reason')||'').trim(),deceased=form.get('deceased')==='yes';
 if(!/^[A-Za-z0-9-]{1,30}$/.test(number)||reason.length<3||reason.length>500||form.get('confirmed')!=='yes')return 'invalid';
 await adminRosterReady();
 return db().begin(async sql=>{
  await sql`LOCK TABLE club_member_roster IN SHARE ROW EXCLUSIVE MODE`;
  const rows=await sql`SELECT * FROM club_member_roster WHERE member_number=${number} FOR UPDATE`;
  if(!rows.length)return 'invalid';
  for(const row of rows){
   const payload=sealRenewal(JSON.stringify({...JSON.parse(openRenewal(row.payload)),deceased}));
   await sql`INSERT INTO club_roster_edits(id,member_number,membership_year,before_payload,after_payload,reason) VALUES(${randomUUID()},${number},${row.membership_year},${sealRenewal(JSON.stringify(row))},${payload},${sealRenewal((deceased?'Marked deceased: ':'Reversed deceased flag: ')+reason)})`;
   await sql`UPDATE club_member_roster SET payload=${payload},updated_at=now() WHERE member_number=${number} AND membership_year=${row.membership_year}`;
  }
  return 'saved';
 });
}
