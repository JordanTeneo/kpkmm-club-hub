'use client';
import {useActionState} from 'react';
import {checkMembership} from './actions';
export function MembershipCheckForm({bm}:{bm:boolean}){
 const [state,action,pending]=useActionState(checkMembership,{});
 const t=(en:string,ms:string)=>bm?ms:en,result=state.membership;
 return <><form action={action} autoComplete="off"><fieldset disabled={pending}>
 <label>{t('Full registered name','Nama penuh berdaftar')}<input name="name" required minLength={2} maxLength={150} autoComplete="name" placeholder={t('Name as registered with KPKMM','Nama seperti didaftarkan dengan KPKMM')}/></label>
 <div hidden><label>Website<input name="website" tabIndex={-1}/></label></div>
 <button>{pending?t('Checking…','Menyemak…'):t('Check my membership','Semak keahlian saya')}</button></fieldset></form>
 {state.error&&<p className="shop-error" role="alert">{state.error}</p>}
 {result&&!pending&&<section className="shop-note" role="status" style={{marginTop:20}}><h2>{result.status==='ambiguous'?t('Please contact the club','Sila hubungi kelab'):result.status==='active'?t('Active','Aktif'):t('Inactive','Tidak aktif')}</h2>
 <p>{t('Membership year','Tahun keahlian')}: <strong>{result.year}</strong></p>
 {result.status==='active'?<p>{t('Valid until','Sah sehingga')}: <strong>31 {t('December','Disember')} {result.year}</strong> ({t('Malaysia time','waktu Malaysia')})</p>:result.status==='ambiguous'?<p>{t('More than one member has this name. Contact the committee to verify your status privately.','Lebih daripada seorang ahli mempunyai nama ini. Hubungi jawatankuasa untuk semakan sulit.')}</p>:<p>{t('No active membership was found under this exact name for the current year. Check the spelling, including any registered title. If you have paid, contact the club before paying again. Your membership number is retained while inactive. A lapse of more than one year requires committee reinstatement.','Tiada keahlian aktif dijumpai dengan nama tepat ini untuk tahun semasa. Semak ejaan, termasuk gelaran berdaftar. Jika sudah membayar, hubungi kelab sebelum membayar lagi. Nombor ahli dikekalkan semasa tidak aktif. Tempoh tidak aktif melebihi setahun memerlukan pengaktifan semula oleh jawatankuasa.')}</p>}
 </section>}</>;
}
