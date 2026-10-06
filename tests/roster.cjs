const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
function load(file,mocks){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>n in mocks?mocks[n]:require(n),Buffer,Map,Set,JSON,Date});return exports;}
let roster=[],apps=[],renewals=[],years=[null,null,null],transactions=0,inserted=0,repeated=false;
const sql=async(p,...v)=>{const q=p.join('?');if(q.includes('max('))return [{year:years[q.includes('club_member_roster')?0:q.includes('club_applications')?1:2]}];if(q.startsWith('SELECT member_number'))return roster;if(q.includes('SELECT payload,status'))return apps;if(q.includes('SELECT payload,review'))return renewals;if(q.includes('INSERT INTO club_roster_imports'))return repeated?[]:[{id:'test'}];if(q.includes('INSERT INTO club_member_roster')){inserted++;assert.equal(JSON.parse(v[0]).length,2);}return [];};
sql.begin=async fn=>{transactions++;return fn(sql);};
sql.json=JSON.stringify;
const m=load('lib/roster.ts',{'./shop':{db:()=>sql},'./membership':{membershipReady:async()=>{},fingerprint:v=>v,unseal:JSON.parse},'./renewals':{renewalsReady:async()=>{},renewalHash:v=>v,sealRenewal:v=>'encrypted:'+v,openRenewal:v=>v}});
const person={memberNumber:'B-09-001',name:'Sample Member',active:true,identity:'',phone:'',email:'',address:'',sourceRow:2};
const input={year:2026,source:'test',members:[person,{...person,memberNumber:'B-09-002',name:'Other Member',active:false}]};
assert.equal(m.normalizeName('  Sample   MEMBER  '),'SAMPLE MEMBER');assert.equal(m.identityKey('123'),null);
assert.throws(()=>m.validateRoster({...input,members:[person,person]}));assert.throws(()=>m.validateRoster({...input,year:NaN}));
assert.throws(()=>m.validateRoster({...input,members:[{...person,active:'yes'}]}));
(async()=>{
 let r=await m.importRoster(input);assert.equal(r.total,2);assert.equal(r.active,1);assert.equal(transactions,1);assert.equal(inserted,1);
 repeated=true;await m.importRoster(input);assert.equal(inserted,1);
 roster=[{member_number:'B-09-001',active:true,membership_year:2026}];
 assert.equal((await m.lookupName('Sample Member',2026)).status,'active');assert.equal((await m.lookupName('Sample Member',2027)).status,'inactive');
 roster.push({member_number:'B-09-002',active:false,membership_year:2026});assert.equal((await m.lookupName('Sample Member',2026)).status,'ambiguous');
 roster=[];assert.equal((await m.lookupName('Not Found',2026)).status,'inactive');
 const details={name:'Sample Member',identityType:'mykad',identity:'900101101234',country:'Malaysia'};
 apps=[{payload:JSON.stringify(details),status:'approved',membership_year:2026}];assert.equal((await m.lookupName('sample member',2026)).status,'active');
 apps[0].status='pending';assert.equal((await m.lookupName('sample member',2026)).status,'inactive');apps=[];
 renewals=[{payload:JSON.stringify(details),review_status:'approved',renewal_year:2026}];assert.equal((await m.lookupName('sample member',2026)).status,'active');
 const result=await m.lookupName('sample member',2026);assert.deepEqual(Object.keys(result).sort(),['status','year']);
 assert.equal(await m.renewalEligibility('test',2026),'review');years=[2024,null,null];assert.equal(await m.renewalEligibility('test',2026),'reinstate');years=[2025,null,null];assert.equal(await m.renewalEligibility('test',2026),'eligible');years=[2024,null,2026];assert.equal(await m.renewalEligibility('test',2026),'eligible');
 console.log('PASS: roster validation, permanent IDs, atomic idempotent import, exact normalized names, duplicate-name safety, year boundaries, approved online records, minimal public results, renewal eligibility.');
})().catch(e=>{console.error(e);process.exitCode=1;});
