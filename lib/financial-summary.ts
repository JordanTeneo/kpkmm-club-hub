import 'server-only';
import {db,isAdmin,shopReady,uuid} from './shop';
import {paymentRegister,invoiceNumber,malaysiaDate,validPaymentDate,paymentActor} from './membership-payments';
import {shopInvoicesReady} from './shop-invoices';
import {sealRenewal} from './renewals';

export type FinanceRow={id:string;category:'new'|'renewal'|'marketplace';name:string;reference:string;paidOn:string|null;membershipYear:number|null;gross:number;discount:number;delivery:number;adminFee:number;total:number;excluded:boolean;invoice:string;receipt:string;approvedAt:string};
export async function financeAllowed(){const access=await Promise.all([isAdmin('membership'),isAdmin('shop')]);return access.every(Boolean);}
export function financeYear(value:unknown){const year=value==null||value===''?Number(malaysiaDate().slice(0,4)):Number(value);if(!Number.isInteger(year)||year<2026||year>2200)throw Error('Choose a year from 2026 to 2200.');return year;}
export function financeTotals(rows:FinanceRow[]){
 const categories=['new','renewal','marketplace'] as const;
 return categories.map(category=>{const selected=rows.filter(r=>r.category===category&&r.paidOn&&!r.excluded);return {category,count:selected.length,gross:selected.reduce((s,r)=>s+r.gross,0),discount:selected.reduce((s,r)=>s+r.discount,0),delivery:selected.reduce((s,r)=>s+r.delivery,0),adminFee:selected.reduce((s,r)=>s+r.adminFee,0),total:selected.reduce((s,r)=>s+r.total,0)};});
}
export async function financialSummary(year:number){
 if(!await financeAllowed())throw Error('Unauthorised');financeYear(year);
 await shopReady();await shopInvoicesReady();
 const [members,orders]=await Promise.all([paymentRegister(year,'payment'),db()`SELECT o.id,o.customer_name,o.quantity,o.unit_price,o.original_unit_price,o.delivery_fee,o.status,i.sequence,i.issued_at,d.paid_on::text
 FROM shop_orders o LEFT JOIN shop_invoices i ON i.order_id=o.id LEFT JOIN shop_payment_dates d ON d.order_id=o.id
 WHERE (d.paid_on>=${year+'-01-01'}::date AND d.paid_on<${(year+1)+'-01-01'}::date)
 OR (d.paid_on IS NULL AND o.status='paid' AND o.created_at>=TIMESTAMPTZ '2026-01-01 00:00:00+08') ORDER BY o.created_at DESC`]);
 const rows:FinanceRow[]=members.map(r=>({id:r.id,category:r.kind,name:r.detail.name,reference:invoiceNumber(r),paidOn:r.paid_on,membershipYear:r.membership_year,gross:r.detail.quote?r.detail.quote.annual+r.detail.quote.administration:r.amount,discount:r.detail.quote?.discount||0,delivery:0,adminFee:r.admin_fee,total:r.amount,excluded:!!r.voided_at,invoice:`/admin/payments/${r.id}?file=invoice`,receipt:`/admin/payments/${r.id}?file=receipt`,approvedAt:new Date(r.approved_at).toISOString()}));
 for(const o of orders){const gross=(o.original_unit_price??o.unit_price)*o.quantity,net=o.unit_price*o.quantity;rows.push({id:o.id,category:'marketplace',name:o.customer_name,reference:o.id,paidOn:o.paid_on||null,membershipYear:null,gross,discount:gross-net,delivery:o.delivery_fee||0,adminFee:0,total:net+(o.delivery_fee||0),excluded:o.status!=='paid',invoice:o.sequence?`/shop/orders/${o.id}/invoice`:'',receipt:`/shop/orders/${o.id}/proof`,approvedAt:o.issued_at?new Date(o.issued_at).toISOString():''});}
 rows.sort((a,b)=>(b.paidOn||'').localeCompare(a.paidOn||'')||a.reference.localeCompare(b.reference));
 return {rows,totals:financeTotals(rows),undated:rows.filter(r=>!r.paidOn)};
}
// Reconcile only a missing date. The original confirmation/invoice is never rewritten.
export async function reconcileShopDate(id:string,paidOn:string,reason:string){
 if(!await financeAllowed())throw Error('Unauthorised');
 if(!uuid(id)||!validPaymentDate(paidOn)||reason.trim().length<5||reason.length>500)throw Error('Invalid reconciliation');
 await shopInvoicesReady();const actor=await paymentActor();
 const saved=await db()`INSERT INTO shop_payment_dates(order_id,paid_on,recorded_by,note)
 SELECT id,${paidOn}::date,${sealRenewal(actor)},${sealRenewal(reason.trim())} FROM shop_orders WHERE id=${id} AND status='paid'
 ON CONFLICT(order_id) DO NOTHING RETURNING order_id`;
 if(!saved.length)throw Error('Already dated or not a paid order');
}
