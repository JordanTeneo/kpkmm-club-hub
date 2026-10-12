import {historicalRegister,historicalSheet} from '../../../../lib/historical-membership';
import {isAdmin} from '../../../../lib/shop';
import {paymentRegister,paymentTotals,paymentYear,invoiceNumber} from '../../../../lib/membership-payments';
import {memberYearWorkbook} from '../../../../lib/member-excel';
export const dynamic='force-dynamic';
const privateHeaders={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'};
export async function GET(request:Request){
 if(!await isAdmin('membership'))return new Response('Not authorised',{status:403,headers:privateHeaders});
 const q=new URL(request.url).searchParams,year=paymentYear(q.get('year')),basis=q.get('basis')==='payment'?'payment':'membership',bm=q.get('lang')==='ms',t=(en:string,ms:string)=>bm?ms:en;
 const rows=await paymentRegister(year,basis),totals=paymentTotals(rows),history=await historicalRegister(year,basis);
 const summary=[
  [t('Membership year','Tahun keahlian'),t('Payment count','Bilangan bayaran'),t('Annual fees - new (RM)','Yuran tahunan - baharu (RM)'),t('Administrative fees (RM)','Yuran pentadbiran (RM)'),t('Renewals (RM)','Pembaharuan (RM)'),t('Verified total (RM)','Jumlah disahkan (RM)')],
  ...totals.map(g=>[String(g.year),String(g.count),(g.newFees/100),(g.adminFees/100),(g.renewalFees/100),(g.total/100)]),
  [t('Total','Jumlah'),String(totals.reduce((s,g)=>s+g.count,0)),(totals.reduce((s,g)=>s+g.newFees,0)/100),(totals.reduce((s,g)=>s+g.adminFees,0)/100),(totals.reduce((s,g)=>s+g.renewalFees,0)/100),(totals.reduce((s,g)=>s+g.total,0)/100)]
 ];
 const detail=[
  [t('Invoice','Invois'),t('Member number','Nombor ahli'),t('Name','Nama'),t('Bank payment date','Tarikh bayaran bank'),t('Membership year','Tahun keahlian'),t('Type','Jenis'),t('Annual fee (RM)','Yuran tahunan (RM)'),t('Admin fee (RM)','Yuran pentadbiran (RM)'),t('Total (RM)','Jumlah (RM)'),t('Approved at (Malaysia)','Diluluskan (Malaysia)'),t('Approved by','Diluluskan oleh'),t('Status','Status'),t('Source reference','Rujukan sumber'),t('Original total (RM)','Jumlah asal (RM)'),t('Discount (RM)','Diskaun (RM)'),t('Submitted through','Dihantar melalui')],
  ...rows.map(r=>[invoiceNumber(r),r.detail.memberNumber,r.detail.name,r.paid_on,String(r.membership_year),r.kind==='new'?t('New','Baharu'):t('Renewal','Pembaharuan'),((r.amount-r.admin_fee)/100),(r.admin_fee/100),(r.amount/100),new Date(r.approved_at).toLocaleString(bm?'ms-MY':'en-MY',{timeZone:'Asia/Kuala_Lumpur'}),r.detail.actor,r.voided_at?t('Approval reversed - excluded','Kelulusan dibatalkan - tidak termasuk'):t('Verified','Disahkan'),r.source_id,((r.detail.quote? r.detail.quote.annual+r.detail.quote.administration:r.amount)/100),((r.detail.quote?.discount||0)/100),r.detail.channel==='admin'?t('Admin manual entry','Kemasukan manual pentadbir'):r.detail.channel==='online'?t('Member online submission','Penghantaran ahli dalam talian'):t('Not recorded','Tidak direkodkan')])
 ];
 const notes=[[t('Report scope','Skop laporan'),t('Description','Penerangan')],[basis==='payment'?t('Payment year','Tahun bayaran'):t('Membership year','Tahun keahlian'),String(year)],[t('Coverage','Liputan'),t('Dated records plus a separate owner-approved historical supplement for 2026: imported Paid RM150; New RM250. Historical dates unknown; not monthly cash receipts.','Rekod bertarikh serta tambahan sejarah 2026 diluluskan pemilik: Paid RM150; New RM250. Tarikh sejarah tidak diketahui; bukan kutipan bulanan.')],[t('Totals','Jumlah'),t('Grouped by membership year; excludes reversed approvals. Reversal is not a bank refund.','Mengikut tahun keahlian; tidak termasuk kelulusan dibatalkan. Pembatalan bukan bayaran balik bank.')]];
 const combined={name:t('Combined totals','Jumlah gabungan'),rows:[[t('Category','Kategori'),t('Dated RM','Bertarikh RM'),t('Historical RM','Sejarah RM'),t('Combined RM','Gabungan RM')],...(['new','renewal'] as const).map(kind=>{const dated=rows.filter(r=>!r.voided_at&&r.kind===kind).reduce((s,r)=>s+r.amount,0),historical=history.filter(r=>r.kind===kind).reduce((s,r)=>s+r.amount,0);return [kind==='new'?t('New memberships','Keahlian baharu'):t('Renewals','Pembaharuan'),dated/100,historical/100,(dated+historical)/100];})]};
 const file=memberYearWorkbook([{name:t('Summary','Ringkasan'),rows:summary},{name:t('Payments','Bayaran'),rows:detail},{name:t('Notes','Nota'),rows:notes},combined,historicalSheet(history,bm)]);
 return new Response(new Uint8Array(file),{headers:{...privateHeaders,'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="KPKMM-payments-${basis}-${year}.xlsx"`}});
}
