const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
let claimed=false,sends=0,outcome='accepted';const updates=[];
const order={id:'00000000-0000-0000-0000-000000000001',customer_name:'Test Buyer',email:'buyer@example.invalid',product_name:'Club shirt',quantity:2,unit_price:2500,language:'en'};
const sql=async(p,...v)=>{const q=p.join('?');updates.push({q,v});if(q.includes("SET status='sending'")){if(claimed)return [];claimed=true;return [order];}return [];};
const mocks={'./shop-invoices':{shopInvoice:async()=>null},'./shop':{db:()=>sql,shopReady:async()=>{},uuid:x=>/^[a-f0-9-]{36}$/.test(x),money:x=>'RM '+(x/100).toFixed(2)},'./gmail':{CLUB_EMAIL:'kelabpeminatkeretaminimalaysia@gmail.com',SITE_ORIGIN:'https://kpkmm-club-hub.vercel.app'},'./enrolment':{enrolmentMessage:(to,subject,body)=>({to,subject,body})},'./renewals':{sendClubMessage:async()=>{sends++;if(outcome==='throw')throw Error('timeout');return {state:outcome};}}};
const pricing={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/shop-order-pricing.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:pricing});mocks['./shop-order-pricing']=pricing;
const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/shop-mail.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:out,require:n=>mocks[n]||require(n)});
(async()=>{
 for(const language of ['en','ms']){
  const message=out.shopMessage({...order,language},'completed',true);
  assert(message.body.includes('/shop/orders/'+order.id+'/invoice?lang='+language));
  assert(!out.shopMessage({...order,language},'received',true).body.includes('/invoice'));
 }
 const admin=out.shopMessage(order,'purchase');assert.equal(admin.to,'kelabpeminatkeretaminimalaysia@gmail.com');assert(admin.body.includes('/admin/shop?order='+order.id));assert(!admin.body.includes(order.email));assert(admin.body.includes('RM 50.00'));
 const discounted=out.shopMessage({...order,unit_price:8000,original_unit_price:10000,discount_percent:20,delivery_fee:800},'purchase');
 for(const line of ['Original unit price: RM 100.00','Discount: 20%','Subtotal before discount: RM 200.00','Total discount savings: RM 40.00','Item subtotal after discount: RM 160.00','Expected payment total: RM 168.00'])assert(discounted.body.includes(line),line);
 const legacy=Object.fromEntries(pricing.orderPriceLines(order));assert.equal(legacy['Original unit price'],'Not recorded for this older order');assert.equal(legacy['Expected payment total'],'RM 50.00');
 const zero=Object.fromEntries(pricing.orderPriceLines({...order,original_unit_price:2500,discount_percent:0}));assert.equal(zero.Discount,'0%');assert.equal(zero['Total discount savings'],'RM 0.00');
 const bm=Object.fromEntries(pricing.orderPriceLines({...order,original_unit_price:2500},true));assert.equal(bm['Harga asal seunit'],'RM 25.00');
 const customer=out.shopMessage(order,'completed');assert.equal(customer.to,order.email);assert(customer.body.includes('purchase is complete'));assert(!customer.body.includes('/admin/'));assert(!customer.body.includes('token'));
 assert(out.shopMessage({...order,language:'ms'},'completed').subject.includes('Pembelian selesai'));
 const delivered={...order,fulfilment:'delivery',delivery_fee:800,carrier:'Test Courier',tracking_number:'MY123456'};
 for(const language of ['en','ms']){const received=out.shopMessage({...delivered,language},'received');assert.equal(received.to,order.email);assert(received.body.includes(order.id));assert(received.body.includes('RM 58.00'));assert(received.body.includes('Maybank'));assert(received.body.includes('5123 4360 5508'));assert(received.body.includes('/shop/orders/'+order.id));assert(!received.body.includes('/admin/'));assert.equal(received.subject,language==='ms'?'KPKMM — Tempahan diterima':'KPKMM — Order received');}
 assert(out.shopMessage({...order,fulfilment:'pickup'},'received').body.includes('018-226 2000 with your Order Reference'));
 assert(out.shopMessage(order,'received').body.includes('not confirmation of payment'));
 const paid=out.shopMessage(delivered,'completed');assert(paid.body.includes('RM 58.00'));assert(paid.body.includes('Delivery fee: RM 8.00'));
 assert(out.shopMessage(delivered,'purchase').body.includes('RM 58.00'));
 const pickup=out.shopMessage({...order,fulfilment:'pickup',delivery_fee:0},'completed');assert(pickup.body.includes('018-226 2000 with your Order Reference'));assert(pickup.body.includes('RM 50.00'));
 for(const language of ['en','ms']){const tracking=out.shopMessage({...delivered,language},'tracking');assert.equal(tracking.to,order.email);assert(tracking.body.includes('MY123456'));assert(tracking.body.includes('Test Courier'));assert(tracking.body.includes(order.id));assert(!tracking.body.includes('/admin/'));}
 await Promise.all([out.deliverShopMail(order.id,'completed'),out.deliverShopMail(order.id,'completed')]);assert.equal(sends,1);
 assert(updates.some(x=>x.v.includes('accepted')));
 claimed=false;await Promise.all([out.deliverShopMail(order.id,'received'),out.deliverShopMail(order.id,'received')]);assert.equal(sends,2);
 assert(updates.some(x=>x.q.includes("m.kind='received' AND o.status='pending'")));
 claimed=false;outcome='throw';await out.deliverShopMail(order.id,'purchase');assert(updates.some(x=>x.v.includes('unknown')));
 assert(updates.some(x=>x.q.includes("o.status='paid'")&&x.q.includes("o.status='review'")));
 await out.queueShopMail(sql,order.id,'purchase');assert(updates.some(x=>x.q.includes('ON CONFLICT(order_id,kind) DO NOTHING')));
 console.log('PASS: recipients, language, protected link, amounts, duplicate claim, uncertain delivery and durable queue. No emails sent.');
})().catch(e=>{console.error(e);process.exitCode=1;});
