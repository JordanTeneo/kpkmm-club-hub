'use client';
import {useActionState,useState} from 'react';
import {checkMembership,type CheckResult} from './actions';
export function MembershipCheckForm({bm}:{bm:boolean}){
 const [kind,setKind]=useState('mykad'),t=(en:string,ms:string)=>bm?ms:en;
 const [state,action,pending]=useActionState(async(previous:CheckResult,form:FormData)=>{const next=await checkMembership(previous,form);setKind('mykad');return next;},{});
 const result=state.membership;
 const labels={active:t('Active','Aktif'),expired:t('Expired','Tamat tempoh'),pending:t('Pending approval','Menunggu kelulusan'),future:t('Approved for a future year','Diluluskan untuk tahun akan datang'),verification:t('Membership year needs verification','Tahun keahlian perlu disahkan'),inactive:t('No active approved membership','Tiada keahlian aktif yang diluluskan'),unmatched:t('No matching online record','Tiada rekod dalam talian yang sepadan')};
 return <><form action={action} autoComplete="off"><fieldset disabled={pending}>
 <label>{t('Registered email address','Alamat e-mel berdaftar')}<input name="email" type="email" required maxLength={254}/></label>
 <label>{t('Identification type','Jenis pengenalan')}<select name="identityType" value={kind} onChange={e=>setKind(e.target.value)}><option value="mykad">MyKad / IC — Malaysia</option><option value="passport">{t('Passport — Non-Malaysian','Pasport — Bukan warganegara')}</option></select></label>
 <label>{kind==='mykad'?t('MyKad / IC number (12 digits)','Nombor MyKad / KP (12 digit)'):t('Passport number','Nombor pasport')}<input key={kind} name="identity" required maxLength={kind==='mykad'?14:20} inputMode={kind==='mykad'?'numeric':'text'} pattern={kind==='mykad'?'[0-9]{6}-?[0-9]{2}-?[0-9]{4}':'[A-Za-z0-9-]{5,20}'}/></label>
 {kind==='passport'&&<label>{t('Passport issuing country (as registered)','Negara pengeluar pasport (seperti didaftarkan)')}<input name="country" required maxLength={80}/></label>}
 <div hidden><label>Website<input name="website" tabIndex={-1}/></label></div><button>{pending?t('Checking…','Menyemak…'):t('Check my membership','Semak keahlian saya')}</button></fieldset></form>
 {state.error&&<p className="shop-error" role="alert">{state.error}</p>}
 {result&&!pending&&<section className="shop-note" role="status" style={{marginTop:20}}><h2>{labels[result.status]}</h2>
 {result.year&&<p>{t('Membership year','Tahun keahlian')}: <strong>{result.year}</strong><br/>{t('Valid until','Sah sehingga')}: <strong>31 {t('December','Disember')} {result.year}</strong> ({t('Malaysia time','waktu Malaysia')})</p>}
 {result.status==='future'&&<p>{t('Starts on 1 January of the approved year. It does not activate the current year.','Bermula pada 1 Januari tahun yang diluluskan. Ia tidak mengaktifkan tahun semasa.')}</p>}
 {result.status==='pending'&&<p>{t('Your request is awaiting club verification. A submission or receipt alone does not activate membership.','Permohonan anda menunggu pengesahan kelab. Permohonan atau resit sahaja tidak mengaktifkan keahlian.')}</p>}
 {result.pending&&result.status!=='pending'&&<p>{t('A request is also pending review.','Terdapat juga permohonan yang menunggu semakan.')}</p>}
 {['unmatched','verification','inactive'].includes(result.status)&&<p>{t('Check that the details match your registration. Older club records may not yet be online. Contact the club for confirmation; do not pay again based on this result alone.','Pastikan maklumat sepadan dengan pendaftaran. Rekod lama kelab mungkin belum tersedia dalam talian. Hubungi kelab untuk pengesahan; jangan bayar lagi berdasarkan keputusan ini sahaja.')}</p>}
 {result.status==='expired'&&<a className="shop-link" href="/renew">{t('Renew membership','Perbaharui keahlian')}</a>}</section>}</>;
}
