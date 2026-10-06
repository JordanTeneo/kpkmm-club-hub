'use server';
import {headers} from 'next/headers';
import {revalidatePath} from 'next/cache';
import {db,isAdmin,readImage,uuid} from '../../lib/shop';
import {renewalLimit} from '../../lib/renewals';
import {approveApplication,approvePayment,reissuePayment,deliverEnrolment,enrolmentReady,savePayment,validPaymentToken} from '../../lib/enrolment';
import {getLanguage} from '../language';
type Result={error?:string;success?:string};
async function translator(){const bm=(await getLanguage())==='ms';return (en:string,ms:string)=>bm?ms:en;}
function refresh(id:string){for(const path of ['/admin/members','/admin/members/'+id,'/admin/members/roster','/membership-status'])revalidatePath(path);}
export async function reviewEnrolment(_:Result,form:FormData):Promise<Result>{
 const t=await translator();if(!(await isAdmin()))return {error:t('Please sign in again.','Sila log masuk semula.')};
 const id=String(form.get('id')||''),action=String(form.get('decision')||''),version=String(form.get('version')||'');
 if(!uuid(id))return {error:t('Invalid request.','Permohonan tidak sah.')};
 try{
  await enrolmentReady();if(!(await renewalLimit('enrolment-admin:'+id,30)))return {error:t('Too many attempts. Try again later.','Terlalu banyak percubaan. Cuba lagi nanti.')};
  let result:string;
  if(action==='application')result=await approveApplication(id,Number(form.get('membershipYear')),String(form.get('previous')));
  else if(action==='payment'){
   if(form.get('verified')!=='yes')return {error:t('Confirm that the bank payment has been verified.','Sahkan bahawa bayaran bank telah disemak.')};
   result=await approvePayment(id,version);
  }else if(action==='reissue')result=await reissuePayment(id,version);
  else if(action==='reject'){
   const rows=await db()`UPDATE club_applications SET status='rejected',membership_year=NULL,updated_at=now() WHERE id=${id} AND status='pending' AND NOT EXISTS(SELECT 1 FROM club_enrolments WHERE application_id=${id}) RETURNING id`;
   result=rows.length?'rejected':'changed';
  }else return {error:t('Invalid decision.','Keputusan tidak sah.')};
  const errors:Record<string,[string,string]>={changed:['The record changed. Refresh before reviewing again.','Rekod telah berubah. Muat semula sebelum menyemak.'],invalid:['Invalid request.','Permohonan tidak sah.'],prefix:['This address has no configured membership prefix. Contact the committee before activation.','Alamat ini tiada awalan nombor ahli. Hubungi jawatankuasa sebelum pengaktifan.'],duplicate:['This person is already in the member listing. Update or reinstate their existing membership instead.','Individu ini sudah tersenarai. Kemas kini atau pulihkan keahlian sedia ada.'],year:['The approved year is no longer current. Contact the committee; no member was created.','Tahun kelulusan bukan tahun semasa. Hubungi jawatankuasa; ahli belum diwujudkan.']};
  if(errors[result])return {error:t(...errors[result])};
  try{await deliverEnrolment(id);}catch{/* Decision remains saved. */}
  refresh(id);
  return {success:result==='rejected'?t('Application rejected. No member was created.','Permohonan ditolak. Ahli tidak diwujudkan.'):result==='activated'||result==='already'?t('Member activated. Check the welcome email status below.','Ahli diaktifkan. Semak status e-mel alu-aluan di bawah.'):t('Saved. Membership is not active yet. Check the payment invitation email status below.','Disimpan. Keahlian belum aktif. Semak status e-mel jemputan bayaran di bawah.')};
 }catch{return {error:t('Unable to complete this action. Refresh to check the saved status before trying again.','Tindakan tidak dapat diselesaikan. Muat semula untuk menyemak status sebelum mencuba lagi.')};}
}
export async function retryEnrolmentEmail(_:Result,form:FormData):Promise<Result>{
 const t=await translator();if(!(await isAdmin()))return {error:t('Please sign in again.','Sila log masuk semula.')};
 const id=String(form.get('id')||''),mail=String(form.get('mail')||'');
 if(!uuid(id)||!uuid(mail))return {error:t('Invalid request.','Permohonan tidak sah.')};
 try{await enrolmentReady();if(!(await renewalLimit('enrolment-admin:'+id,30)))throw Error('Rate limited');await deliverEnrolment(id,form.get('checked')==='yes',mail);refresh(id);return {success:t('Email status updated. Accepted means Gmail accepted the message, not guaranteed delivery.','Status e-mel dikemas kini. Diterima bermakna Gmail menerima mesej, bukan jaminan penghantaran.')};}
 catch{return {error:t('Unable to send. Check the club email setup and retry.','Tidak dapat menghantar. Semak tetapan e-mel kelab dan cuba lagi.')};}
}
export async function uploadJoiningProof(_:Result,form:FormData):Promise<Result>{
 const t=await translator(),token=String(form.get('token')||'');
 if(!validPaymentToken(token))return {error:t('Invalid payment link.','Pautan bayaran tidak sah.')};
 try{
  const h=await headers(),ip=h.get('x-vercel-forwarded-for')?.split(',')[0]||h.get('x-forwarded-for')?.split(',')[0]||'unknown';
  await enrolmentReady();
  if(!(await renewalLimit('join-proof-ip:'+ip,20))||!(await renewalLimit('join-proof:'+token,10)))return {error:t('Too many attempts. Try again in an hour.','Terlalu banyak percubaan. Cuba lagi dalam sejam.')};
  const file=form.get('proof');if(!(file instanceof File)||!file.size||file.size>700*1024)return {error:t('Choose a JPG, PNG or PDF no larger than 700 KB.','Pilih JPG, PNG atau PDF tidak melebihi 700 KB.')};
  let proof;try{proof=await readImage(file,true);}catch{return {error:t('Use a valid JPG, PNG or PDF under 700 KB.','Gunakan JPG, PNG atau PDF sah di bawah 700 KB.')};}
  const id=await savePayment(token,proof);if(id==='invalid')return {error:t('This link has expired, or proof has already been submitted. Refresh or contact the committee.','Pautan tamat tempoh atau bukti telah dihantar. Muat semula atau hubungi jawatankuasa.')};
  try{await deliverEnrolment(id);}catch{}
  revalidatePath('/join/payment/'+token);refresh(id);
  return {success:t('Payment proof received for committee verification. Your welcome email will include your membership number after approval.','Bukti bayaran diterima untuk pengesahan jawatankuasa. E-mel alu-aluan akan mengandungi nombor ahli selepas kelulusan.')};
 }catch{return {error:t('Unable to confirm the upload. Refresh to check whether it was saved before retrying, or contact the committee.','Tidak dapat mengesahkan muat naik. Muat semula untuk menyemak sebelum mencuba lagi atau hubungi jawatankuasa.')};}
}
