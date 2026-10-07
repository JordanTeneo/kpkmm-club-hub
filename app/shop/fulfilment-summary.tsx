export function FulfilmentSummary({mode,fee,carrier,tracking,bm}:{mode?:string|null;fee?:number;carrier?:string;tracking?:string;bm:boolean}){
 const t=(en:string,ms:string)=>bm?ms:en;
 return <div><p>{t('Method','Kaedah')}: {mode==='pickup'?t('Pickup — free','Pengambilan — percuma'):mode==='delivery'?t('Delivery','Penghantaran'):t('Not recorded for this older order','Tidak direkodkan untuk tempahan lama ini')}</p>
 {mode==='pickup'&&<p>{t('After payment is confirmed, contact','Selepas bayaran disahkan, hubungi')} <a href="tel:+60182262000">018-226 2000</a> {t('with your Order Reference to arrange the pickup location.','dengan Rujukan Tempahan untuk mengatur lokasi pengambilan.')}</p>}
 {mode==='delivery'&&<><p>{t('Delivery fee','Caj penghantaran')}: RM {((fee||0)/100).toFixed(2)}</p><p>{tracking?<>{carrier} · {t('Tracking number','Nombor penjejakan')}: <strong>{tracking}</strong></>:t('Tracking details will appear here and be emailed after dispatch.','Butiran penjejakan akan dipaparkan di sini dan dihantar melalui e-mel selepas penghantaran.')}</p></>}
 </div>;
}
