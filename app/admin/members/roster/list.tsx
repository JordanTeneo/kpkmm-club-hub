'use client';
import {useUiText,useUiLanguage} from '../../../ui-language';

import {statusLabel,type AnnualStatus} from '../../../../lib/annual-status';

type Member={memberNumber:string;name:string;active:boolean;annualStatus:AnnualStatus;previousStatus?:AnnualStatus|null;previousActive?:boolean|null;identity:string;address:string;email?:string;vehicles?:string[];lifetimeSince?:number;memberSince?:number;lastActiveYear?:number;paymentHistory?:{year:number;note:string;status:string}[]};
export function MemberList({members,year,query,status,counts,total,matching,pages,current}:{members:Member[];year:number;query:string;status:string;counts:Record<string,number>;total:number;matching:number;pages:number;current:number}){
 const ui = useUiText(),bm=useUiLanguage()==='ms',t=(en:string,ms:string)=>bm?ms:en;

 const pageUrl=(page:number,nextStatus=status)=>'?'+new URLSearchParams({year:String(year),q:query,status:nextStatus,page:String(page)}).toString();
 return <><section className="shop-note"><h2>{year}{ui(" membership")}</h2><p><strong>{total}</strong> {t('registered members','ahli berdaftar')}</p><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:12}}>{(['active','new','inactive','lifetime','deceased'] as AnnualStatus[]).map(s=><a className="shop-link" key={s} href={pageUrl(1,s)}><strong>{counts[s]||0}</strong><br/>{statusLabel(s,bm)}</a>)}</div></section><section className="shop-card"><form className="shop-actions" method="get"><input type="hidden" name="year" value={year}/><label>{ui("Search name or member ID / Cari nama atau nombor ahli")}<input type="search" name="q" defaultValue={query} maxLength={150}/></label><label>Status<select name="status" defaultValue={status}><option value="all">{ui("All / Semua")}</option><option value="active">{ui("Active / Aktif")}</option><option value="new">{statusLabel('new',bm)}</option><option value="lifetime">{statusLabel('lifetime',bm)}</option><option value="deceased">{statusLabel('deceased',bm)}</option><option value="inactive">{ui("Inactive / Tidak aktif")}</option></select></label><button>{t('Search','Cari')}</button></form><p role="status">{matching}{ui(" matching members / ahli sepadan")}</p>
 <p>{t('Private member details — administrators only. Select a member to view their details and actions.','Maklumat ahli sulit — pentadbir sahaja. Pilih ahli untuk melihat maklumat dan tindakan.')}</p>
 <p>{t('Previous-year status is based on saved annual records and approved renewals. No record means historical evidence is unavailable, not confirmed inactivity.','Status tahun sebelumnya berdasarkan rekod tahunan dan pembaharuan diluluskan. Tiada rekod bermakna maklumat sejarah tidak tersedia, bukan pengesahan tidak aktif.')}</p>
 <style>{`
 .member-cards{display:grid;gap:16px;min-width:0}
 .member-detail-card{border:1px solid #d9c49b;border-radius:14px;padding:20px;min-width:0;background:#fffdf7}
 .member-disclosure>summary{display:flex;align-items:center;gap:16px;cursor:pointer;list-style:none;border-radius:6px}
 .member-disclosure>summary::-webkit-details-marker{display:none}
 .member-disclosure>summary:focus-visible{outline:3px solid #725d45;outline-offset:6px}
 .member-summary-name{flex:1;min-width:0;display:grid;gap:4px;overflow-wrap:anywhere}
 .member-summary-name small{font-weight:600;color:#725d45}
 .member-summary-name strong{font-size:18px}
 .member-summary-status{font-size:14px;background:#f5e8ca;border-radius:20px;padding:6px 10px;white-space:nowrap}
 .member-disclosure>summary::after{content:'+';font-size:24px;flex:none}
 .member-disclosure[open]>summary::after{content:'−'}
 .member-detail-body{border-top:1px solid #e6d7bc;margin-top:16px;padding-top:16px}
 .member-detail-actions{display:flex;gap:10px;flex-wrap:wrap}
 .member-detail-card dl{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr);gap:18px 24px;margin:20px 0 0}
 .member-detail-card dl>div{min-width:0}
 .member-detail-card dt{font-size:14px;color:#725d45;margin-bottom:6px;font-weight:600}
 .member-detail-card dd{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.5}
 @media(max-width:600px){.member-detail-card{padding:16px}.member-detail-card dl{grid-template-columns:minmax(0,1fr)}}
 `}</style>
 <div className="member-cards" role="region" aria-label={ui("Private member listing")}>{members.map(m=><article className="member-detail-card" key={m.memberNumber}>
 <details className="member-disclosure"><summary><span className="member-summary-name"><small>{m.memberNumber}</small><strong>{m.name}</strong></span><span className="member-summary-status">{statusLabel(m.annualStatus,bm)}</span></summary>
 <div className="member-detail-body"><div className="member-detail-actions"><a className="shop-link" aria-label={t('Edit ','Sunting ')+m.memberNumber} href={'/admin/members/roster/edit?member='+encodeURIComponent(m.memberNumber)+'&year='+year}>{ui("Edit / Sunting")}</a><a className="shop-link" href={'/admin/members/roster/renew?member='+encodeURIComponent(m.memberNumber)+'&year='+year}>{t('Renew','Perbaharui')}</a></div>
 <dl><div><dt>{t('Member since','Ahli sejak')}</dt><dd>{m.memberSince??t('No record','Tiada rekod')}</dd></div>
 <div><dt>{t('Last active year','Tahun terakhir aktif')}</dt><dd>{m.lastActiveYear??t('No record','Tiada rekod')}</dd></div>
 <div><dt>{ui('MyKad / Passport')}</dt><dd>{m.identity||'—'}</dd></div><div><dt>{ui('Address / Alamat')}</dt><dd>{m.address||'—'}</dd></div>
 <div><dt>{t('Email','E-mel')}</dt><dd>{m.email||'—'}</dd></div><div><dt>{t('Vehicle numbers','Nombor kenderaan')}</dt><dd>{m.vehicles?.length?m.vehicles.join('\n'):'—'}</dd></div>
 <div><dt>{year} {t('status','status')}</dt><dd>{statusLabel(m.annualStatus,bm)}</dd></div><div><dt>{year-1} {t('status','status')}</dt><dd>{m.previousStatus?statusLabel(m.previousStatus,bm):t('No record','Tiada rekod')}</dd></div></dl>
 {m.paymentHistory?.length?<details style={{marginTop:20}}><summary>{t('Payment and fee-waiver history','Sejarah bayaran dan pengecualian yuran')}</summary><ul>{m.paymentHistory.map(h=><li key={h.year}><strong>{h.year}</strong>: {({paid:t('Paid','Dibayar'),new:t('New member','Ahli baharu'),sponsored:t('Sponsored — fee waived','Tajaan — yuran dikecualikan'),lifetime:t('Lifetime membership','Keahlian seumur hidup'),inactive:t('No payment recorded','Tiada bayaran direkodkan'),review:t('Needs review','Perlu semakan')} as Record<string,string>)[h.status]||h.status}{h.note?' — '+h.note:''}</li>)}</ul></details>:null}
 </div></details></article>)}</div>
 {!matching&&<p>{ui("No matching members. / Tiada ahli sepadan.")}</p>}<nav className="shop-actions" aria-label={ui("Member list pages")}>{current>1&&<a className="shop-link" href={pageUrl(current-1)}>{ui("← Previous / Sebelumnya")}</a>}<span>{current} / {pages}</span>{current<pages&&<a className="shop-link" href={pageUrl(current+1)}>{ui("Next / Seterusnya →")}</a>}</nav></section></>;
}
