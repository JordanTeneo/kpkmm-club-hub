'use client';
import {useRef,useState,type ReactNode,type FormEvent} from 'react';
import {prepareECard} from '../../../lib/prepare-ecard';

export default function PreviewForm({children,bm,action}:{children:ReactNode;bm:boolean;action:(form:FormData)=>Promise<{id?:string;error?:string}>}){
 const locked=useRef(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const t=(en:string,ms:string)=>bm?ms:en;
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(locked.current)return;
  const form=new FormData(event.currentTarget);locked.current=true;setBusy(true);setMessage(t('Preparing your preview…','Menyediakan pratonton anda…'));
  try{
   const file=form.get('ecard');
   if(file instanceof File&&file.size)form.set('ecard',await prepareECard(file));
   const result=await action(form);
   if(result.error||!result.id)throw Error(result.error||'preview');
   window.location.assign('/admin/announcements?id='+encodeURIComponent(result.id)+'#announcement-preview');
   setMessage(t('Preview saved. No emails have been sent.','Pratonton disimpan. Tiada e-mel dihantar.'));
  }catch(error){
   const code=error instanceof Error?error.message:'';
   setMessage(code==='gif-size'?t('The animated GIF must be 700 KB or smaller. Please compress it and try again.','GIF animasi mesti 700 KB atau kurang. Sila mampatkannya dan cuba lagi.'):
    code==='size'?t('Choose a JPG or PNG no larger than 40 MB.','Pilih JPG atau PNG tidak melebihi 40 MB.'):
    code==='file'||code==='Invalid e-card'?t('Choose a valid JPG, PNG or animated GIF.','Pilih JPG, PNG atau GIF animasi yang sah.'):
    code==='message'||code==='placeholder'?t('Check the subject and message. Only {name} and {year} placeholders are supported.','Semak subjek dan mesej. Hanya ruang letak {name} dan {year} disokong.'):
    code==='Unauthorised'?t('Your session has expired. Sign in again in another tab, then retry this preview.','Sesi anda tamat. Log masuk semula dalam tab lain, kemudian cuba pratonton ini lagi.'):
    t('Unable to prepare the preview. Your entries are kept below. Check Recent announcements before retrying, or try a smaller image.','Tidak dapat menyediakan pratonton. Isian anda dikekalkan di bawah. Semak Pengumuman terkini sebelum mencuba lagi, atau cuba imej lebih kecil.'));
  }finally{locked.current=false;setBusy(false);}
 }
 return <form onSubmit={submit} aria-busy={busy}><p role="status" aria-live="polite">{message}</p><fieldset disabled={busy} style={{border:0,padding:0,margin:0,minWidth:0}}>{children}</fieldset></form>;
}
