const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/shop-fulfilment.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:out});
for(const [value,cents] of [['0',0],['8.50',850],['10000',1000000]])assert.equal(out.deliveryFeeCents(value),cents);
for(const value of ['',null,'-1','1.001','Infinity','1e3','10000.01'])assert.throws(()=>out.deliveryFeeCents(value));
assert.equal(out.fulfilmentQuote('pickup',850,850).fee,0);
assert.equal(out.fulfilmentQuote('delivery',850,'850').fee,850);
assert.throws(()=>out.fulfilmentQuote('delivery',850,0));
assert.throws(()=>out.fulfilmentQuote('other',850,850));
function form(carrier,number){const f=new FormData();f.set('carrier',carrier);f.set('tracking_number',number);return f;}
assert.equal(out.readTracking(form('Courier','MY123')).number,'MY123');
for(const [carrier,number] of [['','MY123'],['Courier',''],['Courier','a'.repeat(101)],['Courier','MY\n123']])assert.throws(()=>out.readTracking(form(carrier,number)));
const actions=fs.readFileSync('app/shop/actions.ts','utf8');
assert(actions.includes("order.status!=='paid'||order.fulfilment!=='delivery'"));
assert(actions.includes('fulfilmentQuote(form.get'));
assert(actions.includes("id,'tracking'"));
for(const file of ['app/admin/shop/page.tsx','app/shop/orders/[id]/page.tsx'])assert(fs.readFileSync(file,'utf8').includes('FulfilmentSummary'));
console.log('PASS: fee bounds, pickup/delivery validation, stale fee protection, tracking validation and guarded UI');
