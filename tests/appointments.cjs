const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
function load(file,mocks){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>n in mocks?mocks[n]:require(n),FormData,Date,Intl});return exports;}
let owner=true,enabled=true,queries=[],overlap=false,deceased=false,stale=false;
const sql=async(parts,...values)=>{const q=parts.join('?');queries.push({q,values});if(q.includes('SELECT version'))return [{version:stale?2:1,cancelled:false}];if(q.includes('SELECT payload'))return [{payload:JSON.stringify({name:'Test Member',deceased})}];if(q.includes('SELECT id FROM club_appointments'))return overlap?[{id:'existing'}]:[];return [];};sql.begin=async fn=>fn(sql);
const m=load('lib/appointments.ts',{'server-only':{},'./appointment-types':load('lib/appointment-types.ts',{}),'./shop':{db:()=>sql,isAdmin:async()=>owner},'./committee-access':{committeeEnabled:async()=>enabled,committeeSession:async()=>owner?{superAdmin:true,user:{id:'owner'}}:null},'./roster':{rosterReady:async()=>{}},'./renewals':{openRenewal:x=>x}});
function form(extra={}){const f=new FormData();Object.entries({member:'B-26-999',role:'chairman',starts:'2026-01-01',ends:'2026-12-31',publish:'yes',...extra}).forEach(([k,v])=>f.set(k,v));return f;}
(async()=>{
 owner=false;await assert.rejects(()=>m.saveAppointment(form()),/access/);assert.equal(queries.length,0);owner=true;
 for(const extra of [{ends:'2025-12-31'},{starts:'2026-02-30'},{publish:''},{role:'fake'},{role:'custom',roleEn:'Only English'}])await assert.rejects(()=>m.saveAppointment(form(extra)),/invalid/);
 await m.saveAppointment(form());assert.ok(queries.some(x=>x.q.includes('INSERT INTO club_appointments')));assert.ok(queries.some(x=>x.q.includes('pg_advisory_xact_lock')));assert.ok(queries.some(x=>x.q.includes('club_appointment_audit')&&x.values.includes('owner')));
 overlap=true;await assert.rejects(()=>m.saveAppointment(form()),/overlap/);overlap=false;deceased=true;await assert.rejects(()=>m.saveAppointment(form()),/invalid/);deceased=false;
 const edit={id:'00000000-0000-0000-0000-000000000001',version:'1'};stale=true;await assert.rejects(()=>m.saveAppointment(form(edit)),/stale/);stale=false;
 await m.saveAppointment(form({...edit,operation:'cancel'}));assert.ok(queries.some(x=>x.q.includes('SET cancelled=true')));
 queries=[];await m.publicAppointments();assert.ok(queries[0].q.includes('Asia/Kuala_Lumpur'));assert.ok(!/member_number|payload|email|identity/.test(queries[0].q));
 console.log('PASS appointments: owner guards, validation, overlap, deceased exclusion, concurrency token, cancellation, audit and public-field projection.');
})().catch(e=>{console.error(e);process.exitCode=1;});
