'use client';
import {useUiText} from '../ui-language';

import {useActionState,useState} from 'react';
import {requestRenewal} from './actions';
export function RenewalForm({bm,year}:{bm:boolean;year:number}){
 const ui = useUiText();

 const [state,action,pending]=useActionState(requestRenewal,{});
 const [mode,setMode]=useState('name');
 const t=(en:string,ms:string)=>bm?ms:en;
 if(state.success)return <div className="shop-note" role="status"><h2>{t('Request recorded','Permohonan direkodkan')}</h2><p>{ui(state.success)}</p>{state.reference&&<p>{t('Keep your reference','Simpan rujukan anda')}: <strong>{state.reference}</strong></p>}<a href="/">{t('Back to home','Kembali ke laman utama')}</a></div>;
 return <form action={action} autoComplete="off"><fieldset disabled={pending}>
 <label>{t('Renewal year','Tahun pembaharuan')}<select name="year" defaultValue={year}><option value={year}>{year}</option><option value={year+1}>{year+1}</option></select></label>
 <label>{t('Find my membership using','Cari keahlian saya menggunakan')}<select name="lookupMode" value={mode} onChange={e=>setMode(e.target.value)}><option value="name">{t('Registered full name','Nama penuh berdaftar')}</option><option value="identity">{t('MyKad / passport number','Nombor MyKad / pasport')}</option></select></label>
 <label>{mode==='name'?t('Registered full name','Nama penuh berdaftar'):t('MyKad / passport number','Nombor MyKad / pasport')}<input key={mode} name="lookupValue" required minLength={mode==='name'?2:5} maxLength={mode==='name'?150:30} autoComplete="off"/></label>
 <p>{t('Enter only one: your registered name or identification number. We use the contact and address details already held by the club. If no matching member is found, renewal is blocked.','Masukkan satu sahaja: nama berdaftar atau nombor pengenalan. Kami menggunakan maklumat hubungan dan alamat yang sedia ada dalam rekod kelab. Jika tiada ahli sepadan, pembaharuan disekat.')}</p>
 <label>{t('Payment proof — JPG, PNG or PDF, up to 700 KB','Bukti bayaran — JPG, PNG atau PDF, sehingga 700 KB')}<input type="file" name="proof" required accept="image/jpeg,image/png,application/pdf" onChange={e=>{const f=e.target.files?.[0];e.target.setCustomValidity(f&&f.size>700*1024?t('Please choose a file under 700 KB.','Sila pilih fail di bawah 700 KB.'):'');e.target.reportValidity();}}/></label>
 <p>{t('Upload the transfer receipt, not your IC/passport. Hide unrelated bank balances and transactions.','Muat naik resit pindahan, bukan KP/pasport. Sembunyikan baki bank dan transaksi yang tidak berkaitan.')}</p>
 <div hidden><label>{ui("Website")}<input name="website" tabIndex={-1}/></label></div>
 <label className="shop-consent"><input type="checkbox" name="consent" value="yes" required/>{t('I confirm this is my membership and consent to KPKMM using my existing member record and payment proof privately, including sending them to the club Gmail for renewal review.','Saya mengesahkan ini keahlian saya dan bersetuju KPKMM menggunakan rekod ahli sedia ada serta bukti bayaran secara sulit, termasuk menghantarnya ke Gmail kelab untuk semakan pembaharuan.')}</label>
 <button>{pending?t('Saving and sending…','Menyimpan dan menghantar…'):t('Submit renewal request','Hantar permohonan pembaharuan')}</button>
 </fieldset>{state.error&&<p className="shop-error" role="alert">{ui(state.error)}</p>}</form>;
}
