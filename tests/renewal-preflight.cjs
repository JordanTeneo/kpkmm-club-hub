const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
let status='eligible',limited=false,pending=false,bm=false,fail=false,queries=0;
const sql=async(parts)=>{queries++;assert.match(parts.join('?'),/^SELECT id FROM club_renewals/);return pending?[{id:'private-id'}]:[];};
const mocks={
 '../../lib/membership-fees':{readRenewalFee:()=>({total:15000})},'../../lib/roster':{},'node:crypto':{},
 'next/headers':{headers:async()=>({get:()=>null})},'next/cache':{},
 '../../lib/shop':{db:()=>sql},'../language':{getLanguage:async()=>bm?'ms':'en'},
 '../../lib/renewal-member':{renewalLookup:f=>({mode:f.get('lookupMode'),value:f.get('lookupValue')}),findRenewalMember:async()=>{if(fail)throw Error('offline');return {status,identityHash:'private-hash',details:{name:'PRIVATE',email:'PRIVATE'}};}},
 '../../lib/renewals':{renewalsReady:async()=>{},renewalLimit:async()=>!limited}
};
const mod={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/renew/actions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:mod,require:n=>{assert.ok(n in mocks,n);return mocks[n];},Intl,Date,Number});
const form=new FormData();form.set('lookupMode','name');form.set('lookupValue','Sample');form.set('year',new Intl.DateTimeFormat('en',{year:'numeric',timeZone:'Asia/Kuala_Lumpur'}).format(new Date()));
(async()=>{
 let result=await mod.checkRenewalEligibility({},form);assert.equal(JSON.stringify(result),'{"eligible":true}');
 for(const state of ['already-active','deceased','missing','ambiguous','reinstate','review']){status=state;const before=queries;result=await mod.checkRenewalEligibility({},form);assert.ok(result.error,state);assert.equal(queries,before);assert.ok(!JSON.stringify(result).includes('PRIVATE'));if(state==='deceased')assert.ok(!/deceased/i.test(result.error));}
 status='lifetime';result=await mod.checkRenewalEligibility({},form);assert.equal(result.kind,'lifetime');assert.match(result.success,/no annual renewal or payment/i);
 bm=true;result=await mod.checkRenewalEligibility({},form);assert.match(result.success,/seumur hidup/);bm=false;
 status='eligible';pending=true;assert.match((await mod.checkRenewalEligibility({},form)).error,/already on file/);pending=false;
 limited=true;assert.match((await mod.checkRenewalEligibility({},form)).error,/Too many checks/);limited=false;
 fail=true;assert.match((await mod.checkRenewalEligibility({},form)).error,/before paying/);fail=false;
 form.set('year','2040');assert.match((await mod.checkRenewalEligibility({},form)).error,/valid renewal year/);
 const ui=fs.readFileSync('app/renew/form.tsx','utf8');assert.match(ui,/checked&&<>/);assert.match(ui,/action=\{checked\?action:checkAction\}/);assert.match(ui,/value=\{lookupValue\}/);assert.match(ui,/value=\{selectedYear\}/);
 console.log('PASS: eligibility preflight blocks ineligible, lifetime, pending, rate-limited and unavailable cases without proof, member data disclosure, payment writes or email; controlled fields and gated payment UI.');
})().catch(e=>{console.error(e);process.exitCode=1;});

