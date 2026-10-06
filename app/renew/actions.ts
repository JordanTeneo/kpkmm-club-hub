'use server';
import {randomUUID} from 'node:crypto';
import {headers} from 'next/headers';
import {revalidatePath} from 'next/cache';
import {db,readImage} from '../../lib/shop';
import {findRenewalMember,renewalLookup} from '../../lib/renewal-member';
import {renewalsReady,renewalLimit,sealRenewal,deliverRenewal} from '../../lib/renewals';
import {getLanguage} from '../language';
export type RenewalResult={error?:string;success?:string;reference?:string};
export async function requestRenewal(_:RenewalResult,form:FormData):Promise<RenewalResult>{
 if(form.get('consent')!=='yes'||form.get('website'))return {error:'Check the form and consent checkbox. / Semak borang dan persetujuan.'};
 const bm=(await getLanguage())==='ms',t=(en:string,ms:string)=>bm?ms:en;
 let lookup;
 const currentYear=Number(new Intl.DateTimeFormat('en',{year:'numeric',timeZone:'Asia/Kuala_Lumpur'}).format(new Date()));
 const year=Number(form.get('year'));
 try{lookup=renewalLookup(form);if(!Number.isInteger(year)||year<currentYear||year>currentYear+1)throw Error('year');}catch{return {error:t('Enter your registered name or MyKad/passport number and choose a valid renewal year.','Masukkan nama berdaftar atau nombor MyKad/pasport dan pilih tahun pembaharuan yang sah.')};}
 let id:string|undefined;
 try{
  await renewalsReady();const h=await headers();const ip=h.get('x-vercel-forwarded-for')?.split(',')[0]||h.get('x-forwarded-for')?.split(',')[0]||'unknown';
  if(!(await renewalLimit('ip:'+ip,5))||!(await renewalLimit('all',30)))return {error:'Too many requests. Please try again in an hour. / Terlalu banyak permintaan. Cuba lagi dalam sejam.'};
  const match=await findRenewalMember(lookup,currentYear,year);
  if(match.status==='missing')return {error:t('No matching registered member was found. Renewal is not allowed. Check your full registered name or MyKad/passport number, or contact the committee.','Tiada ahli berdaftar yang sepadan ditemui. Pembaharuan tidak dibenarkan. Semak nama penuh berdaftar atau nombor MyKad/pasport, atau hubungi jawatankuasa.')};
  if(match.status==='ambiguous')return {error:lookup.mode==='name'?t('This name cannot identify one member. Please use your MyKad/passport number instead, or contact the committee.','Nama ini tidak dapat mengenal pasti seorang ahli sahaja. Sila gunakan nombor MyKad/pasport atau hubungi jawatankuasa.'):t('These identification details cannot identify one member. Contact the committee before renewing.','Maklumat pengenalan ini tidak dapat mengenal pasti seorang ahli sahaja. Hubungi jawatankuasa sebelum memperbaharui.')};
  if(match.status!=='eligible')return {error:match.status==='reinstate'?'Membership has lapsed for more than one year. Online renewal is unavailable. Contact the committee for manual reinstatement; your membership number is retained. Do not pay again. / Keahlian tidak aktif melebihi setahun. Hubungi jawatankuasa untuk pengaktifan semula secara manual. Nombor ahli dikekalkan. Jangan bayar lagi.':'Your last active year could not be verified. Contact the committee to update your record before renewing or paying. / Tahun aktif terakhir tidak dapat disahkan. Hubungi jawatankuasa untuk mengemas kini rekod sebelum memperbaharui atau membayar.'};
  const {details,identityHash}=match;
  if(!(await renewalLimit('member:'+details.rosterMemberNumber,3)))return {error:'Too many requests. Please try again in an hour. / Terlalu banyak permintaan. Cuba lagi dalam sejam.'};
  const file=form.get('proof');if(!(file instanceof File))return {error:'Attach your payment proof. / Lampirkan bukti bayaran.'};
  let proof;try{proof=await readImage(file,true);}catch{return {error:'Use a JPG, PNG or PDF payment proof under 700 KB. / Gunakan bukti JPG, PNG atau PDF di bawah 700 KB.'};}
  const rows=await db()`INSERT INTO club_renewals(id,identity_hash,renewal_year,payload,proof,proof_type) VALUES(${randomUUID()},${identityHash},${year},${sealRenewal(JSON.stringify(details))},${sealRenewal(proof.bytes.toString('base64'))},${proof.type}) ON CONFLICT(identity_hash,renewal_year) DO NOTHING RETURNING id`;
  id=rows[0]?.id;
 }catch{return {error:'We could not save your request. Please try again later or contact the club. / Permohonan tidak dapat disimpan. Cuba lagi nanti atau hubungi kelab.'};}
 if(!id)return {success:'A request for these membership details and year is already on file. Please contact the club to make changes; do not pay again. / Permohonan untuk maklumat keahlian dan tahun ini sudah direkodkan. Hubungi kelab untuk perubahan; jangan bayar lagi.'};
 let status='unknown';try{status=await deliverRenewal(id);}catch{}
 revalidatePath('/admin/renewals');
 return {reference:id,success:status==='accepted'?'Your renewal and payment proof were saved, and Gmail accepted the email to the club. Membership remains pending verification. / Permohonan dan bukti bayaran disimpan, dan Gmail menerima e-mel kepada kelab. Keahlian masih menunggu pengesahan.':'Your renewal and payment proof were saved for the club to review, but email delivery is not confirmed. Do not submit or pay again. / Permohonan dan bukti bayaran disimpan untuk semakan kelab, tetapi penghantaran e-mel belum disahkan. Jangan hantar atau bayar lagi.'};
}
