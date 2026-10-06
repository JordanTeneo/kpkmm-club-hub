'use client';
import {useUiText,useUiLanguage} from '../../../ui-language';

import {useState} from 'react';
type Member={memberNumber:string;name:string;active:boolean;previousActive?:boolean|null;identity:string;address:string};
export function MemberList({members,year}:{members:Member[];year:number}){
 const ui = useUiText(),bm=useUiLanguage()==='ms',t=(en:string,ms:string)=>bm?ms:en;

 const [query,setQuery]=useState(''),[status,setStatus]=useState('all'),[page,setPage]=useState(1);
 const active=members.filter(m=>m.active).length,needle=query.trim().toLocaleLowerCase();
 const filtered=members.filter(m=>(status==='all'||m.active===(status==='active'))&&(!needle||(m.name+' '+m.memberNumber).toLocaleLowerCase().includes(needle)));
 const pages=Math.max(1,Math.ceil(filtered.length/25)),current=Math.min(page,pages);
 return <><section className="shop-note"><h2>{year}{ui(" membership")}</h2><p><strong>{members.length}</strong>{ui(" total / jumlah · ")}<strong>{active}</strong>{ui(" active / aktif · ")}<strong>{members.length-active}</strong>{ui(" inactive / tidak aktif")}</p></section><section className="shop-card"><div className="shop-actions"><label>{ui("Search name or member ID / Cari nama atau nombor ahli")}<input type="search" value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}}/></label><label>Status<select value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}><option value="all">{ui("All / Semua")}</option><option value="active">{ui("Active / Aktif")}</option><option value="inactive">{ui("Inactive / Tidak aktif")}</option></select></label></div><p role="status">{filtered.length}{ui(" matching members / ahli sepadan")}</p>
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
 <dl><div><dt>{ui('MyKad / Passport')}</dt><dd>{m.identity||'—'}</dd></div><div><dt>{ui('Address / Alamat')}</dt><dd>{m.address||'—'}</dd></div>
 <div><dt>{year} {t('status','status')}</dt><dd>{m.active?ui('Active / Aktif'):ui('Inactive / Tidak aktif')}</dd></div><div><dt>{year-1} {t('status','status')}</dt><dd>{m.previousActive===true?ui('Active / Aktif'):m.previousActive===false?ui('Inactive / Tidak aktif'):t('No record','Tiada rekod')}</dd></div></dl>
 </article>)}</div>
 {!filtered.length&&<p>{ui("No matching members. / Tiada ahli sepadan.")}</p>}<nav className="shop-actions" aria-label={ui("Member list pages")}><button disabled={current<=1} onClick={()=>setPage(current-1)}>{ui("← Previous / Sebelumnya")}</button><span>{current} / {pages}</span><button disabled={current>=pages} onClick={()=>setPage(current+1)}>{ui("Next / Seterusnya →")}</button></nav></section></>;
}
