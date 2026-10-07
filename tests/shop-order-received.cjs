const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
let stored=false,stockWrites=0,queued=0,sends=0,inside=false,failMail=false,failInsert=false;
const id='00000000-0000-0000-0000-000000000001',token='a'.repeat(64);
const sql=async(parts,...values)=>{const q=parts.join('?');if(q.includes('SELECT token_hash'))return stored?[{token_hash:token}]:[];if(q.includes('SELECT * FROM shop_products'))return [{name:'Test',active:true,stock:5,price:1000,discount_percent:20,delivery_fee:0}];if(q.includes('SET stock=stock-'))stockWrites++;if(q.includes('INSERT INTO shop_orders')){assert.equal(values[5],800);assert.equal(values.at(-2),1000);assert.equal(values.at(-1),20);if(failInsert)throw Error('insert failed');stored=true;}return [];};
sql.json=x=>x;sql.begin=async f=>{inside=true;try{return await f(sql);}finally{inside=false;}};
const mocks={
 '../../lib/shop-pricing':{discountedPrice:(price,percent)=>Math.round(price*(100-percent)/100)},
 'next/headers':{cookies:async()=>({set:()=>{}}),headers:async()=>({get:()=>null})},'next/cache':{revalidatePath:()=>{}},'next/navigation':{redirect:url=>{throw Error('redirect:'+url);}},
 '../../lib/shop':{db:()=>sql,shopReady:async()=>{},digest:x=>x,uuid:x=>x===id,limit:async()=>{}},'../../lib/club-data':{},
 '../../lib/shop-customer':{readShopCustomer:()=>({name:'Test Buyer',phone:'0182262000',email:'test@example.invalid',address:{}})},
 '../../lib/shop-fulfilment':{fulfilmentQuote:()=>({mode:'pickup',fee:0})},'../language':{getLanguage:async()=>'en'},
 '../../lib/shop-mail':{queueShopMail:async(_sql,_id,kind)=>{assert(inside);assert.equal(kind,'received');queued++;},deliverShopMail:async(_id,kind)=>{assert(!inside);assert.equal(kind,'received');sends++;if(failMail)throw Error('mail offline');}}
};
const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/shop/actions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:out,require:n=>mocks[n]||require(n),process});
const f=new FormData();for(const [key,value] of Object.entries({id,product:id,token,quantity:'1',price:'800',consent:'yes'}))f.set(key,value);
(async()=>{
 f.set('price','1');assert((await out.placeOrder({},f)).error);assert.equal(stockWrites,0);assert.equal(queued,0);f.set('price','800');
 failInsert=true;assert((await out.placeOrder({},f)).error);assert.equal(queued,0);assert.equal(sends,0);stockWrites=0;failInsert=false;
 failMail=true;await assert.rejects(out.placeOrder({},f),/redirect:/);assert(stored);assert.equal(queued,1);assert.equal(sends,1);assert.equal(stockWrites,1);
 failMail=false;await assert.rejects(out.placeOrder({},f),/redirect:/);assert.equal(queued,1);assert.equal(stockWrites,1);
 console.log('PASS: receipt queued with order, send after commit, no send on failed insert, email failure preserves checkout, duplicate checkout does not requeue');
})().catch(e=>{console.error(e);process.exitCode=1;});
