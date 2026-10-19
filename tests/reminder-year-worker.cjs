const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
function load(file,mocks={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>mocks[n]||require(n),Date,Intl});return exports;}
const settings=load('lib/reminder-settings.ts');
let targetYear,changeYear,count,settingReads,sent,ledger,updates;
const person={name:'Test member',email:'test@example.com'};
const sql=async(p,...v)=>{const q=p.join('?');
 if(q.includes('SELECT paused')){settingReads++;return [{paused:false,start_date:'2026-01-01',config:{targetYear:changeYear&&settingReads===2?2027:targetYear}}];}
 if(q.includes('SELECT count'))return [{count}];
 if(q.includes('FROM club_member_roster'))return [{member_number:'B-25-001',membership_year:2025,active:true,payload:JSON.stringify(person)}];
 if(q.includes('INSERT INTO club_reminder_mail')){ledger.push(v);count=20;}
 if(q.includes('UPDATE club_reminder_mail'))updates.push(v[0]);
 return [];
};sql.begin=fn=>fn(sql);
const worker=load('lib/renewal-reminders.ts',{'./shop':{db:()=>sql},'./roster':{rosterReady:async()=>{}},'./reminder-settings':settings,'./renewals':{renewalsReady:async()=>{},openRenewal:x=>x,sendClubMessage:async raw=>{sent.push(raw);return {state:'accepted'};}},'./enrolment':{enrolmentMessage:(email,subject,body)=>({email,subject,body})}});
async function run(year,day,change=false){targetYear=year;changeYear=change;count=0;settingReads=0;sent=[];ledger=[];updates=[];return worker.runReminders(new Date(day+'T04:00:00Z'));}
(async()=>{
 await run(2026,'2026-12-15');assert.equal(sent.length,1);assert.ok(sent[0].body.includes('2026'));assert.equal(ledger[0][2],2026);
 await run(null,'2026-12-15');assert.equal(sent.length,0); // Automatic targets 2027; no active 2026 record.
 await run(2026,'2027-01-01');assert.equal(sent.length,0);assert.equal(ledger.length,0);
 await run(2026,'2026-12-15',true);assert.equal(sent.length,0);assert.equal(updates[0],'skipped');
 console.log('PASS: fixed-year eligibility, email and ledger, automatic December rollover, expired year and send-time setting change. No real email sent.');
})().catch(e=>{console.error(e);process.exitCode=1;});
