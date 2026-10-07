import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {isAdmin} from '../../../../lib/shop';
import {updateHistory2025} from '../../../../lib/history-2025';
import {getLanguage} from '../../../language';
import '../../../shop/shop.css';
export const dynamic='force-dynamic';
export const maxDuration=60;
export const metadata={title:'2025 membership history | KPKMM',robots:{index:false,follow:false}};
async function save(form:FormData){
 'use server';if(!(await isAdmin('membership')))redirect('/admin');let result='error';
 try{const file=form.get('plan');if(!(file instanceof File)||!file.size||file.size>100000)throw Error('Invalid file');const apply=form.get('mode')==='apply';const r=await updateHistory2025(JSON.parse(await file.text()),apply);result=(r.repeated?'repeated':apply?'saved':'preview')+'&changed='+r.changed;}catch{}
 revalidatePath('/admin/members/roster');revalidatePath('/admin/members/import');
 redirect('/admin/members/history-2025?result='+result);
}
export default async function Page({searchParams}:{searchParams:Promise<{result?:string;changed?:string}>}){
 if(!(await isAdmin('membership')))redirect('/admin');const lang=await getLanguage(),t=(en:string,bm:string)=>lang==='ms'?bm:en,q=await searchParams;
 return <main className="shop" style={{maxWidth:850}}><a href="/admin/members/roster">{t('Member listing','Senarai ahli')}</a><h1>{t('2025 membership history','Sejarah keahlian 2025')}</h1><p>{t('Update 2025 status only from the October 2025 spreadsheet. Membership numbers, personal details and every 2026 record remain unchanged. No emails are sent.','Kemas kini status 2025 sahaja daripada hamparan Oktober 2025. Nombor ahli, maklumat peribadi dan semua rekod 2026 dikekalkan. Tiada e-mel dihantar.')}</p>
 {q.result&&<section role="status" className="shop-card"><h2>{t(q.result==='saved'?'2025 statuses updated':q.result==='preview'?'Preview - no changes saved':q.result==='repeated'?'Already updated':'Update failed - no changes saved',q.result==='saved'?'Status 2025 dikemas kini':q.result==='preview'?'Pratonton - tiada perubahan disimpan':q.result==='repeated'?'Sudah dikemas kini':'Kemas kini gagal - tiada perubahan disimpan')}</h2>{['saved','preview'].includes(q.result)&&<><p>{t('242 valid records: 100 active (88 paid + 12 new), 142 inactive.','242 rekod sah: 100 aktif (88 berbayar + 12 baharu), 142 tidak aktif.')}</p><p>{Number(q.changed)||0} {t('status changes. 2026 records unchanged.','perubahan status. Rekod 2026 tidak berubah.')}</p><p>{t('One invalid membership number remains excluded pending confirmation.','Satu nombor ahli tidak sah masih dikecualikan sementara menunggu pengesahan.')}</p></>}</section>}
 <form action={save} className="shop-card"><label>{t('Private 2025 status plan','Pelan status 2025 sulit')}<input type="file" name="plan" accept=".json,application/json" required/></label><div className="shop-actions"><button name="mode" value="preview">{t('Preview 2025 update','Pratonton kemas kini 2025')}</button><button name="mode" value="apply">{t('Apply 2025 statuses only','Gunakan status 2025 sahaja')}</button></div></form><a href="/admin/members/roster?year=2025">{t('View 2025 members','Lihat ahli 2025')}</a></main>;
}
