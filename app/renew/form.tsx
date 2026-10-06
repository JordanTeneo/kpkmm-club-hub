'use client';
import {useActionState,useState} from 'react';
import {AddressFields} from '../address-fields';
import {requestRenewal} from './actions';
export function RenewalForm({bm,year}:{bm:boolean;year:number}){
 const [state,action,pending]=useActionState(requestRenewal,{});
 const [kind,setKind]=useState('mykad');
 const t=(en:string,ms:string)=>bm?ms:en;
 if(state.success)return <div className="shop-note" role="status"><h2>{t('Request recorded','Permohonan direkodkan')}</h2><p>{state.success}</p>{state.reference&&<p>{t('Keep your reference','Simpan rujukan anda')}: <strong>{state.reference}</strong></p>}<a href="/">{t('Back to home','Kembali ke laman utama')}</a></div>;
 return <form action={action} autoComplete="off"><fieldset disabled={pending}>
 <label>{t('Renewal year','Tahun pembaharuan')}<select name="year" defaultValue={year}><option value={year}>{year}</option><option value={year+1}>{year+1}</option></select></label>
 <label>{t('Full name as on MyKad / passport','Nama penuh seperti MyKad / pasport')}<input name="name" required minLength={2} maxLength={150} autoComplete="name"/></label>
 <label>{t('Identification type','Jenis pengenalan')}<select name="identityType" value={kind} onChange={e=>setKind(e.target.value)}><option value="mykad">MyKad / IC — Malaysia</option><option value="passport">{t('Passport — Non-Malaysian','Pasport — Bukan warganegara')}</option></select></label>
 <label>{kind==='mykad'?t('MyKad / IC number (12 digits)','Nombor MyKad / KP (12 digit)'):t('Passport number','Nombor pasport')}<input key={kind} name="identity" required maxLength={kind==='mykad'?14:20} inputMode={kind==='mykad'?'numeric':'text'} pattern={kind==='mykad'?'[0-9]{6}-?[0-9]{2}-?[0-9]{4}':'[A-Za-z0-9-]{5,20}'}/></label>
 {kind==='passport'?<label>{t('Passport issuing country','Negara pengeluar pasport')}<input name="country" required maxLength={80}/></label>:<input type="hidden" name="country" value="Malaysia"/>}
 <label>{t('Email address','Alamat e-mel')}<input type="email" name="email" required maxLength={254} autoComplete="email"/></label>
 <label>{t('Mobile number (include country code)','Nombor telefon bimbit (sertakan kod negara)')}<input type="tel" name="phone" required maxLength={30} autoComplete="tel" placeholder="+60…"/></label>
 <AddressFields bm={bm}/>
 <label>{t('Payment proof — JPG, PNG or PDF, up to 700 KB','Bukti bayaran — JPG, PNG atau PDF, sehingga 700 KB')}<input type="file" name="proof" required accept="image/jpeg,image/png,application/pdf" onChange={e=>{const f=e.target.files?.[0];e.target.setCustomValidity(f&&f.size>700*1024?t('Please choose a file under 700 KB.','Sila pilih fail di bawah 700 KB.'):'');e.target.reportValidity();}}/></label>
 <p>{t('Upload the transfer receipt, not your IC/passport. Hide unrelated bank balances and transactions.','Muat naik resit pindahan, bukan KP/pasport. Sembunyikan baki bank dan transaksi yang tidak berkaitan.')}</p>
 <div hidden><label>Website<input name="website" tabIndex={-1}/></label></div>
 <label className="shop-consent"><input type="checkbox" name="consent" value="yes" required/>{t('I confirm these details are accurate and consent to KPKMM storing my details and payment proof privately and sending them to the club Gmail for renewal review, as described below.','Saya mengesahkan maklumat ini tepat dan bersetuju KPKMM menyimpan maklumat serta bukti bayaran secara sulit dan menghantarnya ke Gmail kelab untuk semakan pembaharuan seperti diterangkan di bawah.')}</label>
 <button>{pending?t('Saving and sending…','Menyimpan dan menghantar…'):t('Submit renewal request','Hantar permohonan pembaharuan')}</button>
 </fieldset>{state.error&&<p className="shop-error" role="alert">{state.error}</p>}</form>;
}
