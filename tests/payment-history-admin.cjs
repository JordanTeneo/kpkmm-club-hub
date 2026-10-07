const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
let owner=true,queries=[];
const year=new Date().getFullYear()-1;
const rows=[year+1,year,year-1].map(y=>({membership_year:y,active:y!==year,status_override:false,payload:JSON.stringify({name:'Test Member',active:y!==year,receipt:'retained',paymentHistory:[{year,status:'inactive',note:'import'},{year:year-1,status:'paid',note:'original'}]})}));
const sql=async(parts,...values)=>{const q=parts.join('?');queries.push({q,values});return q.includes('SELECT membership_year')?rows:[];};sql.begin=async fn=>fn(sql);
const mocks={'server-only':{},'./shop':{db:()=>sql,isAdmin:async()=>owner},'./committee-access':{committeeEnabled:async()=>true,committeeSession:async()=>({superAdmin:owner,user:{id:'owner-id'}})},'./member-admin':{adminRosterReady:async()=>{},validYear:v=>Number(v)},'./renewals':{openRenewal:x=>x,sealRenewal:x=>x}};
const exportsObject={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/payment-history-admin.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exportsObject,require:n=>n in mocks?mocks[n]:require(n),Date,Intl});const m=exportsObject;
function form(extra={}){const f=new FormData();for(const [k,v] of Object.entries({member:'B-16-219',year:String(year),status:'paid',reason:'Paid confirmed by club administrator',confirmed:'yes',revision:m.historyRevision(rows),...extra}))f.set(k,v);return f;}
(async()=>{
 owner=false;await assert.rejects(()=>m.correctPaymentHistory(form()),/access/);assert.equal(queries.length,0);owner=true;
 for(const change of [{year:String(year+1)},{status:'lifetime'},{reason:'short'},{confirmed:''}])await assert.rejects(()=>m.correctPaymentHistory(form(change)),/invalid/);
 await assert.rejects(()=>m.correctPaymentHistory(form({revision:'old'})),/stale/);assert.ok(!queries.some(x=>x.q.startsWith('UPDATE')));
 queries=[];await m.correctPaymentHistory(form());const updates=queries.filter(x=>x.q.startsWith('UPDATE'));assert.equal(updates.length,3);
 for(const u of updates){const [payload,active,override,member,y]=u.values;const data=JSON.parse(payload);assert.equal(member,'B-16-219');assert.equal(active,true);assert.equal(override,y===year);assert.equal(data.receipt,'retained');assert.equal(data.paymentHistory.find(h=>h.year===year).status,'paid');assert.equal(data.paymentHistory.find(h=>h.year===year).manualCorrection,true);assert.equal(data.paymentHistory.find(h=>h.year===year-1).note,'original');}
 assert.equal(queries.filter(x=>x.q.startsWith('INSERT')&&x.values.some(v=>String(v).includes('owner-id'))).length,3);
 rows[1].payload=JSON.stringify({lifetimeSince:year});queries=[];await assert.rejects(()=>m.correctPaymentHistory(form()),/lifetime/);assert.ok(!queries.some(x=>x.q.startsWith('UPDATE')));
 assert.ok(fs.readFileSync('lib/master-history.ts','utf8').includes('saved.manualCorrection'));
 assert.ok(fs.readFileSync('lib/history-2025.ts','utf8').includes('h.manualCorrection'));
 console.log('PASS: owner-only corrections, validation, stale protection, preserved other years/receipts, actor audit, lifetime guard and import protection.');
})().catch(e=>{console.error(e);process.exitCode=1;});
