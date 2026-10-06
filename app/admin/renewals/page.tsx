
import {uiText} from '../../../lib/ui-text';
import {getLanguage as getUiLanguage} from '../../language';
import {AddressDisplay} from '../../address-fields';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {db,isAdmin,uuid} from '../../../lib/shop';
import {renewalsReady,openRenewal,deliverRenewal,renewalLimit,type RenewalDetails} from '../../../lib/renewals';
import {reviewRenewal} from '../../../lib/renewal-review';
import '../../shop/shop.css';
export const dynamic='force-dynamic';
export const metadata={title:'Membership renewals | KPKMM',robots:{index:false,follow:false}};
async function review(form:FormData){
 'use server';
 if(!(await isAdmin()))redirect('/admin');
 const id=String(form.get('id')||''),status=String(form.get('status')||'');
 if(!uuid(id)||!['pending','approved','rejected'].includes(status))redirect('/admin/renewals?result=invalid');
 let result='failed';try{result=await reviewRenewal(id,status);for(const path of ['/admin/renewals','/admin/members/roster','/admin/members/import','/membership-status'])revalidatePath(path);}catch{result='failed';}
 redirect('/admin/renewals?result='+result);
}
async function retry(form:FormData){
 'use server';
 if(!(await isAdmin()))redirect('/admin');
 const id=String(form.get('id')||'');if(!uuid(id))redirect('/admin/renewals?result=invalid');
 let result='failed';try{await renewalsReady();if(await renewalLimit('admin-retry',10))result=await deliverRenewal(id,form.get('checked')==='yes');else result='limited';}catch{}
 revalidatePath('/admin/renewals');redirect('/admin/renewals?result='+result);
}
const mailLabels:Record<string,string>={queued:'Waiting / Menunggu',sending:'Sending or interrupted — check Gmail / Menghantar atau terganggu — semak Gmail',accepted:'Accepted by Gmail / Diterima Gmail',failed:'Email failed — request saved / E-mel gagal — permohonan disimpan',unknown:'Delivery uncertain — check Gmail / Penghantaran tidak pasti — semak Gmail'};
const reviewMessages:Record<string,string>={activated:'Renewal approved. Member is now active for the renewal year, until 31 December. / Pembaharuan diluluskan. Ahli kini aktif untuk tahun pembaharuan sehingga 31 Disember.',unmatched:'Not approved: no matching membership record. Verify the IC/passport in Manage members first; no status was changed. / Belum diluluskan: rekod ahli tidak sepadan. Semak maklumat pengenalan dahulu.',ambiguous:'Not approved: identification matches more than one member. Resolve duplicate records before approving. / Belum diluluskan: pengenalan sepadan dengan lebih daripada seorang ahli.'};
export default async function Renewals({searchParams}:{searchParams:Promise<{page?:string;status?:string;result?:string}>}){
 const language = await getUiLanguage(), ui = uiText(language);

 if(!(await isAdmin()))redirect('/admin');
 const query=await searchParams,page=Math.max(1,Math.min(10000,Math.floor(Number(query.page)||1)));
 const status=['pending','approved','rejected'].includes(query.status||'')?query.status!:'pending';
 let rows;try{await renewalsReady();rows=await db()`SELECT id,payload,renewal_year,review_status,mail_status,mail_attempt_at,created_at FROM club_renewals WHERE review_status=${status} ORDER BY created_at DESC LIMIT 21 OFFSET ${(page-1)*20}`;}catch{return <main className="shop"><a href="/admin">{ui("← Dashboard / Pentadbiran kelab")}</a><p>{ui("Secure renewal storage is unavailable. Keep GMAIL_ENCRYPTION_KEY unchanged and check the database connection. / Storan pembaharuan tidak tersedia. Jangan ubah GMAIL_ENCRYPTION_KEY dan semak sambungan pangkalan data.")}</p></main>;}
 const messages:Record<string,string>={saved:'Review saved. / Semakan disimpan.',accepted:'Gmail accepted the email. Verify receipt in the club inbox. / Gmail menerima e-mel. Semak penerimaan dalam peti masuk kelab.',failed:'Action could not be completed. The saved request is retained. / Tindakan tidak berjaya. Permohonan yang disimpan dikekalkan.',unknown:'Gmail delivery is uncertain. Check the inbox before retrying. / Penghantaran tidak pasti. Semak peti masuk sebelum mencuba lagi.',sending:'A send is already in progress or completed. Refresh this page. / Penghantaran sedang berjalan atau selesai. Muat semula halaman.',limited:'Too many attempts. Try again in an hour. / Terlalu banyak percubaan. Cuba lagi dalam sejam.',invalid:'Invalid request. / Permintaan tidak sah.'};
 return <main className="shop"><nav className="shop-actions" aria-label="Renewal administration"><a href="/admin">{ui("← Dashboard / Pentadbiran kelab")}</a></nav><h1>{ui("Membership renewals / Pembaharuan keahlian")}</h1><p>{ui("Private — authorised administrators only. Verify the bank payment before approving. / Sulit — pentadbir dibenarkan sahaja. Semak bayaran bank sebelum meluluskan.")}</p>
 {query.result&&(messages[query.result]||reviewMessages[query.result])&&<p className="shop-note" role="status">{ui(messages[query.result]||reviewMessages[query.result])}</p>}
 <p className="shop-note">{ui("Approving a renewal automatically activates the matching member in the member listing, Excel export and membership status check for that renewal year. Their existing membership number is retained. / Kelulusan pembaharuan mengaktifkan ahli yang sepadan secara automatik bagi tahun tersebut. Nombor ahli sedia ada dikekalkan.")}</p>
 <nav className="shop-actions" aria-label={ui("Renewal status / Status pembaharuan")}>{[['pending','Pending / Menunggu'],['approved','Approved / Diluluskan'],['rejected','Rejected / Ditolak']].map(([s,label])=><a className="shop-link" aria-current={status===s?'page':undefined} style={status===s?{background:'#483022',color:'#fff6e4'}:undefined} key={s} href={'?status='+s}>{ui(label)}</a>)}</nav>
 {!rows.length&&<p>{ui("No renewals in this category. / Tiada pembaharuan dalam kategori ini.")}</p>}
 {rows.slice(0,20).map(row=>{let d:RenewalDetails;try{d=JSON.parse(openRenewal(row.payload));}catch{return <article className="shop-card" key={row.id}><p>{ui("Cannot decrypt this record. Keep the original encryption key. / Rekod tidak dapat dinyahsulit. Kekalkan kunci penyulitan asal.")}</p></article>;}
 const uncertain=row.mail_status==='unknown'||row.mail_status==='sending';
 const canRetry=row.mail_status!=='accepted'&&(row.mail_status!=='sending'||Date.now()-new Date(row.mail_attempt_at).getTime()>120000);
 return <article className="shop-card" key={row.id}><h2>{d.name}</h2><p>{row.renewal_year} · RM150 · {new Date(row.created_at).toLocaleDateString(language==='ms'?'ms-MY':'en-MY',{timeZone:'Asia/Kuala_Lumpur'})}</p><p>{ui("Reference / Rujukan: ")}{row.id}</p><p>{ui("Email: ")}{ui(mailLabels[row.mail_status])}</p><details><summary>{ui("View private details / Lihat maklumat sulit")}</summary><p>{ui(d.identityType)}: {d.identity} · {d.country}</p><p>{d.email} · {d.phone}</p><AddressDisplay value={d}/><a className="shop-link" href={'/admin/renewals/proof?id='+row.id}>{ui("Download payment proof / Muat turun bukti bayaran")}</a></details>
 <form action={review}><input type="hidden" name="id" value={row.id}/><p>{ui("Approval activates only the selected renewal year, ending 31 December. / Kelulusan mengaktifkan tahun pembaharuan dipilih sahaja, sehingga 31 Disember.")}</p><label>{ui("Review status / Status semakan")}<select name="status" defaultValue={row.review_status}><option value="pending">{ui("Pending / Menunggu")}</option><option value="approved">{ui("Approved / Diluluskan")}</option><option value="rejected">{ui("Rejected / Ditolak")}</option></select></label><button>{ui("Save review / Simpan semakan")}</button></form>
 {canRetry&&<form action={retry}><input type="hidden" name="id" value={row.id}/>{uncertain&&<label className="shop-consent"><input type="checkbox" name="checked" value="yes" required/>{ui("I checked the club inbox and Sent folder for this reference and understand retrying may send a duplicate. / Saya telah menyemak peti masuk dan folder Dihantar untuk rujukan ini dan memahami penghantaran semula mungkin menghasilkan salinan.")}</label>}<button>{ui("Retry email / Cuba e-mel semula")}</button></form>}</article>;})}
 <nav className="shop-actions">{page>1&&<a href={'?status='+status+'&page='+(page-1)}>{ui("← Previous / Sebelumnya")}</a>}{rows.length>20&&<a href={'?status='+status+'&page='+(page+1)}>{ui("Next / Seterusnya →")}</a>}</nav></main>;
}
