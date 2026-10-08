import {randomUUID} from 'node:crypto';
import {db,isAdmin,uuid} from './shop';
import {adminRosterReady,validYear} from './member-admin';
import {renewalsReady,openRenewal,sealRenewal} from './renewals';
import {membershipPaymentsReady,paymentActor,recordMembershipPayment,voidMembershipPayment,validPaymentDate} from './membership-payments';

// Approval and annual membership activation commit together, or neither does.
export async function reviewRenewal(id:string,status:string,paidOn=''){
 if(!(await isAdmin('membership')))throw Error('Unauthorised');
 if(!uuid(id)||!['pending','approved','rejected'].includes(status))return 'invalid';
 await adminRosterReady();await renewalsReady();await membershipPaymentsReady();
 const actor=await paymentActor();
 return db().begin(async sql=>{
  // Same lock order as member edits/imports, protecting IDs and annual records.
  await sql`LOCK TABLE club_member_roster IN SHARE ROW EXCLUSIVE MODE`;
  const requests=await sql`SELECT id,identity_hash,renewal_year,review_status,payload,proof,proof_type FROM club_renewals WHERE id=${id} FOR UPDATE`;
  const request=requests[0];if(!request)return 'invalid';
  if(status==='approved'&&request.review_status!=='approved'&&!validPaymentDate(paidOn))return 'invalid';
  const year=validYear(request.renewal_year);
  // New requests link to the member resolved on the server, including legacy records
  // with no identification number. Older requests keep their identity-based match.
  const registeredNumber=request.payload?JSON.parse(openRenewal(request.payload)).rosterMemberNumber:undefined;
  if(registeredNumber!==undefined&&(typeof registeredNumber!=='string'||!/^[A-Za-z0-9-]{1,30}$/.test(registeredNumber)))return 'invalid';
  const matches=registeredNumber
   ?await sql`SELECT DISTINCT ON(member_number) member_number,membership_year,name_hash,identity_hash,payload,active,status_override FROM club_member_roster WHERE member_number=${registeredNumber} AND membership_year<=${year} ORDER BY member_number,membership_year DESC`
   :await sql`SELECT DISTINCT ON(member_number) member_number,membership_year,name_hash,identity_hash,payload,active,status_override FROM club_member_roster WHERE identity_hash=${request.identity_hash} AND membership_year<=${year} ORDER BY member_number,membership_year DESC`;
  if(status==='approved'&&matches.length!==1)return matches.length?'ambiguous':'unmatched';
  const row=matches.length===1?matches[0]:undefined;
  if(row){
   const previous=JSON.parse(openRenewal(row.payload));
   const current=row.membership_year===year;
   if(status==='approved'&&previous.deceased)return 'ineligible';
   if(status==='approved'&&Number.isInteger(previous.lifetimeSince)&&previous.lifetimeSince<=year)return 'ineligible';
   if(status==='approved'&&current&&row.active&&previous.renewalActivation?.id!==id)return 'already-active';
   let next=previous,active=row.active,override=row.status_override,write=false;
   if(status==='approved'){
    if(!(request.review_status==='approved'&&current&&row.active&&previous.renewalActivation?.id===id)){
     const baseline=current&&previous.renewalActivation?.id===id&&!row.status_override?previous.renewalActivation:{id,active:current?row.active:false,override:current?row.status_override:false};
     next={...previous,active:true,renewalActivation:baseline};active=true;override=false;write=true;
    }
   }else if(current&&previous.renewalActivation?.id===id){
    // Reversing this approval must not erase a later manual status decision.
    if(!row.status_override){active=previous.renewalActivation.active;override=previous.renewalActivation.override;}
    next={...previous,active};delete next.renewalActivation;write=true;
   }
   if(write){
    const payload=sealRenewal(JSON.stringify(next));
    await sql`INSERT INTO club_roster_edits(id,member_number,membership_year,before_payload,after_payload,reason) VALUES(${randomUUID()},${row.member_number},${year},${sealRenewal(JSON.stringify({...row,newYear:!current}))},${payload},${sealRenewal('Renewal '+id+' review: '+status+'. Annual status only; membership ID and personal details preserved.')})`;
    await sql`INSERT INTO club_member_roster(member_number,membership_year,name_hash,identity_hash,payload,active,status_override) VALUES(${row.member_number},${year},${row.name_hash},${row.identity_hash},${payload},${active},${override}) ON CONFLICT(member_number,membership_year) DO UPDATE SET payload=excluded.payload,active=excluded.active,status_override=excluded.status_override,updated_at=now()`;
   }
  }
  if(status==='approved'&&request.review_status!=='approved'&&row){
   await recordMembershipPayment(sql,{kind:'renewal',sourceId:id,year,paidOn,name:JSON.parse(openRenewal(row.payload)).name,memberNumber:row.member_number,actor,proof:request.proof,proofType:request.proof_type});
   await sql`UPDATE club_renewals SET member_mail_status=CASE WHEN member_mail_status='not_queued' THEN 'queued' ELSE member_mail_status END WHERE id=${id}`;
  }else if(status!=='approved')await voidMembershipPayment(sql,'renewal',id,actor);
  await sql`UPDATE club_renewals SET review_status=${status} WHERE id=${id}`;
  return status==='approved'?'activated':'saved';
 });
}
