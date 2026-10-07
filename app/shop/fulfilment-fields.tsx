'use client';
import {useState} from 'react';
export function FulfilmentFields({fee,bm}:{fee:number;bm:boolean}){
 const [mode,setMode]=useState('pickup');
 const t=(en:string,ms:string)=>bm?ms:en;
 return <fieldset><legend>{t('Pickup or delivery','Pengambilan atau penghantaran')}</legend>
  <input type="hidden" name="delivery_fee" value={fee}/>
  <label>{t('Method','Kaedah')}<select name="fulfilment" value={mode} onChange={e=>setMode(e.target.value)} required><option value="pickup">{t('Pickup — free','Pengambilan — percuma')}</option><option value="delivery">{t('Delivery','Penghantaran')} — RM {(fee/100).toFixed(2)}</option></select></label>
  <p aria-live="polite">{mode==='pickup'?t('After payment is confirmed, contact 018-226 2000 with your Order Reference to arrange the pickup location.','Selepas bayaran disahkan, hubungi 018-226 2000 dengan Rujukan Tempahan untuk mengatur lokasi pengambilan.'):t('A flat delivery fee of RM '+(fee/100).toFixed(2)+' is added once to this order, regardless of quantity. Delivery is to the address below. Tracking details will be emailed after dispatch.','Caj penghantaran tetap RM '+(fee/100).toFixed(2)+' ditambah sekali bagi tempahan ini tanpa mengira kuantiti. Penghantaran ke alamat di bawah. Butiran penjejakan akan dihantar melalui e-mel selepas penghantaran.')}</p>
 </fieldset>;
}
