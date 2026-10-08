const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
function load(file,mocks){const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{exports:out,require:n=>n.endsWith('/membership-fees')||n.endsWith('/membership-pricing')?require('./fee-fixture.cjs')(n):n in mocks?mocks[n]:require(n),Buffer,process,Response,URL,Intl});return out;}
let authorised=true,stored,events=[],queries=[];
const sql=async(parts,...v)=>{const q=parts.join('?').replace(/\s+/g,' ').trim();queries.push(q);
 if(q.startsWith('INSERT INTO club_membership_payments(')){if(stored)return [];stored={id:v[0],kind:v[1],source_id:v[2],membership_year:v[3],paid_on:v[4],amount:v[5],admin_fee:v[6],payload:v[7],proof:v[8],proof_type:v[9],token_hash:v[10],token_encrypted:v[11],voided_at:null};return [{id:stored.id}];}
 if(q.startsWith('SELECT id,token_encrypted'))return stored?[{...stored}]:[];
 if(q.startsWith('INSERT INTO club_membership_payment_events')){events.push(v);return [];}
 if(q.startsWith('UPDATE club_membership_payments SET voided_at=now')){if(!stored||stored.voided_at)return [];stored.voided_at=new Date();return [{id:stored.id}];}
 if(q.startsWith('UPDATE club_membership_payments SET voided_at=NULL')){stored.voided_at=null;return [];}
 return [];
};
const mocks={'server-only':{},'./shop':{db:()=>sql,isAdmin:async()=>authorised,uuid:s=>/^[a-f0-9-]{36}$/.test(s)},'./committee-access':{committeeEnabled:async()=>false},'./renewals':{sealRenewal:s=>'sealed:'+s,openRenewal:s=>s.slice(7),renewalHash:s=>'hash:'+s},'./gmail':{SITE_ORIGIN:'https://example.invalid'}};
const payments=load('lib/membership-payments.ts',mocks);
(async()=>{
 assert.equal(payments.validPaymentDate('2026-02-30'),false);assert.equal(payments.validPaymentDate('2026-99-99'),false);assert.equal(payments.validPaymentDate('2099-01-01'),false);assert.equal(payments.validPaymentDate('2026-01-01'),true);
 const input={kind:'renewal',sourceId:'00000000-0000-4000-8000-000000000001',year:2027,paidOn:'2026-01-01',name:'Sample Member',memberNumber:'B-26-001',actor:'Committee Test',proof:'encrypted-proof',proofType:'image/png'};
 const link=await payments.recordMembershipPayment(sql,input);assert.match(link,/\/membership-invoices\/[a-f0-9]{64}$/);assert.equal(stored.amount,15000);assert.equal(stored.membership_year,2027);assert.equal(stored.paid_on,'2026-01-01');assert.equal(stored.proof,'encrypted-proof');assert.match(stored.payload,/sealed:/);
 const original=JSON.stringify(stored);assert.equal(await payments.recordMembershipPayment(sql,{...input,name:'Changed later'}),link);assert.equal(JSON.stringify(stored),original);assert.equal(events.length,1);
 await payments.voidMembershipPayment(sql,'renewal',input.sourceId,'Admin 2');assert.ok(stored.voided_at);assert.equal(events.length,2);
 assert.equal(payments.paymentTotals([stored]).length,0);await payments.recordMembershipPayment(sql,input);assert.equal(events.length,3);assert.equal(stored.voided_at,null);
 stored=undefined;await payments.recordMembershipPayment(sql,{...input,kind:'new',year:2026});assert.equal(stored.amount,25000);assert.equal(stored.admin_fee,10000);
 const groups=payments.paymentTotals([stored,{...stored,kind:'renewal',membership_year:2027,amount:15000,admin_fee:0},{...stored,voided_at:new Date()}]);assert.equal(groups.length,2);assert.equal(groups[0].total,25000);assert.equal(groups[0].adminFees,10000);assert.equal(groups[0].newFees,15000);assert.equal(groups[1].total,15000);
 authorised=false;await assert.rejects(()=>payments.paymentRegister(2026));
 const route=load('app/admin/payments/[id]/route.ts',{'../../../../lib/shop':mocks['./shop'],'../../../../lib/membership-payments':payments,'../../../../lib/renewals':mocks['./renewals'],'../../../../lib/membership-invoice-response':{paymentPrivateHeaders:{'Cache-Control':'private, no-store'}}});
 assert.equal((await route.GET(new Request('https://example.invalid/admin/payments/id'),{params:Promise.resolve({id:input.sourceId})})).status,403);
 const publicRoute=load('app/membership-invoices/[token]/route.ts',{'../../../lib/shop':mocks['./shop'],'../../../lib/membership-payments':payments,'../../../lib/renewals':mocks['./renewals'],'../../../lib/membership-invoice-response':{paymentPrivateHeaders:{'Cache-Control':'private, no-store'}}});
 const missing=await publicRoute.GET(new Request('https://example.invalid/membership-invoices/bad'),{params:Promise.resolve({token:'bad'})});assert.equal(missing.status,404);assert.match(missing.headers.get('Cache-Control'),/no-store/);
 console.log('PASS: private payment log, immutable snapshot/receipt, duplicate prevention, reversal/reapproval audit, new/renewal fee totals, advance-year separation, date validation and private route authorization.');
})().catch(e=>{console.error(e);process.exitCode=1;});
