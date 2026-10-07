import {redirect} from 'next/navigation';
import {revalidatePath,updateTag} from 'next/cache';
import {isAdmin} from '../../../lib/shop';
import {listCelebrations,saveCelebration} from '../../../lib/celebrations';
import {getLanguage} from '../../language';
import {CelebrationEditor} from './editor';
import '../../shop/shop.css';
export const dynamic='force-dynamic';
export const metadata={title:'Celebrations | KPKMM',robots:{index:false,follow:false}};
async function save(form:FormData){'use server';try{await saveCelebration(form);updateTag('public-celebrations');revalidatePath('/');revalidatePath('/admin/celebrations');return true;}catch{return false;}}
export default async function Page(){if(!await isAdmin('content'))redirect('/admin');const bm=await getLanguage()==='ms',t=(en:string,ms:string)=>bm?ms:en;let items;try{items=await listCelebrations();}catch{return <main className="shop"><p>{t('Greetings unavailable. Please retry.','Ucapan tidak tersedia. Sila cuba lagi.')}</p></main>;}return <main className="shop" style={{maxWidth:900}}><h1>{t('Celebration greetings','Ucapan perayaan')}</h1><p>{t('Prepare Chinese New Year, Hari Raya, Deepavali or any celebration. Enabled cards appear above the homepage introduction during your selected dates, then hide automatically. Dates do not repeat each year.','Sediakan ucapan Tahun Baharu Cina, Hari Raya, Deepavali atau perayaan lain. Kad yang diaktifkan dipaparkan di atas pengenalan halaman utama pada tarikh pilihan, kemudian disembunyikan secara automatik. Tarikh tidak berulang setiap tahun.')}</p><details><summary>{t('Add greeting','Tambah ucapan')}</summary><CelebrationEditor bm={bm} action={save}/></details>{items.map(item=><details key={JSON.stringify(item)}><summary>{bm?item.ms:item.en} · {item.starts} — {item.ends} · {item.enabled?t('Enabled','Diaktifkan'):t('Hidden','Disembunyikan')}</summary><CelebrationEditor item={item} bm={bm} action={save}/></details>)}</main>;}
