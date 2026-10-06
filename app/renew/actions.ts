'use server';
import {randomUUID} from 'node:crypto';
import {headers} from 'next/headers';
import {revalidatePath} from 'next/cache';
import {db,readImage} from '../../lib/shop';
import {validateApplicant} from '../../lib/membership';
import {renewalEligibility,renewalMemberMatches} from '../../lib/roster';
import {renewalsReady,renewalLimit,renewalHash,sealRenewal,deliverRenewal} from '../../lib/renewals';
export type RenewalResult={error?:string;success?:string;reference?:string};
export async function requestRenewal(_:RenewalResult,form:FormData):Promise<RenewalResult>{
 if(form.get('consent')!=='yes'||form.get('website'))return {error:'Check the form and consent checkbox. / Semak borang dan persetujuan.'};
 let details;
 const currentYear=Number(new Intl.DateTimeFormat('en',{year:'numeric',timeZone:'Asia/Kuala_Lumpur'}).format(new Date()));
 const year=Number(form.get('year'));
 try{details={...validateApplicant(form,true),year};if(!Number.isInteger(year)||year<currentYear||year>currentYear+1)throw Error('year');}catch{return {error:'Check every field, including your IC/passport number and renewal year. / Semak setiap medan, termasuk nombor KP/pasport dan tahun pembaharuan.'};}
 let id:string|undefined;
 try{
  await renewalsReady();const h=await headers();const ip=h.get('x-vercel-forwarded-for')?.split(',')[0]||h.get('x-forwarded-for')?.split(',')[0]||'unknown';
  if(!(await renewalLimit('ip:'+ip,5))||!(await renewalLimit('email:'+details.email,3))||!(await renewalLimit('all',30)))return {error:'Too many requests. Please try again in an hour. / Terlalu banyak permintaan. Cuba lagi dalam sejam.'};
  const memberKey=details.identityType+':'+details.country.toLowerCase()+':'+details.identity;
  if(!(await renewalMemberMatches(details.name,memberKey,currentYear)))return {error:'Your name and MyKad/passport details do not match a registered member. Please use your registered full name or contact the committee to correct your record before renewing or paying. / Nama dan maklumat MyKad/pasport tidak sepadan dengan ahli berdaftar. Gunakan nama penuh berdaftar atau hubungi jawatankuasa untuk membetulkan rekod sebelum memperbaharui atau membayar.'};
  const eligibility=await renewalEligibility(memberKey,currentYear);
  if(eligibility!=='eligible')return {error:eligibility==='reinstate'?'Membership has lapsed for more than one year. Online renewal is unavailable. Contact the committee for manual reinstatement; your membership number is retained. Do not pay again. / Keahlian tidak aktif melebihi setahun. Hubungi jawatankuasa untuk pengaktifan semula secara manual. Nombor ahli dikekalkan. Jangan bayar lagi.':'Your last active year could not be verified. Contact the committee to update your record before renewing or paying. / Tahun aktif terakhir tidak dapat disahkan. Hubungi jawatankuasa untuk mengemas kini rekod sebelum memperbaharui atau membayar.'};
  const file=form.get('proof');if(!(file instanceof File))return {error:'Attach your payment proof. / Lampirkan bukti bayaran.'};
  let proof;try{proof=await readImage(file,true);}catch{return {error:'Use a JPG, PNG or PDF payment proof under 700 KB. / Gunakan bukti JPG, PNG atau PDF di bawah 700 KB.'};}
  const identityHash=renewalHash(details.identityType+':'+details.country.toLowerCase()+':'+details.identity);
  const rows=await db()`INSERT INTO club_renewals(id,identity_hash,renewal_year,payload,proof,proof_type) VALUES(${randomUUID()},${identityHash},${year},${sealRenewal(JSON.stringify(details))},${sealRenewal(proof.bytes.toString('base64'))},${proof.type}) ON CONFLICT(identity_hash,renewal_year) DO NOTHING RETURNING id`;
  id=rows[0]?.id;
 }catch{return {error:'We could not save your request. Please try again later or contact the club. / Permohonan tidak dapat disimpan. Cuba lagi nanti atau hubungi kelab.'};}
 if(!id)return {success:'A request for these membership details and year is already on file. Please contact the club to make changes; do not pay again. / Permohonan untuk maklumat keahlian dan tahun ini sudah direkodkan. Hubungi kelab untuk perubahan; jangan bayar lagi.'};
 let status='unknown';try{status=await deliverRenewal(id);}catch{}
 revalidatePath('/admin/renewals');
 return {reference:id,success:status==='accepted'?'Your renewal and payment proof were saved, and Gmail accepted the email to the club. Membership remains pending verification. / Permohonan dan bukti bayaran disimpan, dan Gmail menerima e-mel kepada kelab. Keahlian masih menunggu pengesahan.':'Your renewal and payment proof were saved for the club to review, but email delivery is not confirmed. Do not submit or pay again. / Permohonan dan bukti bayaran disimpan untuk semakan kelab, tetapi penghantaran e-mel belum disahkan. Jangan hantar atau bayar lagi.'};
}
