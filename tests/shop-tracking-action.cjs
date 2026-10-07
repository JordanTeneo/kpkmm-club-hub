const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
function load(file,mocks={}){const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:out,require:n=>mocks[n]||require(n)});return out;}
const fulfilment=load('lib/shop-fulfilment.ts');let allowed=true,order,queued=0,sent=0,updated=0,throwMail=false;
const sql=async(parts,...values)=>{const q=parts.join('?');if(q.includes('FOR UPDATE'))return order?[order]:[];if(q.includes('SET carrier=')){updated++;order.carrier=values[0];order.tracking_number=values[1];}return [];};
sql.begin=async f=>f(sql);
const actions=load('app/shop/actions.ts',{
 '../../lib/shop-pricing':{},
 'next/headers':{},'next/cache':{revalidatePath:()=>{}},'next/navigation':{},
 '../../lib/shop':{db:()=>sql,shopReady:async()=>{},isAdmin:async()=>allowed,limit:async()=>{},uuid:s=>s==='00000000-0000-0000-0000-000000000001'},
 '../../lib/club-data':{},'../../lib/shop-customer':{},'../../lib/shop-fulfilment':fulfilment,'../language':{},
 '../../lib/shop-mail':{queueShopMail:async()=>{queued++;},deliverShopMail:async()=>{sent++;if(throwMail)throw Error('offline');}}
});
function form(){const f=new FormData();f.set('id','00000000-0000-0000-0000-000000000001');f.set('carrier','Courier');f.set('tracking_number','MY123');return f;}
(async()=>{
 order={status:'paid',fulfilment:'delivery',tracking_number:'',carrier:''};allowed=false;
 assert((await actions.saveOrderTracking({},form())).error);assert.equal(updated,0);allowed=true;
 for(const data of [{status:'pending',fulfilment:'delivery'},{status:'paid',fulfilment:'pickup'},{status:'cancelled',fulfilment:'delivery'}]){order={...data,tracking_number:''};assert((await actions.saveOrderTracking({},form())).error);}
 assert.equal(queued,0);
 order={status:'paid',fulfilment:'delivery',tracking_number:'',carrier:''};throwMail=true;
 assert((await actions.saveOrderTracking({},form())).success);assert.equal(updated,1);assert.equal(queued,1);assert.equal(order.tracking_number,'MY123');
 assert((await actions.saveOrderTracking({},form())).success);assert.equal(updated,1);assert.equal(queued,1);
 const changed=form();changed.set('tracking_number','different');assert((await actions.saveOrderTracking({},changed)).error);assert.equal(updated,1);
 console.log('PASS: tracking admin authorization, paid delivery guard, duplicate save, immutable dispatched details and retained save on mail failure');
})().catch(e=>{console.error(e);process.exitCode=1;});
