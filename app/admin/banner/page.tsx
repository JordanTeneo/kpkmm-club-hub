import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {db,isAdmin} from '../../../lib/shop';
import {bannerReady,defaultBanner,getBanner} from '../../../lib/banner';
import {savePhoto} from '../../../lib/club-data';
import {BannerEditor} from './editor';
import '../../shop/shop.css';
export const dynamic='force-dynamic';
export const metadata={title:'Homepage banner | KPKMM',robots:{index:false,follow:false}};
async function save(form:FormData):Promise<{error?:string}>{'use server';if(!(await isAdmin()))return {error:'Session expired. Please sign in again. / Sila log masuk semula.'};try{await bannerReady();let settings={...defaultBanner};if(form.get('reset')!=='1'){settings={...await getBanner(true),en:String(form.get('en')||'').trim().slice(0,100),ms:String(form.get('ms')||'').trim().slice(0,100),position:String(form.get('position')||'center')};if(!['top','center','bottom'].includes(settings.position))return {error:'Invalid photo focus.'};const file=form.get('photo');if(file instanceof File&&file.size){if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>750*1024)return {error:'Please use a compressed JPG, PNG or WebP under 750 KB.'};settings.url=(await savePhoto(file)).url;}}await db()`INSERT INTO club_banner(id,settings) VALUES(1,${JSON.stringify(settings)}::jsonb) ON CONFLICT(id) DO UPDATE SET settings=excluded.settings`;revalidatePath('/');revalidatePath('/admin/banner');return {};}catch{return {error:'Could not save the banner. Please try again. / Gagal menyimpan. Sila cuba lagi.'};}}
export default async function BannerAdmin(){if(!(await isAdmin()))redirect('/admin');let banner;try{banner=await getBanner(true);}catch{return <main className="shop"><a href="/admin">← Admin</a><p>Banner storage is temporarily unavailable. Please try again.</p></main>;}return <main className="shop"><a href="/admin">← Admin</a><h1>Homepage banner / Sepanduk utama</h1><p>Manage the group photo beside “Small cars. Big spirit.” / Urus foto utama kelab.</p><BannerEditor banner={banner} action={save}/></main>;}
