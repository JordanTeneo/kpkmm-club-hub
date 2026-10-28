'use client';
import {useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {compressPoster} from '../../lib/compress-poster';

export function PosterUpload({id,language,action}:{id:string;language:'en'|'ms';action:(form:FormData)=>Promise<{error?:string}>}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),router=useRouter();
 const t=(en:string,ms:string)=>language==='ms'?ms:en;
 const errors:Record<string,string>={
  file:t('Choose a valid JPG, PNG or WebP poster.','Pilih poster JPG, PNG atau WebP yang sah.'),
  size:t('Choose a poster up to 40 MB.','Pilih poster sehingga 40 MB.'),
  session:t('Your session expired or you do not have content access. Sign in again or contact the administrator.','Sesi tamat atau anda tiada akses kandungan. Log masuk semula atau hubungi pentadbir.'),
  missing:t('This notice no longer exists. Refresh the page.','Notis ini tidak lagi wujud. Muat semula halaman.'),
  storage:t('The poster could not be saved. Refresh and check the notice before trying again.','Poster tidak dapat disimpan. Muat semula dan semak notis sebelum mencuba lagi.'),
  compress:t('Could not prepare this poster. Try a smaller JPG, PNG or WebP copy.','Poster tidak dapat disediakan. Cuba salinan JPG, PNG atau WebP yang lebih kecil.')
 };
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;
  const form=event.currentTarget,payload=new FormData(form),file=payload.get('poster');
  if(!(file instanceof File)||!file.size){setMessage(errors.file);return;}
  setBusy(true);setMessage(t('Preparing poster…','Menyediakan poster…'));
  try{
   let prepared:File;
   try{prepared=await compressPoster(file);}catch(error){setMessage(errors[error instanceof Error?error.message:'compress']||errors.compress);return;}
   payload.set('poster',prepared);setMessage(t('Uploading poster…','Memuat naik poster…'));
   const result=await action(payload);
   if(result.error){setMessage(errors[result.error]||errors.storage);return;}
   setMessage(t('Poster uploaded successfully.','Poster berjaya dimuat naik.'));form.reset();router.refresh();
  }catch{setMessage(errors.storage);}finally{setBusy(false);}
 }
 return <form onSubmit={submit}><input type="hidden" name="id" value={id}/><label>{t('Poster image','Gambar poster')}<input name="poster" type="file" accept="image/jpeg,image/png,image/webp" required disabled={busy}/></label><small>{t('JPG, PNG or WebP, up to 40 MB. Large images are compressed automatically before upload; your original file is unchanged.','JPG, PNG atau WebP, sehingga 40 MB. Imej besar dimampatkan secara automatik sebelum dimuat naik; fail asal tidak berubah.')}</small><button className="admin-secondary" disabled={busy}>{busy?t('Please wait…','Sila tunggu…'):t('Upload / replace poster','Muat naik / ganti poster')}</button>{message&&<p role="status" aria-live="polite">{message}</p>}</form>;
}
