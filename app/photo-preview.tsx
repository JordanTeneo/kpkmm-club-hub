'use client';
import Image,{type ImageProps} from 'next/image';
import {useState} from 'react';

function supported(src:ImageProps['src']){
 if(typeof src!=='string')return true;
 if(src.startsWith('/')&&!src.startsWith('//'))return !src.startsWith('/api/');
 try{const url=new URL(src);return url.protocol==='https:'&&(
  url.hostname==='images.unsplash.com'||
  (url.hostname.endsWith('.public.blob.vercel-storage.com')&&url.pathname.startsWith('/kpkmm/media/'))
 );}catch{return false;}
}
// Legacy/external images keep working; only known public sources use the optimizer.
export function PhotoPreview(props:ImageProps){
 const [failed,setFailed]=useState<ImageProps['src']|null>(null);
 return <Image {...props} unoptimized={!supported(props.src)||failed===props.src}
  onError={()=>setFailed(props.src)} />;
}
