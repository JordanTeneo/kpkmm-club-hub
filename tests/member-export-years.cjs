const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
function load(file,mocks={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>mocks[n]||require(n),Buffer,Response,Request,URL,Uint8Array});return exports;}
const excel=load('lib/member-excel.ts');
let allowed=true,fail=false,called=[];
const route=load('app/admin/members/roster/export/route.ts',{
 '../../../../../lib/annual-status':{statusLabel:s=>s},
 '../../../../../lib/shop':{isAdmin:async()=>allowed},
 '../../../../../lib/member-admin':{validYear:v=>{const y=Number(v);if(!Number.isInteger(y)||y<2000||y>2200)throw Error();return y;},listMembers:async y=>{called.push(y);if(fail)throw Error();return [{memberNumber:'B-09-001',name:'=1+1 & Test',annualStatus:y===2025?'active':'inactive',phone:'0123',email:'',address:'',identity:'001234'}];}},
 '../../../../../lib/member-excel':excel
});
function entries(buf){const result={};let p=0;while(buf.readUInt32LE(p)===0x04034b50){const size=buf.readUInt32LE(p+18),nameLength=buf.readUInt16LE(p+26),extra=buf.readUInt16LE(p+28),start=p+30+nameLength+extra;result[buf.toString('utf8',p+30,p+30+nameLength)]=buf.toString('utf8',start,start+size);p=start+size;}return result;}
const request=q=>route.GET(new Request('https://example.test/?'+q));
(async()=>{
 let r=await request('from=2025&to=2026&status=active');assert.equal(r.status,200);assert.deepEqual(called,[2025,2026]);assert.match(r.headers.get('content-disposition'),/2025-2026-active/);
 let files=entries(Buffer.from(await r.arrayBuffer()));assert.match(files['xl/workbook.xml'],/name="2025 active".*name="2026 active"/);assert.match(files['xl/_rels/workbook.xml.rels'],/Id="rId3".*styles/);assert.match(files['[Content_Types].xml'],/sheet2.xml/);
 assert.match(files['xl/worksheets/sheet1.xml'],/=1\+1 &amp; Test/);assert.ok(!files['xl/worksheets/sheet1.xml'].includes('<f>'));assert.ok(!files['xl/worksheets/sheet1.xml'].includes('001234'));assert.ok(!files['xl/worksheets/sheet2.xml'].includes('B-09-001'));
 r=await request('from=2025&to=2026&status=all&identity=yes');files=entries(Buffer.from(await r.arrayBuffer()));assert.match(files['xl/worksheets/sheet2.xml'],/001234/);assert.match(files['xl/worksheets/sheet2.xml'],/inactive/);
 assert.equal((await request('year=2026&status=all')).status,200);
 for(const q of ['from=2026&to=2025','from=2000&to=2025','from=bad&to=2026','from=2025&to=','from=2025&to=2201'])assert.equal((await request(q+'&status=all')).status,400);
 called=[];allowed=false;assert.equal((await request('from=2025&to=2026&status=all')).status,401);assert.equal(called.length,0);
 allowed=true;fail=true;assert.equal((await request('from=2025&to=2026&status=all')).status,503);
 assert.throws(()=>excel.memberYearWorkbook([{name:'2025',rows:[['ID']]},{name:'2025',rows:[['ID']]}]));
 console.log('PASS: Multi-year XLSX package, annual filtering, optional identity, literal cells, single-year compatibility, range bounds, authorization and failure handling.');
})().catch(e=>{console.error(e);process.exitCode=1;});
