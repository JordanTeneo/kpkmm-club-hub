import {isAdmin} from '../../../../lib/shop';
import {paymentRegister,paymentTotals,paymentYear,invoiceNumber} from '../../../../lib/membership-payments';
import {memberYearWorkbook} from '../../../../lib/member-excel';
export const dynamic='force-dynamic';
const privateHeaders={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'};
export async function GET(request:Request){
 if(!await isAdmin('membership'))return new Response('Not authorised',{status:403,headers:privateHeaders});
 const q=new URL(request.url).searchParams,year=paymentYear(q.get('year')),bm=q.get('lang')==='ms',t=(en:string,ms:string)=>bm?ms:en;
 const rows=await paymentRegister(year),totals=paymentTotals(rows);
 const summary=[
  [t('Membership year','Tahun keahlian'),t('Payment count','Bilangan bayaran'),t('Annual fees - new (RM)','Yuran tahunan - baharu (RM)'),t('Administrative fees (RM)','Yuran pentadbiran (RM)'),t('Renewals (RM)','Pembaharuan (RM)'),t('Verified total (RM)','Jumlah disahkan (RM)')],
  ...totals.map(g=>[String(g.year),String(g.count),(g.newFees/100),(g.adminFees/100),(g.renewalFees/100),(g.total/100)]),
  [t('Total','Jumlah'),String(totals.reduce((s,g)=>s+g.count,0)),(totals.reduce((s,g)=>s+g.newFees,0)/100),(totals.reduce((s,g)=>s+g.adminFees,0)/100),(totals.reduce((s,g)=>s+g.renewalFees,0)/100),(totals.reduce((s,g)=>s+g.total,0)/100)]
 ];
 const detail=[
  [t('Invoice','Invois'),t('Member number','Nombor ahli'),t('Name','Nama'),t('Bank payment date','Tarikh bayaran bank'),t('Membership year','Tahun keahlian'),t('Type','Jenis'),t('Annual fee (RM)','Yuran tahunan (RM)'),t('Admin fee (RM)','Yuran pentadbiran (RM)'),t('Total (RM)','Jumlah (RM)'),t('Approved at (Malaysia)','Diluluskan (Malaysia)'),t('Approved by','Diluluskan oleh'),t('Status','Status'),t('Source reference','Rujukan sumber')],
  ...rows.map(r=>[invoiceNumber(r),r.detail.memberNumber,r.detail.name,r.paid_on,String(r.membership_year),r.kind==='new'?t('New','Baharu'):t('Renewal','Pembaharuan'),((r.amount-r.admin_fee)/100),(r.admin_fee/100),(r.amount/100),new Date(r.approved_at).toLocaleString(bm?'ms-MY':'en-MY',{timeZone:'Asia/Kuala_Lumpur'}),r.detail.actor,r.voided_at?t('Approval reversed - excluded','Kelulusan dibatalkan - tidak termasuk'):t('Verified','Disahkan'),r.source_id])
 ];
 const notes=[[t('Report scope','Skop laporan'),t('Description','Penerangan')],[t('Payment year','Tahun bayaran'),String(year)],[t('Coverage','Liputan'),t('Recorded payments from feature launch only. No historical backfill.','Bayaran direkodkan mulai pelancaran fungsi sahaja. Tiada pengisian sejarah.')],[t('Totals','Jumlah'),t('Grouped by membership year; excludes reversed approvals. Reversal is not a bank refund.','Mengikut tahun keahlian; tidak termasuk kelulusan dibatalkan. Pembatalan bukan bayaran balik bank.')]];
 const file=memberYearWorkbook([{name:t('Summary','Ringkasan'),rows:summary},{name:t('Payments','Bayaran'),rows:detail},{name:t('Notes','Nota'),rows:notes}]);
 return new Response(new Uint8Array(file),{headers:{...privateHeaders,'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="KPKMM-payments-${year}.xlsx"`}});
}
