import {db} from '../../../lib/shop';
import {membershipPaymentsReady} from '../../../lib/membership-payments';
import {renewalHash} from '../../../lib/renewals';
import {invoiceResponse,paymentPrivateHeaders} from '../../../lib/membership-invoice-response';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{token:string}>}){
 const {token}=await params;
 if(!/^[a-f0-9]{64}$/.test(token))return new Response('Not found',{status:404,headers:paymentPrivateHeaders});
 await membershipPaymentsReady();
 const row=(await db()`SELECT invoice_sequence,payload,membership_year,paid_on::text,amount,admin_fee,approved_at FROM club_membership_payments WHERE token_hash=${renewalHash('invoice:'+token)} AND voided_at IS NULL`)[0];
 if(!row)return new Response('Not found',{status:404,headers:paymentPrivateHeaders});
 return invoiceResponse(row,new URL(request.url).searchParams.get('lang')==='ms');
}
