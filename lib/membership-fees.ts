import {db} from './shop';
import {renewalHash,renewalsReady} from './renewals';
import {defaultFees,feeQuote,savedFee,type FeeSettings} from './membership-pricing';
let ready:Promise<void>|undefined;
let renewalReady:Promise<void>|undefined;
export async function renewalPricingReady(){
 if(!renewalReady)renewalReady=(async()=>{await renewalsReady();await db().begin(async sql=>{
  await sql`ALTER TABLE club_renewals DROP CONSTRAINT IF EXISTS club_renewals_amount_check`;
  await sql`ALTER TABLE club_renewals ADD CONSTRAINT club_renewals_amount_check CHECK(amount>0 AND amount<=2000000)`;
 });})().catch(e=>{renewalReady=undefined;throw e;});await renewalReady;
}
export async function feesReady(){
 if(!ready)ready=(async()=>{
  await db()`CREATE TABLE IF NOT EXISTS club_fee_settings(id integer PRIMARY KEY CHECK(id=1),settings jsonb NOT NULL,version integer NOT NULL DEFAULT 1,updated_at timestamptz NOT NULL DEFAULT now())`;
  await db()`INSERT INTO club_fee_settings(id,settings) VALUES(1,${JSON.stringify(defaultFees)}::text::jsonb) ON CONFLICT(id) DO NOTHING`;
  await db()`CREATE TABLE IF NOT EXISTS club_fee_audit(id bigserial PRIMARY KEY,settings jsonb NOT NULL,actor text NOT NULL,created_at timestamptz NOT NULL DEFAULT now())`;
 })().catch(e=>{ready=undefined;throw e;});await ready;
}
export async function getFees(){await feesReady();const rows=await db()`SELECT settings,version FROM club_fee_settings WHERE id=1`;if(!rows[0])throw Error('Fees unavailable');const settings=(typeof rows[0].settings==='string'?JSON.parse(rows[0].settings):rows[0].settings) as FeeSettings;feeQuote(settings,'new');feeQuote(settings,'renewal');return {settings,version:Number(rows[0].version)};}
export async function renewalFeeToken(){const {settings}=await getFees();const quote=feeQuote(settings,'renewal'),body=Buffer.from(JSON.stringify({quote,expires:Date.now()+86400000})).toString('base64url');return {quote,token:body+'.'+renewalHash('fee:'+body)};}
export function readRenewalFee(token:unknown){
 if(typeof token!=='string'||token.length>1500)throw Error('Refresh the fee quote');
 const [body,signature,extra]=token.split('.');if(!body||extra!==undefined||signature!==renewalHash('fee:'+body))throw Error('Invalid fee quote');
 const parsed=JSON.parse(Buffer.from(body,'base64url').toString());if(!Number.isFinite(parsed.expires)||parsed.expires<Date.now())throw Error('Fee quote expired');
 return savedFee(parsed.quote,'renewal');
}
