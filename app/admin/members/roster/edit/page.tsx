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
 const member=String(form.get('memberNumber')||''),year=String(form.get('year')||'');
 revalidatePath('/admin/members/roster');revalidatePath('/membership-status');
 redirect('/admin/members/roster/edit?member='+encodeURIComponent(member)+'&year='+encodeURIComponent(year)+'&result='+result);
}
export default async function EditMember({searchParams}:{searchParams:Promise<{member?:string;year?:string;result?:string}>}){
 if(!(await isAdmin()))redirect('/admin');
 const q=await searchParams;let year;try{year=validYear(q.year);}catch{notFound();}
 if(!/^[A-Za-z0-9-]{1,30}$/.test(q.member||''))notFound();
 let member,history;try{member=(await listMembers(year)).find(m=>m.memberNumber===q.member);history=await db()`SELECT created_at,membership_year FROM club_roster_edits WHERE member_number=${q.member!} ORDER BY created_at DESC LIMIT 10`;}catch{return <main className="shop"><p>Private record unavailable. Please retry. / Rekod sulit tidak tersedia.</p></main>;}
 if(!member)notFound();
 return <main className="shop" style={{maxWidth:850}}><a href={'/admin/members/roster?year='+year}>← Member listing / Senarai ahli</a><h1>Edit member / Sunting ahli</h1><p><strong>{member.memberNumber}</strong> · {year}</p><p>Membership ID is locked and is not changed by an address update or inactive status. Changes apply to the selected year and keep earlier-year history. / Nombor ahli kekal. Perubahan terpakai untuk tahun dipilih.</p>
 {q.result&&<p role="status" className="shop-note">{q.result==='saved'?'Member updated. / Maklumat ahli dikemas kini.':q.result==='conflict'?'Another update occurred. Review the refreshed details before saving again. / Rekod telah berubah. Semak maklumat terkini sebelum menyimpan semula.':'Could not save. Check the fields and reason, then retry. / Tidak dapat menyimpan. Semak maklumat dan sebab.'}</p>}
 <section className="shop-card"><form action={save}><input type="hidden" name="memberNumber" value={member.memberNumber}/><input type="hidden" name="year" value={year}/><input type="hidden" name="revision" value={member.revision}/>
 <label>Full registered name / Nama penuh berdaftar<input name="name" defaultValue={member.name} minLength={2} maxLength={150} required/></label>
 <label>Phone / Telefon<input name="phone" defaultValue={member.phone} maxLength={254}/></label><label>Email / E-mel<input name="email" type="email" defaultValue={member.email} maxLength={254}/></label><label>Registered address / Alamat berdaftar<textarea name="address" rows={4} defaultValue={member.address} maxLength={1500}/></label>
 <details><summary>Identification details (private) / Maklumat pengenalan (sulit)</summary><label>MyKad / Passport<input name="identity" defaultValue={member.identity} maxLength={254} autoComplete="off"/></label></details>
 <label>{year} status<select name="status" defaultValue={member.active?'active':'inactive'}><option value="active">Active / Aktif</option><option value="inactive">Inactive / Tidak aktif</option></select></label><p>The saved status is the committee’s decision for {year} and takes precedence over earlier online approvals for this member. Active status ends on 31 December. / Status disimpan ialah keputusan jawatankuasa untuk tahun dipilih.</p>
 <label>Reason for update / Sebab kemas kini<textarea name="reason" required minLength={3} maxLength={500} rows={2}/></label><button>Save member / Simpan ahli</button></form></section>
 <section className="shop-note"><h2>Change history / Sejarah perubahan</h2>{history.length?history.map((r,i)=><p key={i}>{r.membership_year} · {new Date(r.created_at).toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur'})} — Admin update / Kemas kini pentadbir</p>):<p>No manual edits yet. / Tiada suntingan manual.</p>}</section></main>;
}
