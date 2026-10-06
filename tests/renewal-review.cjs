const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
let authorised=false,request,records,writes,audits,fail=false;
const id='00000000-0000-4000-8000-000000000001';
const sql=async(p,...v)=>{const q=p.join('?');
 if(q.startsWith('SELECT id'))return request?[request]:[];
 if(q.startsWith('SELECT DISTINCT'))return records;
 if(q.startsWith('INSERT INTO club_roster_edits')){audits++;return [];}
 if(q.startsWith('INSERT INTO club_member_roster')){writes++;records=[{member_number:v[0],membership_year:v[1],name_hash:v[2],identity_hash:v[3],payload:v[4],active:v[5],status_override:v[6]}];}
 if(q.startsWith('UPDATE club_renewals')){if(fail)throw Error('database failed');request.review_status=v[0];}
 return [];
};
sql.begin=async fn=>{const backup=JSON.stringify({request,records,writes,audits});try{return await fn(sql);}catch(e){({request,records,writes,audits}=JSON.parse(backup));throw e;}};
const mod={};const mocks={'./shop':{db:()=>sql,isAdmin:async()=>authorised,uuid:s=>s===id},'./member-admin':{adminRosterReady:async()=>{},validYear:y=>{assert.ok(y>=2000&&y<=2200);return y;}},'./renewals':{renewalsReady:async()=>{},openRenewal:s=>s,sealRenewal:s=>s}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/renewal-review.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:mod,require:n=>mocks[n]||require(n)});
function setup({year=2026,active=false,override=true}={}){request={id,identity_hash:'hash',renewal_year:2026,review_status:'pending'};records=[{member_number:'B-09-001',membership_year:year,name_hash:'name',identity_hash:'hash',payload:JSON.stringify({memberNumber:'B-09-001',name:'Sample',identity:'kept',addressLine:'kept street',active}),active,status_override:override}];writes=audits=0;fail=false;}
(async()=>{
 setup();await assert.rejects(()=>mod.reviewRenewal(id,'approved'));authorised=true;
 assert.equal(await mod.reviewRenewal('invalid','approved'),'invalid');assert.equal(await mod.reviewRenewal(id,'invalid'),'invalid');assert.equal(writes,0);
 assert.equal(await mod.reviewRenewal(id,'approved'),'activated');assert.equal(records[0].active,true);assert.equal(records[0].status_override,false);assert.equal(request.review_status,'approved');assert.equal(JSON.parse(records[0].payload).addressLine,'kept street');assert.equal(records[0].member_number,'B-09-001');assert.equal(audits,1);
 await mod.reviewRenewal(id,'approved');assert.equal(writes,1);
 await mod.reviewRenewal(id,'rejected');assert.equal(records[0].active,false);assert.equal(records[0].status_override,true);assert.equal(request.review_status,'rejected');
 setup({year:2025,active:true,override:false});await mod.reviewRenewal(id,'approved');assert.equal(records[0].membership_year,2026);assert.equal(JSON.parse(records[0].payload).renewalActivation.active,false);await mod.reviewRenewal(id,'pending');assert.equal(records[0].active,false);
 setup({active:true,override:false});await mod.reviewRenewal(id,'approved');await mod.reviewRenewal(id,'rejected');assert.equal(records[0].active,true);
 setup();await mod.reviewRenewal(id,'approved');records[0].status_override=true;records[0].active=false;await mod.reviewRenewal(id,'rejected');assert.equal(records[0].active,false);assert.equal(records[0].status_override,true);
 setup();records=[];assert.equal(await mod.reviewRenewal(id,'approved'),'unmatched');assert.equal(request.review_status,'pending');assert.equal(writes,0);
 setup();records.push({...records[0],member_number:'B-09-002'});assert.equal(await mod.reviewRenewal(id,'approved'),'ambiguous');assert.equal(request.review_status,'pending');
 setup();fail=true;await assert.rejects(()=>mod.reviewRenewal(id,'approved'));assert.equal(records[0].active,false);assert.equal(request.review_status,'pending');assert.equal(writes,0);
 console.log('PASS: approval activates roster, inactive overrides cleared, annual rollover, permanent ID/address preservation, idempotency, safe approval reversal, unmatched/duplicate blocking, auth and atomic rollback.');
})().catch(e=>{console.error(e);process.exitCode=1;});
