import {randomBytes,randomUUID} from 'node:crypto';
import {db} from './shop';
import {rosterReady} from './roster';
import {renewalsReady,openRenewal,sendClubMessage} from './renewals';
import {enrolmentMessage} from './enrolment';
export function malaysiaDay(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function reminderYear(day:string){const [y,m,d]=day.split('-').map(Number);return m===12&&d>=15?y+1:y;}
export function monthDue(last:string,day:string){
 const [y,m,d]=last.slice(0,10).split('-').map(Number),next=new Date(Date.UTC(y,m,1));
 const lastDay=new Date(Date.UTC(next.getUTCFullYear(),next.getUTCMonth()+1,0)).getUTCDate();
 next.setUTCDate(Math.min(d,lastDay));return day>=next.toISOString().slice(0,10);
}
export async function remindersReady(){
 await Promise.all([rosterReady(),renewalsReady()]);
 await db()`CREATE TABLE IF NOT EXISTS club_reminder_settings(id integer PRIMARY KEY CHECK(id=1),paused boolean NOT NULL DEFAULT true,start_date date NOT NULL DEFAULT '2026-12-15')`;
 await db()`INSERT INTO club_reminder_settings(id) VALUES(1) ON CONFLICT DO NOTHING`;
 await db()`CREATE TABLE IF NOT EXISTS club_reminder_preferences(member_number text PRIMARY KEY,opt_out boolean NOT NULL DEFAULT false,undeliverable boolean NOT NULL DEFAULT false,token text UNIQUE NOT NULL)`;
 await db()`CREATE TABLE IF NOT EXISTS club_reminder_mail(id uuid PRIMARY KEY,member_number text NOT NULL,target_year integer NOT NULL,attempt_day date NOT NULL,status text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(member_number,attempt_day))`;
}
function eligible(rows:any[],number:string,target:number,pending:any[]){
 const person=rows.find(r=>r.member_number===number);if(!person)return null;
 const member=JSON.parse(openRenewal(person.payload));
 if(member.deceased||member.lifetimeSince<=target||!member.email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(member.email))return null;
 if(rows.some(r=>r.member_number===number&&r.membership_year===target&&r.active))return null;
 if(!rows.some(r=>r.member_number===number&&r.membership_year===target-1&&r.active))return null;
 if(pending.some(r=>r.renewal_year===target&&(r.identity_hash===person.identity_hash||JSON.parse(openRenewal(r.payload)).rosterMemberNumber===number)))return null;
 return member;
}
export async function runReminders(now=new Date()){
 await remindersReady();const day=malaysiaDay(now),target=reminderYear(day);let attempted=0;
 // Claim one message at a time under a global database lock. A sending/unknown
 // attempt consumes the daily allowance even if Gmail never confirms delivery.
 for(let slot=0;slot<20;slot++){
  const claim=await db().begin(async sql=>{
   await sql`SELECT pg_advisory_xact_lock(hashtext('kpkmm-reminder-daily'))`;
   const settings=await sql`SELECT paused,start_date::text FROM club_reminder_settings WHERE id=1`;
   if(settings[0].paused||day<settings[0].start_date)return null;
   const count=await sql`SELECT count(*)::integer AS count FROM club_reminder_mail WHERE attempt_day=${day}::date`;
   if(count[0].count>=20)return null;
   await sql`LOCK TABLE club_member_roster IN SHARE MODE`;
   const [rows,pending,prefs,history]=await Promise.all([
    sql`SELECT member_number,membership_year,payload,identity_hash,active FROM club_member_roster ORDER BY membership_year DESC`,
    sql`SELECT identity_hash,payload,renewal_year FROM club_renewals WHERE review_status IN ('pending','approved') AND renewal_year=${target}`,
    sql`SELECT * FROM club_reminder_preferences`,
    sql`SELECT member_number,max(attempt_day)::text AS last_day,bool_or(status IN ('sending','unknown')) AS uncertain FROM club_reminder_mail GROUP BY member_number`
   ]);
   const candidates=[...new Set(rows.map(r=>String(r.member_number)))].sort((a,b)=>(history.find(h=>h.member_number===a)?.last_day||'').localeCompare(history.find(h=>h.member_number===b)?.last_day||'')||a.localeCompare(b));
   for(const number of candidates){
    const pref=prefs.find(p=>p.member_number===number),last=history.find(h=>h.member_number===number)?.last_day;
    if(pref?.opt_out||pref?.undeliverable||history.find(h=>h.member_number===number)?.uncertain||last&&!monthDue(last,day))continue;
    const member=eligible(rows,number,target,pending);if(!member)continue;
    const token=pref?.token||randomBytes(32).toString('hex');
    await sql`INSERT INTO club_reminder_preferences(member_number,token) VALUES(${number},${token}) ON CONFLICT DO NOTHING`;
    const id=randomUUID();await sql`INSERT INTO club_reminder_mail(id,member_number,target_year,attempt_day,status) VALUES(${id},${number},${target},${day}::date,'sending')`;
    return {id,number,member,token};
   }
   return null;
  });
  if(!claim)break;
  let status='unknown';
  try{
   status=await db().begin(async sql=>{
    await sql`LOCK TABLE club_member_roster IN SHARE MODE`;
    const setting=await sql`SELECT paused FROM club_reminder_settings WHERE id=1 FOR SHARE`;
    const pref=await sql`SELECT opt_out,undeliverable FROM club_reminder_preferences WHERE member_number=${claim.number} FOR UPDATE`;
    const rows=await sql`SELECT member_number,membership_year,payload,identity_hash,active FROM club_member_roster WHERE member_number=${claim.number} ORDER BY membership_year DESC`;
    const pending=await sql`SELECT identity_hash,payload,renewal_year FROM club_renewals WHERE review_status IN ('pending','approved') AND renewal_year=${target}`;
    const member=eligible(rows,claim.number,target,pending);
    if(setting[0].paused||pref[0]?.opt_out||pref[0]?.undeliverable||!member)return 'skipped';
    const raw=enrolmentMessage(member.email,'KPKMM — membership renewal reminder / Peringatan pembaharuan',`Dear / Salam ${member.name},\n\nYou are eligible to renew your KPKMM membership for ${target}. The annual fee is RM150. If you have already paid, please contact the committee before paying again.\nAnda layak memperbaharui keahlian KPKMM untuk ${target}. Yuran tahunan ialah RM150. Jika sudah membayar, hubungi jawatankuasa sebelum membayar lagi.\n\nRenew / Perbaharui: https://kpkmm-club-hub.vercel.app/renew\n\nSmall Cars, Big Spirit!\nKPKMM Committee / Jawatankuasa KPKMM\n\nStop renewal reminders (membership is unaffected) / Hentikan peringatan (keahlian tidak terjejas):\nhttps://kpkmm-club-hub.vercel.app/reminder-preferences/${claim.token}`);
    return (await sendClubMessage(raw)).state;
   });
  }catch{}
  await db()`UPDATE club_reminder_mail SET status=${status} WHERE id=${claim.id}`;attempted++;
 }
 return {attempted,day,target};
}
