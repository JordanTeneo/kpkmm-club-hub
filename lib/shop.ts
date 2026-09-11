import postgres from 'postgres';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

let client: ReturnType<typeof postgres> | undefined;
export function db() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error('Marketplace storage is not configured.');
  return client ||= postgres(url, { ssl: 'require', max: 2, idle_timeout: 20, connect_timeout: 10, prepare: false });
}
let ready: Promise<void> | undefined;
export async function shopReady() {
  if (!ready) ready = (async () => {
    const sql = db();
    await sql`CREATE TABLE IF NOT EXISTS shop_products (id uuid PRIMARY KEY, name text NOT NULL, name_ms text NOT NULL DEFAULT '', description text NOT NULL DEFAULT '', description_ms text NOT NULL DEFAULT '', price integer NOT NULL CHECK(price > 0), stock integer NOT NULL CHECK(stock >= 0), active boolean NOT NULL DEFAULT false, image text NOT NULL DEFAULT '', updated_at timestamptz NOT NULL DEFAULT now())`;
    await sql`CREATE TABLE IF NOT EXISTS shop_orders (id uuid PRIMARY KEY, token_hash text NOT NULL, product_id uuid NOT NULL REFERENCES shop_products(id), product_name text NOT NULL, quantity integer NOT NULL CHECK(quantity > 0), unit_price integer NOT NULL CHECK(unit_price > 0), customer_name text NOT NULL, phone text NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','review','paid','cancelled')), receipt bytea, receipt_type text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`;
    await sql`CREATE TABLE IF NOT EXISTS shop_limits (key text PRIMARY KEY, count integer NOT NULL, expires_at timestamptz NOT NULL)`;
  })().catch(e => { ready = undefined; throw e; });
  await ready;
}
export type Product = { id: string; name: string; name_ms: string; description: string; description_ms: string; price: number; stock: number; active: boolean; image: string; updated_at: Date };
export type Order = { id: string; product_id: string; product_name: string; quantity: number; unit_price: number; customer_name: string; phone: string; status: string; created_at: Date; has_receipt: boolean };
export const money = (cents: number) => 'RM ' + (cents / 100).toFixed(2);
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export async function isAdmin() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  const raw = (await cookies()).get('kpkmm-admin')?.value;
  if (!secret || !raw) return false;
  const [expiry, signature] = raw.split('.');
  if (!expiry || !signature || Number(expiry) <= Date.now()) return false;
  const expected = createHmac('sha256', secret).update(expiry).digest('hex');
  return signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
export async function ownsOrder(id: string) {
  if (!uuid(id)) return false;
  const token = (await cookies()).get('shop-' + id)?.value;
  if (!token) return false;
  await shopReady();
  const rows = await db()`SELECT id FROM shop_orders WHERE id=${id} AND token_hash=${digest(token)}`;
  return rows.length > 0;
}
export async function limit(key: string, maximum: number) {
  const rows = await db()`INSERT INTO shop_limits (key,count,expires_at) VALUES (${key},1,now()+interval '1 hour') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN shop_limits.expires_at < now() THEN 1 ELSE shop_limits.count+1 END, expires_at=CASE WHEN shop_limits.expires_at < now() THEN now()+interval '1 hour' ELSE shop_limits.expires_at END RETURNING count`;
  if (rows[0].count > maximum) throw new Error('Too many attempts. Please try again in an hour. / Terlalu banyak percubaan. Cuba lagi dalam sejam.');
}
export async function readImage(file: File, allowPdf = false) {
  if (file.size === 0 || file.size > 700 * 1024) throw new Error('Choose a file under 700 KB. / Pilih fail di bawah 700 KB.');
  const bytes = Buffer.from(await file.arrayBuffer());
  const type = bytes.subarray(0,3).equals(Buffer.from([255,216,255])) ? 'image/jpeg' : bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png' : allowPdf && bytes.subarray(0,5).toString() === '%PDF-' ? 'application/pdf' : '';
  if (!type) throw new Error('Use JPG or PNG' + (allowPdf ? ' or PDF.' : '.') + ' / Gunakan JPG atau PNG' + (allowPdf ? ' atau PDF.' : '.'));
  return { bytes, type };
}
