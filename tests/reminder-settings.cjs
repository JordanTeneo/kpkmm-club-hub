const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
function load(file,mocks={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>mocks[n]||require(n),Date,Intl,FormData});return exports;}
const s=load('lib/reminder-settings.ts');
const form=new FormData();Object.entries({startDate:'2026-12-15',dailyLimit:'10',intervalMonths:'2',subject:'Renew {year}',message:'Dear {name}, please renew for {year}.'}).forEach(([k,v])=>form.set(k,v));
assert.equal(s.validateReminderSettings(form).config.dailyLimit,10);
for(const [key,value] of [['dailyLimit','21'],['dailyLimit','0'],['dailyLimit','1.5'],['intervalMonths','0'],['intervalMonths','13'],['startDate','2026-02-30'],['subject','Bad\nHeader'],['message',''],['message','Hello {unknown}']]){const old=form.get(key);form.set(key,value);assert.throws(()=>s.validateReminderSettings(form));form.set(key,old);}
assert.equal(s.reminderText('Hi {name}, {year}', 'Test {year}',2027),'Hi Test {year}, 2027');
assert.equal(s.reminderConfig({dailyLimit:100}).dailyLimit,20);
assert.equal(s.reminderConfig({}).targetYear,null);
form.set('targetYear','2026');assert.equal(s.validateReminderSettings(form,new Date('2026-10-19')).config.targetYear,2026);
for(const year of ['2025','2028','oops','2026.5']){form.set('targetYear',year);assert.throws(()=>s.validateReminderSettings(form,new Date('2026-10-19')));}
form.set('targetYear','automatic');assert.equal(s.validateReminderSettings(form).config.targetYear,null);
let count=5,candidatesRead=false;
const sql=async(p,...v)=>{const q=p.join('?');if(q.includes('SELECT paused'))return [{paused:false,start_date:'2026-12-15',config:{dailyLimit:5,intervalMonths:2}}];if(q.includes('SELECT count'))return [{count}];if(q.includes('SELECT member_number'))candidatesRead=true;return [];};sql.begin=fn=>fn(sql);
const r=load('lib/renewal-reminders.ts',{'./reminder-settings':s,'./shop':{db:()=>sql},'./roster':{rosterReady:async()=>{}},'./renewals':{renewalsReady:async()=>{}},'./enrolment':{}});
assert.equal(r.monthDue('2026-12-31','2027-02-27',2),false);assert.equal(r.monthDue('2026-12-31','2027-02-28',2),true);
assert.equal(r.scheduledReminderYear('2026-12-14',{}),2026);
assert.equal(r.scheduledReminderYear('2026-12-15',{}),2027);
assert.equal(r.scheduledReminderYear('2026-12-15',{targetYear:2026}),2026);
assert.equal(r.scheduledReminderYear('2027-01-01',{targetYear:2026}),null);
assert.equal(r.scheduledReminderYear('2026-10-19',{targetYear:2027}),2027);
(async()=>{assert.equal((await r.runReminders(new Date('2026-12-15T04:00:00Z'))).attempted,0);assert.equal(candidatesRead,false);console.log('PASS: Settings validation, header protection, placeholders, month intervals and configured daily limit. No real email sent.');})().catch(e=>{console.error(e);process.exitCode=1;});
