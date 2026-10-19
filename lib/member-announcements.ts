import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {db,isAdmin,uuid,readImage} from './shop';
import {paymentActor} from './membership-payments';
import {sealRenewal,openRenewal,sendClubMessage} from './renewals';
import {enrolmentMessage} from './enrolment';
import {remindersReady,malaysiaDay} from './renewal-reminders';
import {reminderConfig,reminderText,validateReminderSettings} from './reminder-settings';

import {ecardMessage,type ECard} from './announcement-email';

export type AnnouncementRecipient={number:string;name:string;email:string};
export function campaignYear(value:unknown,now=new Date()){
 const year=Number(value),current=Number(malaysiaDay(now).slice(0,4));
 if(!Number.isInteger(year)||year<2026||year>current+1)throw Error('Choose a membership year from 2026 to next year');
 return year;
}
export async function announcementsReady(){
 await remindersReady();
 await db()`CREATE TABLE IF NOT EXISTS club_announcement_preferences(member_number text PRIMARY KEY,opt_out boolean NOT NULL DEFAULT false,undeliverable boolean NOT NULL DEFAULT false,token text UNIQUE NOT NULL)`;
 await db()`CREATE TABLE IF NOT EXISTS club_announcement_campaigns(id uuid PRIMARY KEY,target_year integer NOT NULL,status text NOT NULL CHECK(status IN ('draft','queued','completed','cancelled')),payload text NOT NULL,actor text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),confirmed_at timestamptz,cancelled_by text)`;
 await db()`CREATE TABLE IF NOT EXISTS club_announcement_campaign_recipients(campaign_id uuid REFERENCES club_announcement_campaigns(id),member_number text NOT NULL,payload text NOT NULL,status text NOT NULL DEFAULT 'pending',attempt_id uuid,PRIMARY KEY(campaign_id,member_number))`;
}
export function announcementCandidates(rows:any[],prefs:any[],year:number,audience:string):AnnouncementRecipient[]{
 const seen=new Set<string>();
 return [...new Set<string>(rows.map(r=>String(r.member_number)))].sort().flatMap(number=>{
  const entries=rows.filter(r=>r.member_number===number).sort((a,b)=>b.membership_year-a.membership_year);
  const member=JSON.parse(openRenewal(entries[0].payload)),pref=prefs.find(p=>p.member_number===number);
  const email=String(member.email||'').trim().toLowerCase();
  if(member.deceased||pref?.opt_out||pref?.undeliverable||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||seen.has(email))return [];
  if(audience!=='all'&&!entries.some(r=>r.membership_year===year&&r.active)&&!(Number.isInteger(member.lifetimeSince)&&member.lifetimeSince<=year))return [];
  seen.add(email);return [{number,name:member.name,email}];
 });
}
async function candidates(sql:ReturnType<typeof db>,year:number,audience:string){
 const [rows,prefs,blocked]=await Promise.all([
  sql`SELECT member_number,membership_year,payload,active FROM club_member_roster ORDER BY membership_year DESC`,
  sql`SELECT * FROM club_announcement_preferences`,
  sql`SELECT member_number FROM club_reminder_preferences WHERE undeliverable=true`
 ]);
 return announcementCandidates(rows,prefs.map(p=>({...p,undeliverable:p.undeliverable||blocked.some(b=>b.member_number===p.member_number)})).concat(blocked.filter(b=>!prefs.some(p=>p.member_number===b.member_number)).map(b=>({...b,undeliverable:true}))),year,audience);
}
export async function draftAnnouncement(form:FormData){
 if(!await isAdmin('membership'))throw Error('Unauthorised');
 const year=campaignYear(form.get('year')),day=malaysiaDay(),audience=String(form.get('audience')||'');
 if(!['all','active'].includes(audience))throw Error('Choose audience');
 const upload=form.get('ecard');let card:ECard|undefined;
 if(upload&&typeof upload!=='string'&&upload.size){const image=await readImage(upload);card={type:image.type,data:image.bytes.toString('base64')};}
 const supplied=String(form.get('message')||'').trim();
 const validation=new FormData();for(const [key,value] of Object.entries({startDate:day,dailyLimit:'20',intervalMonths:'1',subject:String(form.get('subject')||''),message:supplied||(card?'Greetings from KPKMM.':'')}))validation.set(key,value);
 const {subject,message}=validateReminderSettings(validation).config;
 await announcementsReady();const actor=await paymentActor();
 return db().begin(async sql=>{
  const recipients=await candidates(sql as unknown as ReturnType<typeof db>,year,audience);
  const id=randomUUID();
  await sql`INSERT INTO club_announcement_campaigns(id,target_year,status,payload,actor) VALUES(${id},${year},'draft',${sealRenewal(JSON.stringify({subject,message,audience,...(card?{card}:{})}))},${sealRenewal(actor)})`;
  for(const person of recipients)await sql`INSERT INTO club_announcement_campaign_recipients(campaign_id,member_number,payload) VALUES(${id},${person.number},${sealRenewal(JSON.stringify(person))})`;
  return id;
 });
}
export async function confirmAnnouncement(id:string,confirmed:boolean){
 if(!await isAdmin('membership'))throw Error('Unauthorised');
 if(!uuid(id)||!confirmed||(process.env.CRON_SECRET?.length||0)<32)throw Error('Check confirmation and scheduler');
 await announcementsReady();const actor=await paymentActor();
 await db().begin(async sql=>{
  await sql`SELECT pg_advisory_xact_lock(hashtext('kpkmm-reminder-daily'))`;
  const rows=await sql`SELECT target_year,status,created_at FROM club_announcement_campaigns WHERE id=${id} FOR UPDATE`;
  const campaign=rows[0];if(!campaign)throw Error('Missing campaign');
  if(campaign.status==='queued'||campaign.status==='completed')return;
  campaignYear(campaign.target_year);
  if(campaign.status!=='draft'||Date.now()-new Date(campaign.created_at).getTime()>3600000)throw Error('Preview expired');
  const recipients=await sql`SELECT member_number FROM club_announcement_campaign_recipients WHERE campaign_id=${id} LIMIT 1`;
  if(!recipients.length)throw Error('No recipients');
  await sql`UPDATE club_announcement_campaigns SET status='queued',confirmed_at=now(),actor=${sealRenewal(actor)} WHERE id=${id}`;
 });
}
export async function cancelAnnouncement(id:string){
 if(!await isAdmin('membership')||!uuid(id))throw Error('Unauthorised');
 await announcementsReady();const actor=await paymentActor();
 await db().begin(async sql=>{
  await sql`SELECT pg_advisory_xact_lock(hashtext('kpkmm-reminder-daily'))`;
  await sql`UPDATE club_announcement_campaigns SET status='cancelled',cancelled_by=${sealRenewal(actor)} WHERE id=${id} AND status IN ('draft','queued')`;
  await sql`UPDATE club_announcement_campaign_recipients SET status='cancelled' WHERE campaign_id=${id} AND status='pending' AND EXISTS(SELECT 1 FROM club_announcement_campaigns WHERE id=${id} AND status='cancelled')`;
 });
}
export function announcementBody(message:string,name:string,year:number,token:string){
 return `${reminderText(message,name,year)}\n\nKPKMM — Club member announcement\n\nStop club announcements (membership and renewal reminders are unaffected):\nhttps://kpkmm-club-hub.vercel.app/announcement-preferences/${token}`;
}
// Called only by authenticated cron. The claim lock and shared mail ledger enforce
// one combined daily allowance; an ambiguous delivery is never automatically retried.
export async function runAnnouncements(now=new Date(),deadline=Date.now()+240000){
 await announcementsReady();const day=malaysiaDay(now);let attempted=0;
 for(let slot=0;slot<20&&Date.now()<deadline;slot++){
  const claim=await db().begin(async sql=>{
   await sql`SELECT pg_advisory_xact_lock(hashtext('kpkmm-reminder-daily'))`;
   const settings=await sql`SELECT config FROM club_reminder_settings WHERE id=1`,config=reminderConfig(settings[0].config);
   const count=await sql`SELECT count(*)::integer AS count FROM club_reminder_mail WHERE attempt_day=${day}::date`;
   if(count[0].count>=config.dailyLimit)return null;
   const campaigns=await sql`SELECT id,target_year,payload FROM club_announcement_campaigns WHERE status='queued' ORDER BY confirmed_at,id FOR UPDATE`;
   for(const campaign of campaigns){
    {
     await sql`LOCK TABLE club_member_roster IN SHARE MODE`;
     const content=JSON.parse(openRenewal(campaign.payload));
     const valid=await candidates(sql as unknown as ReturnType<typeof db>,campaign.target_year,content.audience);
     const queue=await sql`SELECT member_number,payload FROM club_announcement_campaign_recipients WHERE campaign_id=${campaign.id} AND status='pending' ORDER BY member_number`;
     for(const entry of queue){
      const saved=JSON.parse(openRenewal(entry.payload)) as AnnouncementRecipient,member=valid.find(m=>m.number===entry.member_number);
      if(!member||member.email!==saved.email){await sql`UPDATE club_announcement_campaign_recipients SET status='skipped' WHERE campaign_id=${campaign.id} AND member_number=${entry.member_number}`;continue;}
      const prior=await sql`SELECT status,attempt_day::text FROM club_reminder_mail WHERE member_number=${member.number}`;
      if(prior.some(p=>['sending','unknown'].includes(p.status))){await sql`UPDATE club_announcement_campaign_recipients SET status='skipped' WHERE campaign_id=${campaign.id} AND member_number=${entry.member_number}`;continue;}
      if(prior.some(p=>p.attempt_day===day))continue;
      const prefs=await sql`SELECT token FROM club_announcement_preferences WHERE member_number=${member.number}`;
      const token=prefs[0]?.token||randomBytes(32).toString('hex');
      await sql`INSERT INTO club_announcement_preferences(member_number,token) VALUES(${member.number},${token}) ON CONFLICT DO NOTHING`;
      const id=randomUUID();
      await sql`INSERT INTO club_reminder_mail(id,member_number,target_year,attempt_day,status,category) VALUES(${id},${member.number},${campaign.target_year},${day}::date,'sending','announcement')`;
      await sql`UPDATE club_announcement_campaign_recipients SET status='sending',attempt_id=${id} WHERE campaign_id=${campaign.id} AND member_number=${member.number}`;
      return {id,campaign:campaign.id,year:campaign.target_year,member,token,content:JSON.parse(openRenewal(campaign.payload)) as {subject:string;message:string;audience:string;card?:ECard}};
     }
    }
    await sql`UPDATE club_announcement_campaigns SET status='completed' WHERE id=${campaign.id} AND NOT EXISTS(SELECT 1 FROM club_announcement_campaign_recipients WHERE campaign_id=${campaign.id} AND status IN ('pending','sending'))`;
   }
   return null;
  });
  if(!claim)break;
  let status='unknown';
  try{status=await db().begin(async sql=>{
   const campaign=await sql`SELECT status FROM club_announcement_campaigns WHERE id=${claim.campaign} FOR SHARE`;
   await sql`LOCK TABLE club_member_roster IN SHARE MODE`;
   const members=await candidates(sql as unknown as ReturnType<typeof db>,claim.year,claim.content.audience);
   const prefs=await sql`SELECT opt_out,undeliverable FROM club_announcement_preferences WHERE member_number=${claim.member.number} FOR UPDATE`;
   const member=members.find(m=>m.number===claim.member.number);
   if(campaign[0]?.status!=='queued'||!member||member.email!==claim.member.email||prefs[0]?.opt_out||prefs[0]?.undeliverable)return 'skipped';
   const subject=reminderText(claim.content.subject,member.name,claim.year).replace(/[\r\n]/g,' '),body=announcementBody(claim.content.message,member.name,claim.year,claim.token);
   return (await sendClubMessage(claim.content.card?ecardMessage(member.email,subject,body,claim.content.card):enrolmentMessage(member.email,subject,body))).state;
  });}catch{}
  await db().begin(async sql=>{
   await sql`UPDATE club_reminder_mail SET status=${status} WHERE id=${claim.id}`;
   await sql`UPDATE club_announcement_campaign_recipients SET status=${status} WHERE campaign_id=${claim.campaign} AND member_number=${claim.member.number}`;
   await sql`UPDATE club_announcement_campaigns SET status='completed' WHERE id=${claim.campaign} AND status='queued' AND NOT EXISTS(SELECT 1 FROM club_announcement_campaign_recipients WHERE campaign_id=${claim.campaign} AND status IN ('pending','sending'))`;
  });attempted++;
 }
 return {attempted,day};
}

