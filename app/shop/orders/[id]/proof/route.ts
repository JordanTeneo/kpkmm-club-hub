import { db,shopReady,isAdmin,ownsOrder,uuid } from '../../../../../lib/shop';
export const runtime='nodejs';
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  if(!uuid(id)||(!(await isAdmin())&&!(await ownsOrder(id))))return new Response('Not found',{status:404});
  await shopReady(); const [order]=await db()`SELECT receipt,receipt_type FROM shop_orders WHERE id=${id}`;
  if(!order?.receipt)return new Response('Not found',{status:404});
  const ext=order.receipt_type==='application/pdf'?'pdf':order.receipt_type==='image/png'?'png':'jpg';
  return new Response(new Uint8Array(order.receipt),{headers:{'Content-Type':order.receipt_type,'Content-Disposition':`attachment; filename="payment-proof.${ext}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
}
