import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {isAdmin} from '../../../../lib/shop';
import {importMasterHistory} from '../../../../lib/master-history';
import {getLanguage} from '../../../language';
import '../../../shop/shop.css';
export const dynamic='force-dynamic';export const maxDuration=60;
export const metadata={title:'Master membership history | KPKMM',robots:{index:false,follow:false}};
async function save(form:FormData){
 'use server';if(!(await isAdmin('membership')))redirect('/admin');let query='error';
 try{const f=form.get('plan');if(!(f instanceof File)||!f.size||f.size>800000)throw Error('Invalid plan');const r=await importMasterHistory(JSON.parse(await f.text()),form.get('mode')==='apply');query=(r.repeated?'repeated':form.get('mode')==='apply'?'saved':'preview')+'&records='+r.records+'&lifetime='+r.lifetime+'&review='+r.review+'&vehicles='+r.vehicles+'&emails='+r.emailConflicts;}catch{}
 for(const p of ['/admin/members/roster','/admin/members/import','/membership-status'])revalidatePath(p);
 redirect('/admin/members/master-history?result='+query);
}
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 if(!(await isAdmin('membership')))redirect('/admin');const bm=(await getLanguage())==='ms',t=(en:string,ms:string)=>bm?ms:en,q=await searchParams;
 return <main className="shop" style={{maxWidth:900}}><a href="/admin/members/roster">{t('Member listing','Senarai ahli')}</a><h1>{t('Master membership history','Sejarah keahlian induk')}</h1><p>{t('Import 2013–2026 notes, vehicle numbers and missing emails. Sponsorship waives the fee for its year. Lifetime members remain active from their recorded lifetime year. Existing 2026 annual statuses and payment proofs are preserved. No emails are sent.','Import catatan 2013–2026, nombor kenderaan dan e-mel yang belum diisi. Tajaan mengecualikan yuran tahun tersebut. Ahli seumur hidup kekal aktif dari tahun direkodkan. Status tahunan 2026 dan bukti bayaran sedia ada dikekalkan. Tiada e-mel dihantar.')}</p>
 {q.result&&<section className="shop-card" role="status"><h2>{t(q.result==='saved'?'Master history saved':q.result==='preview'?'Preview — no changes saved':q.result==='repeated'?'Already imported':'Import failed — no changes saved',q.result==='saved'?'Sejarah induk disimpan':q.result==='preview'?'Pratonton — tiada perubahan disimpan':q.result==='repeated'?'Sudah diimport':'Import gagal — tiada perubahan disimpan')}</h2>{['preview','saved'].includes(q.result)&&<><p>{Number(q.records)||0} {t('annual records','rekod tahunan')} · {Number(q.vehicles)||0} {t('members with vehicles','ahli dengan kenderaan')} · {Number(q.lifetime)||0} {t('lifetime members','ahli seumur hidup')}</p><p>{Number(q.review)||0} {t('unclear historical notes retained for review','catatan sejarah tidak jelas dikekalkan untuk semakan')}. {Number(q.emails)||0} {t('email differences retained without replacing current emails','perbezaan e-mel dikekalkan tanpa menggantikan e-mel semasa')}.</p></>}</section>}
 <form action={save} className="shop-card"><label>{t('Private master plan','Pelan induk sulit')}<input name="plan" type="file" accept=".json,application/json" required/></label><div className="shop-actions"><button name="mode" value="preview">{t('Preview import','Pratonton import')}</button><button name="mode" value="apply">{t('Import master history','Import sejarah induk')}</button></div></form></main>;
}
