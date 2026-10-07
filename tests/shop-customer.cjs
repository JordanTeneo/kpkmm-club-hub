const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/shop-customer.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:out});
function form(extra={}){const f=new FormData();Object.entries({name:'Test Customer',phone:'0182262000',email:'TEST@example.com',address:'12 Test Road, Test Town',postcode:'43000',state:'Selangor',mailingCountry:'Malaysia',...extra}).forEach(([k,v])=>f.set(k,v));return f;}
assert.equal(out.readShopCustomer(form()).email,'test@example.com');
for(const field of ['name','phone','email','address','postcode','state','mailingCountry'])assert.throws(()=>out.readShopCustomer(form({[field]:''})));
for(const data of [{email:'bad'},{postcode:'1234'},{address:'short'},{name:'x'.repeat(101)}])assert.throws(()=>out.readShopCustomer(form(data)));
assert.equal(out.readShopCustomer(form({mailingCountry:'United Kingdom',postcode:'SW1A 1AA'})).address.postcode,'SW1A 1AA');
const actions=fs.readFileSync('app/shop/actions.ts','utf8');
assert(actions.includes('readShopCustomer(form)'));assert(actions.includes('sql.json(address)'));
assert(actions.includes("!order.receipt||order.status!=='review'"));
assert(actions.includes("status IN ('pending','review')"));
assert(actions.includes("if(!(await isAdmin('shop')))"));
for(const file of ['app/admin/shop/page.tsx','app/shop/orders/[id]/page.tsx']){const source=fs.readFileSync(file,'utf8');assert(source.includes('customer_address'));assert(source.includes('AddressDisplay'));}
console.log('PASS: required customer fields, address validation, protected order displays and payment transition guards');
