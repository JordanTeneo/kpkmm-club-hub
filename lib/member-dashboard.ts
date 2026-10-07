import {db,isAdmin} from './shop';
import {enrolmentReady} from './enrolment';
export async function memberDashboard(){
 if(!(await isAdmin('membership')))throw Error('Unauthorised');
 await enrolmentReady();
 const [renewals,applications,stages]=await Promise.all([
  db()`SELECT count(*)::integer AS count FROM club_renewals WHERE review_status='pending'`,
  db()`SELECT count(*)::integer AS count FROM club_applications WHERE status='pending'`,
  db()`SELECT stage,count(*)::integer AS count FROM club_enrolments GROUP BY stage`
 ]);
 return {renewals:renewals[0].count,applications:applications[0].count,awaitingPayment:stages.find(r=>r.stage==='awaiting_payment')?.count||0,awaitingApproval:stages.find(r=>r.stage==='proof_submitted')?.count||0};
}
