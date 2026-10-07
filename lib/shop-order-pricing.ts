type PricingOrder={quantity:number;unit_price:number;original_unit_price?:number|null;discount_percent?:number;delivery_fee?:number};
export function orderPriceLines(order:PricingOrder,bm=false){
 const t=(en:string,ms:string)=>bm?ms:en,money=(n:number)=>'RM '+(n/100).toFixed(2);
 const original=order.original_unit_price,known=original!=null;
 const subtotal=order.quantity*order.unit_price,fee=order.delivery_fee||0;
 return [
  [t('Quantity','Kuantiti'),String(order.quantity)],
  [t('Original unit price','Harga asal seunit'),known?money(original):t('Not recorded for this older order','Tidak direkodkan untuk tempahan lama ini')],
  [t('Discount','Diskaun'),known?`${order.discount_percent??0}%`:t('Not recorded','Tidak direkodkan')],
  [t('Unit price after discount','Harga seunit selepas diskaun'),money(order.unit_price)],
  ...(known?[[t('Subtotal before discount','Jumlah kecil sebelum diskaun'),money(original*order.quantity)],[t('Total discount savings','Jumlah penjimatan diskaun'),money((original-order.unit_price)*order.quantity)]]:[]),
  [t('Item subtotal after discount','Jumlah kecil barangan selepas diskaun'),money(subtotal)],
  [t('Delivery fee','Caj penghantaran'),money(fee)],
  [t('Expected payment total','Jumlah bayaran yang perlu disahkan'),money(subtotal+fee)]
 ];
}
