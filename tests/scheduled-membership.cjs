const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
function load(file,mocks={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>mocks[n]||require(n),Buffer,Date,Intl});return exports;}
const a=load('lib/annual-status.ts');
assert.equal(a.annualStatus({active:true,joinedYear:2025},2025),'new');
assert.equal(a.annualStatus({active:true,joinedYear:2025},2026),'active');
assert.equal(a.annualStatus({active:false,joinedYear:2025},2026),'inactive');
assert.equal(a.annualStatus({active:true,paymentHistory:[{year:2020,status:'new'}]},2020),'new');
assert.equal(a.annualStatus({active:false,lifetimeSince:2020},2026),'lifetime');
assert.equal(a.annualStatus({active:true,lifetimeSince:2020,deceased:true},2026),'deceased');
assert.equal(a.annualStatus({active:true},2026),'active');
const r=load('lib/renewal-reminders.ts',{'./reminder-settings':load('lib/reminder-settings.ts'),'./shop':{},'./roster':{},'./renewals':{},'./enrolment':{}});
assert.equal(r.reminderYear('2026-12-14'),2026);assert.equal(r.reminderYear('2026-12-15'),2027);assert.equal(r.reminderYear('2027-01-01'),2027);
assert.equal(r.monthDue('2026-12-15','2027-01-14'),false);assert.equal(r.monthDue('2026-12-15','2027-01-15'),true);assert.equal(r.monthDue('2027-01-31','2027-02-28'),true);
assert.equal(r.malaysiaDay(new Date('2026-12-14T16:00:00Z')),'2026-12-15');
let state='queued',approved=true,member={name:'Example',email:'example@example.invalid'},sends=0;
const sql=async(p,...v)=>{const q=p.join('?');if(q.startsWith('UPDATE')&&q.includes("SET member_mail_status='sending'")){if(!approved||!['queued','failed'].includes(state))return [];state='sending';return [{payload:JSON.stringify({rosterMemberNumber:'B-20-001'}),renewal_year:2027}];}if(q.startsWith('SELECT payload'))return [{payload:JSON.stringify(member)}];if(q.startsWith('UPDATE'))state=v[0];return [];};
const mail=load('lib/renewal-confirmation.ts',{'./membership-payments':{paymentInvoiceLink:async()=> 'https://example.invalid/private-invoice'},'./shop':{db:()=>sql,uuid:()=>true},'./renewals':{renewalsReady:async()=>{},openRenewal:s=>s,sendClubMessage:async()=>{sends++;return {state:'accepted'};}},'./enrolment':{enrolmentMessage:(to,subject,body)=>{assert(!body.includes('MyKad'));assert(!body.includes('proof'));return body;}}});
(async()=>{assert.equal(await mail.deliverRenewalConfirmation('test'),'accepted');assert.equal(sends,1);await mail.deliverRenewalConfirmation('test');assert.equal(sends,1);state='queued';member.deceased=true;assert.equal(await mail.deliverRenewalConfirmation('test'),'skipped');assert.equal(sends,1);state='queued';member={name:'Example',email:''};assert.equal(await mail.deliverRenewalConfirmation('test'),'skipped');state='queued';approved=false;assert.equal(await mail.deliverRenewalConfirmation('test'),'unchanged');assert.equal(sends,1);console.log('PASS annual New/lifetime/deceased classification, Malaysia dates/month boundaries, confirmation idempotency, approved-only, deceased/missing-email skips. No real mail sent.');})().catch(e=>{console.error(e);process.exitCode=1;});
