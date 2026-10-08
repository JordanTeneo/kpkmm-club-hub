const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const pricing=require('./fee-fixture.cjs')('../membership-pricing');
let authorised=true,currentVersion=1,updates=0,audits=0,saved;
const sql=async(p,...v)=>{const q=p.join('?');if(q.startsWith('UPDATE club_fee_settings')){if(v[1]!==currentVersion)return [];saved=JSON.parse(v[0]);currentVersion++;updates++;return [{id:1}];}if(q.startsWith('INSERT INTO club_fee_audit')){assert.equal(v[1],'sealed:Test admin');audits++;return [];}throw Error(q);};sql.begin=fn=>fn(sql);
const mocks={'next/navigation':{},'next/cache':{revalidatePath:()=>{}},'../../../lib/shop':{isAdmin:async()=>authorised,db:()=>sql},'../../../lib/membership-fees':{getFees:async()=>({settings:pricing.defaultFees,version:currentVersion})},'../../../lib/membership-pricing':pricing,'../../../lib/membership-payments':{paymentActor:async()=> 'Test admin'},'../../../lib/renewals':{sealRenewal:s=>'sealed:'+s},'../../language':{getLanguage:async()=> 'en'},'../../membership-price':{},'../../shop/forms':{},'../../shop/shop.css':{}};
const exportsForTest={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/admin/fees/page.tsx','utf8')+'\nexport const saveForTest=save;',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:exportsForTest,require:n=>n in mocks?mocks[n]:require(n)});
const form=()=>{const f=new FormData();for(const [k,v] of Object.entries({annual:'160',administration:'80',renewalDiscount:'20',joiningDiscount:'30',version:'1'}))f.set(k,v);return f;};
(async()=>{
 authorised=false;assert.ok((await exportsForTest.saveForTest({},form())).error);assert.equal(updates,0);
 authorised=true;const bad=form();bad.set('renewalDiscount','160');assert.ok((await exportsForTest.saveForTest({},bad)).error);assert.equal(updates,0);
 bad.set('renewalDiscount','-10');assert.ok((await exportsForTest.saveForTest({},bad)).error);assert.equal(updates,0);
 assert.ok((await exportsForTest.saveForTest({},form())).success);assert.equal(updates,1);assert.equal(audits,1);assert.equal(saved.renewalDiscount,2000);assert.equal(saved.joiningDiscount,3000);
 assert.match((await exportsForTest.saveForTest({},form())).error,/Settings changed/);assert.equal(updates,1);assert.equal(audits,1);
 console.log('PASS: fee settings require membership permission, validate RM amounts, save discounted settings with audit and reject stale edits. Mock database only.');
})().catch(e=>{console.error(e);process.exitCode=1;});
