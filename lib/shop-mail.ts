import {db,shopReady,uuid,money} from './shop';
import {CLUB_EMAIL,SITE_ORIGIN} from './gmail';
import {enrolmentMessage} from './enrolment';
import {sendClubMessage} from './renewals';

export type ShopMailKind='purchase'|'completed';
type MailOrder={id:string;customer_name:string;email:string;product_name:string;quantity:number;unit_price:number;language?:string};
export function shopMessage(order:MailOrder,kind:ShopMailKind){
 if(!uuid(order.id))throw Error('Invalid order');
 const bm=order.language==='ms',t=(en:string,ms:string)=>bm?ms:en;
 const total=money(order.quantity*order.unit_price);
 if(kind==='purchase')return enrolmentMessage(CLUB_EMAIL,'KPKMM — Purchase awaiting payment verification',
  `A marketplace purchase has been submitted with payment proof.\n\nOrder reference: ${order.id}\nItem: ${order.product_name}\nQuantity: ${order.quantity}\nTotal: ${total}\n\nSign in to review the customer details and payment slip:\n${SITE_ORIGIN}/admin/shop?order=${order.id}#order-${order.id}\n\nVerify the transfer in the KPKMM bank account before completing the purchase. The uploaded slip is not confirmation of payment.\n\nKPKMM Marketplace`);
 return enrolmentMessage(order.email,t('KPKMM — Purchase completed','KPKMM — Pembelian selesai'),
  `${t('Dear','Salam')} ${order.customer_name},\n\n${t('Thank you for supporting KPKMM. The club has verified your payment and your purchase is complete.','Terima kasih kerana menyokong KPKMM. Kelab telah mengesahkan bayaran anda dan pembelian anda telah selesai.')}\n\n${t('Order reference','Rujukan tempahan')}: ${order.id}\n${t('Item','Barangan')}: ${order.product_name}\n${t('Quantity','Kuantiti')}: ${order.quantity}\n${t('Total paid','Jumlah dibayar')}: ${total}\n\n${t('For any questions, contact','Untuk pertanyaan, hubungi')} ${CLUB_EMAIL} / 018-226 2000.\n\nSmall Cars, Big Spirit!\nKPKMM`);
}
// Called inside the order transaction; a mail failure must never undo a purchase.
export async function queueShopMail(sql:ReturnType<typeof db>,id:string,kind:ShopMailKind){
 await sql`INSERT INTO shop_order_mail(order_id,kind) VALUES(${id},${kind}) ON CONFLICT(order_id,kind) DO NOTHING`;
}
export async function deliverShopMail(id:string,kind:ShopMailKind,allowUncertain=false){
 if(!uuid(id)||!['purchase','completed'].includes(kind))throw Error('Invalid notification');
 await shopReady();
 const claimed=await db()`UPDATE shop_order_mail m SET status='sending',attempt_at=now() FROM shop_orders o WHERE m.order_id=${id} AND m.kind=${kind} AND o.id=m.order_id AND ((m.kind='purchase' AND o.status='review') OR (m.kind='completed' AND o.status='paid')) AND (m.status IN ('queued','failed') OR (${allowUncertain} AND (m.status='unknown' OR (m.status='sending' AND m.attempt_at<now()-interval '2 minutes')))) RETURNING o.id,o.customer_name,o.email,o.product_name,o.quantity,o.unit_price,o.language`;
 if(!claimed.length)return 'unchanged';
 let state='unknown';
 try{
  const order=claimed[0] as MailOrder;
  if(kind==='completed'&&!order.email)state='skipped';
  else state=(await sendClubMessage(shopMessage(order,kind))).state;
 }catch{/* An uncertain send is never automatically retried. */}
 await db()`UPDATE shop_order_mail SET status=${state} WHERE order_id=${id} AND kind=${kind} AND status='sending'`;
 return state;
}
