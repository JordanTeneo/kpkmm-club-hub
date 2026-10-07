const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
let claimed=false,sends=0,outcome='accepted';const updates=[];
const order={id:'00000000-0000-0000-0000-000000000001',customer_name:'Test Buyer',email:'buyer@example.invalid',product_name:'Club shirt',quantity:2,unit_price:2500,language:'en'};
const sql=async(p,...v)=>{const q=p.join('?');updates.push({q,v});if(q.includes("SET status='sending'")){if(claimed)return [];claimed=true;return [order];}return [];};
const mocks={'./shop':{db:()=>sql,shopReady:async()=>{},uuid:x=>/^[a-f0-9-]{36}$/.test(x),money:x=>'RM '+(x/100).toFixed(2)},'./gmail':{CLUB_EMAIL:'kelabpeminatkeretaminimalaysia@gmail.com',SITE_ORIGIN:'https://kpkmm-club-hub.vercel.app'},'./enrolment':{enrolmentMessage:(to,subject,body)=>({to,subject,body})},'./renewals':{sendClubMessage:async()=>{sends++;if(outcome==='throw')throw Error('timeout');return {state:outcome};}}};
const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/shop-mail.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:out,require:n=>mocks[n]||require(n)});
(async()=>{
 const admin=out.shopMessage(order,'purchase');assert.equal(admin.to,'kelabpeminatkeretaminimalaysia@gmail.com');assert(admin.body.includes('/admin/shop?order='+order.id));assert(!admin.body.includes(order.email));assert(admin.body.includes('RM 50.00'));
 const customer=out.shopMessage(order,'completed');assert.equal(customer.to,order.email);assert(customer.body.includes('purchase is complete'));assert(!customer.body.includes('/admin/'));assert(!customer.body.includes('token'));
 assert(out.shopMessage({...order,language:'ms'},'completed').subject.includes('Pembelian selesai'));
 await Promise.all([out.deliverShopMail(order.id,'completed'),out.deliverShopMail(order.id,'completed')]);assert.equal(sends,1);
 assert(updates.some(x=>x.v.includes('accepted')));
 claimed=false;outcome='throw';await out.deliverShopMail(order.id,'purchase');assert(updates.some(x=>x.v.includes('unknown')));
 assert(updates.some(x=>x.q.includes("o.status='paid'")&&x.q.includes("o.status='review'")));
 await out.queueShopMail(sql,order.id,'purchase');assert(updates.some(x=>x.q.includes('ON CONFLICT(order_id,kind) DO NOTHING')));
 console.log('PASS: recipients, language, protected link, amounts, duplicate claim, uncertain delivery and durable queue. No emails sent.');
})().catch(e=>{console.error(e);process.exitCode=1;});
