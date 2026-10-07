'use client';
import {useUiLanguage} from '../ui-language';
export default function AdminError({reset}:{error:Error&{digest?:string};reset:()=>void}){
 const bm=useUiLanguage()==='ms';
 return <main style={{maxWidth:720,margin:'40px auto',padding:24}}>
  <h1>{bm?'Halaman tidak dapat dimuatkan':'This page could not be loaded'}</h1>
  <p role="alert">{bm?'Jika anda sedang menyimpan perubahan, semak rekod dahulu sebelum menghantar semula untuk mengelakkan pendua.':'If you were saving a change, check the records before submitting again to avoid duplicates.'}</p>
  <div style={{display:'flex',gap:16,flexWrap:'wrap',alignItems:'center'}}><button type="button" onClick={reset}>{bm?'Cuba muat semula':'Try loading again'}</button><a href="/admin">← {bm?'Kembali ke papan pemuka':'Back to dashboard'}</a></div>
 </main>;
}
