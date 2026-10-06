'use client';
import {useActionState} from 'react';
import {AddressFields} from '../../../address-fields';
type Result={error?:string};
export function AddMemberForm({year,action}:{year:number;action:(state:Result,form:FormData)=>Promise<Result>}){
 const [result,submit,pending]=useActionState(action,{});
 return <section className="shop-card"><h2>Add member / Tambah ahli</h2><p>The membership number is assigned automatically using the registered state, joining year and next club-wide running number. Dormant and retired numbers are never reused. / Nombor ahli dijana secara automatik.</p><form action={submit}>
 <label>Joining / membership year · Tahun menyertai<input name="year" type="number" min="2000" max="2200" defaultValue={year} required/></label>
 <label>Full name as on identification / Nama penuh<input name="name" minLength={2} maxLength={150} required autoComplete="name"/></label>
 <label>Identification type / Jenis pengenalan<select name="identityType"><option value="mykad">MyKad</option><option value="passport">Passport / Pasport</option></select></label>
 <label>MyKad / Passport number<input name="identity" required maxLength={30} autoComplete="off"/></label>
 <label>Identification issuing country / Negara pengeluar<input name="country" defaultValue="Malaysia" required maxLength={80}/></label>
 <label>Email / E-mel<input name="email" type="email" required maxLength={254}/></label><label>Mobile / Telefon<input name="phone" type="tel" required maxLength={30}/></label>
 <AddressFields/>
 <label>Membership status / Status keahlian<select name="status" defaultValue="inactive"><option value="inactive">Inactive / Tidak aktif</option><option value="active">Active / Aktif — payment verified / bayaran disahkan</option></select></label><p>Active membership ends on 31 December of the selected year. No email is sent by this form. / Keahlian aktif tamat pada 31 Disember tahun dipilih.</p>
 <label>Reason / payment reference · Sebab / rujukan bayaran<textarea name="reason" required minLength={3} maxLength={500}/></label>
 {result.error&&<p role="alert">{result.error}</p>}<button disabled={pending}>{pending?'Saving / Menyimpan…':'Add member / Tambah ahli'}</button>
 </form></section>;
}
