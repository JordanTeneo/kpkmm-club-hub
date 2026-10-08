import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {db,isAdmin} from '../../../lib/shop';
import {getFees} from '../../../lib/membership-fees';
import {feeQuote,type FeeSettings} from '../../../lib/membership-pricing';
import {paymentActor} from '../../../lib/membership-payments';
import {sealRenewal} from '../../../lib/renewals';
import {getLanguage} from '../../language';
import {MembershipPrice} from '../../membership-price';
import {ShopForm} from '../../shop/forms';
import type {Result} from '../../shop/actions';
import '../../shop/shop.css';
export const dynamic='force-dynamic';
async function save(_:Result,form:FormData):Promise<Result>{
 'use server';
 if(!await isAdmin('membership'))return {error:'Unauthorised'};
 const bm=(await getLanguage())==='ms';
 try{
  const settings={} as FeeSettings;
  for(const key of ['annual','administration','renewalDiscount','joiningDiscount'] as const){const value=String(form.get(key)||'');if(!/^\d+(\.\d{1,2})?$/.test(value))throw Error();settings[key]=Math.round(Number(value)*100);}
  feeQuote(settings,'new');feeQuote(settings,'renewal');await getFees();const actor=await paymentActor();
  const saved=await db().begin(async sql=>{const rows=await sql`UPDATE club_fee_settings SET settings=${JSON.stringify(settings)}::jsonb,version=version+1,updated_at=now() WHERE id=1 AND version=${Number(form.get('version'))} RETURNING id`;if(!rows.length)return false;await sql`INSERT INTO club_fee_audit(settings,actor) VALUES(${JSON.stringify(settings)}::jsonb,${sealRenewal(actor)})`;return true;});
  if(!saved)return {error:bm?'Tetapan telah berubah. Muat semula.':'Settings changed. Refresh before saving.'};
  for(const p of ['/join','/renew','/admin/fees','/admin/members','/admin/members/roster/renew'])revalidatePath(p);
  return {success:bm?'Yuran disimpan. Muat semula untuk melihat jumlah terkini.':'Fees saved. Refresh to view the latest totals.'};
 }catch{return {error:bm?'Masukkan amaun RM yang sah. Diskaun mesti kurang daripada jumlah yuran.':'Enter valid RM amounts. Each discount must be less than the applicable total fee.'};}
}
export default async function Fees(){
 if(!await isAdmin('membership'))redirect('/admin');
 const bm=(await getLanguage())==='ms',t=(a:string,b:string)=>bm?b:a,{settings,version}=await getFees();
 const fields=[['annual','Annual membership fee (RM)','Yuran tahunan (RM)'],['administration','New-member administrative fee (RM)','Yuran pentadbiran ahli baharu (RM)'],['renewalDiscount','Renewal discount (RM)','Diskaun pembaharuan (RM)'],['joiningDiscount','New-member discount (RM)','Diskaun ahli baharu (RM)']] as const;
 return <main className="shop"><h1>{t('Membership fees & discounts','Yuran & diskaun keahlian')}</h1><p>{t('Applies to everyone receiving a new quote. RM0 disables a discount. Existing payment invitations, submitted renewals and invoices keep their quoted amounts. Renewal page quotes are valid for 24 hours.','Terpakai kepada semua sebut harga baharu. RM0 mematikan diskaun. Jemputan bayaran, pembaharuan dihantar dan invois sedia ada mengekalkan amaun. Sebut harga pembaharuan sah 24 jam.')}</p><ShopForm action={save} label={t('Save fees','Simpan yuran')}><input type="hidden" name="version" value={version}/>{fields.map(([key,en,ms])=><label key={key}>{t(en,ms)}<input required type="number" name={key} min="0" max="10000" step="0.01" defaultValue={settings[key]/100}/></label>)}</ShopForm><h2>{t('New membership','Keahlian baharu')}</h2><MembershipPrice quote={feeQuote(settings,'new')} bm={bm}/><h2>{t('Renewal','Pembaharuan')}</h2><MembershipPrice quote={feeQuote(settings,'renewal')} bm={bm}/></main>;
}
