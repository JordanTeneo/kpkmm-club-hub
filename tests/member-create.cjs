const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
let auth=false,duplicate=false,queries=[],saved;
const sql=async(p,...v)=>{const q=p.join('?');queries.push(q);if(q.startsWith('SELECT member_number FROM'))return duplicate?[{}]:[];if(q.startsWith('SELECT member_number AS'))return [{number:'B-26-359'},{number:'J-15-400'}];if(q.startsWith('INSERT INTO club_member_roster'))saved=v;return [];};sql.begin=async f=>f(sql);
const mod={};const details={name:'Example Member',identityType:'mykad',identity:'000000000001',country:'Malaysia',state:'Selangor',mailingCountry:'Malaysia',address:'Example address',phone:'0120000000',email:'example@example.invalid'};
const mocks={'./shop':{db:()=>sql,isAdmin:async()=>auth},'./membership':{validateApplicant:()=>details},'./member-admin':{adminRosterReady:async()=>{},validYear:y=>Number(y)},'./roster':{nameKey:s=>s},'./renewals':{renewalHash:s=>s,sealRenewal:s=>s}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/member-create.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:mod,require:n=>mocks[n]||require(n)});
const f=new FormData();f.set('year','2026');f.set('status','active');f.set('reason','Payment verified');
(async()=>{
 assert.equal(mod.nextMemberNumber(['B-09-001','J-25-1000','invalid'],'B',2026),'B-26-1001');assert.equal(mod.nextMemberNumber([],'P',2026),'P-26-001');
 await assert.rejects(()=>mod.createMember(f));assert.equal(queries.length,0);auth=true;
 const result=await mod.createMember(f);assert.equal(result.memberNumber,'B-26-401');assert.equal(saved[5],true);assert.ok(queries.find(q=>q.includes('status_override')&&q.endsWith(',true)')));assert.equal(JSON.parse(saved[4]).identity,details.identity);assert.ok(queries.find(q=>q.startsWith('LOCK TABLE')));assert.ok(queries.find(q=>q.includes('old_number')));assert.ok(queries.find(q=>q.startsWith('INSERT INTO club_roster_edits')));
 duplicate=true;saved=undefined;assert.ok((await mod.createMember(f)).error);assert.equal(saved,undefined);
 duplicate=false;details.state='Unconfigured';assert.ok((await mod.createMember(f)).error);assert.equal(saved,undefined);
 f.set('status','invalid');await assert.rejects(()=>mod.createMember(f));
 console.log('PASS: admin auth, club-wide next ID including reserved numbers, correct prefix/year, duplicate identity blocked, encrypted payload/audit, explicit status and unmapped-state safety.');
})().catch(e=>{console.error(e);process.exitCode=1;});
