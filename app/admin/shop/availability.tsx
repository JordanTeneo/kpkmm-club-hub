import {marketplaceEnabled,shopSettingsReady} from '../../../lib/shop-settings';
import {db,isAdmin} from '../../../lib/shop';
import {revalidatePath} from 'next/cache';
import {ShopForm} from '../../shop/forms';
import type {Result} from '../../shop/actions';

export async function saveMarketplaceAvailability(_:Result,form:FormData):Promise<Result>{
 'use server';
 if(!(await isAdmin('shop')))return {error:'Please sign in as admin. / Sila log masuk sebagai pentadbir.'};
 const value=form.get('enabled');
 if(value!=='true'&&value!=='false')return {error:'Invalid setting. / Tetapan tidak sah.'};
 try{
  await shopSettingsReady();
  await db()`UPDATE shop_settings SET enabled=${value==='true'},updated_at=now() WHERE id=1`;
  revalidatePath('/shop');revalidatePath('/admin/shop');revalidatePath('/','layout');
  return {success:value==='true'?'Marketplace enabled. / Kedai diaktifkan.':'Marketplace disabled. Existing orders are retained. / Kedai dinyahaktifkan. Tempahan sedia ada dikekalkan.'};
 }catch{return {error:'Could not save. Please retry. / Tidak dapat disimpan. Sila cuba lagi.'};}
}
export async function MarketplaceAvailability({bm}:{bm:boolean}){
 if(!(await isAdmin('shop')))return null;
 const enabled=await marketplaceEnabled(),t=(en:string,ms:string)=>bm?ms:en;
 return <section className="shop-card"><h2>{t('Marketplace availability','Ketersediaan kedai')}</h2><p><strong>{enabled?t('Enabled — accepting new orders','Aktif — menerima tempahan baharu'):t('Disabled — closed to new orders','Tidak aktif — ditutup untuk tempahan baharu')}</strong></p><p>{t('Disabling hides products and stops new orders. Existing customers can still open their orders and upload payment proof. Products, stock and existing orders are retained.','Menyahaktifkan kedai menyembunyikan produk dan menghentikan tempahan baharu. Pelanggan sedia ada masih boleh membuka tempahan dan memuat naik bukti bayaran. Produk, stok dan tempahan sedia ada dikekalkan.')}</p><ShopForm key={String(enabled)} action={saveMarketplaceAvailability} label={enabled?t('Disable marketplace','Nyahaktifkan kedai'):t('Enable marketplace','Aktifkan kedai')} confirm={enabled?t('Close the marketplace to new orders? Existing orders remain available.','Tutup kedai untuk tempahan baharu? Tempahan sedia ada masih tersedia.'):t('Reopen the marketplace for new orders?','Buka semula kedai untuk tempahan baharu?')}><input type="hidden" name="enabled" value={String(!enabled)}/></ShopForm></section>;
}
