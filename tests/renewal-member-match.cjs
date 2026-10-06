const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
function load(file,mocks){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>n in mocks?mocks[n]:require(n),Buffer,FormData,File,Intl,Date});return exports;}
let records=[],inserts=0,mails=0,proofReads=0,allowed=false;
const sql=async(parts,...values)=>{const query=parts.join('?');if(query.includes('AS latest')){assert.match(query,/DISTINCT ON\(member_number\)/);assert.match(query,/membership_year DESC/);assert.equal(values[0],2026);assert.equal(values[1],'mykad:malaysia:900101101234');return records;}return [];};
const roster=load('lib/roster.ts',{'./shop':{db:()=>sql},'./membership':{},'./renewals':{renewalHash:v=>v}});
const action=load('app/renew/actions.ts',{'next/headers':{headers:async()=>({get:()=>null})},'next/cache':{revalidatePath:()=>{}},'../../lib/shop':{db:()=>async()=>{inserts++;return [{id:'test'}];},readImage:async()=>{proofReads++;return {bytes:Buffer.from('test'),type:'image/png'};}},'../../lib/membership':{validateApplicant:()=>({name:'Sample Member',identityType:'mykad',country:'Malaysia',identity:'900101101234',email:'test@example.invalid'})},'../language':{getLanguage:async()=> 'en'},'../../lib/renewal-member':{renewalLookup:()=>({mode:'name',value:'Sample Member'}),findRenewalMember:async()=>allowed?{status:'eligible',identityHash:'test',details:{rosterMemberNumber:'B-09-001',name:'Sample Member'}}:{status:'missing'}},'../../lib/renewals':{renewalsReady:async()=>{},renewalLimit:async()=>true,renewalHash:v=>v,sealRenewal:v=>v,deliverRenewal:async()=>{mails++;return 'accepted';}}});
(async()=>{
 const key='mykad:malaysia:900101101234';
 assert.equal(await roster.renewalMemberMatches('Sample Member',key,2026),false);
 records=[{member_number:'B-09-001',name_hash:roster.nameKey('Sample Member')}];
 assert.equal(await roster.renewalMemberMatches(' sample   MEMBER ',key,2026),true);
 assert.equal(await roster.renewalMemberMatches('Another Member',key,2026),false);
 records.push({...records[0],member_number:'B-09-002'});assert.equal(await roster.renewalMemberMatches('Sample Member',key,2026),false);
 const form=new FormData();form.set('consent','yes');form.set('year',new Intl.DateTimeFormat('en',{year:'numeric',timeZone:'Asia/Kuala_Lumpur'}).format(new Date()));form.set('proof',new File(['test'],'proof.png',{type:'image/png'}));
 assert.match((await action.requestRenewal({},form)).error,/No matching registered member/);assert.equal(inserts,0);assert.equal(mails,0);assert.equal(proofReads,0);
 allowed=true;assert.ok((await action.requestRenewal({},form)).success);assert.equal(inserts,1);assert.equal(mails,1);
 console.log('PASS: registered name matching, case/space normalization, unknown and ambiguous identities blocked; rejected renewals neither save proof nor send email. Mock data only.');
})().catch(e=>{console.error(e);process.exitCode=1;});
