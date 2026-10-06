'use client';
import {useUiText} from '../../../ui-language';

import {useActionState} from 'react';
import {AddressFields} from '../../../address-fields';
type Result={error?:string};
export function AddMemberForm({year,action}:{year:number;action:(state:Result,form:FormData)=>Promise<Result>}){
 const ui = useUiText();

 const [result,submit,pending]=useActionState(action,{});
 return <section className="shop-card"><h2>{ui("Add member / Tambah ahli")}</h2><p>{ui("The membership number is assigned automatically using the registered state, joining year and next club-wide running number. Dormant and retired numbers are never reused. / Nombor ahli dijana secara automatik.")}</p><form action={submit}>
 <label>{ui("Joining / membership year · Tahun menyertai")}<input name="year" type="number" min="2000" max="2200" defaultValue={year} required/></label>
 <label>{ui("Full name as on identification / Nama penuh")}<input name="name" minLength={2} maxLength={150} required autoComplete="name"/></label>
 <label>{ui("Identification type / Jenis pengenalan")}<select name="identityType"><option value="mykad">MyKad</option><option value="passport">{ui("Passport / Pasport")}</option></select></label>
 <label>{ui("MyKad / Passport number")}<input name="identity" required maxLength={30} autoComplete="off"/></label>
 <label>{ui("Identification issuing country / Negara pengeluar")}<input name="country" defaultValue="Malaysia" required maxLength={80}/></label>
 <label>{ui("Email / E-mel")}<input name="email" type="email" required maxLength={254}/></label><label>{ui("Mobile / Telefon")}<input name="phone" type="tel" required maxLength={30}/></label>
 <AddressFields/>
 <label>{ui("Membership status / Status keahlian")}<select name="status" defaultValue="inactive"><option value="inactive">{ui("Inactive / Tidak aktif")}</option><option value="active">{ui("Active / Aktif — payment verified / bayaran disahkan")}</option></select></label><p>{ui("Active membership ends on 31 December of the selected year. No email is sent by this form. / Keahlian aktif tamat pada 31 Disember tahun dipilih.")}</p>
 <label>{ui("Reason / payment reference · Sebab / rujukan bayaran")}<textarea name="reason" required minLength={3} maxLength={500}/></label>
 {result.error&&<p role="alert">{ui(result.error)}</p>}<button disabled={pending}>{pending?ui('Saving / Menyimpan…'):ui('Add member / Tambah ahli')}</button>
 </form></section>;
}
