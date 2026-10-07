import 'server-only';
import {randomUUID} from 'node:crypto';
import {db,isAdmin} from './shop';
import {committeeEnabled,committeeSession} from './committee-access';
import {rosterReady} from './roster';
import {openRenewal} from './renewals';

import {roles,type Appointment} from './appointment-types';
let ready:Promise<void>|undefined;
async function appointmentReady(){
 if(!ready)ready=(async()=>{
  await db()`CREATE TABLE IF NOT EXISTS club_appointments(id uuid PRIMARY KEY,member_number text NOT NULL,display_name text NOT NULL,role text NOT NULL,role_en text NOT NULL,role_ms text NOT NULL,starts date NOT NULL,ends date NOT NULL CHECK(ends>=starts),cancelled boolean NOT NULL DEFAULT false,version integer NOT NULL DEFAULT 1)`;
  await db()`CREATE TABLE IF NOT EXISTS club_appointment_audit(id bigserial PRIMARY KEY,appointment_id uuid NOT NULL,actor text NOT NULL,operation text NOT NULL,created_at timestamptz NOT NULL DEFAULT now())`;
 })().catch(e=>{ready=undefined;throw e;});
 await ready;
}
export async function appointmentAdmin(){
 if(await committeeEnabled()){const session=await committeeSession();return session?.superAdmin?session.user.id:null;}
 return await isAdmin()?'legacy-owner':null;
}
export async function adminAppointments(){
 if(!await appointmentAdmin())throw Error('Unauthorised');
 await Promise.all([appointmentReady(),rosterReady()]);
 const [rows,members]=await Promise.all([db()`SELECT *,starts::text,ends::text FROM club_appointments ORDER BY starts DESC,role,display_name`,db()`SELECT DISTINCT ON(member_number) member_number,payload FROM club_member_roster ORDER BY member_number,membership_year DESC`]);
 return {rows:rows as unknown as Appointment[],members:members.flatMap(row=>{const m=JSON.parse(openRenewal(row.payload));return m.deceased?[]:[{number:row.member_number as string,name:String(m.name)}];})};
}
export async function publicAppointments(){
 await appointmentReady();
 // Deliberately project only public fields; never return member identifiers or contact details.
 return await db()`SELECT display_name,role,role_en,role_ms,starts::text,ends::text FROM club_appointments WHERE NOT cancelled AND starts<=(now() AT TIME ZONE 'Asia/Kuala_Lumpur')::date AND ends>=(now() AT TIME ZONE 'Asia/Kuala_Lumpur')::date ORDER BY CASE role WHEN 'chairman' THEN 1 WHEN 'vice-chairman' THEN 2 WHEN 'secretary' THEN 3 WHEN 'assistant-secretary' THEN 4 WHEN 'treasurer' THEN 5 ELSE 6 END,display_name`;
}
export async function saveAppointment(form:FormData){
 const actor=await appointmentAdmin();if(!actor)throw Error('access');
 await Promise.all([appointmentReady(),rosterReady()]);
 const id=String(form.get('id')||''),version=Number(form.get('version')),cancel=form.get('operation')==='cancel';
 if(id&&!/^[0-9a-f-]{36}$/i.test(id))throw Error('invalid');
 if(cancel&&!id)throw Error('invalid');
 const member=String(form.get('member')||''),role=String(form.get('role')||''),preset=roles.find(r=>r[0]===role);
 const en=role==='custom'?String(form.get('roleEn')||'').trim():preset?.[1]||'',ms=role==='custom'?String(form.get('roleMs')||'').trim():preset?.[2]||'';
 const starts=String(form.get('starts')||''),ends=String(form.get('ends')||'');
 const date=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number(v.slice(0,4))>=2000&&Number(v.slice(0,4))<=2200&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
 if(!cancel&&(!preset||!en||!ms||en.length>80||ms.length>80||!date(starts)||!date(ends)||ends<starts||form.get('publish')!=='yes'))throw Error('invalid');
 await db().begin(async sql=>{
  await sql`SELECT pg_advisory_xact_lock(742611)`;
  if(id){const old=await sql`SELECT version,cancelled FROM club_appointments WHERE id=${id}`;if(!old.length||old[0].cancelled||old[0].version!==version)throw Error('stale');}
  if(cancel){await sql`UPDATE club_appointments SET cancelled=true,version=version+1 WHERE id=${id}`;}
  else {
   const people=await sql`SELECT payload FROM club_member_roster WHERE member_number=${member} ORDER BY membership_year DESC LIMIT 1`;
   if(!people.length)throw Error('invalid');const person=JSON.parse(openRenewal(people[0].payload));if(person.deceased)throw Error('invalid');
   const overlaps=await sql`SELECT id FROM club_appointments WHERE NOT cancelled AND id<>${id||'00000000-0000-0000-0000-000000000000'}::uuid AND starts<=${ends}::date AND ends>=${starts}::date AND role=${role} AND (member_number=${member} OR ${!['committee','custom'].includes(role)})`;
   if(overlaps.length)throw Error('overlap');
   if(id)await sql`UPDATE club_appointments SET member_number=${member},display_name=${String(person.name)},role=${role},role_en=${en},role_ms=${ms},starts=${starts},ends=${ends},version=version+1 WHERE id=${id}`;
   else {const newId=randomUUID();await sql`INSERT INTO club_appointments(id,member_number,display_name,role,role_en,role_ms,starts,ends) VALUES(${newId},${member},${String(person.name)},${role},${en},${ms},${starts},${ends})`;await sql`INSERT INTO club_appointment_audit(appointment_id,actor,operation) VALUES(${newId},${actor},'created')`;}
  }
  if(id)await sql`INSERT INTO club_appointment_audit(appointment_id,actor,operation) VALUES(${id},${actor},${cancel?'cancelled':'updated'})`;
 });
}
