import {redirect} from 'next/navigation';
import {db,isAdmin,money} from '../../../lib/shop';
import {invoiceNumber,paymentRegister,paymentTotals,paymentYear} from '../../../lib/membership-payments';
import {enrolmentReady} from '../../../lib/enrolment';
import {getLanguage} from '../../language';
import '../../shop/shop.css';
export const dynamic='force-dynamic';
export const metadata={title:'Membership payments | KPKMM',robots:{index:false,follow:false}};
export default async function Payments({searchParams}:{searchParams:Promise<{year?:string;membershipYear?:string;page?:string}>}){
 if(!await isAdmin('membership'))redirect('/admin');
 const bm=(await getLanguage())==='ms',t=(en:string,ms:string)=>bm?ms:en;
 const q=await searchParams,year=paymentYear(q.year),page=Math.max(1,Math.min(10000,Math.floor(Number(q.page)||1)));
 let rows,pending;
 try{
  rows=await paymentRegister(year);await enrolmentReady();
  pending=(await db()`SELECT (SELECT count(*) FROM club_renewals WHERE review_status='pending') AS renewals,(SELECT count(*) FROM club_enrolments WHERE stage='proof_submitted') AS applications`)[0];
 }catch{return <main className="shop"><h1>{t('Membership payments','Bayaran keahlian')}</h1><p role="alert">{t('Payment records could not be loaded. Please try again. No records have been changed.','Rekod bayaran tidak dapat dimuatkan. Sila cuba lagi. Tiada rekod diubah.')}</p></main>;}
 const groups=paymentTotals(rows),filtered=q.membershipYear?rows.filter(r=>r.membership_year===Number(q.membershipYear)):rows;
 const shown=filtered.slice((page-1)*50,page*50),base=`?year=${year}${q.membershipYear?'&membershipYear='+encodeURIComponent(q.membershipYear):''}`;
 return <main className="shop"><h1>{t('Membership payments','Bayaran keahlian')}</h1>
  <p>{t('Payments recorded from this feature onward. Historical payments are not included. Totals use the bank payment date, not the approval date.','Bayaran direkodkan mulai penggunaan fungsi ini. Bayaran sejarah tidak termasuk. Jumlah mengikut tarikh bayaran bank, bukan tarikh kelulusan.')}</p>
  <form method="get" className="shop-actions"><label>{t('Payment year','Tahun bayaran')}<input type="number" name="year" min="2000" max="2200" defaultValue={year} required/></label><button>{t('View year','Lihat tahun')}</button></form>
  <section className="shop-note"><h2>{year}: {money(groups.reduce((sum,g)=>sum+g.total,0))}</h2><p>{t('Verified payments only. Reversed approvals are excluded; they do not represent a bank refund.','Bayaran disahkan sahaja. Kelulusan dibatalkan tidak termasuk; ini bukan bayaran balik bank.')}</p></section>
  <h2>{t('By membership year','Mengikut tahun keahlian')}</h2>
  {!groups.length&&<p>{t('No verified payments recorded for this payment year.','Tiada bayaran disahkan direkodkan bagi tahun bayaran ini.')}</p>}
  {groups.map(g=><section className="shop-card" key={g.year}><h3>{g.year} {g.year>year?t('(Advance payments)','(Bayaran awal)'):g.year<year?t('(Earlier membership year)','(Tahun keahlian terdahulu)'):''}</h3><p>{g.count} {t('payments','bayaran')} · <strong>{money(g.total)}</strong></p><p>{t('New-member annual fees','Yuran tahunan ahli baharu')}: {money(g.newFees)} · {t('One-time admin fees','Yuran pentadbiran sekali sahaja')}: {money(g.adminFees)} · {t('Renewals','Pembaharuan')}: {money(g.renewalFees)}</p><a href={`?year=${year}&membershipYear=${g.year}`}>{t('View these payments','Lihat bayaran ini')}</a></section>)}
  <p><a className="shop-link" href={`/admin/payments/export?year=${year}&lang=${bm?'ms':'en'}`}>{t('Download annual Excel report','Muat turun laporan Excel tahunan')}</a></p>
  <section className="shop-note"><h2>{t('Awaiting verification — all years','Menunggu pengesahan — semua tahun')}</h2><p>{t('Excluded from the verified totals above. Payment year is confirmed by admin when approving.','Tidak termasuk dalam jumlah disahkan di atas. Tahun bayaran disahkan pentadbir semasa kelulusan.')}</p><div className="shop-actions"><a href="/admin/renewals">{pending.renewals} {t('renewals','pembaharuan')}</a><a href="/admin/members?status=approved&stage=proof_submitted">{pending.applications} {t('new-member payments','bayaran ahli baharu')}</a></div></section>
  <h2>{t('Payment records','Rekod bayaran')}</h2>{q.membershipYear&&<p><a href={`?year=${year}`}>{t('Show all membership years','Paparkan semua tahun keahlian')}</a></p>}
  <p>{filtered.length} {t('records (including reversed approvals)','rekod (termasuk kelulusan dibatalkan)')}</p>
  {shown.map(r=><details className="shop-card" key={r.id}><summary><strong>{r.detail.memberNumber} · {r.detail.name}</strong> — {money(r.amount)} · {r.membership_year}{r.voided_at?' · '+t('Approval reversed','Kelulusan dibatalkan'):''}</summary><p>{t('Invoice','Invois')}: {invoiceNumber(r)}</p><p>{t('Bank payment date','Tarikh bayaran bank')}: {r.paid_on} · {t('Membership year','Tahun keahlian')}: {r.membership_year}</p><p>{t('Type','Jenis')}: {r.kind==='new'?t('New membership','Keahlian baharu'):t('Renewal','Pembaharuan')}</p><p>{t('Approved','Diluluskan')}: {new Date(r.approved_at).toLocaleString(bm?'ms-MY':'en-MY',{timeZone:'Asia/Kuala_Lumpur'})} · {r.detail.actor}</p><div className="shop-actions"><a href={`/admin/payments/${r.id}?file=invoice&lang=${bm?'ms':'en'}`}>{t('Download invoice','Muat turun invois')}</a><a href={`/admin/payments/${r.id}?file=receipt`}>{t('Uploaded receipt','Resit dimuat naik')}</a><a href={r.kind==='new'?`/admin/members/${r.source_id}`:'/admin/renewals?status=approved'}>{t('Application / renewal','Permohonan / pembaharuan')}</a></div></details>)}
  <nav className="shop-actions" aria-label={t('Payment pages','Halaman bayaran')}>{page>1&&<a href={`${base}&page=${page-1}`}>{t('Previous','Sebelumnya')}</a>}{page*50<filtered.length&&<a href={`${base}&page=${page+1}`}>{t('Next','Seterusnya')}</a>}</nav>
 </main>;
}
