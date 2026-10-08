import {db,isAdmin,uuid} from '../../../../lib/shop';
import {membershipPaymentsReady} from '../../../../lib/membership-payments';
import {openRenewal} from '../../../../lib/renewals';
import {invoiceResponse,paymentPrivateHeaders} from '../../../../lib/membership-invoice-response';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!await isAdmin('membership'))return new Response('Not authorised',{status:403,headers:paymentPrivateHeaders});
 const {id}=await params;if(!uuid(id))return new Response('Not found',{status:404,headers:paymentPrivateHeaders});
 await membershipPaymentsReady();
 const row=(await db()`SELECT *,paid_on::text AS paid_on FROM club_membership_payments WHERE id=${id}`)[0];
 if(!row)return new Response('Not found',{status:404,headers:paymentPrivateHeaders});
 const q=new URL(request.url).searchParams;
 if(q.get('file')==='receipt'){
  const ext=({'image/jpeg':'jpg','image/png':'png','application/pdf':'pdf'} as Record<string,string>)[row.proof_type];if(!ext)return new Response('Unavailable',{status:404,headers:paymentPrivateHeaders});
  return new Response(new Uint8Array(Buffer.from(openRenewal(row.proof),'base64')),{headers:{...paymentPrivateHeaders,'Content-Type':row.proof_type,'Content-Disposition':`attachment; filename="payment-${id}.${ext}"`}});
 }
 return invoiceResponse(row,q.get('lang')==='ms');
}
