'use client';
import {useEffect,useState} from 'react';
import {usePathname,useSearchParams} from 'next/navigation';
import {useUiLanguage} from './ui-language';

export function NavigationFeedback(){
 const path=usePathname(),query=useSearchParams().toString(),bm=useUiLanguage()==='ms';
 const [busy,setBusy]=useState(false);
 useEffect(()=>{setBusy(false);},[path,query]);
 useEffect(()=>{
  let timer:ReturnType<typeof setTimeout>|undefined;
  const clear=()=>{clearTimeout(timer);setBusy(false);};
  const click=(event:MouseEvent)=>{
   if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
   const link=(event.target as Element)?.closest?.('a');
   if(!link||link.hasAttribute('download')||(link.target&&link.target!=='_self'))return;
   const url=new URL(link.href,location.href);
   if(url.origin!==location.origin||url.protocol!==location.protocol||/\/(export|receipt)(\/|$)/.test(url.pathname))return;
   if(url.pathname===location.pathname&&url.search===location.search)return;
   setBusy(true);clearTimeout(timer);timer=setTimeout(clear,30000);
  };
  document.addEventListener('click',click,true);
  window.addEventListener('pageshow',clear);
  window.addEventListener('popstate',clear);
  return ()=>{clearTimeout(timer);document.removeEventListener('click',click,true);window.removeEventListener('pageshow',clear);window.removeEventListener('popstate',clear);};
 },[]);
 if(!busy)return null;
 return <div role="status" aria-live="polite" style={{position:'fixed',top:0,left:0,right:0,zIndex:1000,padding:'8px 16px',background:'#a64320',color:'#fff',textAlign:'center',pointerEvents:'none'}}>{bm?'Memuatkan halaman…':'Loading page…'}</div>;
}
