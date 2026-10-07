const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
function load(file,mocks){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>n in mocks?mocks[n]:require(n),Buffer,FormData,Intl,Date});return exports;}
let appRows=[],renewRows=[],queries=[];
const m=load('lib/member-status.ts',{'./roster':{lookupMyKadRoster:async()=>null,normalizeName:v=>v.trim().replace(/\s+/g,' ').toUpperCase(),lookupName:async()=>({status:'active',year:new Date().getFullYear()})},'./shop':{db:()=>async(p,...values)=>{const q=p.join('?');queries.push({q,values});assert.ok(!q.includes('payload'));assert.ok(q.includes("='approved'"));assert.ok(q.includes('year=?'));return (q.includes('club_applications')?appRows:renewRows).filter(r=>r.year===values[1]&&r.status==='approved');}},'./membership':{membershipReady:async()=>{},fingerprint:v=>'app-'+v},'./renewals':{renewalsReady:async()=>{},renewalHash:v=>'renew-'+v}});
const now=new Date('2026-10-05T04:00:00Z'),approved=year=>({status:'approved',year});
assert.equal(m.calculateStatus([approved(2026)],now).status,'active');
assert.equal(m.calculateStatus([approved(2026)],new Date('2026-12-31T15:59:59Z')).status,'active');
assert.equal(m.calculateStatus([approved(2026)],new Date('2026-12-31T16:00:00Z')).status,'inactive');
for(const records of [[],[approved(2025)],[approved(2027)],[approved(null)],[{status:'pending',year:2026}],[{status:'rejected',year:2026}]])assert.equal(m.calculateStatus(records,now).status,'inactive');
const f=new FormData();f.set('identity','900101-10-1234');assert.equal(m.validateLookup(f).identityKey,'mykad:malaysia:900101101234');
f.set('identity','900101101234');assert.equal(m.validateLookup(f).identityKey,'mykad:malaysia:900101101234');
for(const bad of ['TEST12345','123','', '9001011012345']){const badForm=new FormData();badForm.set('identity',bad);assert.throws(()=>m.validateLookup(badForm));}
(async()=>{
 const year=m.malaysiaYear(),identityKey=m.validateLookup(f).identityKey;
 assert.equal((await m.lookupMembership(identityKey)).status,'inactive');
 appRows=[approved(year)];const result=await m.lookupMembership(identityKey);assert.equal(result.status,'active');assert.deepEqual(Object.keys(result).sort(),['status','year']);
 appRows=[approved(year-1)];assert.equal((await m.lookupMembership(identityKey)).status,'inactive');
 appRows=[];renewRows=[approved(year)];assert.equal((await m.lookupMembership(identityKey)).status,'active');
 renewRows=[{status:'pending',year}];assert.equal((await m.lookupMembership(identityKey)).status,'inactive');
 f.set('name','Example Member');
 let allowed=false,lookups=0,broken=false;
 const action=load('app/membership-status/actions.ts',{'next/headers':{headers:async()=>({get:()=>null})},'../../lib/membership':{membershipReady:async()=>{},applicationLimit:async()=>allowed,fingerprint:v=>v},'../../lib/member-status':{validateLookup:m.validateLookup,lookupMembership:async key=>{assert.equal(key,'name:EXAMPLE MEMBER');lookups++;if(broken)throw Error('database');return {status:'active',year};}}});
 assert.ok((await action.checkMembership({},f)).error);assert.equal(lookups,0);allowed=true;assert.equal((await action.checkMembership({},f)).membership.status,'active');broken=true;const failure=await action.checkMembership({},f);assert.ok(failure.error);assert.equal(failure.membership,undefined);
 console.log('PASS: MyKad-only validation, approved current-year matching in both tables, inactive for absent/old/future/pending records, Malaysia year-end boundary, no personal payload queries, minimal result, rate limiting and storage-failure safety.');
})().catch(e=>{console.error(e);process.exitCode=1;});
