import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {isAdmin} from '../../../../lib/shop';
import {restore2026Statuses} from '../../../../lib/roster-year-correction';
import {getLanguage} from '../../../language';
import '../../../shop/shop.css';
export const dynamic='force-dynamic';
export const maxDuration=60;
export const metadata={title:'Restore 2026 status | KPKMM',robots:{index:false,follow:false}};
async function save(form:FormData){
 'use server';
 if(!(await isAdmin('membership')))redirect('/admin');
 let query='error';
 try{const apply=form.get('mode')==='apply';const r=await restore2026Statuses(apply);query=(r.repeated?'repeated':apply?'saved':'preview')+'&restored='+r.restored+'&skipped='+r.skipped;}catch{}
 revalidatePath('/admin/members/roster');revalidatePath('/admin/members/import');revalidatePath('/membership-status');
 redirect('/admin/members/correct-year?result='+query);
}
export default async function Page({searchParams}:{searchParams:Promise<{result?:string;restored?:string;skipped?:string}>}){
 if(!(await isAdmin('membership')))redirect('/admin');
 const language=await getLanguage(),t=(en:string,bm:string)=>language==='ms'?bm:en,q=await searchParams;
 return <main className="shop" style={{maxWidth:850}}><a href="/admin/members/roster">{t('Back to member listing','Kembali ke senarai ahli')}</a><h1>{t('Restore 2026 membership status','Pulihkan status keahlian 2026')}</h1>
 <p>{t('Restore only the active statuses removed by the previous year correction, using the saved audit records. Keep 2025 history, membership numbers, personal details and payment records unchanged. No emails are sent.','Pulihkan hanya status aktif yang dibuang oleh pembetulan tahun sebelumnya, menggunakan rekod audit. Sejarah 2025, nombor ahli, maklumat peribadi dan rekod bayaran dikekalkan. Tiada e-mel dihantar.')}</p>
 <p>{t('The previous correction action has been disabled.','Tindakan pembetulan sebelumnya telah dinyahdayakan.')}</p>
 {q.result&&<section className="shop-card" role="status"><h2>{t(q.result==='saved'?'2026 statuses restored':q.result==='preview'?'Preview - no changes saved':q.result==='repeated'?'Restoration already completed':'Restoration failed - no changes saved',q.result==='saved'?'Status 2026 dipulihkan':q.result==='preview'?'Pratonton - tiada perubahan disimpan':q.result==='repeated'?'Pemulihan telah selesai':'Pemulihan gagal - tiada perubahan disimpan')}</h2>{['saved','preview'].includes(q.result)&&<p>{Number(q.restored)||0} {t('members restored to active for 2026.','ahli dipulihkan kepada aktif untuk 2026.')} {Number(q.skipped)||0} {t('already active or subsequently changed; left unchanged.','sudah aktif atau diubah selepas pembetulan; dikekalkan.')}</p>}</section>}
 <form action={save} className="shop-actions"><button name="mode" value="preview">{t('Preview restoration','Pratonton pemulihan')}</button><button name="mode" value="apply">{t('Restore 2026 active members','Pulihkan ahli aktif 2026')}</button></form><p><a href="/admin/members/roster?year=2025">{t('View 2025 members','Lihat ahli 2025')}</a> · <a href="/admin/members/roster?year=2026">{t('View 2026 members','Lihat ahli 2026')}</a></p></main>;
}
