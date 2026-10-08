const fs=require('fs'),ts=require('typescript'),assert=require('node:assert/strict');
function load(file,mocks={}){const out={};new Function('exports','require','process','Buffer',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText)(out,n=>n in mocks?mocks[n]:require(n),process,Buffer);return out;}
let stored,allowed=true,paid=true;
const sql=async(parts,...v)=>{const q=parts.join('?');if(q.startsWith('INSERT INTO shop_invoices')){if(!stored)stored={payload:v[1],sequence:'1',issued_at:new Date('2026-10-08T00:00:00Z')};return [];}if(q.startsWith('SELECT i.sequence'))return stored&&paid?[stored]:[];return [];};
const invoices=load('lib/shop-invoices.ts',{'server-only':{},'./shop':{db:()=>sql},'./renewals':{sealRenewal:s=>'encrypted:'+s,openRenewal:s=>s.slice(10)}});
const pricing=load('lib/shop-order-pricing.ts');
const pdf=load('lib/shop-invoice-pdf.ts',{'./shop-order-pricing':pricing});
const order={id:'00000000-0000-4000-8000-000000000001',customer_name:'Example Customer',product_name:'KPKMM Club Polo Shirt',quantity:2,unit_price:8000,original_unit_price:10000,discount_percent:20,delivery_fee:800,fulfilment:'delivery',language:'en'};
(async()=>{
 await invoices.recordShopInvoice(sql,order);const snapshot=stored.payload;await invoices.recordShopInvoice(sql,{...order,unit_price:99999});assert.equal(stored.payload,snapshot);assert.match(snapshot,/^encrypted:/);
 const invoice=await invoices.shopInvoice(order.id);assert.equal(invoice.order.unit_price,8000);assert.match(invoice.number,/KPKMM-SHOP-2026-000001/);
 const bytes=await pdf.shopInvoicePdf({...invoice,number:'SAMPLE-'+invoice.number});assert.equal((await require('pdf-lib').PDFDocument.load(bytes)).getPageCount(),1);
 fs.mkdirSync('../output/pdf',{recursive:true});fs.writeFileSync('../output/pdf/sample-marketplace-invoice.pdf',bytes);
 const bm=await pdf.shopInvoicePdf({...invoice,order:{...order,fulfilment:'pickup',delivery_fee:0}},true);assert.equal((await require('pdf-lib').PDFDocument.load(bm)).getPageCount(),1);
 const route=load('app/shop/orders/[id]/invoice/route.ts',{'../../../../../lib/shop':{uuid:s=>s===order.id,isAdmin:async()=>false,ownsOrder:async()=>allowed},'../../../../../lib/shop-invoices':invoices,'../../../../../lib/shop-invoice-pdf':pdf});
 const req=new Request('https://example.invalid/shop/orders/'+order.id+'/invoice');const context={params:Promise.resolve({id:order.id})};
 let response=await route.GET(req,context);assert.equal(response.status,200);assert.match(response.headers.get('Cache-Control'),/no-store/);assert.equal(response.headers.get('Content-Type'),'application/pdf');
 allowed=false;assert.equal((await route.GET(req,context)).status,404);allowed=true;paid=false;assert.equal((await route.GET(req,context)).status,404);
 console.log('PASS marketplace invoice: immutable pricing, duplicate prevention, separate reference, logo PDF EN/BM, delivery/pickup, paid-only and private downloads.');
})().catch(e=>{console.error(e);process.exitCode=1;});
