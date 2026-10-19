const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const instant='2026-10-19T04:00:00Z';
class Clock extends Date{constructor(...args){super(...(args.length?args:[instant]));}static now(){return Date.parse(instant);}}
function load(file,mocks={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>n in mocks?mocks[n]:require(n),Date:Clock,Intl,FormData,Blob,process:{env:{CRON_SECRET:'test-only-not-a-real-secret-value-123'}},Response,Buffer});return exports;}
const settings=load('lib/reminder-settings.ts');
const reminders=load('lib/renewal-reminders.ts',{'./shop':{},'./roster':{},'./renewals':{openRenewal:x=>x},'./enrolment':{},'./reminder-settings':settings});
const row=(number,year=2025,extra={})=>({member_number:number,membership_year:year,active:true,identity_hash:null,payload:JSON.stringify({name:'Test '+number,email:number+'@example.com',...extra})});
function fixture(size=1){
 const state={admin:true,rows:Array.from({length:size},(_,i)=>row('B-'+String(i).padStart(3,'0'))),pending:[],prefs:[],mail:[],campaigns:[],recipients:[],sent:[],dailyLimit:20,outcome:'accepted',beforeSend:null};
 const sql=async(parts,...v)=>{
  const q=parts.join('?').replace(/\s+/g,' ').trim();
  if(/^(CREATE|LOCK)/.test(q)||q.includes('pg_advisory'))return [];
  if(q.startsWith('SELECT status,attempt_day'))return state.mail.filter(m=>m.member_number===v[0]);
  if(q.startsWith('SELECT member_number FROM club_reminder_preferences'))return [];
  if(q.startsWith('SELECT config'))return [{config:{dailyLimit:state.dailyLimit,intervalMonths:1}}];
  if(q.startsWith('SELECT payload,target_year FROM club_announcement_campaigns'))return state.campaigns.filter(c=>c.id===v[0]);
  if(q.startsWith('SELECT id FROM club_reminder_mail'))return state.mail.filter(m=>m.member_number===v[0]&&m.attempt_day===v[1]);
  if(q.startsWith('SELECT count'))return [{count:state.mail.filter(m=>m.attempt_day===v[0]).length}];
  if(q.startsWith('SELECT member_number,membership_year'))return state.rows.filter(r=>!q.includes('WHERE')||r.member_number===v[0]).sort((a,b)=>b.membership_year-a.membership_year);
  if(q.startsWith('SELECT identity_hash'))return state.pending.filter(r=>r.renewal_year===v[0]);
  if(q.startsWith('SELECT * FROM club_announcement_preferences'))return state.prefs;
  if(q.startsWith('SELECT member_number,max'))return [...new Set(state.mail.map(m=>m.member_number))].map(n=>({member_number:n,last_day:state.mail.filter(m=>m.member_number===n).map(m=>m.attempt_day).sort().at(-1),uncertain:state.mail.some(m=>m.member_number===n&&['sending','unknown'].includes(m.status))}));
  if(q.startsWith('SELECT token')||q.startsWith('SELECT opt_out'))return state.prefs.filter(p=>p.member_number===v[0]);
  if(q.startsWith('INSERT INTO club_announcement_preferences')){if(!state.prefs.some(p=>p.member_number===v[0]))state.prefs.push({member_number:v[0],token:v[1]});return [];}
  if(q.startsWith('INSERT INTO club_announcement_campaigns')){state.campaigns.push({id:v[0],target_year:v[1],status:'draft',payload:v[2],actor:v[3],created_at:instant});return [];}
  if(q.startsWith('INSERT INTO club_announcement_campaign_recipients')){state.recipients.push({campaign_id:v[0],member_number:v[1],payload:v[2],status:'pending'});return [];}
  if(q.startsWith('SELECT target_year,status'))return state.campaigns.filter(c=>c.id===v[0]);
  if(q.startsWith('SELECT member_number FROM club_announcement_campaign_recipients'))return state.recipients.filter(r=>r.campaign_id===v[0]).slice(0,1);
  if(q.startsWith('SELECT id,target_year,payload'))return state.campaigns.filter(c=>c.status==='queued');
  if(q.startsWith('SELECT member_number,payload FROM club_announcement_campaign_recipients'))return state.recipients.filter(r=>r.campaign_id===v[0]&&r.status==='pending');
  if(q.startsWith('SELECT status FROM club_announcement_campaigns')){if(state.beforeSend){const hook=state.beforeSend;state.beforeSend=null;hook(state);}return state.campaigns.filter(c=>c.id===v[0]);}
  if(q.startsWith('INSERT INTO club_reminder_mail')){assert.ok(!state.mail.some(m=>m.member_number===v[1]&&m.attempt_day===v[3]),'unique daily claim');state.mail.push({id:v[0],member_number:v[1],target_year:v[2],attempt_day:v[3],status:'sending'});return [];}
  if(q.startsWith('UPDATE club_reminder_mail')){state.mail.find(m=>m.id===v[1]).status=v[0];return [];}
  if(q.startsWith('UPDATE club_announcement_campaigns')){
   if(q.includes("SET status='queued'")){Object.assign(state.campaigns.find(c=>c.id===v[1]),{status:'queued',actor:v[0]});}
   else if(q.includes("SET status='cancelled'")){const c=state.campaigns.find(c=>c.id===v[1]);if(c&&['draft','queued'].includes(c.status))c.status='cancelled';}
   else if(q.includes("SET status='completed'")){const c=state.campaigns.find(c=>c.id===v[0]);assert.ok(q.includes("('pending','sending')"),'do not finish in-flight campaign');if(c&&c.status==='queued'&&!state.recipients.some(r=>r.campaign_id===c.id&&['pending','sending'].includes(r.status)))c.status='completed';}
   return [];
  }
  if(q.startsWith('UPDATE club_announcement_campaign_recipients')){
   if(q.includes("SET status='sending'")){Object.assign(state.recipients.find(r=>r.campaign_id===v[1]&&r.member_number===v[2]),{status:'sending',attempt_id:v[0]});}
   else if(q.includes("SET status='cancelled'")){if(state.campaigns.find(c=>c.id===v[0])?.status==='cancelled')state.recipients.filter(r=>r.campaign_id===v[0]&&r.status==='pending').forEach(r=>r.status='cancelled');}
   else if(q.includes("SET status='skipped'")){state.recipients.filter(r=>r.campaign_id===v[0]&&(v.length>1?r.member_number===v[1]:r.status==='pending')).forEach(r=>r.status='skipped');}
   else state.recipients.find(r=>r.campaign_id===v[1]&&r.member_number===v[2]).status=v[0];
   return [];
  }
  throw Error('Unhandled SQL '+q);
 };
 // Serialize transactions as the production advisory lock does; external sends mocked.
 let serial=Promise.resolve();sql.begin=fn=>{const result=serial.then(()=>fn(sql));serial=result.catch(()=>{});return result;};
 const lib=load('lib/member-announcements.ts',{'./announcement-email':{ecardMessage:(to,subject,body,card)=>({to,subject,body,card})},'./shop':{readImage:async file=>{if(file.size>700*1024||file.type!=='image/png')throw Error('Invalid image');return {type:file.type,bytes:Buffer.from(await file.arrayBuffer())};},db:()=>sql,isAdmin:async()=>state.admin,uuid:x=>/^[a-f0-9-]{36}$/.test(x)},'./membership-payments':{paymentActor:async()=>'test-admin'},'./renewals':{sealRenewal:x=>'sealed:'+x,openRenewal:x=>x.startsWith('sealed:')?x.slice(7):x,sendClubMessage:async raw=>{state.sent.push(raw);if(state.outcome==='throw')throw Error('uncertain');return {state:state.outcome};}},'./enrolment':{enrolmentMessage:(to,subject,body)=>({to,subject,body})},'./renewal-reminders':{...reminders,remindersReady:async()=>{}},'./reminder-settings':settings});
 const form=()=>{const f=new FormData();for(const [k,v] of Object.entries({audience:'all',year:'2026',subject:'Renew {year}',message:'Dear {name}, renew for {year}.'}))f.set(k,v);return f;};
 return {state,lib,form,queue:async()=>{const id=await lib.draftAnnouncement(form());await lib.confirmAnnouncement(id,true);return id;}};
}
(async()=>{
 let f=fixture(),lib=f.lib;
 const rows=[row('A',2026),row('B'),row('C',2026,{deceased:true}),row('D',2020,{lifetimeSince:2020}),row('E',2026,{email:'bad'}),row('F',2026,{email:'A@example.com'})];
 assert.equal(JSON.stringify(lib.announcementCandidates(rows,[],2026,'active').map(x=>x.number)),JSON.stringify(['A','D']));
 assert.equal(JSON.stringify(lib.announcementCandidates(rows,[],2026,'all').map(x=>x.number)),JSON.stringify(['A','B','D']));
 assert.equal(lib.announcementCandidates([row('A')],[{member_number:'A',opt_out:true}],2026,'all').length,0);
 assert.equal(lib.announcementCandidates([row('A')],[{member_number:'A',undeliverable:true}],2026,'all').length,0);
 f.state.admin=false;await assert.rejects(f.lib.draftAnnouncement(f.form()));await assert.rejects(f.lib.confirmAnnouncement('bad',true));await assert.rejects(f.lib.cancelAnnouncement('bad'));
 f=fixture();let id=await f.lib.draftAnnouncement(f.form());assert.equal(f.state.sent.length,0);assert.ok(f.state.recipients[0].payload.startsWith('sealed:'));await assert.rejects(f.lib.confirmAnnouncement(id,false));
 f.state.campaigns[0].created_at='2026-10-18';await assert.rejects(f.lib.confirmAnnouncement(id,true));
 f=fixture(25);id=await f.queue();await f.lib.confirmAnnouncement(id,true);assert.equal(f.state.sent.length,0);
 await Promise.all([f.lib.runAnnouncements(new Date(instant)),f.lib.runAnnouncements(new Date(instant))]);assert.equal(f.state.sent.length,20);assert.equal(f.state.mail.length,20);
 await f.lib.runAnnouncements(new Date('2026-10-20'));assert.equal(f.state.sent.length,25);assert.equal(f.state.campaigns[0].status,'completed');
 assert.ok(f.state.sent.every(m=>m.body.includes('/announcement-preferences/')&&!m.body.includes('/reminder-preferences/')));
 await f.lib.runAnnouncements(new Date('2026-10-21'));assert.equal(f.state.sent.length,25);
 f=fixture();id=await f.queue();await f.lib.cancelAnnouncement(id);await f.lib.runAnnouncements();assert.equal(f.state.sent.length,0);
 f=fixture();await f.queue();f.state.dailyLimit=1;f.state.mail.push({member_number:'OTHER',attempt_day:'2026-10-19',status:'accepted'});await f.lib.runAnnouncements();assert.equal(f.state.sent.length,0);
 f=fixture();await f.queue();f.state.mail.push({member_number:'B-000',attempt_day:'2026-10-19',status:'accepted'});await f.lib.runAnnouncements();assert.equal(f.state.sent.length,0);assert.equal(f.state.recipients[0].status,'pending');await f.lib.runAnnouncements(new Date('2026-10-20'));assert.equal(f.state.sent.length,1);
 for(const change of ['email','deceased','optout','cancel']){f=fixture();await f.queue();f.state.beforeSend=s=>{if(change==='email')s.rows[0].payload=JSON.stringify({name:'Test',email:'changed@example.com'});if(change==='deceased')s.rows[0].payload=JSON.stringify({name:'Test',email:'B-000@example.com',deceased:true});if(change==='optout')s.prefs[0].opt_out=true;if(change==='cancel')s.campaigns[0].status='cancelled';};await f.lib.runAnnouncements();assert.equal(f.state.sent.length,0,change);assert.equal(f.state.mail[0].status,'skipped');}
 f=fixture();await f.queue();f.state.outcome='throw';await f.lib.runAnnouncements();await f.lib.runAnnouncements(new Date('2026-10-20'));assert.equal(f.state.sent.length,1);assert.equal(f.state.mail[0].status,'unknown');
 const form=f.form();form.set('audience','invalid');await assert.rejects(f.lib.draftAnnouncement(form));form.set('audience','all');form.set('subject','bad\nheader');await assert.rejects(f.lib.draftAnnouncement(form));
 f=fixture();let cardForm=f.form();cardForm.set('ecard',new Blob([Buffer.from([137,80,78,71,13,10,26,10])],{type:'image/png'}),'card.png');cardForm.set('message','');id=await f.lib.draftAnnouncement(cardForm);assert.ok(JSON.parse(f.state.campaigns[0].payload.slice(7)).card);assert.equal(f.state.sent.length,0);
 assert.equal(await f.lib.testAnnouncement(id,'test@example.com'),'accepted');assert.equal(f.state.sent.length,1);assert.ok(f.state.sent[0].card);assert.equal(f.state.campaigns[0].status,'draft');await assert.rejects(f.lib.testAnnouncement(id,'test@example.com'));f.state.admin=false;await assert.rejects(f.lib.testAnnouncement(id,'other@example.com'));f.state.admin=true;f.state.dailyLimit=1;await assert.rejects(f.lib.testAnnouncement(id,'other@example.com'));
 f=fixture();cardForm=f.form();cardForm.set('ecard',new Blob(['bad'],{type:'text/html'}),'card.png');await assert.rejects(f.lib.draftAnnouncement(cardForm));assert.equal(f.state.campaigns.length,0);
 console.log('PASS: announcements audience, deduplication, encrypted drafts, confirmation, auth, cancel, concurrent daily cap, shared allowance, next-day continuation, send-time checks, uncertainty and separate unsubscribe. No real email sent.');
})().catch(e=>{console.error(e);process.exitCode=1;});
