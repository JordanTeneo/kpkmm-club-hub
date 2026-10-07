import {isAdmin} from '../../lib/shop';
import {memberDashboard} from '../../lib/member-dashboard';

export async function ApprovalDashboard({bm}:{bm:boolean}) {
  if (!(await isAdmin('membership'))) return null;
  const t=(en:string,ms:string)=>bm?ms:en;
  let queues;
  try { queues=await memberDashboard(); } catch {
    return <section className="admin-group"><h2>{t('Approval dashboard','Papan pemuka kelulusan')}</h2><p role="status">{t('Approval counts are temporarily unavailable. Please refresh to try again.','Jumlah kelulusan tidak tersedia buat sementara waktu. Sila muat semula untuk mencuba lagi.')}</p></section>;
  }
  const items=[
    {count:queues.renewals,label:t('Pending renewals','Pembaharuan menunggu'),href:'/admin/renewals?status=pending'},
    {count:queues.applications,label:t('Applications to review','Permohonan untuk semakan'),href:'/admin/members?status=pending'},
    {count:queues.awaitingPayment,label:t('Awaiting payment','Menunggu bayaran'),href:'/admin/members?status=approved&stage=awaiting_payment'},
    {count:queues.awaitingApproval,label:t('Payments to approve','Bayaran untuk kelulusan'),href:'/admin/members?status=approved&stage=proof_submitted'},
  ];
  return <section className="admin-group" aria-labelledby="approval-dashboard-title">
    <h2 id="approval-dashboard-title">{t('Approval dashboard','Papan pemuka kelulusan')}</h2>
    <p>{t('Pending work across all membership years.','Tugasan menunggu bagi semua tahun keahlian.')}</p>
    <div className="admin-card-grid">{items.map(item=><a className="admin-link-card" href={item.href} key={item.href}><strong>{item.count}<span aria-hidden="true">↗</span></strong><p>{item.label}</p></a>)}</div>
  </section>;
}
