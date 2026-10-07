'use client';
import {useUiText,useUiLanguage} from '../../../ui-language';

import {statusLabel,type AnnualStatus} from '../../../../lib/annual-status';
import {useState} from 'react';
type Member={memberNumber:string;name:string;active:boolean;annualStatus:AnnualStatus;previousStatus?:AnnualStatus|null;previousActive?:boolean|null;identity:string;address:string;email?:string;vehicles?:string[];lifetimeSince?:number;memberSince?:number;lastActiveYear?:number;paymentHistory?:{year:number;note:string;status:string}[]};
export function MemberList({members,year}:{members:Member[];year:number}){
 const ui = useUiText(),bm=useUiLanguage()==='ms',t=(en:string,ms:string)=>bm?ms:en;

 const [query,setQuery]=useState(''),[status,setStatus]=useState('all'),[page,setPage]=useState(1);
 const needle=query.trim().toLocaleLowerCase();
 const filtered=members.filter(m=>(status==='all'||m.annualStatus===status)&&(!needle||(m.name+' '+m.memberNumber).toLocaleLowerCase().includes(needle)));
 const pages=Math.max(1,Math.ceil(filtered.length/25)),current=Math.min(page,pages);
 return <><section className="shop-note"><h2>{year}{ui(" membership")}</h2><p><strong>{members.length}</strong> {t('registered members','ahli berdaftar')}</p><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:12}}>{(['active','new','inactive','lifetime','deceased'] as AnnualStatus[]).map(s=><button key={s} onClick={()=>{setStatus(s);setPage(1);}}><strong>{members.filter(m=>m.annualStatus===s).length}</strong><br/>{statusLabel(s,bm)}</button>)}</div></section><section className="shop-card"><div className="shop-actions"><label>{ui("Search name or member ID / Cari nama atau nombor ahli")}<input type="search" value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}}/></label><label>Status<select value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}><option value="all">{ui("All / Semua")}</option><option value="active">{ui("Active / Aktif")}</option><option value="new">{statusLabel('new',bm)}</option><option value="lifetime">{statusLabel('lifetime',bm)}</option><option value="deceased">{statusLabel('deceased',bm)}</option><option value="inactive">{ui("Inactive / Tidak aktif")}</option></select></label></div><p role="status">{filtered.length}{ui(" matching members / ahli sepadan")}</p>
 <p>{t('Private member details — administrators only. All fields are shown below without sideways scrolling.','Maklumat ahli sulit — pentadbir sahaja. Semua medan dipaparkan tanpa menatal ke sisi.')}</p>
 <p>{t('Previous-year status is based on saved annual records and approved renewals. No record means historical evidence is unavailable, not confirmed inactivity.','Status tahun sebelumnya berdasarkan rekod tahunan dan pembaharuan diluluskan. Tiada rekod bermakna maklumat sejarah tidak tersedia, bukan pengesahan tidak aktif.')}</p>
 <style>{`
 .member-cards{display:grid;gap:16px;min-width:0}
 .member-detail-card{border:1px solid #d9c49b;border-radius:14px;padding:20px;min-width:0;background:#fffdf7}
 .member-detail-head{display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px}
 .member-detail-head>div{flex:1 1 240px;min-width:0}
 .member-detail-head h3{font-size:23px;margin:6px 0;overflow-wrap:anywhere}
 .member-detail-head p{margin:0;font-weight:700}
 .member-detail-card dl{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr);gap:18px 24px;margin:20px 0 0}
 .member-detail-card dl>div{min-width:0}
 .member-detail-card dt{font-size:14px;color:#725d45;margin-bottom:6px;font-weight:600}
 .member-detail-card dd{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.5}
 @media(max-width:600px){.member-detail-card{padding:16px}.member-detail-card dl{grid-template-columns:minmax(0,1fr)}}
 `}</style>
 <div className="member-cards" role="region" aria-label={ui("Private member listing")}>{filtered.slice((current-1)*25,current*25).map(m=><article className="member-detail-card" key={m.memberNumber}>
 <header className="member-detail-head"><div><p>{m.memberNumber}</p><h3>{m.name}</h3></div><a className="shop-link" aria-label={t('Edit ','Sunting ')+m.memberNumber} href={'/admin/members/roster/edit?member='+encodeURIComponent(m.memberNumber)+'&year='+year}>{ui("Edit / Sunting")}</a><a className="shop-link" href={'/admin/members/roster/renew?member='+encodeURIComponent(m.memberNumber)+'&year='+year}>{t('Renew','Perbaharui')}</a></header>
 <dl><div><dt>{t('Member since','Ahli sejak')}</dt><dd>{m.memberSince??t('No record','Tiada rekod')}</dd></div>
 <div><dt>{t('Last active year','Tahun terakhir aktif')}</dt><dd>{m.lastActiveYear??t('No record','Tiada rekod')}</dd></div>
 <div><dt>{ui('MyKad / Passport')}</dt><dd>{m.identity||'—'}</dd></div><div><dt>{ui('Address / Alamat')}</dt><dd>{m.address||'—'}</dd></div>
 <div><dt>{t('Email','E-mel')}</dt><dd>{m.email||'—'}</dd></div><div><dt>{t('Vehicle numbers','Nombor kenderaan')}</dt><dd>{m.vehicles?.length?m.vehicles.join('\n'):'—'}</dd></div>
 <div><dt>{year} {t('status','status')}</dt><dd>{statusLabel(m.annualStatus,bm)}</dd></div><div><dt>{year-1} {t('status','status')}</dt><dd>{m.previousStatus?statusLabel(m.previousStatus,bm):t('No record','Tiada rekod')}</dd></div></dl>
 {m.paymentHistory?.length?<details style={{marginTop:20}}><summary>{t('Payment and fee-waiver history','Sejarah bayaran dan pengecualian yuran')}</summary><ul>{m.paymentHistory.map(h=><li key={h.year}><strong>{h.year}</strong>: {({paid:t('Paid','Dibayar'),new:t('New member','Ahli baharu'),sponsored:t('Sponsored — fee waived','Tajaan — yuran dikecualikan'),lifetime:t('Lifetime membership','Keahlian seumur hidup'),inactive:t('No payment recorded','Tiada bayaran direkodkan'),review:t('Needs review','Perlu semakan')} as Record<string,string>)[h.status]||h.status}{h.note?' — '+h.note:''}</li>)}</ul></details>:null}
 </article>)}</div>
 {!filtered.length&&<p>{ui("No matching members. / Tiada ahli sepadan.")}</p>}<nav className="shop-actions" aria-label={ui("Member list pages")}><button disabled={current<=1} onClick={()=>setPage(current-1)}>{ui("← Previous / Sebelumnya")}</button><span>{current} / {pages}</span><button disabled={current>=pages} onClick={()=>setPage(current+1)}>{ui("Next / Seterusnya →")}</button></nav></section></>;
}
