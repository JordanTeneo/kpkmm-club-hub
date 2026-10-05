import {db,uuid} from './shop';
import {CLUB_EMAIL,SITE_ORIGIN} from './gmail';
import {sendClubMessage,type MailState} from './renewals';
export async function membershipMailReady(){
 await db()`CREATE TABLE IF NOT EXISTS club_application_mail(application_id uuid PRIMARY KEY REFERENCES club_applications(id),status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sending','accepted','failed','unknown')),attempt_at timestamptz,mail_id text)`;
}
export function membershipMessage(id:string,test=false){
 if(!uuid(id))throw Error('Invalid application reference');
 const body=test?'This is a KPKMM new-membership notification test. No application was created. / Ini ujian pemberitahuan keahlian baharu KPKMM. Tiada permohonan dicipta.':`A new membership application needs your review. / Permohonan keahlian baharu memerlukan semakan anda.\n\nReference / Rujukan: ${id}\nReview privately / Semak secara sulit: ${SITE_ORIGIN}/admin/members/${id}\n\nSign in as a club administrator to view the applicant details. This is not confirmation of membership or payment. / Log masuk sebagai pentadbir kelab untuk melihat maklumat pemohon. Ini bukan pengesahan keahlian atau bayaran.`;
 const encoded=Buffer.from(body,'utf8').toString('base64').match(/.{1,76}/g)!.join('\r\n');
 return Buffer.from([`From: KPKMM <${CLUB_EMAIL}>`,`To: ${CLUB_EMAIL}`,`Subject: ${test?'TEST - ':''}KPKMM new membership application - ${id}`,`Message-ID: <membership-${id}@kpkmm-club-hub.vercel.app>`,`Date: ${new Date().toUTCString()}`,'MIME-Version: 1.0','Content-Type: text/plain; charset=utf-8','Content-Transfer-Encoding: base64','',encoded,''].join('\r\n')).toString('base64url');
}
export async function notifyMembership(id:string,allowUncertain=false):Promise<MailState>{
 if(!uuid(id))throw Error('Invalid application reference');
 const rows=await db()`UPDATE club_application_mail SET status='sending',attempt_at=now() WHERE application_id=${id} AND (status IN ('queued','failed') OR (${allowUncertain} AND (status='unknown' OR (status='sending' AND attempt_at<now()-interval '2 minutes')))) RETURNING application_id`;
 if(!rows.length)return 'sending';
 const sent=await sendClubMessage(membershipMessage(id));
 await db()`UPDATE club_application_mail SET status=${sent.state},mail_id=${sent.id||null} WHERE application_id=${id}`;
 return sent.state;
}
