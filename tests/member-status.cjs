const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
function load(file,mocks){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>n in mocks?mocks[n]:require(n),Buffer,FormData,Intl,Date});return exports;}
let appRows=[],renewRows=[];
const m=load('lib/member-status.ts',{'./shop':{db:()=>async p=>p.join('').includes('club_applications')?appRows:renewRows},'./membership':{membershipReady:async()=>{},fingerprint:v=>'app-'+v,unseal:JSON.parse},'./renewals':{renewalsReady:async()=>{},renewalHash:v=>'renew-'+v,openRenewal:v=>v}});
const now=new Date('2026-10-05T04:00:00Z'),approved=year=>({status:'approved',year});
assert.equal(m.calculateStatus([approved(2026)],now).status,'active');
assert.equal(m.calculateStatus([approved(2026)],new Date('2026-12-31T15:59:59Z')).status,'active');
assert.equal(m.calculateStatus([approved(2026)],new Date('2026-12-31T16:00:00Z')).status,'expired');
assert.equal(m.calculateStatus([approved(2027)],now).status,'future');
assert.equal(m.calculateStatus([{status:'pending',year:2026}],now).status,'pending');
assert.equal(m.calculateStatus([{status:'rejected',year:2026}],now).status,'inactive');
assert.equal(m.calculateStatus([approved(null)],now).status,'verification');
assert.equal(m.calculateStatus([],now).status,'unmatched');
const mixed=m.calculateStatus([approved(2025),{status:'pending',year:2026}],now);assert.equal(mixed.status,'expired');assert.equal(mixed.pending,true);
assert.equal(m.calculateStatus([approved(2026),approved(2027)],now).year,2026);
const f=new FormData();f.set('email',' MEMBER@example.invalid ');f.set('identityType','mykad');f.set('identity','900101-10-1234');assert.equal(m.validateLookup(f).identityKey,'mykad:malaysia:900101101234');assert.equal(m.validateLookup(f).email,'member@example.invalid');
f.set('identity','bad');assert.throws(()=>m.validateLookup(f));f.set('identityType','passport');f.set('identity','test12345');f.set('country',' Test Country ');assert.equal(m.validateLookup(f).identityKey,'passport:test country:TEST12345');
(async()=>{
 const year=m.malaysiaYear();appRows=[{payload:JSON.stringify({email:'member@example.invalid',identity:'NEVER_RETURN',address:'PRIVATE'}),status:'approved',membership_year:year}];
 assert.equal((await m.lookupMembership('other@example.invalid','x')).status,'unmatched');
 const result=await m.lookupMembership('member@example.invalid','x');assert.equal(result.status,'active');assert.ok(!JSON.stringify(result).includes('PRIVATE'));assert.ok(!JSON.stringify(result).includes('NEVER_RETURN'));
 appRows=[];renewRows=[{payload:JSON.stringify({email:'member@example.invalid'}),review_status:'approved',renewal_year:year}];assert.equal((await m.lookupMembership('member@example.invalid','x')).status,'active');
 let allowed=false,lookups=0,broken=false;
 const action=load('app/membership-status/actions.ts',{'next/headers':{headers:async()=>({get:()=>null})},'../../lib/membership':{membershipReady:async()=>{},applicationLimit:async()=>allowed,fingerprint:v=>v},'../../lib/member-status':{validateLookup:m.validateLookup,lookupMembership:async()=>{lookups++;if(broken)throw Error('database');return {status:'active',year};}}});
 assert.ok((await action.checkMembership({},f)).error);assert.equal(lookups,0);allowed=true;assert.equal((await action.checkMembership({},f)).membership.status,'active');broken=true;const failure=await action.checkMembership({},f);assert.ok(failure.error);assert.equal(failure.membership,undefined);
 console.log('PASS: Malaysia year-end expiry, approved/pending/rejected/future/undated states, existing-member renewals, normalised lookup, email mismatch, minimal result, rate limits and unavailable-storage safety. No real member records used.');
})().catch(e=>{console.error(e);process.exitCode=1;});
