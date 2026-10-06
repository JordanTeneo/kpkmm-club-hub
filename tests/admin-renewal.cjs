const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
let admin=false,row,records,audits,writes,fail=false;
const sql=async(p,...v)=>{const q=p.join('?');
 if(q.startsWith('SELECT *'))return row?[row]:[];
 if(q.startsWith('SELECT id'))return records;
 if(q.startsWith('INSERT INTO club_renewals')){records.push({id:v[0],proof:v[4],year:v[2],payload:v[3]});return [{id:v[0]}];}
 if(q.startsWith('INSERT INTO club_roster_edits')){audits++;return [];}
 if(q.startsWith('INSERT INTO club_member_roster')){if(fail)throw Error('storage failure');writes++;row={...row,member_number:v[0],membership_year:v[1],payload:v[4],active:true};}
 return [];
};
sql.begin=async fn=>{const backup=JSON.stringify({row,records,audits,writes});try{return await fn(sql);}catch(e){({row,records,audits,writes}=JSON.parse(backup));throw e;}};
const mocks={'./shop':{isAdmin:async()=>admin,db:()=>sql,readImage:async f=>{if(f.size>700*1024||f.type!=='image/png')throw Error('proof');return {bytes:Buffer.from(await f.arrayBuffer()),type:f.type};}},'./member-admin':{adminRosterReady:async()=>{},validYear:Number},'./renewals':{renewalsReady:async()=>{},renewalHash:s=>'hash:'+s,sealRenewal:s=>s,openRenewal:s=>s},'./member-status':{malaysiaYear:()=>2026}};
const mod={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/admin-renewal.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:mod,require:n=>mocks[n]||require(n),File,Buffer});
function reset(){row={member_number:'B-09-001',membership_year:2025,identity_hash:null,name_hash:'name',payload:JSON.stringify({name:'Example',memberNumber:'B-09-001',active:false,address:'Keep address'}),active:false,status_override:true};records=[];audits=writes=0;fail=false;}
function form(){const f=new FormData();Object.entries({member:'B-09-001',year:'2026',verified:'yes',reason:'Committee verified payment'}).forEach(([k,v])=>f.set(k,v));f.set('proof',new File(['mock image'],'proof.png',{type:'image/png'}));return f;}
(async()=>{reset();await assert.rejects(()=>mod.renewMemberByAdmin(form()));admin=true;
 let f=form();f.delete('proof');assert.equal(await mod.renewMemberByAdmin(f),'proof');assert.equal(writes,0);
 f=form();f.delete('verified');assert.equal(await mod.renewMemberByAdmin(f),'invalid');assert.equal(writes,0);
 f=form();f.set('year','2025');assert.equal(await mod.renewMemberByAdmin(f),'invalid');
 const id=await mod.renewMemberByAdmin(form());assert.match(id,/^[a-f0-9-]{36}$/);assert.equal(row.active,true);assert.equal(row.membership_year,2026);assert.equal(row.member_number,'B-09-001');assert.equal(JSON.parse(row.payload).address,'Keep address');assert.equal(records.length,1);assert.equal(records[0].proof,Buffer.from('mock image').toString('base64'));assert.equal(audits,1);
 assert.equal(await mod.renewMemberByAdmin(form()),'existing');assert.equal(writes,1);
 reset();fail=true;await assert.rejects(()=>mod.renewMemberByAdmin(form()));assert.equal(records.length,0);assert.equal(writes,0);assert.equal(row.active,false);
 reset();f=form();f.set('year','2027');await mod.renewMemberByAdmin(f);assert.equal(row.membership_year,2027);assert.equal(records[0].year,2027);
 console.log('PASS: authenticated admin, mandatory receipt/verification, permitted years, atomic receipt and activation, permanent ID, duplicate protection and rollback.');
})().catch(e=>{console.error(e);process.exitCode=1;});
