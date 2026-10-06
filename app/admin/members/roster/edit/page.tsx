
import {uiText} from '../../../../../lib/ui-text';
import {getLanguage as getUiLanguage} from '../../../../language';
import {AddressFields} from '../../../../address-fields';
import {redirect,notFound} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {db,isAdmin} from '../../../../../lib/shop';
import {listMembers,saveMember,validYear} from '../../../../../lib/member-admin';
import '../../../../shop/shop.css';
export const dynamic='force-dynamic';
export const metadata={title:'Edit member | KPKMM',robots:{index:false,follow:false}};
async function save(form:FormData){
 'use server';
 if(!(await isAdmin()))redirect('/admin');
 let result='invalid';try{result=await saveMember(form);}catch{}
 const member=result==='saved'?String(form.get('correctedMemberNumber')||form.get('memberNumber')||'').trim().toUpperCase():String(form.get('memberNumber')||''),year=String(form.get('year')||'');
 revalidatePath('/admin/members/roster');revalidatePath('/membership-status');
 redirect('/admin/members/roster/edit?member='+encodeURIComponent(member)+'&year='+encodeURIComponent(year)+'&result='+result);
}
export default async function EditMember({searchParams}:{searchParams:Promise<{member?:string;year?:string;result?:string}>}){
 const language = await getUiLanguage(), ui = uiText(language),t=(en:string,ms:string)=>language==='ms'?ms:en;

 if(!(await isAdmin()))redirect('/admin');
 const q=await searchParams;let year;try{year=validYear(q.year);}catch{notFound();}
 if(!/^[A-Za-z0-9-]{1,30}$/.test(q.member||''))notFound();
 let member,history;try{member=(await listMembers(year)).find(m=>m.memberNumber===q.member);history=await db()`SELECT created_at,membership_year FROM club_roster_edits WHERE member_number=${q.member!} ORDER BY created_at DESC LIMIT 10`;}catch{return <main className="shop"><p>{ui("Private record unavailable. Please retry. / Rekod sulit tidak tersedia.")}</p></main>;}
 if(!member)notFound();
 return <main className="shop" style={{maxWidth:850}}><a href={'/admin/members/roster?year='+year}>{ui("← Member listing / Senarai ahli")}</a><h1>{ui("Edit member / Sunting ahli")}</h1><p><strong>{member.memberNumber}</strong> · {year}</p><p>{t('Edit personal details only. Membership status cannot be changed here. Use Renew membership with verified payment proof.','Sunting maklumat peribadi sahaja. Status keahlian tidak boleh diubah di sini. Gunakan pembaharuan dengan bukti bayaran disahkan.')}</p>
 {q.result&&<p role="status" className="shop-note">{q.result==='saved'?ui('Member updated. / Maklumat ahli dikemas kini.'):q.result==='duplicate-id'?ui('That ID or running number is already in use, or the ID was previously retired. No changes saved. / Nombor telah digunakan atau tidak boleh digunakan semula.'):q.result==='invalid-id'?ui('Use a valid state prefix, two-digit joining year and running number, e.g. B-26-001. / Gunakan format B-26-001.'):q.result==='confirm-id'?ui('Tick the ID correction confirmation before changing the number. / Sahkan pembetulan nombor ahli.'):q.result==='conflict'?ui('Another update occurred. Review the refreshed details before saving again. / Rekod telah berubah. Semak maklumat terkini sebelum menyimpan semula.'):ui('Could not save. Check the fields and reason, then retry. / Tidak dapat menyimpan. Semak maklumat dan sebab.')}</p>}
 <section className="shop-card"><form action={save}><input type="hidden" name="memberNumber" value={member.memberNumber}/><input type="hidden" name="year" value={year}/><input type="hidden" name="revision" value={member.revision}/>
 <label>{ui("Membership ID / Nombor ahli")}<input name="correctedMemberNumber" defaultValue={member.memberNumber} maxLength={30} required autoComplete="off"/></label><p>{ui("Example: B-26-001. Keep the original joining year and running number unless correcting an error. Address changes do not require a new ID. Old IDs cannot be reused. / Kekalkan tahun menyertai dan nombor turutan kecuali untuk pembetulan.")}</p><label className="shop-consent"><input type="checkbox" name="confirmIdCorrection" value="yes"/>{ui("I confirm this is an intentional ID correction across all years (only needed when changing the ID). / Saya mengesahkan pembetulan nombor ahli bagi semua tahun.")}</label>
 <label>{ui("Full registered name / Nama penuh berdaftar")}<input name="name" defaultValue={member.name} minLength={2} maxLength={150} required/></label>
 <label>{ui("MyKad / Passport")}<input name="identity" defaultValue={member.identity} maxLength={254} autoComplete="off"/></label>
 <label>{ui("Phone / Telefon")}<input name="phone" defaultValue={member.phone} maxLength={254}/></label><label>{ui("Email / E-mel")}<input name="email" type="email" defaultValue={member.email} maxLength={254}/></label><AddressFields value={member} required={false}/>
 <p>{year}: <strong>{member.active?ui('Active / Aktif'):ui('Inactive / Tidak aktif')}</strong></p><p><a className="shop-link" href={'/admin/members/roster/renew?member='+encodeURIComponent(member.memberNumber)+'&year='+year}>{t('Renew membership','Perbaharui keahlian')}</a></p>
 <label>{ui("Reason for update / Sebab kemas kini")}<textarea name="reason" required minLength={3} maxLength={500} rows={2}/></label><button>{ui("Save member / Simpan ahli")}</button></form></section>
 <section className="shop-note"><h2>{ui("Change history / Sejarah perubahan")}</h2>{history.length?history.map((r,i)=><p key={i}>{r.membership_year} · {new Date(r.created_at).toLocaleString(language==='ms'?'ms-MY':'en-MY',{timeZone:'Asia/Kuala_Lumpur'})}{ui(" — Admin update / Kemas kini pentadbir")}</p>):<p>{ui("No manual edits yet. / Tiada suntingan manual.")}</p>}</section></main>;
}
