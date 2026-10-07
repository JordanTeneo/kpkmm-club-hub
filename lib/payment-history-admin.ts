import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {db,isAdmin} from './shop';
import {committeeEnabled,committeeSession} from './committee-access';
import {adminRosterReady,validYear} from './member-admin';
import {openRenewal,sealRenewal} from './renewals';
export async function historyOwner(){
 if(await committeeEnabled()){const s=await committeeSession();return s?.superAdmin?s.user.id:null;}
 return await isAdmin()?'legacy-owner':null;
}
export function historyRevision(rows:any[]){return createHash('sha256').update(JSON.stringify(rows.map(r=>[r.membership_year,r.payload,r.active,r.status_override]))).digest('hex');}
export async function memberPaymentHistory(member:string){
 if(!await historyOwner())throw Error('access');
 if(!/^[A-Z]-\d{2}-\d{3,10}$/.test(member))throw Error('invalid');
 await adminRosterReady();
 const rows=await db()`SELECT membership_year,payload,active,status_override FROM club_member_roster WHERE member_number=${member} ORDER BY membership_year DESC`;
 if(!rows.length)throw Error('missing');
 const latest=JSON.parse(openRenewal(rows[0].payload));
 return {name:String(latest.name),revision:historyRevision(rows),history:latest.paymentHistory||[],years:rows.map(r=>({year:r.membership_year,active:r.active}))};
}
export async function correctPaymentHistory(form:FormData){
 const actor=await historyOwner();if(!actor)throw Error('access');
 const member=String(form.get('member')||''),year=validYear(form.get('year')),status=String(form.get('status')||''),reason=String(form.get('reason')||'').trim();
 const current=Number(new Intl.DateTimeFormat('en',{timeZone:'Asia/Kuala_Lumpur',year:'numeric'}).format(new Date()));
 if(!/^[A-Z]-\d{2}-\d{3,10}$/.test(member)||year>=current||!['paid','new','sponsored','inactive'].includes(status)||reason.length<10||reason.length>500||form.get('confirmed')!=='yes')throw Error('invalid');
 await adminRosterReady();
 return db().begin(async sql=>{
  await sql`LOCK TABLE club_member_roster IN SHARE ROW EXCLUSIVE MODE`;
  const rows=await sql`SELECT membership_year,payload,active,status_override,name_hash,identity_hash FROM club_member_roster WHERE member_number=${member} ORDER BY membership_year DESC FOR UPDATE`;
  if(!rows.length)throw Error('missing');
  if(historyRevision(rows)!==String(form.get('revision')))throw Error('stale');
  const target=rows.find(r=>r.membership_year===year);
  if(!target)throw Error('missing-year');
  const old=JSON.parse(openRenewal(target.payload));
  if(old.lifetimeSince&&old.lifetimeSince<=year)throw Error('lifetime');
  const entry={year,status,note:reason,manualCorrection:true,correctedAt:new Date().toISOString()};
  for(const row of rows){
   const previous=JSON.parse(openRenewal(row.payload));
   const paymentHistory=[...(previous.paymentHistory||[]).filter((h:any)=>h.year!==year),entry].sort((a,b)=>a.year-b.year);
   const active=row.membership_year===year?status!=='inactive':row.active;
   const updated={...previous,paymentHistory,...(row.membership_year===year?{active}:{})};
   const payload=sealRenewal(JSON.stringify(updated));
   await sql`INSERT INTO club_roster_edits(id,member_number,membership_year,before_payload,after_payload,reason) VALUES(${randomUUID()},${member},${row.membership_year},${sealRenewal(JSON.stringify(row))},${payload},${sealRenewal('Payment history correction for '+year+' by '+actor+': '+reason)})`;
   await sql`UPDATE club_member_roster SET payload=${payload},active=${active},status_override=${row.membership_year===year?true:row.status_override},updated_at=now() WHERE member_number=${member} AND membership_year=${row.membership_year}`;
  }
 });
}
