import {publicAppointments} from '../../lib/appointments';
export async function PublicCommittee({bm}:{bm:boolean}){
 const rows=await publicAppointments();
 return <section id="committee" style={{margin:'32px 0'}}><h2>{bm?'Jawatankuasa Kelab':'Club Committee'}</h2><p>{bm?'Bersama memimpin keluarga Mini kita.':'The people guiding our Mini family.'}</p>{rows.length?<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,240px),1fr))',gap:16}}>{rows.map((row,i)=><article key={i} style={{padding:24,background:'#fff8e9',border:'1px solid #d5bd91',borderRadius:16}}><p style={{color:'#a44b29',fontWeight:700}}>{bm?row.role_ms:row.role_en}</p><h3>{row.display_name}</h3><p>{row.starts} — {row.ends}</p></article>)}</div>:<p>{bm?'Pelantikan jawatankuasa akan diumumkan di sini.':'Committee appointments will be announced here.'}</p>}</section>;
}