// Explicit admin-only test; consumes the same daily allowance and never queues members.
export async function testAnnouncement(id:string,email:string){
 if(!await isAdmin('membership')||!uuid(id))throw Error('Unauthorised');
 email=email.trim().toLowerCase();enrolmentMessage(email,'Test','Test');
 await announcementsReady();
 const day=malaysiaDay(),key='announcement-test:'+createHash('sha256').update(email).digest('hex');
 const claim=await db().begin(async sql=>{
  await sql`SELECT pg_advisory_xact_lock(hashtext('kpkmm-reminder-daily'))`;
  const rows=await sql`SELECT payload,target_year FROM club_announcement_campaigns WHERE id=${id}`;
  if(!rows.length)throw Error('Missing preview');
  const config=await sql`SELECT config FROM club_reminder_settings WHERE id=1`;
  const count=await sql`SELECT count(*)::integer AS count FROM club_reminder_mail WHERE attempt_day=${day}::date`;
  // Include legacy claims and retry claims; never retry an accepted or ambiguous send.
  const prior=await sql`SELECT id,status FROM club_reminder_mail WHERE (member_number=${key} OR member_number LIKE ${key+':%'}) AND attempt_day=${day}::date`;
  if(count[0].count>=reminderConfig(config[0].config).dailyLimit||prior.some(p=>p.status!=='failed'))throw Error('Daily test limit');
  const content=JSON.parse(openRenewal(rows[0].payload)),subject='[TEST] '+reminderText(content.subject,'Test recipient',rows[0].target_year),body=reminderText(content.message,'Test recipient',rows[0].target_year)+'\n\nKPKMM test preview — no member mailing was started.';
  const raw=content.card?ecardMessage(email,subject,body,content.card):enrolmentMessage(email,subject,body),attempt=randomUUID();
  // A separate claim preserves the failed record and counts every retry in the daily cap.
  const attemptKey=prior.length?key+':'+attempt:key;
  await sql`INSERT INTO club_reminder_mail(id,member_number,target_year,attempt_day,status,category) VALUES(${attempt},${attemptKey},${rows[0].target_year},${day}::date,'sending','announcement_test')`;
  return {attempt,raw};
 });
 let state='unknown';try{state=(await sendClubMessage(claim.raw)).state;}catch{}
 await db()`UPDATE club_reminder_mail SET status=${state} WHERE id=${claim.attempt}`;
 return state;
}

