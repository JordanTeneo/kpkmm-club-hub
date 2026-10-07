import {revalidatePath} from 'next/cache';
import {appointmentAdmin,adminAppointments,saveAppointment} from '../../../lib/appointments';
import {getLanguage} from '../../language';
import {AppointmentForm,type Result} from './form';
import {appointmentTitle} from '../../../lib/appointment-types';
export const dynamic='force-dynamic';
async function save(_state:Result,form:FormData):Promise<Result>{
 'use server';
 const bm=await getLanguage()==='ms';
 try{await saveAppointment(form);}catch(error){
  const code=error instanceof Error?error.message:'';
  return {ok:false,message:code==='overlap'?(bm?'Jawatan ini sudah diisi. Ubah atau batalkan pelantikan semasa dahulu.':'This role is already assigned. Edit or cancel the current appointment first.'):code==='stale'?(bm?'Rekod telah berubah. Muat semula halaman.':'This record has changed. Reload the page.'):code==='access'?(bm?'Kebenaran pelantikan jawatankuasa diperlukan.':'Committee appointments permission is required.'):code==='invalid'?(bm?'Semak ahli, jawatan dan pengesahan penerbitan.':'Check the member, role and publication confirmation.'):(bm?'Tidak dapat menyimpan. Sila cuba lagi.':'Could not save. Please try again.')};
 }
 revalidatePath('/about');revalidatePath('/admin/appointments');
 return {ok:true,message:bm?'Pelantikan telah disimpan.':'Appointment saved.'};
}
export default async function Appointments(){
 const bm=await getLanguage()==='ms';
 if(!await appointmentAdmin())return <main style={{padding:32}}><h1>{bm?'Pelantikan jawatankuasa':'Committee appointments'}</h1><p>{bm?'Minta Super Admin memberikan kebenaran pelantikan jawatankuasa kepada akaun anda.':'Ask a Super Admin to grant Committee appointments permission to your account.'}</p><a href="/admin/sign-in">{bm?'Log masuk':'Sign in'}</a></main>;
 const {rows,members}=await adminAppointments();
 return <main className="appointments"><h1>{bm?'Pelantikan jawatankuasa':'Committee appointments'}</h1><p>{bm?'Pilih ahli dan jawatan. Pelantikan kekal sehingga diubah atau dibatalkan oleh pentadbir yang diberi kebenaran. Pelantikan semasa dipaparkan di Tentang Kami. Pelantikan tidak memberikan akses pentadbir.':'Choose a member and role. Appointments remain current until changed or cancelled by an authorised administrator. Current appointments appear on About Us. An appointment does not grant admin access.'}</p><a href="/about#committee">{bm?'Lihat halaman awam ↗':'View public section ↗'}</a>
  <details className="appointment-card"><summary>{bm?'＋ Pelantikan baharu':'＋ New appointment'}</summary><AppointmentForm bm={bm} members={members} action={save}/></details>
  <h2>{bm?'Pelantikan dan sejarah':'Appointments & history'}</h2>{!rows.length&&<p>{bm?'Belum ada pelantikan.':'No appointments yet.'}</p>}
  {rows.map(item=><details className="appointment-card" key={item.id}><summary><strong>{item.display_name}</strong> — {item.is_current&&!item.cancelled?appointmentTitle(item,bm):bm?item.role_ms:item.role_en}<br/><small>{item.cancelled?(bm?'Dibatalkan':'Cancelled'):item.is_current?(bm?'Semasa':'Current'):(bm?'Sejarah':'Historical')}</small></summary>{!item.cancelled?<AppointmentForm key={item.version} bm={bm} members={members} item={item} action={save}/>:<p>{bm?'Disimpan untuk sejarah.':'Retained for history.'}</p>}</details>)}
  <style>{`.appointments{max-width:960px;margin:40px auto;padding:0 20px}.appointment-card{margin:20px 0;padding:20px;background:#fff8e9;border:1px solid #d5bd91;border-radius:16px}.appointment-card summary{cursor:pointer;line-height:1.7}.appointment-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;margin-top:22px}.appointment-form label{display:grid;gap:8px}.appointment-form input:not([type=checkbox]),.appointment-form select{width:100%;min-width:0;padding:12px;border:1px solid #bda17a;border-radius:8px;background:white;color:#35251c}.appointment-form .publication{display:flex;align-items:start;grid-column:1/-1}.appointment-form button{padding:12px;border-radius:8px;background:#39271c;color:#fff8e9;cursor:pointer}.appointment-form button:disabled{opacity:.6}.appointment-form p{grid-column:1/-1}@media(max-width:600px){.appointment-form{grid-template-columns:1fr}}`}</style>
 </main>;
}
