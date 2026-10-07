export function deliveryFeeCents(value:unknown){
 const raw=String(value??'').trim();
 const cents=Math.round(Number(raw)*100);
 if(!/^\d+(\.\d{1,2})?$/.test(raw)||!Number.isSafeInteger(cents)||cents<0||cents>1000000)throw Error('Enter a delivery fee from RM 0 to RM 10,000. / Masukkan caj penghantaran antara RM 0 hingga RM 10,000.');
 return cents;
}
export function fulfilmentQuote(mode:unknown,storedFee:number,submittedFee:unknown){
 if(mode!=='pickup'&&mode!=='delivery')throw Error('Choose pickup or delivery. / Pilih pengambilan atau penghantaran.');
 if(!Number.isSafeInteger(storedFee)||storedFee<0)throw Error('Invalid delivery fee.');
 if(mode==='delivery'&&Number(submittedFee)!==storedFee)throw Error('The delivery fee changed. Refresh before ordering. / Caj penghantaran berubah. Muat semula sebelum menempah.');
 return {mode,fee:mode==='delivery'?storedFee:0};
}
export function readTracking(form:FormData){
 const carrier=String(form.get('carrier')||'').trim(),number=String(form.get('tracking_number')||'').trim();
 if(!carrier||carrier.length>100||!number||number.length>100||/[\r\n\x00-\x1f]/.test(carrier+number))throw Error('Enter a courier and tracking number (maximum 100 characters each). / Masukkan kurier dan nombor penjejakan (maksimum 100 aksara setiap satu).');
 return {carrier,number};
}
