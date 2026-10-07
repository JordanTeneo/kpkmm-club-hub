'use client';
import {useActionState,useState} from 'react';
import {roles,type Appointment} from '../../../lib/appointment-types';
export type Result={ok:boolean;message:string};
export function AppointmentForm({bm,members,item,action}:{bm:boolean;members:{number:string;name:string}[];item?:Appointment;action:(state:Result,form:FormData)=>Promise<Result>}){
 const [state,submit,pending]=useActionState(action,{ok:false,message:''});
 const [role,setRole]=useState(item?.role||'chairman');
 return <form action={submit} className="appointment-form">
  <input type="hidden" name="id" value={item?.id||''}/><input type="hidden" name="version" value={item?.version||0}/>
  <label>{bm?'Ahli':'Member'}<select name="member" defaultValue={item?.member_number||''} required><option value="">{bm?'Pilih ahli':'Select a member'}</option>{members.map(m=><option key={m.number} value={m.number}>{m.number} — {m.name}</option>)}</select></label>
  <label>{bm?'Jawatan':'Role'}<select name="role" value={role} onChange={e=>setRole(e.target.value)}>{roles.map(r=><option key={r[0]} value={r[0]}>{r[bm?2:1]}</option>)}</select></label>
  {role==='custom'&&<><label>{bm?'Nama jawatan (Inggeris)':'Role title (English)'}<input name="roleEn" maxLength={80} defaultValue={item?.role_en} required/></label><label>{bm?'Nama jawatan (Bahasa Malaysia)':'Role title (Bahasa Malaysia)'}<input name="roleMs" maxLength={80} defaultValue={item?.role_ms} required/></label></>}
  <label>{bm?'Tarikh mula':'Term starts'}<input type="date" name="starts" defaultValue={item?.starts} required/></label><label>{bm?'Tarikh akhir (termasuk)':'Term ends (inclusive)'}<input type="date" name="ends" defaultValue={item?.ends} required/></label>
  <label className="publication"><input type="checkbox" name="publish" value="yes" required/>{bm?'Saya mengesahkan nama, jawatan dan tempoh boleh dipaparkan kepada umum.':'I confirm the name, role and term may be published publicly.'}</label>
  <button disabled={pending} name="operation" value="save">{pending?(bm?'Menyimpan…':'Saving…'):(bm?'Simpan pelantikan':'Save appointment')}</button>
  {item&&<button type="submit" name="operation" value="cancel" formNoValidate disabled={pending} onClick={e=>{if(!confirm(bm?'Batalkan pelantikan ini? Rekod sejarah akan disimpan.':'Cancel this appointment? Its history will be retained.'))e.preventDefault();}}>{bm?'Batalkan pelantikan':'Cancel appointment'}</button>}
  <p role="status" aria-live="polite">{state.message}</p>
 </form>;
}
