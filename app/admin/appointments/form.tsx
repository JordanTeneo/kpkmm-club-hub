'use client';
import {useActionState,useState} from 'react';
import {roles,type Appointment} from '../../../lib/appointment-types';
export type Result={ok:boolean;message:string};
export function AppointmentForm({bm,members,item,action}:{bm:boolean;members:{number:string;name:string}[];item?:Appointment;action:(state:Result,form:FormData)=>Promise<Result>}){
 const [state,submit,pending]=useActionState(action,{ok:false,message:''});
 const [role,setRole]=useState(item?.role||'chairman');
 const [search,setSearch]=useState('');
 const [member,setMember]=useState(item?.member_number||'');
 const query=search.normalize('NFKC').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 const matches=members.filter(m=>query.every(word=>(m.number+' '+m.name).normalize('NFKC').toLocaleLowerCase().includes(word)));
 return <form action={submit} className="appointment-form">
  <input type="hidden" name="id" value={item?.id||''}/><input type="hidden" name="version" value={item?.version||0}/>
  {role==='advisor'?<div style={{minWidth:0,display:'grid',gap:8}}>
   <label>{bm?'Nama penasihat':'Advisor name'}<input name="advisorName" maxLength={150} required defaultValue={item?.role==='advisor'?item.display_name:''}/></label>
   <label>{bm?'Butiran penasihat (dipaparkan kepada umum)':'Advisor details (shown publicly)'}<textarea name="advisorDetails" maxLength={2000} rows={4} defaultValue={item?.advisor_details||''} placeholder={bm?'Profil ringkas, kelayakan atau maklumat penasihat':'Short profile, qualifications or advisor information'}/></label>
   <small>{bm?'Tidak perlu menjadi ahli. Nama, jawatan dan butiran ini akan dipaparkan dalam hierarki jawatankuasa awam. Jangan masukkan maklumat sulit.':'Club membership is not required. The name, role and these details will appear in the public committee hierarchy. Do not enter confidential information.'}</small>
  </div>:<div style={{minWidth:0,display:'grid',gap:8}}>
   <label>{bm?'Cari ahli':'Search members'}<input type="search" value={search} onChange={e=>{setSearch(e.target.value);setMember('');}} placeholder={bm?'Taip nama atau nombor ahli':'Type a name or membership number'} autoComplete="off"/></label>
   <label>{bm?'Ahli':'Member'}<select name="member" value={member} onChange={e=>setMember(e.target.value)} required size={5}><option value="" disabled>{bm?'Pilih ahli daripada senarai':'Choose a member from the results'}</option>{matches.map(m=><option key={m.number} value={m.number}>{m.number} — {m.name}</option>)}</select></label>
   <small role="status" aria-live="polite">{matches.length===0?(bm?'Tiada ahli ditemui. Cuba nama atau nombor lain.':'No members found. Try another name or number.'):bm?`${matches.length} ahli ditemui. Pilih satu ahli.`:`${matches.length} members found. Select one member.`}</small>
  </div>}
  <label style={{alignSelf:'start'}}>{bm?'Jawatan':'Role'}<select name="role" value={role} onChange={e=>setRole(e.target.value)}>{roles.map(r=><option key={r[0]} value={r[0]}>{r[bm?2:1]}</option>)}</select></label>
  {role==='custom'&&<><label>{bm?'Nama jawatan (Inggeris)':'Role title (English)'}<input name="roleEn" maxLength={80} defaultValue={item?.role_en} required/></label><label>{bm?'Nama jawatan (Bahasa Malaysia)':'Role title (Bahasa Malaysia)'}<input name="roleMs" maxLength={80} defaultValue={item?.role_ms} required/></label></>}
  <p>{bm?'Pelantikan kekal semasa sehingga diubah atau dibatalkan oleh pentadbir yang diberi kebenaran.':'Appointments remain current until changed or cancelled by an authorised administrator.'}</p>
  <label className="publication"><input type="checkbox" name="publish" value="yes" required/>{role==='advisor'?(bm?'Saya mengesahkan nama, jawatan dan butiran penasihat boleh dipaparkan kepada umum.':'I confirm the advisor’s name, role and details may be published publicly.'):(bm?'Saya mengesahkan nama dan jawatan boleh dipaparkan kepada umum.':'I confirm the name and role may be published publicly.')}</label>
  <button disabled={pending} name="operation" value="save">{pending?(bm?'Menyimpan…':'Saving…'):(bm?'Simpan pelantikan':'Save appointment')}</button>
  {item&&<button type="submit" name="operation" value="cancel" formNoValidate disabled={pending} onClick={e=>{if(!confirm(bm?'Batalkan pelantikan ini? Rekod sejarah akan disimpan.':'Cancel this appointment? Its history will be retained.'))e.preventDefault();}}>{bm?'Batalkan pelantikan':'Cancel appointment'}</button>}
  <p role="status" aria-live="polite">{state.message}</p>
 </form>;
}
