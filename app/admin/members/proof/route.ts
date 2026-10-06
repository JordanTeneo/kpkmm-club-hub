import {db,isAdmin,uuid} from '../../../../lib/shop';
import {enrolmentReady} from '../../../../lib/enrolment';
import {openRenewal} from '../../../../lib/renewals';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const privateHeaders={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
export async function GET(request:Request){
 if(!(await isAdmin()))return new Response('Unauthorised',{status:401,headers:privateHeaders});
 const id=new URL(request.url).searchParams.get('id')||'';
 if(!uuid(id))return new Response('Not found',{status:404,headers:privateHeaders});
 try{
  await enrolmentReady();const rows=await db()`SELECT proof,proof_type FROM club_enrolments WHERE application_id=${id}`;
  if(!rows[0]?.proof)return new Response('Not found',{status:404,headers:privateHeaders});
  const ext:Record<string,string>={'image/jpeg':'jpg','image/png':'png','application/pdf':'pdf'};
  if(!ext[rows[0].proof_type])throw Error('Invalid attachment');
  return new Response(new Uint8Array(Buffer.from(openRenewal(rows[0].proof),'base64')),{headers:{...privateHeaders,'Content-Type':rows[0].proof_type,'Content-Disposition':`attachment; filename="joining-payment-proof.${ext[rows[0].proof_type]}"`,'Content-Security-Policy':"default-src 'none'; sandbox"}});
 }catch{return new Response('Proof unavailable',{status:503,headers:privateHeaders});}
}
