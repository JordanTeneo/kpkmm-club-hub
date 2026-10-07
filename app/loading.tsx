'use client';
import {useUiLanguage} from './ui-language';
export default function Loading(){
 const bm=useUiLanguage()==='ms';
 return <div role="status" aria-live="polite" style={{padding:'48px 24px',maxWidth:1280,margin:'auto'}}><p>{bm?'Memuatkan halaman…':'Loading page…'}</p><div aria-hidden="true" style={{height:120,borderRadius:16,background:'#f0dfbd'}}/></div>;
}
