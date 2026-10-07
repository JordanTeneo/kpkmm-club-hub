'use client';
import {useUiText} from '../ui-language';

import {useActionState,useState} from 'react';
import {checkMembership} from './actions';
export function MembershipCheckForm({bm}:{bm:boolean}){
 const [method,setMethod]=useState<'name'|'mykad'>('name');
 return <><label>{bm?'Semak menggunakan':'Check using'}<select value={method} onChange={e=>setMethod(e.target.value as 'name'|'mykad')}><option value="name">{bm?'Nama penuh':'Full name'}</option><option value="mykad">MyKad</option></select></label><CheckByMethod key={method} bm={bm} method={method}/></>;
}
function CheckByMethod({bm,method}:{bm:boolean;method:'name'|'mykad'}){
 const ui = useUiText();

 const [state,action,pending]=useActionState(checkMembership,{});
 const t=(en:string,ms:string)=>bm?ms:en,result=state.membership;
 return <><form action={action} autoComplete="off"><fieldset disabled={pending}>
 {method==='name'?<label>{t('Full registered name','Nama penuh berdaftar')}<input name="name" required minLength={2} maxLength={150} autoComplete="name" placeholder={t('Name as registered with KPKMM','Nama seperti didaftarkan dengan KPKMM')}/></label>:<label>{t('MyKad number','Nombor MyKad')}<input name="identity" type="text" inputMode="numeric" required minLength={12} maxLength={14} pattern="[0-9]{6}-?[0-9]{2}-?[0-9]{4}" autoComplete="off" placeholder="900101-10-1234"/><small>{t('12 digits, with or without hyphens.','12 digit, dengan atau tanpa tanda sempang.')}</small></label>}
 <div hidden><label>{ui("Website")}<input name="website" tabIndex={-1}/></label></div>
 <button>{pending?t('Checking…','Menyemak…'):t('Check my membership','Semak keahlian saya')}</button></fieldset></form>
 {state.error&&<p className="shop-error" role="alert">{state.error.startsWith('Enter a valid 12-digit MyKad')?t('Enter a valid 12-digit MyKad number.','Masukkan nombor MyKad 12 digit yang sah.'):ui(state.error)}</p>}
 {result&&!pending&&<section className="shop-note" role="status" style={{marginTop:20}}><h2>{result.status==='ambiguous'?t('Please contact the club','Sila hubungi kelab'):result.status==='active'?(result.newMember?t('New member','Ahli baharu'):t('Active','Aktif')):t('Inactive','Tidak aktif')}</h2>
 <p>{t('Membership year','Tahun keahlian')}: <strong>{result.year}</strong></p>
 {result.lifetime?<p>{t('Lifetime membership — no annual renewal or payment required.','Keahlian seumur hidup — tiada pembaharuan atau bayaran tahunan diperlukan.')}</p>:result.status==='active'?<p>{t('Valid until','Sah sehingga')}: <strong>31 {t('December','Disember')} {result.year}</strong> ({t('Malaysia time','waktu Malaysia')})</p>:result.status==='ambiguous'?<p>{t('Please contact the committee to verify your membership status privately.','Sila hubungi jawatankuasa untuk menyemak status keahlian anda secara sulit.')}</p>:<p>{t('No active membership was found using these details for the current year. Check your registered name or MyKad number. If you have paid, contact the club before paying again. Your membership number is retained while inactive. A lapse of more than one year requires committee reinstatement.','Tiada keahlian aktif dijumpai menggunakan maklumat ini untuk tahun semasa. Semak nama berdaftar atau nombor MyKad anda. Jika sudah membayar, hubungi kelab sebelum membayar lagi. Nombor ahli dikekalkan semasa tidak aktif. Tempoh tidak aktif melebihi setahun memerlukan pengaktifan semula oleh jawatankuasa.')}</p>}
 </section>}</>;
}
