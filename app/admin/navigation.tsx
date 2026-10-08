'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useUiLanguage} from '../ui-language';

const sections=[
 ['/admin/celebrations','Celebration greetings','Ucapan perayaan'],
 ['/admin/appointments','Committee appointments','Pelantikan jawatankuasa'],
 ['/admin/members/roster','Member listing','Senarai ahli'],
 ['/admin/members','Applications','Permohonan'],
 ['/admin/renewals','Renewals','Pembaharuan'],
 ['/admin/payments','Membership payments','Bayaran keahlian'],
 ['/admin?section=notices#workspace','Notices','Notis'],
 ['/admin?section=archive#workspace','Archive','Arkib'],
 ['/admin?section=photos#workspace','Photos','Foto'],
 ['/admin/banner','Homepage banner','Sepanduk utama'],
 ['/admin/videos','Videos','Video'],
 ['/admin/shop','Marketplace','Kedai'],
 ['/admin/email','Club email','E-mel kelab'],
 ['/admin/reminders','Renewal reminders','Peringatan pembaharuan'],
 ['/admin/users','Committee accounts','Akaun jawatankuasa'],
] as const;

export function AdminNavigation(){
 const pathname=usePathname(),bm=useUiLanguage()==='ms';
 if(pathname==='/admin/sign-in')return null;
 const current=sections.find(([url])=>pathname===url||pathname.startsWith(url+'/'));
 return <nav className="admin-navigation" aria-label={bm?'Navigasi pentadbir':'Admin navigation'}>
  <Link prefetch={false} className="dashboard-link" href="/admin">← {bm?'Papan pemuka':'Dashboard'}</Link>
  <span className="current-section">{current?current[bm?2:1]:bm?'Pentadbiran kelab':'Club administration'}</span>
  <details key={pathname}><summary>{bm?'Menu pentadbir':'Admin menu'} <span aria-hidden="true">☰</span></summary>
   <div className="admin-menu-links">{sections.map(([url,en,ms])=><Link prefetch={false} key={url} href={url} aria-current={pathname===url?'page':undefined} onClick={event=>event.currentTarget.closest('details')?.removeAttribute('open')}>{bm?ms:en}</Link>)}</div>
  </details>
  <style jsx>{`
   .admin-navigation{position:sticky;top:0;z-index:40;display:flex;align-items:center;gap:16px;padding:10px max(16px,calc((100vw - 1280px)/2));background:#fff8e9;border-bottom:1px solid #d5bd91;box-shadow:0 3px 12px #38261910;color:#35251c;}
   .admin-navigation :global(.dashboard-link){display:inline-flex;align-items:center;min-height:44px;padding:0 16px;border-radius:10px;background:#39271c;color:#fff8e9;text-decoration:none;font-weight:700;white-space:nowrap;}
   .current-section{font-size:14px;font-weight:600;flex:1;}
   details{position:relative;margin-left:auto;}
   summary{cursor:pointer;min-height:44px;display:flex;align-items:center;gap:12px;padding:0 14px;border:1px solid #bda17a;border-radius:10px;font-weight:600;list-style:none;}
   summary::-webkit-details-marker{display:none;}
   .admin-menu-links{position:absolute;right:0;top:calc(100% + 8px);width:280px;max-width:calc(100vw - 32px);max-height:65vh;overflow-y:auto;overflow-x:hidden;padding:8px;background:#fff8e9;border:1px solid #d5bd91;border-radius:12px;box-shadow:0 12px 30px #38261930;}
   .admin-menu-links :global(a){display:flex;box-sizing:border-box;width:100%;align-items:center;min-height:44px;padding:8px 12px;border-radius:7px;color:#35251c;text-decoration:none;white-space:normal;overflow-wrap:anywhere;}
   .admin-menu-links :global(a:hover),.admin-menu-links :global(a[aria-current=page]){background:#f0dfbd;}
   .admin-navigation :global(a:focus-visible),summary:focus-visible{outline:3px solid #a44b29;outline-offset:3px;}
   @media(max-width:600px){.admin-navigation{gap:8px;padding:8px 12px;}.current-section{display:none;}.admin-navigation :global(.dashboard-link),summary{font-size:14px;padding:0 12px;}}
  `}</style>
 </nav>;
}
