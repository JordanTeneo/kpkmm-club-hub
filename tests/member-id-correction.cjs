const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
let authorised=true,duplicate=false,retired=false,stale=false,queries=[];
const sql=async(p,...v)=>{const q=p.join('?');queries.push({q,v});
 if(q.startsWith('SELECT payload,active'))return [{payload:JSON.stringify({memberNumber:'B-09-001',sourceRow:2}),revision:stale?'changed':'original'}];
 if(q.startsWith('SELECT member_number FROM'))return duplicate?[{member_number:'A-10-002'}]:[];
 if(q.startsWith('SELECT old_number'))return retired?[{old_number:'B-26-002'}]:[];
 if(q.startsWith('SELECT membership_year,payload'))return [2025,2026].map(year=>({membership_year:year,payload:JSON.stringify({memberNumber:'B-09-001',name:'Sample',active:year===2026})}));
 return [];};sql.begin=async fn=>fn(sql);
const mocks={'./shop':{db:()=>sql,isAdmin:async()=>authorised},'./roster':{rosterReady:async()=>{},validateRoster:d=>d,nameKey:v=>v,identityKey:v=>v},'./membership':{membershipReady:async()=>{}},'./renewals':{renewalsReady:async()=>{},sealRenewal:v=>v,openRenewal:v=>v}};
const exportsObject={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/member-admin.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exportsObject,require:n=>n==='./member-since'?{}:n==='./annual-status'?{annualStatus:m=>m.active?'active':'inactive'}:mocks[n]||require(n),Buffer});
// Match the real validator's return shape.
mocks['./roster'].validateRoster=d=>d;
const f=new FormData();Object.entries({memberNumber:'B-09-001',correctedMemberNumber:'B-26-002',name:'Sample',year:'2026',status:'active',reason:'Correct transcription',revision:'original'}).forEach(([k,v])=>f.set(k,v));
(async()=>{
 assert.equal(await exportsObject.saveMember(f),'confirm-id');
 f.set('confirmIdCorrection','yes');f.set('correctedMemberNumber','bad');assert.equal(await exportsObject.saveMember(f),'invalid-id');
 f.set('correctedMemberNumber','B-26-002');duplicate=true;assert.equal(await exportsObject.saveMember(f),'duplicate-id');duplicate=false;
 retired=true;assert.equal(await exportsObject.saveMember(f),'duplicate-id');retired=false;
 stale=true;assert.equal(await exportsObject.saveMember(f),'conflict');stale=false;
 queries=[];assert.equal(await exportsObject.saveMember(f),'saved');
 const changes=queries.filter(x=>x.q.startsWith('UPDATE club_member_roster SET member_number'));
 assert.equal(changes.length,2);assert.deepEqual(changes.map(x=>x.v[3]),[2025,2026]);
 assert.ok(changes.every(x=>JSON.parse(x.v[1]).memberNumber==='B-26-002'));
 assert.ok(queries.some(x=>x.q.startsWith('INSERT INTO club_member_id_history')));
 assert.ok(queries.some(x=>x.q.startsWith('UPDATE club_roster_edits')));
 const audit=queries.find(x=>x.q.startsWith('INSERT INTO club_roster_edits'));assert.match(audit.v[5],/B-09-001 → B-26-002/);
 authorised=false;await assert.rejects(()=>exportsObject.saveMember(f));
 console.log('PASS: ID correction confirmation, format, duplicate/retired checks, stale edits, all-year payload correction, audit retention and admin authentication. Mocked only; no member records changed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
