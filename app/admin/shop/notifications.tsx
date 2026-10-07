import {ShopForm} from '../../shop/forms';
import {retryShopNotification} from '../../shop/actions';
export type ShopNotification={order_id:string;kind:string;status:string};
export function ShopNotifications({id,bm,rows}:{id:string;bm:boolean;rows:ShopNotification[]}){
 const t=(en:string,ms:string)=>bm?ms:en;
 const states:Record<string,string>={queued:t('Waiting to send','Menunggu penghantaran'),sending:t('Sending — check Sent folder before retrying','Sedang menghantar — semak folder Dihantar sebelum mencuba semula'),accepted:t('Accepted by Gmail','Diterima Gmail'),failed:t('Failed','Gagal'),unknown:t('Delivery uncertain','Penghantaran tidak pasti'),skipped:t('No customer email on this older order','Tiada e-mel pelanggan pada tempahan lama ini')};
 return <div>{rows.map(row=>{
  const uncertain=['unknown','sending'].includes(row.status);
  return <div key={row.kind}><p>{row.kind==='received'?t('Customer order received email','E-mel tempahan diterima pelanggan'):row.kind==='purchase'?t('Admin purchase notification','Pemberitahuan pembelian pentadbir'):row.kind==='tracking'?t('Customer tracking email','E-mel penjejakan pelanggan'):t('Customer completion email','E-mel pembelian selesai pelanggan')}: {states[row.status]||row.status}</p>
   {['queued','failed','unknown','sending'].includes(row.status)&&<ShopForm action={retryShopNotification} label={t('Retry email','Cuba e-mel semula')}><input type="hidden" name="id" value={id}/><input type="hidden" name="kind" value={row.kind}/>{uncertain&&<label><input type="checkbox" name="checked" value="yes" required/>{t('I checked the club Sent folder. Retrying may send a duplicate. If sending just started, wait two minutes.','Saya telah menyemak folder Dihantar kelab. Cubaan semula mungkin menghantar salinan. Jika baru bermula, tunggu dua minit.')}</label>}</ShopForm>}
  </div>;
 })}</div>;
}
