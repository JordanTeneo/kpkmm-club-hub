import {publicAppointments} from '../../lib/appointments';
export async function PublicCommittee({bm}:{bm:boolean}){
 const rows=await publicAppointments();
 const cards=(role:string)=>rows.filter(row=>row.role===role).map((row,i)=><article className="committee-card" key={role+i}><p className="committee-role">{bm?row.role_ms:row.role_en}</p><h3>{row.display_name}</h3></article>);
 return <section id="committee" className="current-committee"><h2>{bm?'Jawatankuasa Kelab Semasa':'Current Club Committee'}</h2><p>{bm?'Bersama memimpin keluarga Mini kita.':'The people guiding our Mini family.'}</p>{rows.length?<div className="committee-hierarchy">
  {rows.some(r=>r.role==='chairman')&&<div className="committee-tier">{cards('chairman')}</div>}
  {rows.some(r=>r.role==='vice-chairman')&&<div className="committee-tier">{cards('vice-chairman')}</div>}
  {rows.some(r=>['secretary','assistant-secretary','treasurer'].includes(r.role))&&<div className="committee-officers">
   {rows.some(r=>['secretary','assistant-secretary'].includes(r.role))&&<div className="committee-branch">{cards('secretary')}{cards('assistant-secretary')}</div>}
   {rows.some(r=>r.role==='treasurer')&&<div className="committee-branch">{cards('treasurer')}</div>}
  </div>}
  {rows.some(r=>['committee','custom'].includes(r.role))&&<div className="committee-members">{cards('committee')}{cards('custom')}</div>}
 </div>:<p>{bm?'Pelantikan jawatankuasa akan diumumkan di sini.':'Committee appointments will be announced here.'}</p>}
 <style>{`.current-committee{margin:24px 0}.committee-hierarchy{margin-top:16px;display:grid;gap:12px}.committee-tier{display:grid;justify-items:center;position:relative}.committee-tier:not(:first-child):before,.committee-officers:before{content:'';position:absolute;width:1px;height:12px;background:#d5bd91;top:-12px;left:50%}.committee-card{box-sizing:border-box;width:100%;padding:12px 16px;background:#fff8e9;border:1px solid #d5bd91;border-radius:12px;box-shadow:0 2px 8px #39271c08;text-align:center;overflow-wrap:anywhere}.committee-tier>.committee-card{max-width:290px}.committee-card h3{margin:6px 0 0;font-size:16px;line-height:1.4}.committee-role{color:#a44b29;font-weight:700;font-size:12px;letter-spacing:.025em;margin:0}.committee-term{font-size:14px;margin:12px 0 0}.committee-officers{position:relative;display:flex;justify-content:center;gap:12px}.committee-branch{display:grid;align-content:start;gap:12px;flex:1;max-width:290px}.committee-members{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:12px;padding-top:16px;border-top:1px solid #d5bd91}@media(max-width:600px){.committee-officers{flex-direction:column;align-items:center}.committee-branch{width:100%;flex:auto}.committee-card{padding:12px 14px}.committee-tier>.committee-card,.committee-branch{max-width:100%}.committee-card h3{font-size:16px}}`}</style></section>;
}
