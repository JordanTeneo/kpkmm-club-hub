import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {historyOwner,memberPaymentHistory,correctPaymentHistory} from '../../../../lib/payment-history-admin';
import {getLanguage} from '../../../language';
import '../../../shop/shop.css';
export const dynamic='force-dynamic';
export const metadata={title:'Payment history | KPKMM',robots:{index:false,follow:false}};
async function save(form:FormData){
 'use server';
 let result='saved';try{await correctPaymentHistory(form);}catch(e){result=e instanceof Error&&['stale','missing-year','lifetime','invalid'].includes(e.message)?e.message:'error';}
 for(const path of ['/admin/members/roster','/membership-status','/renew','/admin/members/payment-history'])revalidatePath(path);
 redirect('/admin/members/payment-history?member='+encodeURIComponent(String(form.get('member')||''))+'&result='+result);
}
export default async function Page({searchParams}:{searchParams:Promise<{member?:string;result?:string}>}){
 if(!await historyOwner())redirect('/admin');
 const bm=await getLanguage()==='ms',t=(en:string,ms:string)=>bm?ms:en,q=await searchParams,member=(q.member||'').trim().toUpperCase();
 let record;try{if(member)record=await memberPaymentHistory(member);}catch{}
 const current=Number(new Intl.DateTimeFormat('en',{timeZone:'Asia/Kuala_Lumpur',year:'numeric'}).format(new Date()));
 return <main className="shop" style={{maxWidth:850}}><h1>{t('Correct payment history','Betulkan sejarah bayaran')}</h1><p>{t('Super Admin only. Correct previous-year records with a reason. Other annual statuses and payment proofs remain unchanged. No emails are sent. Use Renew for current or future payments.','Super Admin sahaja. Betulkan rekod tahun terdahulu dengan sebab. Status tahun lain dan bukti bayaran dikekalkan. Tiada e-mel dihantar. Gunakan Pembaharuan untuk bayaran tahun semasa atau akan datang.')}</p>
 <form method="get"><label>{t('Member number','Nombor ahli')}<input name="member" defaultValue={member} required placeholder="B-16-219"/></label><button>{t('Find member','Cari ahli')}</button></form>
 {q.result&&<p role="status">{q.result==='saved'?t('History corrected successfully.','Sejarah berjaya dibetulkan.'):q.result==='stale'?t('The record changed. Review the refreshed history before retrying.','Rekod telah berubah. Semak sejarah terkini sebelum mencuba lagi.'):t('Correction not saved. Use an existing previous year, check the reason and confirmation. Lifetime records require separate review.','Pembetulan tidak disimpan. Gunakan tahun terdahulu yang wujud, semak sebab dan pengesahan. Rekod seumur hidup memerlukan semakan berasingan.')}</p>}
 {member&&!record&&<p>{t('Member record unavailable.','Rekod ahli tidak tersedia.')}</p>}
 {record&&<section className="shop-card"><h2>{member} — {record.name}</h2><ul>{record.history.map((h:{year:number;status:string;note:string})=><li key={h.year}><strong>{h.year}</strong> · {t(({paid:'Paid',new:'New',sponsored:'Sponsored',inactive:'Inactive',review:'Review',lifetime:'Lifetime'} as Record<string,string>)[h.status]||h.status,({paid:'Dibayar',new:'Baharu',sponsored:'Ditaja',inactive:'Tidak aktif',review:'Semakan',lifetime:'Seumur hidup'} as Record<string,string>)[h.status]||h.status)} — {h.note}</li>)}</ul>
 <form action={save}><input type="hidden" name="member" value={member}/><input type="hidden" name="revision" value={record.revision}/><label>{t('Year to correct','Tahun pembetulan')}<select name="year" required defaultValue=""><option value="" disabled>{t('Select a year','Pilih tahun')}</option>{record.years.filter((r:{year:number})=>r.year<current).map((r:{year:number})=><option key={r.year} value={r.year}>{r.year}</option>)}</select></label><label>{t('Correct payment status','Status bayaran yang betul')}<select name="status" required defaultValue=""><option value="" disabled>{t('Select status','Pilih status')}</option><option value="paid">{t('Paid','Dibayar')}</option><option value="new">{t('New member — paid','Ahli baharu — dibayar')}</option><option value="sponsored">{t('Sponsored — fee waived','Ditaja — yuran dikecualikan')}</option><option value="inactive">{t('Unpaid / inactive','Belum dibayar / tidak aktif')}</option></select></label><label>{t('Correction reason / evidence reference','Sebab pembetulan / rujukan bukti')}<textarea name="reason" minLength={10} maxLength={500} required/></label><label><input type="checkbox" name="confirmed" value="yes" required/>{t('I verified the evidence and confirm this historical correction.','Saya telah menyemak bukti dan mengesahkan pembetulan sejarah ini.')}</label><button>{t('Save history correction','Simpan pembetulan sejarah')}</button></form></section>}
 </main>;
}
