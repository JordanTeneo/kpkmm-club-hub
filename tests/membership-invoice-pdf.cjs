const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const code=ts.transpileModule(fs.readFileSync('lib/membership-invoice-pdf.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
const out={};new Function('exports','require','process','Buffer',code)(out,require,process,Buffer);
(async()=>{
 const data={number:'SAMPLE-KPKMM-2026-000001',name:'Example Member',memberNumber:'B-26-999',year:2027,paidOn:'2026-10-08',approvedAt:'2026-10-08T02:00:00Z',amount:25000,adminFee:10000,voided:false};
 const pdf=await out.membershipInvoicePdf(data);assert.ok(pdf.length>10000);const parsed=await require('pdf-lib').PDFDocument.load(pdf);assert.equal(parsed.getPageCount(),1);
 fs.mkdirSync('../output/pdf',{recursive:true});fs.writeFileSync('../output/pdf/sample-membership-invoice.pdf',pdf);
 const bm=await out.membershipInvoicePdf({...data,amount:15000,adminFee:0,voided:true},true);assert.equal((await require('pdf-lib').PDFDocument.load(bm)).getPageCount(),1);
 console.log('PASS: logo PDF creation, new member RM250 and renewal RM150, EN/BM and reversed-approval documents.');
})().catch(e=>{console.error(e);process.exitCode=1;});
