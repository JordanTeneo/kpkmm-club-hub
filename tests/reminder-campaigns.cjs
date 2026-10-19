const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const instant='2026-10-19T04:00:00Z';
class Clock extends Date{constructor(...args){super(...(args.length?args:[instant]));}static now(){return Date.parse(instant);}}
function load(file,mocks={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>n in mocks?mocks[n]:require(n),Date:Clock,Intl,FormData,process:{env:{CRON_SECRET:'test-only-not-a-real-secret-value-123'}},Response,Buffer});return exports;}
const settings=load('lib/reminder-settings.ts');
const reminders=load('lib/renewal-reminders.ts',{'./shop':{},'./roster':{},'./renewals':{openRenewal:x=>x},'./enrolment':{},'./reminder-settings':settings});
const row=(number,year=2025,extra={})=>({member_number:number,membership_year:year,active:true,identity_hash:null,payload:JSON.stringify({name:'Test '+number,email:number+'@example.com',...extra})});
function fixture(size=1){
 const state={admin:true,rows:Array.from({length:size},(_,i)=>row('B-'+String(i).padStart(3,'0'))),pending:[],prefs:[],mail:[],campaigns:[],recipients:[],sent:[],dailyLimit:20,outcome:'accepted',beforeSend:null};
 const sql=async(parts,...v)=>{
  const q=parts.join('?').replace(/\s+/g,' ').trim();
  if(/^(CREATE|LOCK)/.test(q)||q.includes('pg_advisory'))return [];
  if(q.startsWith('SELECT config'))return [{config:{dailyLimit:state.dailyLimit,intervalMonths:1}}];
  if(q.startsWith('SELECT count'))return [{count:state.mail.filter(m=>m.attempt_day===v[0]).length}];
  if(q.startsWith('SELECT member_number,membership_year'))return state.rows.filter(r=>!q.includes('WHERE')||r.member_number===v[0]).sort((a,b)=>b.membership_year-a.membership_year);
  if(q.startsWith('SELECT identity_hash'))return state.pending.filter(r=>r.renewal_year===v[0]);
  if(q.startsWith('SELECT * FROM club_reminder_preferences'))return state.prefs;
  if(q.startsWith('SELECT member_number,max'))return [...new Set(state.mail.map(m=>m.member_number))].map(n=>({member_number:n,last_day:state.mail.filter(m=>m.member_number===n).map(m=>m.attempt_day).sort().at(-1),uncertain:state.mail.some(m=>m.member_number===n&&['sending','unknown'].includes(m.status))}));
  if(q.startsWith('SELECT token')||q.startsWith('SELECT opt_out'))return state.prefs.filter(p=>p.member_number===v[0]);
  if(q.startsWith('INSERT INTO club_reminder_preferences')){if(!state.prefs.some(p=>p.member_number===v[0]))state.prefs.push({member_number:v[0],token:v[1]});return [];}
  if(q.startsWith('INSERT INTO club_reminder_campaigns')){state.campaigns.push({id:v[0],target_year:v[1],status:'draft',payload:v[2],actor:v[3],created_at:instant});return [];}
  if(q.startsWith('INSERT INTO club_reminder_campaign_recipients')){state.recipients.push({campaign_id:v[0],member_number:v[1],payload:v[2],status:'pending'});return [];}
  if(q.startsWith('SELECT target_year,status'))return state.campaigns.filter(c=>c.id===v[0]);
  if(q.startsWith('SELECT member_number FROM club_reminder_campaign_recipients'))return state.recipients.filter(r=>r.campaign_id===v[0]).slice(0,1);
  if(q.startsWith('SELECT id,target_year,payload'))return state.campaigns.filter(c=>c.status==='queued');
  if(q.startsWith('SELECT member_number,payload FROM club_reminder_campaign_recipients'))return state.recipients.filter(r=>r.campaign_id===v[0]&&r.status==='pending');
  if(q.startsWith('SELECT status FROM club_reminder_campaigns')){if(state.beforeSend){const hook=state.beforeSend;state.beforeSend=null;hook(state);}return state.campaigns.filter(c=>c.id===v[0]);}
  if(q.startsWith('INSERT INTO club_reminder_mail')){assert.ok(!state.mail.some(m=>m.member_number===v[1]&&m.attempt_day===v[3]),'unique daily claim');state.mail.push({id:v[0],member_number:v[1],target_year:v[2],attempt_day:v[3],status:'sending'});return [];}
  if(q.startsWith('UPDATE club_reminder_mail')){state.mail.find(m=>m.id===v[1]).status=v[0];return [];}
  if(q.startsWith('UPDATE club_reminder_campaigns')){
   if(q.includes("SET status='queued'")){assert.ok(!state.campaigns.some(c=>c.status==='queued'&&c.target_year===state.campaigns.find(c=>c.id===v[1]).target_year));Object.assign(state.campaigns.find(c=>c.id===v[1]),{status:'queued',actor:v[0]});}
   else if(q.includes("SET status='cancelled'")){const c=state.campaigns.find(c=>c.id===v[1]);if(c&&['draft','queued'].includes(c.status))c.status='cancelled';}
   else if(q.includes("SET status='completed'")){const c=state.campaigns.find(c=>c.id===v[0]);assert.ok(q.includes("('pending','sending')"),'do not finish in-flight campaign');if(c&&c.status==='queued'&&!state.recipients.some(r=>r.campaign_id===c.id&&['pending','sending'].includes(r.status)))c.status='completed';}
   return [];
  }
  if(q.startsWith('UPDATE club_reminder_campaign_recipients')){
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
 const lib=load('lib/reminder-campaigns.ts',{'./shop':{db:()=>sql,isAdmin:async()=>state.admin,uuid:x=>/^[a-f0-9-]{36}$/.test(x)},'./membership-payments':{paymentActor:async()=>'test-admin'},'./renewals':{sealRenewal:x=>'sealed:'+x,openRenewal:x=>x.startsWith('sealed:')?x.slice(7):x,sendClubMessage:async raw=>{state.sent.push(raw);if(state.outcome==='throw')throw Error('uncertain');return {state:state.outcome};}},'./enrolment':{enrolmentMessage:(to,subject,body)=>({to,subject,body})},'./renewal-reminders':{...reminders,remindersReady:async()=>{}},'./reminder-settings':settings});
 const form=()=>{const f=new FormData();for(const [k,v] of Object.entries({year:'2026',subject:'Renew {year}',message:'Dear {name}, renew for {year}.'}))f.set(k,v);return f;};
 return {state,lib,form,queue:async()=>{const id=await lib.draftCampaign(form());await lib.confirmCampaign(id,true);return id;}};
}
(async()=>{
 let f=fixture(),{lib}=f;
 assert.equal(lib.campaignYear('2026',new Date('2026-12-15')),2026);
 for(const value of ['2025','2028','bad','2026.5'])assert.throws(()=>lib.campaignYear(value));
 let candidates=lib.campaignCandidates([row('A'),row('B',2026),row('B'),row('C',2025,{deceased:true}),row('D',2025,{lifetimeSince:2020}),row('E',2024),row('F',2025,{email:''})],[],[],[],2026,'2026-10-19',1);
 assert.equal(JSON.stringify(candidates.map(m=>m.number)),JSON.stringify(['A']));
 assert.equal(lib.campaignCandidates([row('A')],[{renewal_year:2026,identity_hash:null,payload:'{"rosterMemberNumber":"OTHER"}'}],[],[],2026,'2026-10-19',1).length,1,'null hashes must not match unrelated members');
 assert.equal(lib.campaignCandidates([row('A')],[{renewal_year:2026,identity_hash:null,payload:'{"rosterMemberNumber":"A"}'}],[],[],2026,'2026-10-19',1).length,0);
 for(const pref of [{opt_out:true},{undeliverable:true}])assert.equal(lib.campaignCandidates([row('A')],[],[{member_number:'A',...pref}],[],2026,'2026-10-19',1).length,0);
 for(const h of [{last_day:'2026-10-01'},{last_day:'2025-01-01',uncertain:true}])assert.equal(lib.campaignCandidates([row('A')],[],[],[{member_number:'A',...h}],2026,'2026-10-19',1).length,0);
 f.state.admin=false;await assert.rejects(f.lib.draftCampaign(f.form()),/Unauthorised/);await assert.rejects(f.lib.confirmCampaign('bad',true));await assert.rejects(f.lib.cancelCampaign('bad'));
 f.state.admin=true;const draft=await f.lib.draftCampaign(f.form());assert.equal(f.state.sent.length,0);assert.ok(f.state.recipients[0].payload.startsWith('sealed:'));await assert.rejects(f.lib.confirmCampaign(draft,false));
 f.state.campaigns[0].created_at='2026-10-18';await assert.rejects(f.lib.confirmCampaign(draft,true),/expired/);
 f=fixture(25);const id=await f.queue();await f.lib.confirmCampaign(id,true);assert.equal(f.state.sent.length,0,'confirmation only queues');
 await Promise.all([f.lib.runCampaigns(new Date(instant)),f.lib.runCampaigns(new Date(instant))]);assert.equal(f.state.sent.length,20);assert.equal(f.state.mail.length,20);assert.equal(f.state.campaigns[0].status,'queued');
 await f.lib.runCampaigns(new Date('2026-10-20T04:00:00Z'));assert.equal(f.state.sent.length,25);assert.equal(f.state.campaigns[0].status,'completed');assert.ok(f.state.sent.every(m=>m.subject==='Renew 2026'&&m.body.includes('/renew')&&m.body.includes('/reminder-preferences/')));
 await f.lib.runCampaigns(new Date('2026-10-21'));assert.equal(f.state.sent.length,25,'completed campaigns never resend');
 f=fixture();await f.queue();f.state.mail.push({member_number:'OTHER',attempt_day:'2026-10-19',status:'accepted'});f.state.dailyLimit=1;await f.lib.runCampaigns(new Date(instant));assert.equal(f.state.sent.length,0,'shared cap includes recurring');
 f=fixture();const cancel=await f.queue();await f.lib.cancelCampaign(cancel);await f.lib.runCampaigns();assert.equal(f.state.sent.length,0);assert.equal(f.state.recipients[0].status,'cancelled');
 for(const change of ['email','active','optout','cancel']){f=fixture();await f.queue();f.state.beforeSend=s=>{if(change==='email')s.rows[0].payload=JSON.stringify({name:'Test',email:'changed@example.com'});if(change==='active')s.rows.unshift(row('B-000',2026));if(change==='optout')s.prefs[0].opt_out=true;if(change==='cancel')s.campaigns[0].status='cancelled';};await f.lib.runCampaigns();assert.equal(f.state.sent.length,0,change);assert.equal(f.state.mail[0].status,'skipped');}
 f=fixture();await f.queue();f.state.outcome='throw';await f.lib.runCampaigns();await f.lib.runCampaigns(new Date('2026-10-20'));assert.equal(f.state.sent.length,1);assert.equal(f.state.mail[0].status,'unknown');
 f=fixture();await f.queue();await f.lib.runCampaigns(new Date('2027-01-01'));assert.equal(f.state.sent.length,0);assert.equal(f.state.recipients[0].status,'skipped');
 f=fixture();await f.queue();await f.lib.runCampaigns(new Date('2026-12-15'));assert.equal(f.state.mail[0].target_year,2026,'fixed year even after seasonal switch');
 let calls=0;const route=load('app/api/renewal-reminders/route.ts',{'../../../lib/member-announcements':{runAnnouncements:async()=>({})},'../../../lib/renewal-reminders':{runReminders:async()=>{calls++;return {};}},'../../../lib/reminder-campaigns':{runCampaigns:async()=>{calls++;return {};}}});
 assert.equal((await route.GET(new Request('https://example.com'))).status,401);assert.equal(calls,0);
 console.log('PASS: ad hoc preview/confirmation, authorization, eligibility, null identity, cancellation, shared 20/day cap, concurrent workers, second-day continuation, send-time rechecks, fixed year and uncertain delivery. Mock database and mail only.');
})().catch(e=>{console.error(e);process.exitCode=1;});
