'use client';
import {useUiText} from '../ui-language';

import {useActionState,useState,useEffect,useRef,useId} from 'react';
import {requestRenewal,type RenewalResult} from './actions';
const emptyOutcome:RenewalResult={};

function RenewalOutcome({result,bm}:{result:RenewalResult;bm:boolean}){
 const dialog=useRef<HTMLDialogElement>(null),heading=useId(),description=useId(),ui=useUiText();
 const t=(en:string,ms:string)=>bm?ms:en;
 useEffect(()=>{
  const modal=dialog.current;
  if(result.error||result.success){if(modal&&!modal.open)modal.showModal();}
  else if(modal?.open)modal.close();
 },[result]);
 return <dialog ref={dialog} className="renewal-outcome" aria-labelledby={heading} aria-describedby={description} onClick={e=>{if(e.target===e.currentTarget)e.currentTarget.close();}}>
  <style>{`.renewal-outcome{width:min(520px,calc(100vw - 32px));max-height:85dvh;overflow:auto;box-sizing:border-box;padding:28px;border:1px solid #c9b690;border-radius:20px;background:#fff8ea;color:#2e2119;box-shadow:0 24px 80px #21170f66}.renewal-outcome::backdrop{background:#21170fa6}.renewal-outcome h2{font-size:28px;margin:0 0 16px}.renewal-outcome p{line-height:1.6;overflow-wrap:anywhere}.renewal-outcome .outcome-reference{background:#f2e0bd;padding:12px;border-radius:8px;overflow-wrap:anywhere}.renewal-outcome button{width:100%;margin-top:16px}.renewal-outcome button:focus-visible{outline:3px solid #b64122;outline-offset:3px}`}</style>
  <h2 id={heading}>{result.error?t('Unable to submit renewal','Pembaharuan tidak dapat dihantar'):result.reference?t('Renewal request submitted','Permohonan pembaharuan dihantar'):t('Request already recorded','Permohonan sudah direkodkan')}</h2>
  <p id={description}>{ui(result.error||result.success||'')}</p>
  {result.success&&<p>{t('This is not membership approval. The committee must verify your payment and approve the renewal. Do not pay again.','Ini bukan kelulusan keahlian. Jawatankuasa perlu mengesahkan bayaran dan meluluskan pembaharuan. Jangan bayar lagi.')}</p>}
  {result.reference&&<p className="outcome-reference">{t('Your reference','Rujukan anda')}: <strong>{result.reference}</strong></p>}
  <button type="button" autoFocus onClick={()=>dialog.current?.close()}>{result.error?t('Close and review','Tutup dan semak'):t('OK, understood','Baik, saya faham')}</button>
 </dialog>;
}
export function RenewalForm({bm,year}:{bm:boolean;year:number}){
 const ui = useUiText();

 const [validation,setValidation]=useState<RenewalResult|null>(null);
 const [state,action,pending]=useActionState(async(previous:RenewalResult,form:FormData):Promise<RenewalResult>=>{
  try{return await requestRenewal(previous,form);}catch{return {error:bm?'Keputusan penghantaran tidak dapat disahkan. Hubungi kelab sebelum menghantar atau membayar lagi.':'We could not confirm the submission result. Contact the club before submitting or paying again.'};}
 },{});
 const [mode,setMode]=useState('name');
 const t=(en:string,ms:string)=>bm?ms:en;
 const outcome=pending?emptyOutcome:validation??state;
 const popup=<RenewalOutcome result={outcome} bm={bm}/>;
 if(state.success)return <>{popup}<div className="shop-note" role="status"><h2 tabIndex={-1}>{t('Request recorded','Permohonan direkodkan')}</h2><p>{ui(state.success)}</p><p>{t('Committee approval is still required.','Kelulusan jawatankuasa masih diperlukan.')}</p>{state.reference&&<p>{t('Keep your reference','Simpan rujukan anda')}: <strong>{state.reference}</strong></p>}<a href="/">{t('Back to home','Kembali ke laman utama')}</a></div></>;
 return <>{popup}<form action={action} autoComplete="off" onSubmit={()=>setValidation(null)} onInvalid={e=>{
  e.preventDefault();
  const form=e.currentTarget;
  if(e.target!==form.querySelector('input:invalid, select:invalid, textarea:invalid'))return;
  setValidation({error:t('Please enter your registered name or MyKad/passport number, attach a JPG, PNG or PDF payment proof under 700 KB, and tick the consent checkbox.','Sila masukkan nama berdaftar atau nombor MyKad/pasport, lampirkan bukti bayaran JPG, PNG atau PDF di bawah 700 KB, dan tandakan kotak persetujuan.')});
 }}><fieldset disabled={pending}>
 <label>{t('Renewal year','Tahun pembaharuan')}<select name="year" defaultValue={year}><option value={year}>{year}</option><option value={year+1}>{year+1}</option></select></label>
 <label>{t('Find my membership using','Cari keahlian saya menggunakan')}<select name="lookupMode" value={mode} onChange={e=>setMode(e.target.value)}><option value="name">{t('Registered full name','Nama penuh berdaftar')}</option><option value="identity">{t('MyKad / passport number','Nombor MyKad / pasport')}</option></select></label>
 <label>{mode==='name'?t('Registered full name','Nama penuh berdaftar'):t('MyKad / passport number','Nombor MyKad / pasport')}<input key={mode} name="lookupValue" required minLength={mode==='name'?2:5} maxLength={mode==='name'?150:30} autoComplete="off"/></label>
 <p>{t('Enter only one: your registered name or identification number. We use the contact and address details already held by the club. If no matching member is found, renewal is blocked.','Masukkan satu sahaja: nama berdaftar atau nombor pengenalan. Kami menggunakan maklumat hubungan dan alamat yang sedia ada dalam rekod kelab. Jika tiada ahli sepadan, pembaharuan disekat.')}</p>
 <label>{t('Payment proof — JPG, PNG or PDF, up to 700 KB','Bukti bayaran — JPG, PNG atau PDF, sehingga 700 KB')}<input type="file" name="proof" required accept="image/jpeg,image/png,application/pdf" onChange={e=>{const f=e.target.files?.[0];e.target.setCustomValidity(f&&f.size>700*1024?t('Please choose a file under 700 KB.','Sila pilih fail di bawah 700 KB.'):'');e.target.reportValidity();}}/></label>
 <p>{t('Upload the transfer receipt, not your IC/passport. Hide unrelated bank balances and transactions.','Muat naik resit pindahan, bukan KP/pasport. Sembunyikan baki bank dan transaksi yang tidak berkaitan.')}</p>
 <div hidden><label>{ui("Website")}<input name="website" tabIndex={-1}/></label></div>
 <label className="shop-consent"><input type="checkbox" name="consent" value="yes" required/>{t('I confirm this is my membership and consent to KPKMM using my existing member record and payment proof privately, including sending them to the club Gmail for renewal review.','Saya mengesahkan ini keahlian saya dan bersetuju KPKMM menggunakan rekod ahli sedia ada serta bukti bayaran secara sulit, termasuk menghantarnya ke Gmail kelab untuk semakan pembaharuan.')}</label>
 <button>{pending?t('Saving and sending…','Menyimpan dan menghantar…'):t('Submit renewal request','Hantar permohonan pembaharuan')}</button>
 </fieldset>{outcome.error&&<p className="shop-error" role="alert">{ui(outcome.error)}</p>}</form></>;
}
