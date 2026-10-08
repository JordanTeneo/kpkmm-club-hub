import {isAdmin,ownsOrder,uuid} from '../../../../../lib/shop';
import {shopInvoice} from '../../../../../lib/shop-invoices';
import {shopInvoicePdf} from '../../../../../lib/shop-invoice-pdf';
export const dynamic='force-dynamic';
const privateHeaders={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!uuid(id)||!(await ownsOrder(id)||await isAdmin('shop')))return new Response('Open your private order using its reference and access code to download the invoice. / Buka tempahan sulit dengan rujukan dan kod akses untuk memuat turun invois.',{status:404,headers:privateHeaders});
 const invoice=await shopInvoice(id);if(!invoice)return new Response('Invoice unavailable / Invois tidak tersedia',{status:404,headers:privateHeaders});
 const lang=new URL(request.url).searchParams.get('lang'),bm=lang?lang==='ms':invoice.order.language==='ms';
 return new Response(new Uint8Array(await shopInvoicePdf(invoice,bm)),{headers:{...privateHeaders,'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${invoice.number}.pdf"`}});
}
