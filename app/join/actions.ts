'use server';
import {nameKey as searchNameKey} from '../../lib/roster';

import {randomUUID} from 'node:crypto';
import {headers} from 'next/headers';
import {revalidatePath} from 'next/cache';
import {db,isAdmin,uuid} from '../../lib/shop';
import {membershipReady,validateApplicant,seal,fingerprint,applicationLimit} from '../../lib/membership';
import {membershipMailReady,notifyMembership} from '../../lib/membership-mail';
export type ApplicationResult={error?:string;success?:string};
export async function requestMembership(_:ApplicationResult,form:FormData):Promise<ApplicationResult>{
 if(form.get('consent')!=='yes'||form.get('website'))return {error:'Check the form and consent checkbox. / Semak borang dan persetujuan.'};
 let applicant;try{applicant=validateApplicant(form,true);}catch{return {error:'Check all fields, including address, postcode, state and country. Malaysian postcodes must have 5 digits. MyKad must have 12 digits; passports need 5–20 letters/numbers. / Semak semua medan termasuk alamat, poskod, negeri dan negara. Poskod Malaysia mesti 5 digit. MyKad mesti 12 digit; pasport 5–20 huruf/nombor.'};}
 let savedId:string|undefined;
 try{await membershipReady();await membershipMailReady();const ip=(await headers()).get('x-vercel-forwarded-for')?.split(',')[0]||(await headers()).get('x-forwarded-for')?.split(',')[0]||'unknown';
 if(!(await applicationLimit(fingerprint('ip:'+ip)))||!(await applicationLimit(fingerprint('email:'+applicant.email))))return {error:'Too many requests. Try again in an hour. / Terlalu banyak permintaan. Cuba lagi dalam sejam.'};
 const identityHash=fingerprint(applicant.identityType+':'+applicant.country.toLowerCase()+':'+applicant.identity);
 const rows=await db()`WITH inserted AS (INSERT INTO club_applications(id,identity_hash,name_hash,payload) VALUES(${randomUUID()},${identityHash},${searchNameKey(applicant.name)},${seal(applicant)}) ON CONFLICT(identity_hash) DO NOTHING RETURNING id) INSERT INTO club_application_mail(application_id) SELECT id FROM inserted RETURNING application_id`;
 savedId=rows[0]?.application_id;
 }catch{return {error:'We could not submit your request. Please try again later. / Permohonan tidak dapat dihantar. Sila cuba lagi nanti.'};}
 if(savedId){try{await notifyMembership(savedId);}catch{/* The saved request and notification remain available to administrators. */}}
 revalidatePath('/admin/members');return {success:'Your request has been saved for review. The team is notified by email when delivery is available. If you already applied, your existing request is kept. This is not confirmation of membership. / Permohonan disimpan untuk semakan. Pasukan dimaklumkan melalui e-mel apabila penghantaran tersedia. Jika anda pernah memohon, permohonan asal dikekalkan. Ini bukan pengesahan keahlian.'};
}
export async function reviewMembership(_:ApplicationResult,form:FormData):Promise<ApplicationResult>{
 // Older browser tabs must not bypass the new payment-verification stage.
 return {error:'Refresh this page to use the new application and payment review steps. / Muat semula untuk menggunakan langkah semakan permohonan dan bayaran baharu.'};
}
