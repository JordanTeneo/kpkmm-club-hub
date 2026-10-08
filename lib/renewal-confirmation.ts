import {db,uuid} from './shop';
import {renewalsReady,openRenewal,sendClubMessage} from './renewals';
import {enrolmentMessage} from './enrolment';
import {paymentInvoiceLink} from './membership-payments';
export function renewalConfirmation(email:string,name:string,number:string,year:number,invoiceLink?:string){
 return enrolmentMessage(email,'KPKMM — membership renewed / Keahlian diperbaharui',`Dear / Salam ${name},\n\nThank you for renewing your KPKMM membership. The committee has verified your payment.\nTerima kasih kerana memperbaharui keahlian KPKMM. Jawatankuasa telah mengesahkan bayaran anda.\n\nMembership number / Nombor ahli: ${number}\nMembership year / Tahun keahlian: ${year}\nValid until / Sah sehingga: 31 December / Disember ${year}\n\nYour membership number remains unchanged. We look forward to seeing you at our club activities!\nNombor ahli anda dikekalkan. Kami berharap dapat bertemu anda dalam aktiviti kelab!${invoiceLink?"\n\nPaid invoice / Invois berbayar (private / sulit):\n"+invoiceLink+"\nDo not forward this link. / Jangan kongsi pautan ini.":""}\n\nSmall Cars, Big Spirit!\nKPKMM Committee / Jawatankuasa KPKMM`);
}
// Only newly approved renewals are queued. Historical imports never call this.
export async function deliverRenewalConfirmation(id:string){
 if(!uuid(id))return 'invalid';
 await renewalsReady();
 const claimed=await db()`UPDATE club_renewals SET member_mail_status='sending' WHERE id=${id} AND review_status='approved' AND member_mail_status IN ('queued','failed') RETURNING payload,renewal_year`;
 if(!claimed.length)return 'unchanged';
 let state='unknown';
 try{
  const detail=JSON.parse(openRenewal(claimed[0].payload));
  const rows=await db()`SELECT payload FROM club_member_roster WHERE member_number=${detail.rosterMemberNumber||''} ORDER BY membership_year DESC LIMIT 1`;
  if(!rows.length)state='skipped';
  else{
   const member=JSON.parse(openRenewal(rows[0].payload));
   if(member.deceased||!member.email)state='skipped';
   else{
    const invoiceLink=await paymentInvoiceLink('renewal',id);
    let raw;try{raw=renewalConfirmation(member.email,member.name,detail.rosterMemberNumber,claimed[0].renewal_year,invoiceLink);}catch{state='skipped';}
    if(raw)state=(await sendClubMessage(raw)).state;
   }
  }
 }catch{/* Unknown sends are never retried automatically. */}
 await db()`UPDATE club_renewals SET member_mail_status=${state} WHERE id=${id} AND member_mail_status='sending'`;
 return state;
}
