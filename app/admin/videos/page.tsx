import {randomUUID} from 'node:crypto';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {db,isAdmin,uuid} from '../../../lib/shop';
import {videosReady,youtubeId,type ClubVideo} from '../../../lib/videos';
import {getClubData} from '../../../lib/club-data';
import {getLanguage} from '../../language';
import {ShopForm} from '../../shop/forms';
import type {Result} from '../../shop/actions';
import '../../shop/shop.css';
export const dynamic='force-dynamic';
export const metadata={title:'Manage videos | KPKMM',robots:{index:false,follow:false}};
async function save(_:Result,form:FormData):Promise<Result>{
  'use server';
  if(!(await isAdmin()))return {error:'Please sign in as admin. / Sila log masuk sebagai pentadbir.'};
  const id=String(form.get('id')||randomUUID()),op=String(form.get('operation')||'save');
  if(!uuid(id)||!['save','delete','restore'].includes(op))return {error:'Invalid request. / Permintaan tidak sah.'};
  try{
    await videosReady();
    if(op==='save'){
      const video=youtubeId(String(form.get('url')||'')),title=String(form.get('title')||'').trim().slice(0,200),description=String(form.get('description')||'').trim().slice(0,2000),event=String(form.get('event_id')||'');
      if(!video||!title)return {error:'Enter a valid YouTube link and title. / Masukkan pautan YouTube yang sah dan tajuk.'};
      if(event&&!(await getClubData(true)).events.some(e=>e.id===event))return {error:'The outing no longer exists. / Aktiviti tidak lagi tersedia.'};
      const existing=await db()`SELECT id FROM club_videos WHERE id=${id}`;
      if(existing.length){
        const changed=await db()`UPDATE club_videos SET youtube_id=${video},title=${title},description=${description},event_id=${event},updated_at=now() WHERE id=${id} AND deleted=false AND updated_at=${String(form.get('version'))}::timestamptz RETURNING id`;
        if(!changed.length)return {error:'Video changed. Refresh and try again. / Video berubah. Muat semula dan cuba lagi.'};
      }else await db()`INSERT INTO club_videos(id,youtube_id,title,description,event_id) VALUES(${id},${video},${title},${description},${event})`;
    }else {
      const changed=await db()`UPDATE club_videos SET deleted=${op==='delete'},updated_at=now() WHERE id=${id} AND updated_at=${String(form.get('version'))}::timestamptz RETURNING id`;
      if(!changed.length)return {error:'Video changed. Refresh and try again. / Video berubah. Muat semula dan cuba lagi.'};
    }
    revalidatePath('/videos');revalidatePath('/admin/videos');return {success:'Saved. / Disimpan.'};
  }catch{return {error:'Could not save. Please retry. / Tidak dapat disimpan. Sila cuba lagi.'};}
}
export default async function ManageVideos(){
  if(!(await isAdmin()))redirect('/admin');
  await videosReady();const videos=await db()<ClubVideo[]>`SELECT * FROM club_videos ORDER BY updated_at DESC`;const {events}=await getClubData();
  const bm=(await getLanguage())==='ms';const t=(en:string,ms:string)=>bm?ms:en;
  function fields(v?:ClubVideo){return <><input type="hidden" name="id" value={v?.id||randomUUID()}/><input type="hidden" name="version" value={v?.updated_at.toISOString()||''}/><label>{t('YouTube link','Pautan YouTube')}<input name="url" type="url" required defaultValue={v?'https://www.youtube.com/watch?v='+v.youtube_id:''}/></label><label>{t('Title','Tajuk')}<input name="title" required maxLength={200} defaultValue={v?.title}/></label><label>{t('Description','Penerangan')}<textarea name="description" maxLength={2000} defaultValue={v?.description}/></label><label>{t('Linked outing','Aktiviti berkaitan')}<select name="event_id" defaultValue={v?.event_id||''}><option value="">{t('No linked outing','Tiada aktiviti berkaitan')}</option>{events.map(e=><option key={e.id} value={e.id}>{e.title}</option>)}</select></label></>;}
  return <main className="shop"><a href="/admin">← {t('Club admin','Pentadbir kelab')}</a><h1>{t('Manage videos','Urus video')}</h1><p><a href="/videos">{t('View videos →','Lihat video →')}</a></p><section className="shop-card"><h2>{t('Add YouTube video','Tambah video YouTube')}</h2><ShopForm action={save} label={t('Publish video','Terbitkan video')}>{fields()}</ShopForm></section>{videos.filter(v=>!v.deleted).map(v=><section className="shop-card" key={v.id}><h2>{v.title}</h2><ShopForm key={v.updated_at.toISOString()} action={save} label={t('Save changes','Simpan perubahan')}>{fields(v)}</ShopForm><ShopForm action={save} label={t('Delete video','Padam video')} confirm={t('Remove this video from the website? It can be restored below.','Padam video daripada laman web? Video boleh dipulihkan di bawah.')}><input name="id" type="hidden" value={v.id}/><input name="version" type="hidden" value={v.updated_at.toISOString()}/><input name="operation" type="hidden" value="delete"/></ShopForm></section>)}<details className="shop-card"><summary>{t('Deleted videos','Video dipadam')}</summary>{videos.filter(v=>v.deleted).map(v=><div key={v.id}><h3>{v.title}</h3><ShopForm action={save} label={t('Restore video','Pulihkan video')}><input name="id" type="hidden" value={v.id}/><input name="version" type="hidden" value={v.updated_at.toISOString()}/><input name="operation" type="hidden" value="restore"/></ShopForm></div>)}</details></main>;
}
