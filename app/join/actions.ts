'use server';
import {randomUUID} from 'node:crypto';
import {headers} from 'next/headers';
import {revalidatePath} from 'next/cache';
import {db,isAdmin,uuid} from '../../lib/shop';
import {membershipReady,validateApplicant,seal,fingerprint,applicationLimit} from '../../lib/membership';
export type ApplicationResult={error?:string;success?:string};
export async function requestMembership(_:ApplicationResult,form:FormData):Promise<ApplicationResult>{
 if(form.get('consent')!=='yes'||form.get('website'))return {error:'Check the form and consent checkbox. / Semak borang dan persetujuan.'};
 let applicant;try{applicant=validateApplicant(form);}catch{return {error:'Check all fields. MyKad must have 12 digits; passports need 5–20 letters/numbers. / Semak semua maklumat. MyKad mesti 12 digit; pasport 5–20 huruf/nombor.'};}
 try{await membershipReady();const ip=(await headers()).get('x-vercel-forwarded-for')?.split(',')[0]||(await headers()).get('x-forwarded-for')?.split(',')[0]||'unknown';
 if(!(await applicationLimit(fingerprint('ip:'+ip)))||!(await applicationLimit(fingerprint('email:'+applicant.email))))return {error:'Too many requests. Try again in an hour. / Terlalu banyak permintaan. Cuba lagi dalam sejam.'};
 const identityHash=fingerprint(applicant.identityType+':'+applicant.country.toLowerCase()+':'+applicant.identity);
 await db()`INSERT INTO club_applications(id,identity_hash,payload) VALUES(${randomUUID()},${identityHash},${seal(applicant)}) ON CONFLICT(identity_hash) DO NOTHING`;
 revalidatePath('/admin/members');return {success:'Your request has been received for review. If you already applied, your existing request is kept. This is not confirmation of membership. / Permohonan diterima untuk semakan. Jika anda pernah memohon, permohonan asal dikekalkan. Ini bukan pengesahan keahlian.'};
 }catch{return {error:'We could not submit your request. Please try again later. / Permohonan tidak dapat dihantar. Sila cuba lagi nanti.'};}
}
export async function reviewMembership(_:ApplicationResult,form:FormData):Promise<ApplicationResult>{
 if(!(await isAdmin()))return {error:'Please sign in again. / Sila log masuk semula.'};
 const id=String(form.get('id')||''),status=String(form.get('status')||''),previous=String(form.get('previous')||'');
 if(!uuid(id)||!['pending','approved','rejected'].includes(status)||!['pending','approved','rejected'].includes(previous))return {error:'Invalid request.'};
 try{await membershipReady();const result=await db()`UPDATE club_applications SET status=${status},updated_at=now() WHERE id=${id} AND status=${previous} RETURNING id`;if(!result.length)return {error:'This request changed. Refresh and try again.'};revalidatePath('/admin/members');revalidatePath('/admin/members/'+id);return {success:'Review status saved. Contact the applicant directly; no automatic email is sent. / Status disimpan. Hubungi pemohon secara terus; tiada e-mel automatik dihantar.'};}catch{return {error:'Unable to save. Please try again.'};}
}
