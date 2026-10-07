import {db,isAdmin} from './shop';
import {enrolmentReady} from './enrolment';
export async function memberDashboard(){
 if(!(await isAdmin('membership')))throw Error('Unauthorised');
 await enrolmentReady();
 const [counts]=await db()`SELECT
  (SELECT count(*)::integer FROM club_renewals WHERE review_status='pending') AS renewals,
  (SELECT count(*)::integer FROM club_applications WHERE status='pending') AS applications,
  count(*) FILTER (WHERE stage='awaiting_payment')::integer AS awaiting_payment,
  count(*) FILTER (WHERE stage='proof_submitted')::integer AS awaiting_approval
  FROM club_enrolments`;
 return {renewals:counts.renewals,applications:counts.applications,awaitingPayment:counts.awaiting_payment,awaitingApproval:counts.awaiting_approval};
}
