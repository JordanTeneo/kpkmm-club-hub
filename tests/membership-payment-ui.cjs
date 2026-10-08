const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict'),{renderToStaticMarkup}=require('react-dom/server');
function load(file,mocks){const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports:out,require:n=>n in mocks?mocks[n]:n.endsWith('.css')?{}:require(n),Response,URL,Buffer});return out;}
let admin=true,lang='en',captured;
const row={id:'id',source_id:'source',invoice_sequence:'1',kind:'renewal',membership_year:2027,paid_on:'2026-12-20',amount:15000,admin_fee:0,approved_at:'2026-12-21T00:00:00Z',voided_at:null,detail:{name:'Sample',memberNumber:'B-26-001',actor:'Test Admin'}};
const payments={paymentYear:()=>2026,paymentRegister:async()=>[row],paymentTotals:()=>[{year:2027,count:1,newFees:0,adminFees:0,renewalFees:15000,total:15000}],invoiceNumber:()=> 'KPKMM-2026-000001'};
const shop={isAdmin:async()=>admin,money:v=>'RM '+(v/100).toFixed(2),db:()=>async()=>[{renewals:2,applications:1}]};
const page=load('app/admin/payments/page.tsx',{'next/navigation':{redirect:()=>{throw Error('redirect');}},'../../../lib/shop':shop,'../../../lib/membership-payments':payments,'../../../lib/enrolment':{enrolmentReady:async()=>{}},'../../language':{getLanguage:async()=>lang}});
const excel=load('lib/member-excel.ts',{});
const route=load('app/admin/payments/export/route.ts',{'../../../../lib/shop':shop,'../../../../lib/membership-payments':payments,'../../../../lib/member-excel':{memberYearWorkbook:sheets=>{captured=sheets;return excel.memberYearWorkbook(sheets);}}});
(async()=>{
 const html=renderToStaticMarkup(await page.default({searchParams:Promise.resolve({year:'2026'})}));assert.match(html,/Advance payments/);assert.match(html,/RM 150.00/);assert.match(html,/Awaiting verification/);assert.match(html,/file=receipt/);assert.match(html,/file=invoice/);assert.match(html,/name="year"/);
 lang='ms';const bm=renderToStaticMarkup(await page.default({searchParams:Promise.resolve({year:'2026'})}));assert.match(bm,/Bayaran awal/);assert.doesNotMatch(bm,/Advance payments/);
 const res=await route.GET(new Request('https://example.invalid/admin/payments/export?year=2026'));assert.equal(res.status,200);assert.match(res.headers.get('Cache-Control'),/no-store/);assert.equal(captured[0].rows[1][0],'2027');assert.equal(captured[0].rows[1][5],150);assert.equal(captured[1].rows[1][8],150);assert.equal(typeof captured[1].rows[1][8],'number');
 const zip=Buffer.from(await res.arrayBuffer()).toString('utf8');assert.match(zip,/<v>150<\/v>/);assert.ok(!zip.includes('token'));assert.ok(!zip.includes('proof'));
 admin=false;await assert.rejects(()=>page.default({searchParams:Promise.resolve({})}),/redirect/);assert.equal((await route.GET(new Request('https://example.invalid/admin/payments/export'))).status,403);
 console.log('PASS: register EN/BM, advance-year cards, receipt/invoice navigation, pending separation, numeric Excel totals, private export and permission guards.');
})().catch(e=>{console.error(e);process.exitCode=1;});
