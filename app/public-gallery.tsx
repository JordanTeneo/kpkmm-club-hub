'use client';
import {useRef,useState} from 'react';
import {PhotoPreview} from './photo-preview';
import type {AlbumCover} from '../lib/album-covers';
type Photo={id:string;url:string;caption:string};
export function PublicGallery({albums,lang}:{albums:AlbumCover[];lang:'en'|'ms'}){
 const t=(en:string,ms:string)=>lang==='ms'?ms:en;
 const dialog=useRef<HTMLDialogElement>(null),request=useRef(0),cache=useRef(new Map<string,Photo[]>());
 const [album,setAlbum]=useState<AlbumCover|null>(null),[photos,setPhotos]=useState<Photo[]>([]),[index,setIndex]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(false);
 async function open(item:AlbumCover){
  const serial=++request.current;setAlbum(item);setIndex(0);setError(false);dialog.current?.showModal();
  if(item.count===1){setPhotos([item.cover]);setBusy(false);return;}
  const saved=cache.current.get(item.id);if(saved){setPhotos(saved);setBusy(false);return;}
  setPhotos([item.cover]);setBusy(true);
  try{const res=await fetch('/api/albums?id='+encodeURIComponent(item.id));if(!res.ok)throw Error('load');const data=await res.json();if(!Array.isArray(data.photos)||!data.photos.length)throw Error('load');if(serial!==request.current)return;cache.current.set(item.id,data.photos);setPhotos(data.photos);}
  catch{if(serial===request.current)setError(true);}finally{if(serial===request.current)setBusy(false);}
 }
 function close(){request.current++;dialog.current?.close();setAlbum(null);setPhotos([]);}
 const photo=photos[index];
 return <><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,260px),1fr))',gap:24}}>{albums.map(item=><button key={item.id} onClick={()=>open(item)} style={{padding:0,textAlign:'left',color:'inherit',background:'#f5e7ca',border:'1px solid #c9b690',borderRadius:16,overflow:'hidden'}} aria-label={t('Open ','Buka ')+item.cover.caption}>
 <PhotoPreview src={item.cover.url} alt={item.cover.caption} width={720} height={480} sizes="(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 33vw" style={{width:'100%',height:260,objectFit:'cover'}}/>
 <span style={{display:'grid',gap:6,padding:18}}><strong>{item.cover.caption}</strong><span>{item.count} {t('photos','foto')} · {t('View moment','Lihat kenangan')} →</span><small>{item.eventTitle}</small></span></button>)}</div>
 <dialog ref={dialog} aria-label={t('Shared moment photos','Foto kenangan bersama')} onClose={()=>{request.current++;setAlbum(null);setPhotos([]);}} onClick={e=>{if(e.target===dialog.current)close();}} onKeyDown={e=>{if(e.key==='ArrowRight')setIndex(i=>Math.min(photos.length-1,i+1));if(e.key==='ArrowLeft')setIndex(i=>Math.max(0,i-1));}} style={{width:'min(960px,94vw)',maxHeight:'92vh',padding:20,border:0,borderRadius:16,background:'#fbf1d9',color:'#30291f'}}>
 <button autoFocus onClick={close} style={{float:'right'}}>{t('Close','Tutup')} ✕</button><h3>{album?.cover.caption}</h3>
 {busy&&<p role="status">{t('Loading photos…','Memuatkan foto…')}</p>}
 {error&&<div role="alert"><p>{t('Could not load this album. Please try again.','Album tidak dapat dimuatkan. Sila cuba lagi.')}</p><button onClick={()=>album&&open(album)}>{t('Try again','Cuba lagi')}</button></div>}
 {photo&&<PhotoPreview src={photo.url} alt={photo.caption} width={1600} height={1100} sizes="(max-width: 960px) 94vw, 960px" style={{width:'100%',height:'min(60vh,620px)',objectFit:'contain'}}/>}
 <div style={{display:'flex',justifyContent:'space-between',gap:12,padding:12}}><button disabled={index<=0||busy} onClick={()=>setIndex(i=>i-1)}>← {t('Previous','Sebelumnya')}</button><span aria-live="polite">{index+1} / {busy?album?.count:photos.length}</span><button disabled={index>=photos.length-1||busy} onClick={()=>setIndex(i=>i+1)}>{t('Next','Seterusnya')} →</button></div>
 <div style={{display:'flex',gap:8,overflowX:'auto'}}>{photos.map((p,i)=><button key={p.id} aria-label={t('View photo ','Lihat foto ')+(i+1)} aria-pressed={index===i} onClick={()=>setIndex(i)} style={{flexShrink:0,padding:3,border:index===i?'3px solid #a64320':'3px solid transparent'}}><PhotoPreview src={p.url} alt="" width={80} height={60} sizes="80px" style={{objectFit:'cover'}}/></button>)}</div></dialog></>;
}
