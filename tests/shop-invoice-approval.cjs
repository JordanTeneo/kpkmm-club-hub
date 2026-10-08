const fs=require('fs'),ts=require('typescript'),assert=require('node:assert/strict');
let allowed=true,order,invoices,queued,sends,fail=false;
const id='00000000-0000-4000-8000-000000000001';
const sql=async(parts,...v)=>{const q=parts.join('?');if(q.includes('SELECT * FROM shop_orders'))return [order];if(q.includes('UPDATE shop_orders SET status='))order.status=v[0];return [];};
sql.begin=async fn=>{const backup={order:{...order},invoices,queued};try{return await fn(sql);}catch(e){({order,invoices,queued}=backup);throw e;}};
const mocks={
 'next/headers':{},'next/cache':{revalidatePath:()=>{}},'next/navigation':{},'../../lib/club-data':{},'../../lib/shop-pricing':{},'../../lib/shop-fulfilment':{},'../../lib/shop-customer':{},'../language':{},'../../lib/shop-settings':{},
 '../../lib/shop':{db:()=>sql,isAdmin:async()=>allowed,shopReady:async()=>{},uuid:s=>s===id},
 '../../lib/shop-invoices':{shopInvoicesReady:async()=>{},recordShopInvoice:async(_sql,snapshot)=>{assert.equal(snapshot.unit_price,8000);invoices++;if(fail)throw Error('Invoice storage failed');}},
 '../../lib/shop-mail':{queueShopMail:async(_sql,_id,kind)=>{assert.equal(kind,'completed');queued++;},deliverShopMail:async()=>{sends++;}}
};
const out={};new Function('exports','require',ts.transpileModule(fs.readFileSync('app/shop/actions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(out,n=>n in mocks?mocks[n]:require(n));
function reset(){order={id,status:'review',receipt:'private-receipt',unit_price:8000};invoices=queued=sends=0;fail=false;}
function form(status='paid'){const f=new FormData();f.set('id',id);f.set('status',status);return f;}
(async()=>{
 reset();allowed=false;assert((await out.updateOrder({},form())).error);assert.equal(invoices,0);allowed=true;
 reset();order.status='pending';assert((await out.updateOrder({},form())).error);assert.equal(invoices,0);
 reset();fail=true;assert((await out.updateOrder({},form())).error);assert.equal(order.status,'review');assert.equal(invoices,0);assert.equal(queued,0);assert.equal(sends,0);
 reset();assert((await out.updateOrder({},form())).success);assert.equal(order.status,'paid');assert.equal(invoices,1);assert.equal(queued,1);assert.equal(sends,1);
 assert((await out.updateOrder({},form())).error);assert.equal(invoices,1);assert.equal(sends,1);
 reset();assert((await out.updateOrder({},form('pending'))).success);assert.equal(invoices,0);assert.equal(sends,0);
 console.log('PASS marketplace invoice approval: shop permission, proof required, atomic invoice/payment/mail queue, rollback, duplicate confirmation and no invoice before approval.');
})().catch(e=>{console.error(e);process.exitCode=1;});
