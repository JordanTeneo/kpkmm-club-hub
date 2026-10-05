'use client';
import {useActionState} from 'react';
import {checkMembership} from './actions';
export function MembershipCheckForm({bm}:{bm:boolean}){
 const [state,action,pending]=useActionState(checkMembership,{});
 const t=(en:string,ms:string)=>bm?ms:en,result=state.membership;
 return <><form action={action} autoComplete="off"><fieldset disabled={pending}>
 <label>{t('MyKad number (12 digits)','Nombor MyKad (12 digit)')}<input name="identity" required maxLength={14} inputMode="numeric" pattern="[0-9]{6}-?[0-9]{2}-?[0-9]{4}" placeholder="YYMMDD-PB-XXXX"/></label>
 <div hidden><label>Website<input name="website" tabIndex={-1}/></label></div>
 <button>{pending?t('Checking…','Menyemak…'):t('Check my membership','Semak keahlian saya')}</button></fieldset></form>
 {state.error&&<p className="shop-error" role="alert">{state.error}</p>}
 {result&&!pending&&<section className="shop-note" role="status" style={{marginTop:20}}><h2>{result.status==='active'?t('Active','Aktif'):t('Inactive','Tidak aktif')}</h2>
 <p>{t('Membership year','Tahun keahlian')}: <strong>{result.year}</strong></p>
 {result.status==='active'?<p>{t('Valid until','Sah sehingga')}: <strong>31 {t('December','Disember')} {result.year}</strong> ({t('Malaysia time','waktu Malaysia')})</p>:<><p>{t('No approved membership or renewal was found for this MyKad in the current year. If you have already applied or paid, contact the club before paying again.','Tiada keahlian atau pembaharuan diluluskan untuk MyKad ini pada tahun semasa. Jika anda sudah memohon atau membayar, hubungi kelab sebelum membayar lagi.')}</p><a className="shop-link" href="/renew">{t('Renew membership','Perbaharui keahlian')}</a></>}
 </section>}</>;
}
