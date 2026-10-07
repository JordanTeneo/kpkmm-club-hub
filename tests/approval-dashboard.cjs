const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
let allowed=true,fail=false,calls=0;const out={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/admin/approval-dashboard.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:out,require:n=>n.includes('lib/shop')?{isAdmin:async role=>{assert.equal(role,'membership');return allowed;}}:n.includes('member-dashboard')?{memberDashboard:async()=>{calls++;if(fail)throw Error('offline');return {renewals:2,applications:3,awaitingPayment:4,awaitingApproval:5};}}:require(n)});
function flatten(n){return !n?[]:Array.isArray(n)?n.flatMap(flatten):typeof n==='object'?[n,...flatten(n.props?.children)]:[];}
(async()=>{
 const nodes=flatten(await out.ApprovalDashboard({bm:false}));assert.equal(nodes.filter(n=>n.type==='a').length,4);
 assert(nodes.some(n=>n.props?.href==='/admin/members?status=approved&stage=proof_submitted'));
 assert.equal(nodes.filter(n=>n.type==='h2').length,0);
 assert.equal(nodes.filter(n=>n.type==='p').length,4);
 assert.equal(flatten(await out.ApprovalDashboard({bm:true})).find(n=>n.type==='section').props['aria-label'],'Kelulusan');
 allowed=false;const before=calls;assert.equal(await out.ApprovalDashboard({bm:false}),null);assert.equal(calls,before);
 allowed=true;fail=true;assert(flatten(await out.ApprovalDashboard({bm:false})).some(n=>n.props?.role==='status'));
 assert(!fs.readFileSync('app/admin/members/roster/page.tsx','utf8').includes('memberDashboard'));
 assert(fs.readFileSync('app/admin/page.tsx','utf8').includes('<ApprovalDashboard'));
 console.log('PASS: dashboard placement, four queue links, EN/BM, permission guard and unavailable state');
})().catch(e=>{console.error(e);process.exitCode=1;});
