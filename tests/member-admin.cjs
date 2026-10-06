const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
function load(file,mocks={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>n in mocks?mocks[n]:require(n),Buffer,FormData,Response,Request,URL,Uint8Array});return exports;}
let authorised=false,writes=0,revision='original',override=false,rows=[];
const sql=async(p,...v)=>{const q=p.join('?');if(q.startsWith('SELECT DISTINCT'))return rows;if(q.includes('FOR UPDATE'))return [{payload:JSON.stringify({sourceRow:10}),revision}];if(q.includes('INSERT INTO club_roster_edits')||q.includes('INSERT INTO club_member_roster'))writes++;return [];};sql.begin=async fn=>fn(sql);
const mockRoster={rosterReady:async()=>{},nameKey:n=>n,identityKey:n=>n||null,validateRoster:d=>{if(!d.members[0].name)throw Error('name');return d;}};
const m=load('lib/member-admin.ts',{'./shop':{db:()=>sql,isAdmin:async()=>authorised},'./roster':mockRoster,'./membership':{membershipReady:async()=>{},fingerprint:v=>v},'./renewals':{renewalsReady:async()=>{},renewalHash:v=>v,sealRenewal:v=>'encrypted:'+v,openRenewal:v=>v}});
const f=new FormData();Object.entries({memberNumber:'B-09-001',name:'Sample Member',year:'2026',status:'inactive',reason:'Verified correction',revision:'original'}).forEach(([k,v])=>f.set(k,v));
(async()=>{
 await assert.rejects(()=>m.saveMember(f));assert.equal(writes,0);authorised=true;assert.equal(await m.saveMember(f),'saved');assert.equal(writes,2);
 revision='changed';assert.equal(await m.saveMember(f),'conflict');assert.equal(writes,2);
 f.set('status','other');assert.throws(()=>m.editedMember(f));f.set('status','active');f.set('reason','');assert.throws(()=>m.editedMember(f));
 assert.throws(()=>m.validYear('bad'));assert.throws(()=>m.validYear(1999));
 rows=[{member_number:'B-09-001',membership_year:2025,payload:JSON.stringify({name:'Sample',identity:''}),active:true,status_override:false,revision:'old'}];assert.equal((await m.listMembers(2026))[0].active,false);rows[0].membership_year=2026;assert.equal((await m.listMembers(2026))[0].active,true);
 rows=['A-10-038','J-26-1000','W-25-010','B-09-001','P-20-2','UNKNOWN'].map(member_number=>({...rows[0],member_number}));
 assert.deepEqual(Array.from(await m.listMembers(2026),r=>r.memberNumber),['B-09-001','P-20-2','W-25-010','A-10-038','J-26-1000','UNKNOWN']);
 assert.ok(m.compareMemberNumbers({memberNumber:'B-26-001'},{memberNumber:'J-25-1'})<0);
 const excel=load('lib/member-excel.ts');const sample=excel.memberWorkbook([['ID','Name'],['001','=HYPERLINK("bad")'],['002','A & B < C']],'2026 active');assert.equal(sample.readUInt32LE(0),0x04034b50);assert.ok(sample.includes(Buffer.from('t="inlineStr"')));assert.ok(!sample.includes(Buffer.from('<f>')));assert.ok(sample.includes(Buffer.from('A &amp; B &lt; C')));
 fs.writeFileSync('../work/member-export-test.xlsx',sample);
 let captured;
 const route=load('app/admin/members/roster/export/route.ts',{'../../../../../lib/shop':{isAdmin:async()=>authorised},'../../../../../lib/member-admin':{validYear:m.validYear,listMembers:async()=>[{memberNumber:'001',name:'Sample',active:true,phone:'0123',email:'',address:'',identity:'private'},{memberNumber:'002',name:'Other',active:false,phone:'',email:'',address:'',identity:''}]},'../../../../../lib/member-excel':{memberWorkbook:(r,s)=>{captured=r;return excel.memberWorkbook(r,s);}}});
 authorised=false;assert.equal((await route.GET(new Request('https://example.invalid?year=2026&status=all'))).status,401);authorised=true;
 let response=await route.GET(new Request('https://example.invalid?year=2026&status=active'));assert.equal(response.status,200);assert.match(response.headers.get('Cache-Control'),/no-store/);assert.equal(captured.length,2);assert.equal(captured[1].length,10);assert.ok(!captured.flat().includes('private'));
 response=await route.GET(new Request('https://example.invalid?year=2026&status=inactive'));assert.equal(captured[1][0],'002');
 await route.GET(new Request('https://example.invalid?year=2026&status=all&identity=yes'));assert.equal(captured.length,3);assert.equal(captured[1][10],'private');
 assert.equal((await route.GET(new Request('https://example.invalid?year=oops&status=all'))).status,400);
 console.log('PASS: admin-only editing/export, stale-edit protection, audit transaction, year handling, filtered XLSX, private headers, optional identity columns, literal cells/formula-injection protection.');
})().catch(e=>{console.error(e);process.exitCode=1;});
