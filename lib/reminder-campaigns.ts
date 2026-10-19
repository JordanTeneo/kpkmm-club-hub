import {randomUUID,randomBytes} from 'node:crypto';
import {db,isAdmin,uuid} from './shop';
import {paymentActor} from './membership-payments';
import {sealRenewal,openRenewal,sendClubMessage} from './renewals';
import {enrolmentMessage} from './enrolment';
import {eligible,remindersReady,malaysiaDay,monthDue} from './renewal-reminders';
import {reminderConfig,reminderText,validateReminderSettings} from './reminder-settings';

export type CampaignRecipient={number:string;name:string;email:string};
export function campaignYear(value:unknown,now=new Date()){
 const year=Number(value),current=Number(malaysiaDay(now).slice(0,4));
 if(!Number.isInteger(year)||year<current||year>current+1)throw Error('Choose current or next membership year');
 return year;
}
export async function campaignsReady(){
 await remindersReady();
 await db()`CREATE TABLE IF NOT EXISTS club_reminder_campaigns(id uuid PRIMARY KEY,target_year integer NOT NULL,status text NOT NULL CHECK(status IN ('draft','queued','completed','cancelled')),payload text NOT NULL,actor text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),confirmed_at timestamptz,cancelled_by text)`;
 await db()`CREATE UNIQUE INDEX IF NOT EXISTS club_one_reminder_campaign ON club_reminder_campaigns(target_year) WHERE status='queued'`;
 await db()`CREATE TABLE IF NOT EXISTS club_reminder_campaign_recipients(campaign_id uuid REFERENCES club_reminder_campaigns(id),member_number text NOT NULL,payload text NOT NULL,status text NOT NULL DEFAULT 'pending',attempt_id uuid,PRIMARY KEY(campaign_id,member_number))`;
}
export function campaignCandidates(rows:any[],pending:any[],prefs:any[],history:any[],year:number,day:string,months:number):CampaignRecipient[]{
 return [...new Set<string>(rows.map(r=>String(r.member_number)))].sort().flatMap(number=>{
  const pref=prefs.find(p=>p.member_number===number),last=history.find(h=>h.member_number===number);
  if(pref?.opt_out||pref?.undeliverable||last?.uncertain||last?.last_day&&!monthDue(last.last_day,day,months))return [];
  const member=eligible(rows,number,year,pending);
  return member?[{number,name:member.name,email:member.email}]:[];
 });
}
async function candidates(sql:ReturnType<typeof db>,year:number,day:string,months:number){
 const [rows,pending,prefs,history]=await Promise.all([
  sql`SELECT member_number,membership_year,payload,identity_hash,active FROM club_member_roster ORDER BY membership_year DESC`,
  sql`SELECT identity_hash,payload,renewal_year FROM club_renewals WHERE review_status IN ('pending','approved') AND renewal_year=${year}`,
  sql`SELECT * FROM club_reminder_preferences`,
  sql`SELECT member_number,max(attempt_day)::text AS last_day,bool_or(status IN ('sending','unknown')) AS uncertain FROM club_reminder_mail GROUP BY member_number`
 ]);
 return campaignCandidates(rows,pending,prefs,history,year,day,months);
}
export async function draftCampaign(form:FormData){
 if(!await isAdmin('membership'))throw Error('Unauthorised');
 const year=campaignYear(form.get('year')),day=malaysiaDay();
 const validation=new FormData();for(const [key,value] of Object.entries({startDate:day,dailyLimit:'20',intervalMonths:'1',subject:String(form.get('subject')||''),message:String(form.get('message')||'')}))validation.set(key,value);
 const {subject,message}=validateReminderSettings(validation).config;
 await campaignsReady();const actor=await paymentActor();
 return db().begin(async sql=>{
  const settings=await sql`SELECT config FROM club_reminder_settings WHERE id=1`;
  const recipients=await candidates(sql as unknown as ReturnType<typeof db>,year,day,reminderConfig(settings[0].config).intervalMonths);
  const id=randomUUID();
  await sql`INSERT INTO club_reminder_campaigns(id,target_year,status,payload,actor) VALUES(${id},${year},'draft',${sealRenewal(JSON.stringify({subject,message}))},${sealRenewal(actor)})`;
  for(const person of recipients)await sql`INSERT INTO club_reminder_campaign_recipients(campaign_id,member_number,payload) VALUES(${id},${person.number},${sealRenewal(JSON.stringify(person))})`;
  return id;
 });
}
export async function confirmCampaign(id:string,confirmed:boolean){
 if(!await isAdmin('membership'))throw Error('Unauthorised');
 if(!uuid(id)||!confirmed||(process.env.CRON_SECRET?.length||0)<32)throw Error('Check confirmation and scheduler');
 await campaignsReady();const actor=await paymentActor();
 await db().begin(async sql=>{
  await sql`SELECT pg_advisory_xact_lock(hashtext('kpkmm-reminder-daily'))`;
  const rows=await sql`SELECT target_year,status,created_at FROM club_reminder_campaigns WHERE id=${id} FOR UPDATE`;
  const campaign=rows[0];if(!campaign)throw Error('Missing campaign');
  if(campaign.status==='queued'||campaign.status==='completed')return;
  campaignYear(campaign.target_year);
  if(campaign.status!=='draft'||Date.now()-new Date(campaign.created_at).getTime()>3600000)throw Error('Preview expired');
  const recipients=await sql`SELECT member_number FROM club_reminder_campaign_recipients WHERE campaign_id=${id} LIMIT 1`;
  if(!recipients.length)throw Error('No recipients');
  await sql`UPDATE club_reminder_campaigns SET status='queued',confirmed_at=now(),actor=${sealRenewal(actor)} WHERE id=${id}`;
 });
}
export async function cancelCampaign(id:string){
 if(!await isAdmin('membership')||!uuid(id))throw Error('Unauthorised');
 await campaignsReady();const actor=await paymentActor();
 await db().begin(async sql=>{
  await sql`SELECT pg_advisory_xact_lock(hashtext('kpkmm-reminder-daily'))`;
  await sql`UPDATE club_reminder_campaigns SET status='cancelled',cancelled_by=${sealRenewal(actor)} WHERE id=${id} AND status IN ('draft','queued')`;
  await sql`UPDATE club_reminder_campaign_recipients SET status='cancelled' WHERE campaign_id=${id} AND status='pending' AND EXISTS(SELECT 1 FROM club_reminder_campaigns WHERE id=${id} AND status='cancelled')`;
 });
}
export function campaignBody(message:string,name:string,year:number,token:string){
 return `${reminderText(message,name,year)}\n\nRenew membership: https://kpkmm-club-hub.vercel.app/renew\n\nStop renewal reminders (membership is unaffected):\nhttps://kpkmm-club-hub.vercel.app/reminder-preferences/${token}`;
}
// Called only by authenticated cron. The claim lock and shared mail ledger enforce
// one combined daily allowance; an ambiguous delivery is never automatically retried.
export async function runCampaigns(now=new Date(),deadline=Date.now()+240000){
 await campaignsReady();const day=malaysiaDay(now);let attempted=0;
 for(let slot=0;slot<20&&Date.now()<deadline;slot++){
  const claim=await db().begin(async sql=>{
   await sql`SELECT pg_advisory_xact_lock(hashtext('kpkmm-reminder-daily'))`;
   const settings=await sql`SELECT config FROM club_reminder_settings WHERE id=1`,config=reminderConfig(settings[0].config);
   const count=await sql`SELECT count(*)::integer AS count FROM club_reminder_mail WHERE attempt_day=${day}::date`;
   if(count[0].count>=config.dailyLimit)return null;
   const campaigns=await sql`SELECT id,target_year,payload FROM club_reminder_campaigns WHERE status='queued' ORDER BY confirmed_at,id FOR UPDATE`;
   for(const campaign of campaigns){
    // Never send an expired year's renewal request after year-end.
    if(campaign.target_year<Number(day.slice(0,4))){await sql`UPDATE club_reminder_campaign_recipients SET status='skipped' WHERE campaign_id=${campaign.id} AND status='pending'`;}
    else {
     await sql`LOCK TABLE club_member_roster IN SHARE MODE`;
     const valid=await candidates(sql as unknown as ReturnType<typeof db>,campaign.target_year,day,config.intervalMonths);
     const queue=await sql`SELECT member_number,payload FROM club_reminder_campaign_recipients WHERE campaign_id=${campaign.id} AND status='pending' ORDER BY member_number`;
     for(const entry of queue){
      const saved=JSON.parse(openRenewal(entry.payload)) as CampaignRecipient,member=valid.find(m=>m.number===entry.member_number);
      if(!member||member.email!==saved.email){await sql`UPDATE club_reminder_campaign_recipients SET status='skipped' WHERE campaign_id=${campaign.id} AND member_number=${entry.member_number}`;continue;}
      const prefs=await sql`SELECT token FROM club_reminder_preferences WHERE member_number=${member.number}`;
      const token=prefs[0]?.token||randomBytes(32).toString('hex');
      await sql`INSERT INTO club_reminder_preferences(member_number,token) VALUES(${member.number},${token}) ON CONFLICT DO NOTHING`;
      const id=randomUUID();
      await sql`INSERT INTO club_reminder_mail(id,member_number,target_year,attempt_day,status) VALUES(${id},${member.number},${campaign.target_year},${day}::date,'sending')`;
      await sql`UPDATE club_reminder_campaign_recipients SET status='sending',attempt_id=${id} WHERE campaign_id=${campaign.id} AND member_number=${member.number}`;
      return {id,campaign:campaign.id,year:campaign.target_year,member,token,content:JSON.parse(openRenewal(campaign.payload)) as {subject:string;message:string}};
     }
    }
    await sql`UPDATE club_reminder_campaigns SET status='completed' WHERE id=${campaign.id} AND NOT EXISTS(SELECT 1 FROM club_reminder_campaign_recipients WHERE campaign_id=${campaign.id} AND status IN ('pending','sending'))`;
   }
   return null;
  });
  if(!claim)break;
  let status='unknown';
  try{status=await db().begin(async sql=>{
   const campaign=await sql`SELECT status FROM club_reminder_campaigns WHERE id=${claim.campaign} FOR SHARE`;
   await sql`LOCK TABLE club_member_roster IN SHARE MODE`;
   const rows=await sql`SELECT member_number,membership_year,payload,identity_hash,active FROM club_member_roster WHERE member_number=${claim.member.number} ORDER BY membership_year DESC`;
   const pending=await sql`SELECT identity_hash,payload,renewal_year FROM club_renewals WHERE review_status IN ('pending','approved') AND renewal_year=${claim.year}`;
   const prefs=await sql`SELECT opt_out,undeliverable FROM club_reminder_preferences WHERE member_number=${claim.member.number} FOR UPDATE`;
   const member=eligible(rows,claim.member.number,claim.year,pending);
   if(campaign[0]?.status!=='queued'||!member||member.email!==claim.member.email||prefs[0]?.opt_out||prefs[0]?.undeliverable)return 'skipped';
   return (await sendClubMessage(enrolmentMessage(member.email,reminderText(claim.content.subject,member.name,claim.year).replace(/[\r\n]/g,' '),campaignBody(claim.content.message,member.name,claim.year,claim.token)))).state;
  });}catch{}
  await db().begin(async sql=>{
   await sql`UPDATE club_reminder_mail SET status=${status} WHERE id=${claim.id}`;
   await sql`UPDATE club_reminder_campaign_recipients SET status=${status} WHERE campaign_id=${claim.campaign} AND member_number=${claim.member.number}`;
   await sql`UPDATE club_reminder_campaigns SET status='completed' WHERE id=${claim.campaign} AND status='queued' AND NOT EXISTS(SELECT 1 FROM club_reminder_campaign_recipients WHERE campaign_id=${claim.campaign} AND status IN ('pending','sending'))`;
  });attempted++;
 }
 return {attempted,day};
}
