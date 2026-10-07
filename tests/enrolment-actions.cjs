const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
let admin=false,allowed=true,saved=0,sent=0,activated=0,lang='en',saveResult='00000000-0000-4000-8000-000000000001';
const mocks={'next/headers':{headers:async()=>new Headers()},'next/cache':{revalidatePath:()=>{}},'../../lib/shop':{isAdmin:async()=>admin,uuid:s=>/^[a-f0-9-]{36}$/.test(s),readImage:async file=>({bytes:Buffer.from(await file.arrayBuffer()),type:'image/png'})},'../../lib/renewals':{renewalLimit:async()=>allowed},'../language':{getLanguage:async()=>lang},'../../lib/enrolment':{enrolmentReady:async()=>{},validPaymentToken:s=>/^[a-f0-9]{64}$/.test(s),savePayment:async()=>{saved++;return saveResult;},deliverEnrolment:async()=>{sent++;},approvePayment:async()=>{activated++;return 'activated';}}};
const actions={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/join/enrolment-actions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:actions,File,Buffer,require:n=>mocks[n]||require(n)});
function form(){const f=new FormData();f.set('token','a'.repeat(64));f.set('proof',new File([new Uint8Array([137,80,78,71])],'sample.png'));return f;}
(async()=>{
 let f=form();f.set('token','invalid');assert.ok((await actions.uploadJoiningProof({},f)).error);assert.equal(saved,0);
 allowed=false;assert.ok((await actions.uploadJoiningProof({},form())).error);assert.equal(saved,0);allowed=true;
 f=form();f.set('proof',new File([new Uint8Array(701*1024)],'large.png'));assert.ok((await actions.uploadJoiningProof({},f)).error);assert.equal(saved,0);
 assert.ok((await actions.uploadJoiningProof({},form())).success);assert.equal(saved,1);assert.equal(sent,1);
 saveResult='invalid';assert.ok((await actions.uploadJoiningProof({},form())).error);assert.equal(sent,1);
 f=new FormData();f.set('id','00000000-0000-4000-8000-000000000001');f.set('decision','payment');assert.ok((await actions.reviewEnrolment({},f)).error);assert.equal(activated,0);
 admin=true;assert.ok((await actions.reviewEnrolment({},f)).error);assert.equal(activated,0);f.set('verified','yes');assert.ok((await actions.reviewEnrolment({},f)).success);assert.equal(activated,1);
 allowed=false;assert.ok((await actions.reviewEnrolment({},f)).error);assert.equal(activated,1);lang='ms';const result=await actions.reviewEnrolment({},f);assert.match(result.error,/Terlalu/);
 const route=fs.readFileSync('app/admin/members/proof/route.ts','utf8');assert.match(route,/if\(!\(await isAdmin\('membership'\)\)\)/);assert.match(route,/private, no-store/);assert.match(route,/attachment;/);
 console.log('PASS: server auth, required payment verification, upload/token validation, rate limits, upload errors, EN/BM and private proof response safeguards.');
})().catch(e=>{console.error(e);process.exitCode=1;});
