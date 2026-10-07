import {committeeAuth} from '../../../../lib/committee-auth';
// User administration is exposed only by the guarded Super Admin server actions.
const allowed=new Set(['sign-in/email','sign-out','get-session','change-password']);
async function handle(request:Request){
 const path=new URL(request.url).pathname.replace('/api/committee/','');
 if(!allowed.has(path))return new Response('Not found',{status:404});
 try{return await committeeAuth().handler(request);}catch{console.error('Committee authentication unavailable');return new Response('Sign in unavailable',{status:503});}
}
export const GET=handle,POST=handle;
