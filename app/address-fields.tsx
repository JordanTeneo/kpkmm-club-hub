'use client';
import {useId,useState} from 'react';
type Address={address:string;addressLine?:string;postcode?:string;state?:string;mailingCountry?:string};
export function AddressFields({value,bm=false,required=true}:{value?:Address;bm?:boolean;required?:boolean}){
 const id=useId(),[country,setCountry]=useState(value?.mailingCountry??(value?'':'Malaysia'));
 const t=(en:string,ms:string)=>bm?ms:en,isMalaysia=country.trim().toLowerCase()==='malaysia';
 return <><label>{t('Address (house, street and town)','Alamat (rumah, jalan dan bandar)')}<textarea name="address" defaultValue={value?.addressLine??value?.address} required={required} minLength={required?10:undefined} maxLength={required?1000:1500} rows={4} autoComplete="street-address"/></label>
 <label>{t('Postcode','Poskod')}<input name="postcode" defaultValue={value?.postcode} required={required} maxLength={isMalaysia?5:20} pattern={isMalaysia?'[0-9]{5}':undefined} inputMode={isMalaysia?'numeric':'text'} autoComplete="postal-code"/></label>
 <label>{t('State / territory','Negeri / wilayah')}<input name="state" defaultValue={value?.state} required={required} maxLength={100} list={id} autoComplete="address-level1"/></label>
 <datalist id={id}>{['Johor','Kedah','Kelantan','Melaka','Negeri Sembilan','Pahang','Perak','Perlis','Pulau Pinang','Sabah','Sarawak','Selangor','Terengganu','Kuala Lumpur','Putrajaya','Labuan'].map(s=><option key={s} value={s}/>)}</datalist>
 <label>{t('Country (mailing address)','Negara (alamat surat-menyurat)')}<input name="mailingCountry" value={country} onChange={e=>setCountry(e.target.value)} required={required} maxLength={80} autoComplete="country-name"/></label>
 {value&&value.addressLine===undefined&&<p>Existing address preserved in its original format. Please separate its postcode, state and country when known. / Alamat asal dikekalkan. Asingkan poskod, negeri dan negara apabila diketahui.</p>}</>;
}
export function AddressDisplay({value}:{value:Address}){
 return <div><p style={{whiteSpace:'pre-wrap'}}>Address / Alamat: {value.addressLine??value.address}</p><p>Postcode / Poskod: {value.postcode||'—'}</p><p>State / Negeri: {value.state||'—'}</p><p>Country / Negara: {value.mailingCountry||'—'}</p>{value.addressLine===undefined&&<small>Original unsplit address / Alamat asal belum diasingkan</small>}</div>;
}
