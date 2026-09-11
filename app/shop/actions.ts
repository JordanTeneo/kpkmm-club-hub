'use server';
import { randomUUID } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db, shopReady, digest, uuid, isAdmin, ownsOrder, limit, readImage } from '../../lib/shop';
import { savePhoto } from '../../lib/club-data';

export type Result = { error?: string; success?: string };
const text = (form: FormData, key: string, max = 200) => String(form.get(key) || '').trim().slice(0,max);
const refresh = () => { revalidatePath('/shop'); revalidatePath('/admin/shop'); };
const failure = (e: unknown): Result => ({ error: e instanceof Error && !('severity' in e) ? e.message : 'Could not save. Please retry. / Tidak dapat disimpan. Sila cuba lagi.' });
async function orderCookie(id: string, token: string) { (await cookies()).set('shop-'+id,token,{ httpOnly:true, secure:process.env.NODE_ENV==='production', sameSite:'lax', path:'/shop', maxAge:60*60*24*90 }); }

export async function placeOrder(_: Result, form: FormData): Promise<Result> {
  const id=text(form,'id'), token=text(form,'token'), product=text(form,'product');
  try {
    if (!uuid(id) || !uuid(product) || !/^[a-f0-9]{64}$/.test(token)) throw new Error('Refresh and try again. / Muat semula dan cuba lagi.');
    const name=text(form,'name',100), phone=text(form,'phone',30), quantity=Number(form.get('quantity')), price=Number(form.get('price'));
    if (name.length<2 || !/^[+0-9 ()-]{7,30}$/.test(phone) || !Number.isInteger(quantity) || quantity<1 || quantity>20 || form.get('consent')!=='yes') throw new Error('Check your name, phone number and quantity. / Semak nama, nombor telefon dan kuantiti.');
    await shopReady();
    const ip=(await headers()).get('x-forwarded-for')?.split(',')[0] || 'unknown';
    await limit('orders:'+digest(ip),10);
    await db().begin(async sql => {
      await sql`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
      const existing=await sql`SELECT token_hash FROM shop_orders WHERE id=${id}`;
      if (existing.length) { if(existing[0].token_hash!==digest(token)) throw new Error('Please refresh the form.'); return; }
      const rows=await sql`SELECT * FROM shop_products WHERE id=${product} FOR UPDATE`;
      const p=rows[0];
      if(!p || !p.active || p.stock<quantity) throw new Error('Not enough stock. Refresh the shop. / Stok tidak mencukupi. Muat semula kedai.');
      if(p.price!==price) throw new Error('The price changed. Refresh before ordering. / Harga telah berubah. Muat semula sebelum menempah.');
      await sql`UPDATE shop_products SET stock=stock-${quantity},updated_at=now() WHERE id=${product}`;
      await sql`INSERT INTO shop_orders (id,token_hash,product_id,product_name,quantity,unit_price,customer_name,phone) VALUES (${id},${digest(token)},${product},${p.name},${quantity},${p.price},${name},${phone})`;
    });
    await orderCookie(id,token); refresh();
  } catch(e) { return failure(e); }
  redirect('/shop/orders/'+id);
}
export async function openOrder(_: Result, form: FormData): Promise<Result> {
  const id=text(form,'id'), token=text(form,'token');
  try {
    await shopReady(); const ip=(await headers()).get('x-forwarded-for')?.split(',')[0] || 'unknown'; await limit('lookup:'+digest(ip),30);
    if (!uuid(id) || !/^[a-f0-9]{64}$/.test(token)) throw new Error('Invalid reference or access code. / Rujukan atau kod akses tidak sah.');
    const rows=await db()`SELECT id FROM shop_orders WHERE id=${id} AND token_hash=${digest(token)}`;
    if(!rows.length) throw new Error('Invalid reference or access code. / Rujukan atau kod akses tidak sah.');
    await orderCookie(id,token);
  } catch(e) { return failure(e); }
  redirect('/shop/orders/'+id);
}
export async function uploadReceipt(_: Result, form: FormData): Promise<Result> {
  try {
    const id=text(form,'id'); if(!(await ownsOrder(id))) throw new Error('Open your order again using its access code. / Buka tempahan menggunakan kod akses.');
    const file=form.get('receipt'); if(!(file instanceof File)) throw new Error('Choose payment proof. / Pilih bukti bayaran.');
    const {bytes,type}=await readImage(file,true);
    await limit('receipt:'+id,20);
    const rows=await db()`UPDATE shop_orders SET receipt=${bytes},receipt_type=${type},status='review',updated_at=now() WHERE id=${id} AND status IN ('pending','review') RETURNING id`;
    if(!rows.length) throw new Error('This order is already paid or cancelled. / Tempahan telah dibayar atau dibatalkan.');
    revalidatePath('/shop/orders/'+id); refresh(); return {success:'Proof submitted for review. / Bukti dihantar untuk semakan.'};
  } catch(e) { return failure(e); }
}
export async function saveProduct(_: Result, form: FormData): Promise<Result> {
  try {
    if(!(await isAdmin())) throw new Error('Please sign in as admin. / Sila log masuk sebagai pentadbir.');
    await shopReady(); const id=text(form,'id')||randomUUID(); if(!uuid(id)) throw new Error('Invalid product.');
    const name=text(form,'name'), nameMs=text(form,'name_ms'), description=text(form,'description',2000), descriptionMs=text(form,'description_ms',2000);
    const priceText=text(form,'price'); const price=Math.round(Number(priceText)*100), stock=Number(form.get('stock')), active=form.get('active')==='yes';
    if(!name || !/^\d+(\.\d{1,2})?$/.test(priceText) || !Number.isSafeInteger(price) || price<1 || price>1000000 || !Number.isInteger(stock) || stock<0 || stock>100000) throw new Error('Check product name, price and stock. / Semak nama produk, harga dan stok.');
    const file=form.get('image'); let image='';
    if(file instanceof File && file.size) { const valid=await readImage(file); image=(await savePhoto(new File([new Uint8Array(valid.bytes)],randomUUID()+'.'+(valid.type==='image/png'?'png':'jpg'),{type:valid.type}))).url; }
    await db().begin(async sql => {
      const rows=await sql`SELECT * FROM shop_products WHERE id=${id} FOR UPDATE`;
      if(rows.length) {
        if(rows[0].updated_at.toISOString()!==text(form,'version')) throw new Error('Stock or product changed. Refresh before saving. / Stok atau produk telah berubah. Muat semula sebelum menyimpan.');
        await sql`UPDATE shop_products SET name=${name},name_ms=${nameMs},description=${description},description_ms=${descriptionMs},price=${price},stock=${stock},active=${active},image=${image||rows[0].image},updated_at=now() WHERE id=${id}`;
      } else await sql`INSERT INTO shop_products(id,name,name_ms,description,description_ms,price,stock,active,image) VALUES(${id},${name},${nameMs},${description},${descriptionMs},${price},${stock},${active},${image})`;
    });
    refresh(); return {success:'Product saved. / Produk disimpan.'};
  } catch(e) { return failure(e); }
}
export async function updateOrder(_: Result, form: FormData): Promise<Result> {
  try {
    if(!(await isAdmin())) throw new Error('Please sign in as admin. / Sila log masuk sebagai pentadbir.');
    await shopReady(); const id=text(form,'id'), status=text(form,'status');
    if(!uuid(id)||!['paid','cancelled','pending'].includes(status)) throw new Error('Invalid order status.');
    await db().begin(async sql => {
      const rows=await sql`SELECT * FROM shop_orders WHERE id=${id} FOR UPDATE`; const order=rows[0];
      if(!order || ['paid','cancelled'].includes(order.status)) throw new Error('This order is already finalised. / Tempahan ini telah dimuktamadkan.');
      if(status==='paid' && !order.receipt) throw new Error('Payment proof is required before confirmation. / Bukti bayaran diperlukan sebelum pengesahan.');
      if(status==='cancelled') await sql`UPDATE shop_products SET stock=stock+${order.quantity},updated_at=now() WHERE id=${order.product_id}`;
      await sql`UPDATE shop_orders SET status=${status},updated_at=now() WHERE id=${id}`;
    });
    refresh(); revalidatePath('/shop/orders/'+id); return {success:'Order updated. / Tempahan dikemas kini.'};
  } catch(e) { return failure(e); }
}
