import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {isAdmin} from '../../../../lib/shop';
import {correctRosterYear} from '../../../../lib/roster-year-correction';
import {getLanguage} from '../../../language';
import '../../../shop/shop.css';
export const dynamic='force-dynamic';
export const maxDuration=60;
export const metadata={title:'Correct roster year | KPKMM',robots:{index:false,follow:false}};
async function save(form:FormData){
 'use server';
 if(!(await isAdmin()))redirect('/admin');
 let query='error';
 try{
  const file=form.get('plan');if(!(file instanceof File)||!file.size||file.size>100000)throw Error('Invalid file');
  const apply=form.get('mode')==='apply';if(apply&&form.get('confirmed')!=='yes')throw Error('Confirm year');
  const result=await correctRosterYear(JSON.parse(await file.text()),apply);
  query=(result.repeated?'repeated':apply?'saved':'preview')+'&cleared='+result.cleared2026+'&preserved='+result.preserved2026;
 }catch{/* Never expose private member records in errors. */}
 revalidatePath('/admin/members/roster');revalidatePath('/admin/members/import');revalidatePath('/membership-status');
 redirect('/admin/members/correct-year?result='+query);
}
export default async function Page({searchParams}:{searchParams:Promise<{result?:string;cleared?:string;preserved?:string}>}){
 if(!(await isAdmin()))redirect('/admin');
 const language=await getLanguage(),t=(en:string,bm:string)=>language==='ms'?bm:en,q=await searchParams;
 return <main className="shop" style={{maxWidth:850}}><a href="/admin/members/roster">{t('← Member listing','← Senarai ahli')}</a><h1>{t('Correct spreadsheet membership year','Betulkan tahun keahlian hamparan')}</h1>
 <p>{t('The committee confirmed that paid and new-member markers in the October spreadsheet refer to 2025. This correction retains membership numbers and personal details. No emails are sent.','Jawatankuasa mengesahkan bahawa tanda bayaran dan ahli baharu dalam hamparan Oktober merujuk kepada 2025. Nombor ahli dan maklumat peribadi dikekalkan. Tiada e-mel dihantar.')}</p>
 {q.result&&<section className="shop-card" role="status"><h2>{t(q.result==='saved'?'Correction saved':q.result==='preview'?'Preview only — no records changed':q.result==='repeated'?'Correction already applied':'Correction failed — no changes saved',q.result==='saved'?'Pembetulan disimpan':q.result==='preview'?'Pratonton sahaja — tiada rekod diubah':q.result==='repeated'?'Pembetulan telah digunakan':'Pembetulan gagal — tiada perubahan disimpan')}</h2>{['saved','preview'].includes(q.result)&&<><p>{t('2025: 242 members · 67 active · 175 inactive','2025: 242 ahli · 67 aktif · 175 tidak aktif')}</p><p>{Number(q.cleared)||0} {t('incorrect 2026 activations removed','pengaktifan 2026 yang salah dibuang')}. {Number(q.preserved)||0} {t('independent 2026 activations preserved','pengaktifan 2026 berasingan dikekalkan')}.</p><p>{t('Members active in 2025 qualify to renew in 2026. Others without a later approved payment require committee review or reinstatement.','Ahli aktif pada 2025 layak memperbaharui pada 2026. Ahli lain tanpa bayaran diluluskan selepas itu memerlukan semakan atau pengaktifan semula oleh jawatankuasa.')}</p></>}</section>}
 <form action={save} className="shop-card"><label>{t('Private correction plan','Pelan pembetulan sulit')}<input name="plan" type="file" accept=".json,application/json" required/></label><label className="shop-consent"><input name="confirmed" value="yes" type="checkbox"/>{t('Paid and new-member markers belong to 2025.','Tanda bayaran dan ahli baharu adalah untuk 2025.')}</label><div className="shop-actions"><button name="mode" value="preview">{t('Preview correction','Pratonton pembetulan')}</button><button name="mode" value="apply">{t('Apply year correction','Gunakan pembetulan tahun')}</button></div></form><p><a href="/admin/members/roster?year=2025">{t('View 2025 members','Lihat ahli 2025')}</a> · <a href="/admin/members/roster?year=2026">{t('View 2026 members','Lihat ahli 2026')}</a></p></main>;
}
