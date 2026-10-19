import {timingSafeEqual} from 'node:crypto';
import {runReminders} from '../../../lib/renewal-reminders';
import {runCampaigns} from '../../../lib/reminder-campaigns';
export const maxDuration=300;
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET,actual=request.headers.get('authorization')||'',expected='Bearer '+secret;
 if(!secret||secret.length<32||Buffer.byteLength(actual)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(actual),Buffer.from(expected)))return new Response('Unauthorised',{status:401});
 try{const now=new Date(),deadline=Date.now()+240000;const campaigns=await runCampaigns(now,deadline);const recurring=await runReminders(now,deadline);return Response.json({...recurring,campaigns});}catch{console.error('Renewal reminder job failed');return Response.json({error:'Job failed'},{status:500});}
}
