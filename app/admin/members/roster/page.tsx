
import {uiText} from '../../../../lib/ui-text';
import {getLanguage as getUiLanguage} from '../../../language';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {createMember} from '../../../../lib/member-create';
import {AddMemberForm} from './add-form';
import {isAdmin} from '../../../../lib/shop';
import {listMembers,validYear} from '../../../../lib/member-admin';
import {malaysiaYear} from '../../../../lib/member-status';
import {MemberList} from './list';
import '../../../shop/shop.css';
export const dynamic='force-dynamic';
export const metadata={title:'Manage members | KPKMM',robots:{index:false,follow:false}};
async function add(_: {error?:string},form:FormData):Promise<{error?:string}>{
 'use server';
 if(!(await isAdmin()))redirect('/admin');
 let result;try{result=await createMember(form);}catch{return {error:'Could not save. Check all fields and try again. / Tidak dapat menyimpan. Semak semua medan.'};}
 if(!('memberNumber' in result))return {error:result.error};
 revalidatePath('/admin/members/roster');revalidatePath('/membership-status');
 redirect('/admin/members/roster/edit?member='+encodeURIComponent(result.memberNumber!)+'&year='+Number(form.get('year'))+'&result=saved');
}
export default async function Roster({searchParams}:{searchParams:Promise<{year?:string;add?:string}>}){
 const ui = uiText(await getUiLanguage());

 if(!(await isAdmin()))redirect('/admin');
 const q=await searchParams;let year=malaysiaYear();try{if(q.year)year=validYear(q.year);}catch{}
 let members;try{members=await listMembers(year);}catch{return <main className="shop"><a href="/admin/members">{ui("← Admin")}</a><h1>{ui("Member listing / Senarai ahli")}</h1><p>{ui("Private records are temporarily unavailable. No changes were made. / Rekod sulit tidak tersedia buat sementara waktu.")}</p></main>;}
 return <main className="shop"><nav className="shop-actions"><a href="/admin/members">{ui("← Applications / Permohonan")}</a><a href="/admin/renewals">{ui("Renewals / Pembaharuan")}</a><a href="/admin/members/import">{ui("Import roster / Import daftar")}</a></nav><h1>{ui("Member listing / Senarai ahli")}</h1><p>{ui("Private administrator access. Membership numbers remain permanent. Edit details, maintain annual status or download an Excel list. / Akses pentadbir sahaja. Nombor ahli kekal.")}</p>
 <form className="shop-actions"><label>{ui("Membership year / Tahun keahlian")}<input name="year" type="number" min="2000" max="2200" defaultValue={year} required/></label><button>{ui("View year / Lihat tahun")}</button></form>
 <p><a className="shop-link" href={'?year='+year+(q.add?'':'&add=1')}>{q.add?ui('Close add form / Tutup borang'):ui('+ Add member / Tambah ahli')}</a></p>
 {q.add&&<AddMemberForm year={year} action={add}/>}
 <MemberList year={year} members={members.map(m=>({memberNumber:m.memberNumber,name:m.name,active:m.active,identity:m.identity,address:m.address}))}/>
 <section className="shop-card"><h2>{ui("Excel downloads / Muat turun Excel")}</h2><p>{ui("Exports include member number, name, annual status, phone, email and registered address. Identification numbers are excluded by default. Keep downloaded files private. / Nombor pengenalan tidak disertakan secara lalai. Simpan fail secara sulit.")}</p><form action="/admin/members/roster/export" method="get"><input type="hidden" name="year" value={year}/><label>{ui("Members to export / Ahli untuk dieksport")}<select name="status"><option value="active">{ui("Active / Aktif")}</option><option value="inactive">{ui("Inactive / Tidak aktif")}</option><option value="all">{ui("All / Semua")}</option></select></label><label className="shop-consent"><input type="checkbox" name="identity" value="yes"/>{ui("Include identification numbers (private) / Sertakan nombor pengenalan (sulit)")}</label><button>{ui("Download Excel (.xlsx) / Muat turun Excel")}</button></form></section>
 </main>;
}
