const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
function load(file,mocks={}){const e={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:e,require:n=>mocks[n]||require(n)});return e;}
const helpers=load('lib/member-since.ts');
const id='11111111-1111-4111-8111-111111111111',number='B-24-123';
let approved=true;
const member={name:'Example',identity:'',memberNumber:number,paymentHistory:[{year:2025,status:'sponsored',note:'Sponsor'},{year:2026,status:'inactive',note:''}]};
const sql=async(p,...v)=>{const q=p.join('?');
 if(q.startsWith('SELECT DISTINCT ON'))return [{member_number:number,membership_year:2026,payload:JSON.stringify(member),active:true}];
 if(q.startsWith('SELECT id,identity_hash'))return approved?[{id,identity_hash:'hash',renewal_year:2026}]:[];
 if(q.startsWith('SELECT member_number,membership_year,reason'))return [
  {member_number:number,membership_year:2026,reason:'Renewal '+id+' review: approved. Annual status only',created_at:'2026-10-08T01:30:00Z'},
  {member_number:number,membership_year:2026,reason:'Fix spelling',created_at:'2026-10-09T01:30:00Z'},
 ];
 return [];
};
const admin=load('lib/member-admin.ts',{'./member-since':helpers,'./annual-status':{annualStatus:()=> 'active'},'./shop':{db:()=>sql},'./roster':{rosterReady:async()=>{}},'./membership':{membershipReady:async()=>{}},'./renewals':{renewalsReady:async()=>{},openRenewal:x=>x}});
(async()=>{
 const rows=await admin.listMembers(2026);
 const history=rows[0].paymentHistory;
 assert.equal(history[1].status,'paid');assert.equal(history[1].approvedAt,'2026-10-08T01:30:00.000Z');
 assert.equal(history[0].status,'sponsored');assert.equal(member.paymentHistory[1].status,'inactive');
 approved=false;assert.equal((await admin.listMembers(2026))[0].paymentHistory[1].status,'inactive');
 const future=helpers.renewalPaymentHistory(member.paymentHistory,[{year:2027,approvedAt:'2026-12-20T00:00:00Z'}]);
 assert.equal(future[2].year,2027);assert.equal(future[2].status,'paid');
 assert.equal(helpers.renewalPaymentHistory([{year:2026,status:'new',note:'new'}],[{year:2026}])[0].status,'new');
 const source=fs.readFileSync('app/admin/members/roster/list.tsx','utf8');assert.match(source,/Renewal approved/);assert.match(source,/Asia\/Kuala_Lumpur/);
 console.log('PASS: approved renewal replaces stale imported unpaid history, real approval date not edit date, reversal, future year, fee-waiver preservation and Malaysia display.');
})().catch(e=>{console.error(e);process.exitCode=1;});
