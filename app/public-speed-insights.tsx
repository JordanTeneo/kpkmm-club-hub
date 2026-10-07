'use client';
import {SpeedInsights} from '@vercel/speed-insights/next';
import {usePathname} from 'next/navigation';
const allowed=new Set(['/','/about','/shop','/videos','/join','/renew','/membership-status']);
export function cleanMetricUrl(value:string){try{const url=new URL(value);if(!allowed.has(url.pathname))return null;url.search='';url.hash='';return url.toString();}catch{return null;}}
export function PublicSpeedInsights(){
 const pathname=usePathname();
 if(!pathname||!allowed.has(pathname))return null;
 return <SpeedInsights sampleRate={0.25} debug={false} beforeSend={data=>{const url=cleanMetricUrl(data.url);return url?{...data,url}:null;}}/>;
}
