'use client';
import {MembershipPrice} from '../../../membership-price';
import type {FeeQuote} from '../../../../lib/membership-pricing';

import {useUiLanguage,useUiText} from '../../../ui-language';

import {useActionState,useState} from 'react';
import {AddressFields} from '../../../address-fields';
type Result={error?:string};
export function AddMemberForm({year,action,pricing}:{pricing:{quote:FeeQuote;token:string};year:number;action:(state:Result,form:FormData)=>Promise<Result>}){
 const ui = useUiText(),bm=useUiLanguage()==='ms',t=(en:string,ms:string)=>bm?ms:en;
 const [paid,setPaid]=useState(false);

 const [result,submit,pending]=useActionState(action,{});
 return <section className="shop-card"><h2>{ui("Add member / Tambah ahli")}</h2><p>{ui("The membership number is assigned automatically using the registered state, joining year and next club-wide running number. Dormant and retired numbers are never reused. / Nombor ahli dijana secara automatik.")}</p><form action={submit}>
 <label>{ui("Joining / membership year · Tahun menyertai")}<input name="year" type="number" min="2000" max="2200" defaultValue={year} required/></label>
 <label>{ui("Full name as on identification / Nama penuh")}<input name="name" minLength={2} maxLength={150} required autoComplete="name"/></label>
 <label>{ui("Identification type / Jenis pengenalan")}<select name="identityType"><option value="mykad">MyKad</option><option value="passport">{ui("Passport / Pasport")}</option></select></label>
 <label>{ui("MyKad / Passport number")}<input name="identity" required maxLength={30} autoComplete="off"/></label>
 <label>{ui("Identification issuing country / Negara pengeluar")}<input name="country" defaultValue="Malaysia" required maxLength={80}/></label>
 <label>{ui("Email / E-mel")}<input name="email" type="email" required maxLength={254}/></label><label>{ui("Mobile / Telefon")}<input name="phone" type="tel" required maxLength={30}/></label>
 <AddressFields/>
 <label>{ui("Membership status / Status keahlian")}<select name="status" defaultValue="inactive" onChange={e=>setPaid(e.target.value==='active')}><option value="inactive">{ui("Inactive / Tidak aktif")}</option><option value="active">{t("New member — payment verified","Ahli baharu — bayaran disahkan")}</option></select></label><p>{ui("Active membership ends on 31 December of the selected year. No email is sent by this form. / Keahlian aktif tamat pada 31 Disember tahun dipilih.")}</p>
 {paid&&<fieldset><legend>{t('Verified new-member payment','Bayaran ahli baharu disahkan')}</legend><MembershipPrice quote={pricing.quote} bm={bm}/><input type="hidden" name="feeToken" value={pricing.token}/><p>{t('Quote valid for 24 hours. Saving creates the paid invoice and Membership Payments record. No email is sent by this form.','Sebut harga sah 24 jam. Penyimpanan menghasilkan invois berbayar dan rekod Bayaran Keahlian. Tiada e-mel dihantar oleh borang ini.')}</p><label>{t('Bank payment date (as on receipt)','Tarikh bayaran bank (seperti pada resit)')}<input type="date" name="paidOn" min="2000-01-01" required/></label><label>{t('Payment proof — JPG, PNG or PDF, up to 700 KB','Bukti bayaran — JPG, PNG atau PDF, sehingga 700 KB')}<input name="proof" type="file" accept="image/jpeg,image/png,application/pdf" required/></label><label><input type="checkbox" name="verified" value="yes" required/>{t('I verified the payment against the quoted total.','Saya mengesahkan bayaran sepadan dengan jumlah yang dinyatakan.')}</label></fieldset>}
 <label>{ui("Reason / payment reference · Sebab / rujukan bayaran")}<textarea name="reason" required minLength={3} maxLength={500}/></label>
 {result.error&&<p role="alert">{ui(result.error)}</p>}<button disabled={pending}>{pending?ui('Saving / Menyimpan…'):ui('Add member / Tambah ahli')}</button>
 </form></section>;
}
