import {openRenewal} from './renewals';
import {invoiceNumber} from './membership-payments';
import {membershipInvoicePdf} from './membership-invoice-pdf';
export const paymentPrivateHeaders={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
export async function invoiceResponse(row:any,bm:boolean){
 const person=JSON.parse(openRenewal(row.payload)),number=invoiceNumber(row);
 const pdf=await membershipInvoicePdf({quote:person.quote,number,name:person.name,memberNumber:person.memberNumber,year:row.membership_year,paidOn:row.paid_on,approvedAt:row.approved_at,amount:row.amount,adminFee:row.admin_fee,voided:!!row.voided_at},bm);
 return new Response(new Uint8Array(pdf),{headers:{...paymentPrivateHeaders,'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${number}.pdf"`}});
}
