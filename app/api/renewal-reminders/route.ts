import {timingSafeEqual} from 'node:crypto';
import {runReminders} from '../../../lib/renewal-reminders';
export const maxDuration=300;
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET,actual=request.headers.get('authorization')||'',expected='Bearer '+secret;
 if(!secret||secret.length<32||Buffer.byteLength(actual)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(actual),Buffer.from(expected)))return new Response('Unauthorised',{status:401});
 try{return Response.json(await runReminders());}catch{console.error('Renewal reminder job failed');return Response.json({error:'Job failed'},{status:500});}
}
