'use client';
import Link from 'next/link';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {usePathname} from 'next/navigation';
export function SiteNavigation({bm,children}:{bm:boolean;children:ReactNode}){
 const [open,setOpen]=useState(false),button=useRef<HTMLButtonElement>(null),path=usePathname();
 useEffect(()=>setOpen(false),[path]);
 const links=[['/',bm?'Laman Utama':'Home'],['/about',bm?'Tentang Kami':'About Us'],['/shop',bm?'Kedai':'Marketplace'],['/join',bm?'Mohon Keahlian':'Join the Club'],['/renew',bm?'Perbaharui Keahlian':'Renew Membership'],['/membership-status',bm?'Status Keahlian':'Membership Status']];
 if(path==='/admin'||path.startsWith('/admin/'))return <header className="club-navigation"><Link prefetch={false} className="club-nav-brand" href="/">KPKMM</Link><Link prefetch={false} href="/" style={{marginLeft:'auto',color:'inherit'}}>{bm?'Lihat laman web':'View website'} ↗</Link><div className="club-nav-tools">{children}</div></header>;
 return <header className="club-navigation" onKeyDown={e=>{if(e.key==='Escape'&&open){setOpen(false);button.current?.focus();}}}>
 <Link prefetch={false} className="club-nav-brand" href="/">KPKMM</Link><button ref={button} className="club-menu-toggle" aria-expanded={open} aria-controls="club-site-menu" onClick={()=>setOpen(!open)}>{open?(bm?'Tutup':'Close'):'Menu'} <span aria-hidden="true">{open?'×':'☰'}</span></button>
 <div id="club-site-menu" className={'club-site-menu'+(open?' is-open':'')}><nav aria-label={bm?'Halaman utama':'Site pages'}>{links.map(([url,label])=><Link prefetch={false} key={url} href={url} aria-current={path===url?'page':undefined} onClick={()=>setOpen(false)}>{label}</Link>)}</nav><div className="club-nav-tools"><Link prefetch={false} href="/admin" onClick={()=>setOpen(false)}>{bm?'Pentadbir':'Admin'}</Link>{children}</div></div>
 </header>;
}
