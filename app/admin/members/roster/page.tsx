
import {uiText} from '../../../../lib/ui-text';
import {getLanguage as getUiLanguage} from '../../../language';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {createMember} from '../../../../lib/member-create';
import {AddMemberForm} from './add-form';
import {isAdmin} from '../../../../lib/shop';
import {memberPage} from '../../../../lib/member-history';
import {validYear} from '../../../../lib/member-admin';
import {malaysiaYear} from '../../../../lib/member-status';
import {MemberList} from './list';
import '../../../shop/shop.css';
export const dynamic='force-dynamic';
export const metadata={title:'Manage members | KPKMM',robots:{index:false,follow:false}};
async function add(_: {error?:string},form:FormData):Promise<{error?:string}>{
 'use server';
 if(!(await isAdmin('membership')))redirect('/admin');
 let result;try{result=await createMember(form);}catch{return {error:'Could not save. Check all fields and try again. / Tidak dapat menyimpan. Semak semua medan.'};}
 if(!('memberNumber' in result))return {error:result.error};
 revalidatePath('/admin/members/roster');revalidatePath('/membership-status');
 redirect('/admin/members/roster/edit?member='+encodeURIComponent(result.memberNumber!)+'&year='+Number(form.get('year'))+'&result=saved');
}
export default async function Roster({searchParams}:{searchParams:Promise<{year?:string;add?:string;q?:string;status?:string;page?:string}>}){
 const language=await getUiLanguage(),ui=uiText(language),t=(en:string,ms:string)=>language==='ms'?ms:en;
 if(!(await isAdmin('membership')))redirect('/admin');
 const q=await searchParams;let year=malaysiaYear();try{if(q.year)year=validYear(q.year);}catch{}
 const query=(q.q||'').slice(0,150),status=['active','new','inactive','lifetime','deceased'].includes(q.status||'')?q.status!:'all';
 let result;try{result=await memberPage(year,query,status,Number(q.page)||1);}catch{return <main className="shop"><a href="/admin/members">{ui("← Admin")}</a><h1>{ui("Member listing / Senarai ahli")}</h1><p>{ui("Private records are temporarily unavailable. No changes were made. / Rekod sulit tidak tersedia buat sementara waktu.")}</p></main>;}
 return <main className="shop"><h1>{ui("Member listing / Senarai ahli")}</h1><p>{ui("Private administrator access. Membership numbers remain permanent. Edit details, maintain annual status or download an Excel list. / Akses pentadbir sahaja. Nombor ahli kekal.")}</p>
 <form className="shop-actions"><label>{ui("Membership year / Tahun keahlian")}<input name="year" type="number" min="2000" max="2200" defaultValue={year} required/></label><button>{ui("View year / Lihat tahun")}</button></form>
 <p><a className="shop-link" href={'?year='+year+(q.add?'':'&add=1')}>{q.add?ui('Close add form / Tutup borang'):ui('+ Add member / Tambah ahli')}</a></p>
 {q.add&&<AddMemberForm year={year} action={add}/>}
 <MemberList year={year} query={query} status={status} counts={result.counts} total={result.total} matching={result.matching} pages={result.pages} current={result.current} members={result.members.map(m=>({memberNumber:m.memberNumber,name:m.name,active:m.active,annualStatus:m.annualStatus,previousStatus:m.previousStatus,previousActive:m.previousActive,identity:m.identity,address:m.address,email:m.email,vehicles:m.vehicles,lifetimeSince:m.lifetimeSince,memberSince:m.memberSince,lastActiveYear:m.lastActiveYear,paymentHistory:m.paymentHistory}))}/>
 <section className="shop-card"><h2>{ui("Excel downloads / Muat turun Excel")}</h2><p>{ui("Exports include member number, name, annual status, phone, email and registered address. Identification numbers are excluded by default. Keep downloaded files private. / Nombor pengenalan tidak disertakan secara lalai. Simpan fail secara sulit.")}</p>
 <p>{t('Choose a start and end year (up to 25 years). Each year gets its own sheet with that year’s membership status. Use the same year in both fields for a single-year download.','Pilih tahun mula dan akhir (sehingga 25 tahun). Setiap tahun mempunyai helaian sendiri dengan status keahlian tahun tersebut. Gunakan tahun yang sama dalam kedua-dua medan untuk muat turun satu tahun.')}</p>
 <form action="/admin/members/roster/export" method="get">
 <div className="shop-actions"><label>{t('From year','Dari tahun')}<input type="number" name="from" min="2000" max="2200" defaultValue={year} required/></label><label>{t('To year','Hingga tahun')}<input type="number" name="to" min="2000" max="2200" defaultValue={year} required/></label></div>
 <label>{ui("Members to export / Ahli untuk dieksport")}<select name="status"><option value="active">{ui("Active / Aktif")}</option><option value="new">{ui('New / Baharu')}</option><option value="lifetime">{ui('Lifetime / Seumur hidup')}</option><option value="deceased">{ui('Deceased / Telah meninggal dunia')}</option><option value="inactive">{ui("Inactive / Tidak aktif")}</option><option value="all">{ui("All / Semua")}</option></select></label><label className="shop-consent"><input type="checkbox" name="identity" value="yes"/>{ui("Include identification numbers (private) / Sertakan nombor pengenalan (sulit)")}</label><button>{ui("Download Excel (.xlsx) / Muat turun Excel")}</button></form></section>
 </main>;
}
