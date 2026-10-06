
import {uiText} from '../../../lib/ui-text';
import {getLanguage as getUiLanguage} from '../../language';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {db,isAdmin,uuid} from '../../../lib/shop';
import {membershipReady,unseal,applicationLimit,fingerprint} from '../../../lib/membership';
import {membershipMailReady,notifyMembership} from '../../../lib/membership-mail';
import '../../shop/shop.css';
export const dynamic='force-dynamic';
export const metadata={title:'Membership requests | KPKMM',robots:{index:false,follow:false}};
async function retryNotification(form:FormData){
 'use server';
 if(!(await isAdmin()))redirect('/admin');
 const id=String(form.get('id')||'');if(!uuid(id))redirect('/admin/members?result=failed');
 let result='failed';
 try{await membershipReady();await membershipMailReady();if(await applicationLimit(fingerprint('admin-mail')))result=await notifyMembership(id,form.get('checked')==='yes');else result='limited';}catch{}
 revalidatePath('/admin/members');redirect('/admin/members?result='+result);
}
async function Links(){
 const language = await getUiLanguage(), ui = uiText(language);
return <nav className="shop-actions" aria-label={ui("Membership administration")}><a href="/admin">{ui("← Dashboard / Pentadbiran kelab")}</a></nav>;}
const labels:Record<string,string>={queued:'Waiting to send / Menunggu penghantaran',sending:'Sending or interrupted — check Gmail / Menghantar atau terganggu — semak Gmail',accepted:'Accepted by Gmail / Diterima Gmail',failed:'Failed — request saved / Gagal — permohonan disimpan',unknown:'Delivery uncertain — check Gmail / Penghantaran tidak pasti — semak Gmail'};
export default async function Members({searchParams}:{searchParams:Promise<{page?:string;status?:string;result?:string}>}){
 const language = await getUiLanguage(), ui = uiText(language);

 if(!(await isAdmin()))redirect('/admin');
 const query=await searchParams,page=Math.max(1,Math.min(10000,Math.floor(Number(query.page)||1)));
 const status=['pending','approved','rejected'].includes(query.status||'')?query.status!:'pending';
 let rows;
 try{await membershipReady();await membershipMailReady();rows=await db()`SELECT a.id,a.payload,a.status,a.created_at,m.status AS mail_status,m.attempt_at FROM club_applications a LEFT JOIN club_application_mail m ON m.application_id=a.id WHERE a.status=${status} ORDER BY a.created_at DESC LIMIT 21 OFFSET ${(page-1)*20}`;}
 catch{return <main className="shop"><Links/><p>{ui("Membership storage is unavailable. Please check the database and encryption settings. / Storan keahlian tidak tersedia. Sila semak pangkalan data dan tetapan penyulitan.")}</p></main>;}
 const messages:Record<string,string>={accepted:'Gmail accepted the notification. / Gmail menerima pemberitahuan.',failed:'Could not send. Saved applications are retained. Check Email Setup. / Tidak dapat menghantar. Permohonan disimpan. Semak Tetapan E-mel.',unknown:'Delivery uncertain. Check the club inbox before retrying. / Penghantaran tidak pasti. Semak peti masuk sebelum mencuba semula.',sending:'Sending or already completed. Refresh this page. / Sedang menghantar atau sudah selesai. Muat semula halaman.',limited:'Too many attempts. Try again in an hour. / Terlalu banyak percubaan. Cuba lagi dalam sejam.'};
 return <main className="shop"><Links/><h1>{ui("New membership requests / Permohonan keahlian baharu")}</h1><p>{ui("Review applications and update their approval status. / Semak permohonan dan kemas kini status kelulusan.")}</p>
 {query.result&&messages[query.result]&&<p className="shop-note" role="status">{ui(messages[query.result])}</p>}
 <nav className="shop-actions" aria-label={ui("Application status / Status permohonan")}>{[['pending','Pending / Menunggu'],['approved','Approved / Diluluskan'],['rejected','Rejected / Ditolak']].map(([s,label])=><a className="shop-link" aria-current={status===s?'page':undefined} style={status===s?{background:'#483022',color:'#fff6e4'}:undefined} key={s} href={'?status='+s}>{ui(label)}</a>)}</nav>
 {rows.slice(0,20).map(row=>{let name='Unable to decrypt — check server key';try{name=unseal(row.payload).name;}catch{}
 const uncertain=row.mail_status==='unknown'||row.mail_status==='sending';
 const retryable=row.mail_status&&row.mail_status!=='accepted'&&(row.mail_status!=='sending'||Date.now()-new Date(row.attempt_at).getTime()>120000);
 return <article className="shop-card" key={row.id}><h2>{name}</h2><p>{ui(row.status)} · {new Date(row.created_at).toLocaleDateString(language==='ms'?'ms-MY':'en-MY',{timeZone:'Asia/Kuala_Lumpur'})}</p><p>{ui("Email: ")}{ui(labels[row.mail_status]||'Older application — no automatic notification / Permohonan lama — tiada pemberitahuan automatik')}</p><a className="shop-link" href={'/admin/members/'+row.id}>{ui("Review / Semak →")}</a>
 {retryable&&<form action={retryNotification}><input type="hidden" name="id" value={row.id}/>{uncertain&&<label className="shop-consent"><input type="checkbox" name="checked" value="yes" required/>{ui("I checked the club inbox and Sent folder. Retrying may send a duplicate. / Saya menyemak peti masuk dan folder Dihantar. Penghantaran semula mungkin menghasilkan salinan.")}</label>}<button>{ui("Retry notification / Cuba pemberitahuan semula")}</button></form>}</article>;})}
 {!rows.length&&<p>{ui("No applications in this category. / Tiada permohonan dalam kategori ini.")}</p>}
 <nav className="shop-actions">{page>1&&<a href={'?status='+status+'&page='+(page-1)}>{ui("← Previous")}</a>}{rows.length>20&&<a href={'?status='+status+'&page='+(page+1)}>{ui("Next →")}</a>}</nav></main>;
}
