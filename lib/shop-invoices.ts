import 'server-only';
import {db} from './shop';
import {sealRenewal,openRenewal} from './renewals';
export type ShopInvoiceSnapshot={id:string;customer_name:string;product_name:string;quantity:number;unit_price:number;original_unit_price:number|null;discount_percent:number;delivery_fee:number;fulfilment:string|null;language:string};
let ready:Promise<void>|undefined;
export async function shopInvoicesReady(){
 if(!ready)ready=(async()=>{
  await db()`CREATE TABLE IF NOT EXISTS shop_invoices(order_id uuid PRIMARY KEY REFERENCES shop_orders(id),sequence bigserial UNIQUE,payload text NOT NULL,issued_at timestamptz NOT NULL DEFAULT now())`;
 })().catch(e=>{ready=undefined;throw e;});
 await ready;
}
// In the payment-confirmation transaction; a single immutable invoice per order.
export async function recordShopInvoice(sql:any,order:ShopInvoiceSnapshot){
 const snapshot:ShopInvoiceSnapshot={id:order.id,customer_name:order.customer_name,product_name:order.product_name,quantity:order.quantity,unit_price:order.unit_price,original_unit_price:order.original_unit_price??null,discount_percent:order.discount_percent??0,delivery_fee:order.delivery_fee||0,fulfilment:order.fulfilment,language:order.language};
 await sql`INSERT INTO shop_invoices(order_id,payload) VALUES(${order.id},${sealRenewal(JSON.stringify(snapshot))}) ON CONFLICT(order_id) DO NOTHING`;
}
export async function shopInvoice(id:string){
 await shopInvoicesReady();
 const row=(await db()`SELECT i.sequence,i.payload,i.issued_at FROM shop_invoices i JOIN shop_orders o ON o.id=i.order_id WHERE i.order_id=${id} AND o.status='paid'`)[0];
 if(!row)return null;
 return {number:`KPKMM-SHOP-${new Intl.DateTimeFormat('en',{year:'numeric',timeZone:'Asia/Kuala_Lumpur'}).format(new Date(row.issued_at))}-${String(row.sequence).padStart(6,'0')}`,issuedAt:row.issued_at as Date,order:JSON.parse(openRenewal(row.payload)) as ShopInvoiceSnapshot};
}
