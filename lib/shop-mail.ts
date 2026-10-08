import {orderPriceLines} from './shop-order-pricing';
import {shopInvoice} from './shop-invoices';
import {db,shopReady,uuid,money} from './shop';
import {CLUB_EMAIL,SITE_ORIGIN} from './gmail';
import {enrolmentMessage} from './enrolment';
import {sendClubMessage} from './renewals';

export type ShopMailKind='received'|'purchase'|'completed'|'tracking';
type MailOrder={id:string;customer_name:string;email:string;product_name:string;quantity:number;unit_price:number;original_unit_price?:number|null;discount_percent?:number;language?:string;fulfilment?:string|null;delivery_fee?:number;carrier?:string;tracking_number?:string};
export function shopMessage(order:MailOrder,kind:ShopMailKind,hasInvoice=false){
 if(!uuid(order.id))throw Error('Invalid order');
 const bm=order.language==='ms',t=(en:string,ms:string)=>bm?ms:en;
 const total=money(order.quantity*order.unit_price+(order.delivery_fee||0));
 const fulfilment=order.fulfilment==='pickup'?t('Pickup: After payment is confirmed, contact 018-226 2000 with your Order Reference to arrange the pickup location.','Pengambilan: Selepas bayaran disahkan, hubungi 018-226 2000 dengan Rujukan Tempahan untuk mengatur lokasi pengambilan.'):order.fulfilment==='delivery'?`${t('Delivery fee','Caj penghantaran')}: ${money(order.delivery_fee||0)}\n${t('Delivery to your order address. Tracking details will be emailed after dispatch.','Penghantaran ke alamat tempahan anda. Butiran penjejakan akan dihantar melalui e-mel selepas penghantaran.')}`:'';
 if(kind==='received')return enrolmentMessage(order.email,t('KPKMM — Order received','KPKMM — Tempahan diterima'),
  `${t('Dear','Salam')} ${order.customer_name},\n\n${t('Thank you for your order. This email acknowledges your request; it is not confirmation of payment.','Terima kasih atas tempahan anda. E-mel ini mengakui permintaan anda; ia bukan pengesahan bayaran.')}\n\n${t('Order reference','Rujukan tempahan')}: ${order.id}\n${t('Item','Barangan')}: ${order.product_name}\n${t('Quantity','Kuantiti')}: ${order.quantity}\n${t('Total to pay','Jumlah perlu dibayar')}: ${total}\n\n${fulfilment}\n\n${t('Bank transfer details','Butiran pindahan bank')}\nMaybank\nKelab Peminat Kereta Mini Malaysia\n5123 4360 5508\n${t('Payment reference','Rujukan bayaran')}: ${order.id.slice(0,8).toUpperCase()}\n\n${t('Transfer the exact total, then open your order and upload your payment slip for admin verification. If you have already paid, do not pay again.','Pindahkan jumlah tepat, kemudian buka tempahan dan muat naik slip bayaran untuk pengesahan pentadbir. Jika anda telah membayar, jangan bayar sekali lagi.')}\n${SITE_ORIGIN}/shop/orders/${order.id}\n\n${t('Open the link in the browser you used to order. On another device, use the Order Reference and the private access code saved from your order page under Already ordered on the marketplace. Keep that code private.','Buka pautan dalam pelayar yang digunakan untuk menempah. Pada peranti lain, gunakan Rujukan Tempahan dan kod akses peribadi yang disimpan dari halaman tempahan di bahagian Sudah membuat tempahan di kedai. Rahsiakan kod tersebut.')}\n${SITE_ORIGIN}/shop\n\n${t('We will email you again after the club verifies your payment and completes your purchase.','Kami akan menghantar e-mel sekali lagi selepas kelab mengesahkan bayaran dan melengkapkan pembelian anda.')}\n\n${t('For any questions, contact','Untuk pertanyaan, hubungi')} ${CLUB_EMAIL} / 018-226 2000.\n\nSmall Cars, Big Spirit!\nKPKMM`);
 if(kind==='tracking')return enrolmentMessage(order.email,t('KPKMM — Your order has been dispatched','KPKMM — Tempahan anda telah dihantar'),
  `${t('Dear','Salam')} ${order.customer_name},\n\n${t('Your order has been dispatched.','Tempahan anda telah dihantar.')}\n\n${t('Order reference','Rujukan tempahan')}: ${order.id}\n${t('Item','Barangan')}: ${order.product_name}\n${t('Courier','Kurier')}: ${order.carrier}\n${t('Tracking number','Nombor penjejakan')}: ${order.tracking_number}\n\n${t('Use this number on the courier’s official tracking website.','Gunakan nombor ini di laman penjejakan rasmi kurier.')}\n\n${t('For any questions, contact','Untuk pertanyaan, hubungi')} ${CLUB_EMAIL} / 018-226 2000.\n\nSmall Cars, Big Spirit!\nKPKMM`);
 if(kind==='purchase')return enrolmentMessage(CLUB_EMAIL,'KPKMM — Purchase awaiting payment verification',
  `A marketplace purchase has been submitted with payment proof.\n\nOrder reference: ${order.id}\nItem: ${order.product_name}\n${orderPriceLines(order).map(([label,value])=>`${label}: ${value}`).join('\n')}\n\nSign in to review the customer details and payment slip:\n${SITE_ORIGIN}/admin/shop?order=${order.id}#order-${order.id}\n\nVerify the transfer in the KPKMM bank account before completing the purchase. The uploaded slip is not confirmation of payment.\n\nKPKMM Marketplace`);
 const invoiceText=hasInvoice?`\n\n${t('Download your paid invoice','Muat turun invois berbayar')}:\n${SITE_ORIGIN}/shop/orders/${order.id}/invoice?lang=${bm?'ms':'en'}\n${t('Use the browser you ordered with. On another device, first open your order using the reference and private access code at','Gunakan pelayar asal. Pada peranti lain, buka tempahan dengan rujukan dan kod akses peribadi di')} ${SITE_ORIGIN}/shop`:'';
 return enrolmentMessage(order.email,t('KPKMM — Purchase completed','KPKMM — Pembelian selesai'),
  `${t('Dear','Salam')} ${order.customer_name},\n\n${t('Thank you for supporting KPKMM. The club has verified your payment and your purchase is complete.','Terima kasih kerana menyokong KPKMM. Kelab telah mengesahkan bayaran anda dan pembelian anda telah selesai.')}\n\n${t('Order reference','Rujukan tempahan')}: ${order.id}\n${t('Item','Barangan')}: ${order.product_name}\n${t('Quantity','Kuantiti')}: ${order.quantity}\n${t('Total paid','Jumlah dibayar')}: ${total}\n\n${fulfilment}${invoiceText}\n\n${t('For any questions, contact','Untuk pertanyaan, hubungi')} ${CLUB_EMAIL} / 018-226 2000.\n\nSmall Cars, Big Spirit!\nKPKMM`);
}
// Called inside the order transaction; a mail failure must never undo a purchase.
export async function queueShopMail(sql:ReturnType<typeof db>,id:string,kind:ShopMailKind){
 await sql`INSERT INTO shop_order_mail(order_id,kind) VALUES(${id},${kind}) ON CONFLICT(order_id,kind) DO NOTHING`;
}
export async function deliverShopMail(id:string,kind:ShopMailKind,allowUncertain=false){
 if(!uuid(id)||!['received','purchase','completed','tracking'].includes(kind))throw Error('Invalid notification');
 await shopReady();
 const claimed=await db()`UPDATE shop_order_mail m SET status='sending',attempt_at=now() FROM shop_orders o WHERE m.order_id=${id} AND m.kind=${kind} AND o.id=m.order_id AND ((m.kind='received' AND o.status='pending') OR (m.kind='purchase' AND o.status='review') OR (m.kind='completed' AND o.status='paid') OR (m.kind='tracking' AND o.status='paid' AND o.fulfilment='delivery' AND o.tracking_number<>'')) AND (m.status IN ('queued','failed') OR (${allowUncertain} AND (m.status='unknown' OR (m.status='sending' AND m.attempt_at<now()-interval '2 minutes')))) RETURNING o.id,o.customer_name,o.email,o.product_name,o.quantity,o.unit_price,o.original_unit_price,o.discount_percent,o.language,o.fulfilment,o.delivery_fee,o.carrier,o.tracking_number`;
 if(!claimed.length)return 'unchanged';
 let state='unknown';
 try{
  const order=claimed[0] as MailOrder;
  if(kind!=='purchase'&&!order.email)state='skipped';
  else state=(await sendClubMessage(shopMessage(order,kind,kind==='completed'&&!!await shopInvoice(id)))).state;
 }catch{/* An uncertain send is never automatically retried. */}
 await db()`UPDATE shop_order_mail SET status=${state} WHERE order_id=${id} AND kind=${kind} AND status='sending'`;
 return state;
}
