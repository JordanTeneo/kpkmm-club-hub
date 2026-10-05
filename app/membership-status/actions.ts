'use server';
import {headers} from 'next/headers';
import {membershipReady,applicationLimit,fingerprint} from '../../lib/membership';
import {lookupMembership,validateLookup,type MembershipStatus} from '../../lib/member-status';
export type CheckResult={error?:string;membership?:MembershipStatus};
export async function checkMembership(_:CheckResult,form:FormData):Promise<CheckResult>{
 if(form.get('website'))return {error:'Unable to check. / Tidak dapat menyemak.'};
 let input;try{input=validateLookup(form);}catch{return {error:'Enter a valid 12-digit MyKad number. / Masukkan nombor MyKad 12 digit yang sah.'};}
 try{
  await membershipReady();const h=await headers(),ip=h.get('x-vercel-forwarded-for')?.split(',')[0]||h.get('x-forwarded-for')?.split(',')[0]||'unknown';
  if(!(await applicationLimit(fingerprint('status-ip:'+ip)))||!(await applicationLimit(fingerprint('status-identity:'+input.identityKey))))return {error:'Too many checks. Try again in an hour or contact the club. / Terlalu banyak semakan. Cuba lagi dalam sejam atau hubungi kelab.'};
  return {membership:await lookupMembership(input.identityKey)};
 }catch{return {error:'Status is temporarily unavailable. This does not mean your membership has expired. Please contact the club. / Status tidak tersedia buat sementara waktu. Ini tidak bermakna keahlian anda tamat. Sila hubungi kelab.'};}
}
