import {randomUUID} from 'node:crypto';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {db,isAdmin,uuid} from '../../../lib/shop';
import {renewalsReady,openRenewal,deliverRenewal,renewalLimit,clubMessage,sendClubMessage,type RenewalDetails} from '../../../lib/renewals';
import '../../shop/shop.css';
export const dynamic='force-dynamic';
export const metadata={title:'Membership renewals | KPKMM',robots:{index:false,follow:false}};
async function review(form:FormData){
 'use server';
 if(!(await isAdmin()))redirect('/admin');
 const id=String(form.get('id')||''),status=String(form.get('status')||'');
 if(!uuid(id)||!['pending','approved','rejected'].includes(status))redirect('/admin/renewals?result=invalid');
 let result='saved';try{await renewalsReady();await db()`UPDATE club_renewals SET review_status=${status} WHERE id=${id}`;revalidatePath('/admin/renewals');}catch{result='failed';}
 redirect('/admin/renewals?result='+result);
}
async function retry(form:FormData){
 'use server';
 if(!(await isAdmin()))redirect('/admin');
 const id=String(form.get('id')||'');if(!uuid(id))redirect('/admin/renewals?result=invalid');
 let result='failed';try{await renewalsReady();if(await renewalLimit('admin-retry',10))result=await deliverRenewal(id,form.get('checked')==='yes');else result='limited';}catch{}
 revalidatePath('/admin/renewals');redirect('/admin/renewals?result='+result);
}
async function testEmail(){
 'use server';
 if(!(await isAdmin()))redirect('/admin');
 let result='failed';try{await renewalsReady();if(await renewalLimit('admin-test',3)){const sent=await sendClubMessage(clubMessage(randomUUID(),'KPKMM website email delivery test. This is not a membership application. No member information is included.',{bytes:Buffer.from('KPKMM payment-proof attachment test. No personal information.'),type:'text/plain'},true));result=sent.state;}else result='limited';}catch{}
 redirect('/admin/renewals?result=test-'+result);
}
const mailLabels:Record<string,string>={queued:'Waiting / Menunggu',sending:'Sending or interrupted — check Gmail / Menghantar atau terganggu — semak Gmail',accepted:'Accepted by Gmail / Diterima Gmail',failed:'Email failed — request saved / E-mel gagal — permohonan disimpan',unknown:'Delivery uncertain — check Gmail / Penghantaran tidak pasti — semak Gmail'};
export default async function Renewals({searchParams}:{searchParams:Promise<{page?:string;result?:string}>}){
 if(!(await isAdmin()))redirect('/admin');
 const query=await searchParams,page=Math.max(1,Math.min(10000,Math.floor(Number(query.page)||1)));
 let rows;try{await renewalsReady();rows=await db()`SELECT id,payload,renewal_year,review_status,mail_status,mail_attempt_at,created_at FROM club_renewals ORDER BY created_at DESC LIMIT 21 OFFSET ${(page-1)*20}`;}catch{return <main className="shop"><a href="/admin/email">Email setup / Tetapan e-mel</a><p>Secure renewal storage is unavailable. Keep GMAIL_ENCRYPTION_KEY unchanged and check the database connection. / Storan pembaharuan tidak tersedia. Jangan ubah GMAIL_ENCRYPTION_KEY dan semak sambungan pangkalan data.</p></main>;}
 const messages:Record<string,string>={saved:'Review saved. / Semakan disimpan.',accepted:'Gmail accepted the email. Verify receipt in the club inbox. / Gmail menerima e-mel. Semak penerimaan dalam peti masuk kelab.',failed:'Action could not be completed. The saved request is retained. / Tindakan tidak berjaya. Permohonan yang disimpan dikekalkan.',unknown:'Gmail delivery is uncertain. Check the inbox before retrying. / Penghantaran tidak pasti. Semak peti masuk sebelum mencuba lagi.',sending:'A send is already in progress or completed. Refresh this page. / Penghantaran sedang berjalan atau selesai. Muat semula halaman.',limited:'Too many attempts. Try again in an hour. / Terlalu banyak percubaan. Cuba lagi dalam sejam.',invalid:'Invalid request. / Permintaan tidak sah.','test-accepted':'Test email with a sample attachment accepted by Gmail. Check the club inbox. / E-mel ujian dengan lampiran contoh diterima Gmail. Semak peti masuk kelab.','test-failed':'Test failed. Reconnect Gmail in Email Setup, then try again. / Ujian gagal. Sambung semula Gmail dalam Tetapan E-mel dan cuba lagi.','test-unknown':'Test delivery uncertain. Check the club inbox. / Penghantaran ujian tidak pasti. Semak peti masuk kelab.','test-limited':'Test limit reached. Try again in an hour. / Had ujian dicapai. Cuba lagi dalam sejam.'};
 return <main className="shop"><nav className="shop-actions"><a href="/admin">← Admin</a><a href="/admin/members">New applications / Permohonan baharu</a><a href="/admin/email">Email setup / Tetapan e-mel</a></nav><h1>Renewals / Pembaharuan</h1><p>Private — authorised administrators only. Verify the bank payment before approving. / Sulit — pentadbir dibenarkan sahaja. Semak bayaran bank sebelum meluluskan.</p>
 {query.result&&messages[query.result]&&<p className="shop-note" role="status">{messages[query.result]}</p>}
 <section className="shop-card"><h2>Email delivery check / Ujian penghantaran</h2><p>Sends one clearly labelled test email and sample attachment to the club Gmail only. / Menghantar satu e-mel ujian berlabel dan lampiran contoh ke Gmail kelab sahaja.</p><form action={testEmail}><button>Send test email / Hantar e-mel ujian</button></form></section>
 {!rows.length&&<p>No renewal requests yet. / Belum ada permohonan pembaharuan.</p>}
 {rows.slice(0,20).map(row=>{let d:RenewalDetails;try{d=JSON.parse(openRenewal(row.payload));}catch{return <article className="shop-card" key={row.id}><p>Cannot decrypt this record. Keep the original encryption key. / Rekod tidak dapat dinyahsulit. Kekalkan kunci penyulitan asal.</p></article>;}
 const uncertain=row.mail_status==='unknown'||row.mail_status==='sending';
 const canRetry=row.mail_status!=='accepted'&&(row.mail_status!=='sending'||Date.now()-new Date(row.mail_attempt_at).getTime()>120000);
 return <article className="shop-card" key={row.id}><h2>{d.name}</h2><p>{row.renewal_year} · RM150 · {new Date(row.created_at).toLocaleDateString('en-MY',{timeZone:'Asia/Kuala_Lumpur'})}</p><p>Reference / Rujukan: {row.id}</p><p>Email: {mailLabels[row.mail_status]}</p><details><summary>View private details / Lihat maklumat sulit</summary><p>{d.identityType}: {d.identity} · {d.country}</p><p>{d.email} · {d.phone}</p><p style={{whiteSpace:'pre-wrap'}}>{d.address}</p><a className="shop-link" href={'/admin/renewals/proof?id='+row.id}>Download payment proof / Muat turun bukti bayaran</a></details>
 <form action={review}><input type="hidden" name="id" value={row.id}/><p>Approval activates only the selected renewal year, ending 31 December. / Kelulusan mengaktifkan tahun pembaharuan dipilih sahaja, sehingga 31 Disember.</p><label>Review status / Status semakan<select name="status" defaultValue={row.review_status}><option value="pending">Pending / Menunggu</option><option value="approved">Approved / Diluluskan</option><option value="rejected">Rejected / Ditolak</option></select></label><button>Save review / Simpan semakan</button></form>
 {canRetry&&<form action={retry}><input type="hidden" name="id" value={row.id}/>{uncertain&&<label className="shop-consent"><input type="checkbox" name="checked" value="yes" required/>I checked the club inbox and Sent folder for this reference and understand retrying may send a duplicate. / Saya telah menyemak peti masuk dan folder Dihantar untuk rujukan ini dan memahami penghantaran semula mungkin menghasilkan salinan.</label>}<button>Retry email / Cuba e-mel semula</button></form>}</article>;})}
 <nav className="shop-actions">{page>1&&<a href={'?page='+(page-1)}>← Previous / Sebelumnya</a>}{rows.length>20&&<a href={'?page='+(page+1)}>Next / Seterusnya →</a>}</nav></main>;
}
