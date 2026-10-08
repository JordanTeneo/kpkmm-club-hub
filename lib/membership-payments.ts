import 'server-only';
import {randomBytes,randomUUID} from 'node:crypto';
import {db,isAdmin,uuid} from './shop';
import {committeeEnabled,committeeSession} from './committee-access';
import {openRenewal,sealRenewal,renewalHash} from './renewals';
import {SITE_ORIGIN} from './gmail';

export type PaymentKind='new'|'renewal';
export type PaymentSnapshot={name:string;memberNumber:string;actor:string};
export type PaymentRecord={id:string;invoice_sequence:string;kind:PaymentKind;source_id:string;membership_year:number;paid_on:string;amount:number;admin_fee:number;payload:string;approved_at:Date;voided_at:Date|null;detail:PaymentSnapshot};
export function malaysiaDate(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export function validPaymentDate(value:string){const date=new Date(value+'T00:00:00Z');return /^\d{4}-\d{2}-\d{2}$/.test(value)&&value>='2000-01-01'&&value<=malaysiaDate()&&Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;}
export async function paymentActor(){
 if(!await isAdmin('membership'))throw Error('Unauthorised');
 if(!await committeeEnabled())return 'Legacy owner';
 const s=await committeeSession();if(!s)throw Error('Unauthorised');
 return `${s.user.name || s.user.email} (${s.user.id})`;
}
let ready:Promise<void>|undefined;
export async function membershipPaymentsReady(){
 if(!ready)ready=(async()=>{
  await db()`CREATE TABLE IF NOT EXISTS club_membership_payments(
   id uuid PRIMARY KEY,invoice_sequence bigserial UNIQUE,kind text NOT NULL CHECK(kind IN ('new','renewal')),
   source_id uuid NOT NULL,membership_year integer NOT NULL CHECK(membership_year BETWEEN 2000 AND 2200),
   paid_on date NOT NULL,amount integer NOT NULL CHECK(amount>0),admin_fee integer NOT NULL CHECK(admin_fee>=0),
   payload text NOT NULL,proof text NOT NULL,proof_type text NOT NULL,
   token_hash text UNIQUE NOT NULL,token_encrypted text NOT NULL,
   approved_at timestamptz NOT NULL DEFAULT now(),voided_at timestamptz,
   UNIQUE(kind,source_id))`;
  await db()`CREATE INDEX IF NOT EXISTS club_membership_payments_year ON club_membership_payments(paid_on,membership_year)`;
  await db()`CREATE TABLE IF NOT EXISTS club_membership_payment_events(id bigserial PRIMARY KEY,payment_id uuid NOT NULL REFERENCES club_membership_payments(id),action text NOT NULL,actor text NOT NULL,created_at timestamptz NOT NULL DEFAULT now())`;
 })().catch(e=>{ready=undefined;throw e;});
 await ready;
}
// Called only inside the already-authorised approval transaction. No historical backfill.
export async function recordMembershipPayment(sql:any,input:{kind:PaymentKind;sourceId:string;year:number;paidOn:string;name:string;memberNumber:string;actor:string;proof:string;proofType:string}){
 if(!validPaymentDate(input.paidOn)||!uuid(input.sourceId)||!input.proof||!['image/jpeg','image/png','application/pdf'].includes(input.proofType))throw Error('Invalid payment record');
 const token=randomBytes(32).toString('hex');
 const rows=await sql`INSERT INTO club_membership_payments(id,kind,source_id,membership_year,paid_on,amount,admin_fee,payload,proof,proof_type,token_hash,token_encrypted)
 VALUES(${randomUUID()},${input.kind},${input.sourceId},${input.year},${input.paidOn},${input.kind==='new'?25000:15000},${input.kind==='new'?10000:0},${sealRenewal(JSON.stringify({name:input.name,memberNumber:input.memberNumber,actor:input.actor}))},${input.proof},${input.proofType},${renewalHash('invoice:'+token)},${sealRenewal(token)})
 ON CONFLICT(kind,source_id) DO NOTHING RETURNING id`;
 const saved=(await sql`SELECT id,token_encrypted,voided_at FROM club_membership_payments WHERE kind=${input.kind} AND source_id=${input.sourceId} FOR UPDATE`)[0];
 if(!saved)throw Error('Payment record unavailable');
 if(saved.voided_at)await sql`UPDATE club_membership_payments SET voided_at=NULL WHERE id=${saved.id}`;
 if(rows.length||saved.voided_at)await sql`INSERT INTO club_membership_payment_events(payment_id,action,actor) VALUES(${saved.id},${rows.length?'approved':'reapproved'},${sealRenewal(input.actor)})`;
 return `${SITE_ORIGIN}/membership-invoices/${openRenewal(saved.token_encrypted)}`;
}
export async function voidMembershipPayment(sql:any,kind:PaymentKind,sourceId:string,actor:string){
 const rows=await sql`UPDATE club_membership_payments SET voided_at=now() WHERE kind=${kind} AND source_id=${sourceId} AND voided_at IS NULL RETURNING id`;
 for(const row of rows)await sql`INSERT INTO club_membership_payment_events(payment_id,action,actor) VALUES(${row.id},'approval-reversed',${sealRenewal(actor)})`;
}
export async function paymentInvoiceLink(kind:PaymentKind,sourceId:string){
 await membershipPaymentsReady();
 const row=(await db()`SELECT token_encrypted FROM club_membership_payments WHERE kind=${kind} AND source_id=${sourceId} AND voided_at IS NULL`)[0];
 return row?`${SITE_ORIGIN}/membership-invoices/${openRenewal(row.token_encrypted)}`:undefined;
}
export function invoiceNumber(row:{invoice_sequence:string|number;approved_at:Date|string}){return `KPKMM-${new Intl.DateTimeFormat('en',{timeZone:'Asia/Kuala_Lumpur',year:'numeric'}).format(new Date(row.approved_at))}-${String(row.invoice_sequence).padStart(6,'0')}`;}
export async function paymentIdsForSources(kind:PaymentKind,ids:string[]){
 if(!await isAdmin('membership'))throw Error('Unauthorised');
 if(!ids.length)return {} as Record<string,string>;
 await membershipPaymentsReady();
 const rows=await db()`SELECT id,source_id FROM club_membership_payments WHERE kind=${kind} AND source_id=ANY(${ids}::uuid[])`;
 return Object.fromEntries(rows.map(r=>[r.source_id,r.id])) as Record<string,string>;
}
export function paymentYear(value:unknown){const n=Number(value);return Number.isInteger(n)&&n>=2000&&n<=2200?n:Number(malaysiaDate().slice(0,4));}
export async function paymentRegister(year:number){
 if(!await isAdmin('membership'))throw Error('Unauthorised');
 await membershipPaymentsReady();
 // One bounded-year query; do not load receipt bytes into the page or export.
 const rows=await db()`SELECT id,invoice_sequence,kind,source_id,membership_year,paid_on::text,amount,admin_fee,payload,approved_at,voided_at FROM club_membership_payments WHERE paid_on>=${year+'-01-01'}::date AND paid_on<${(year+1)+'-01-01'}::date ORDER BY membership_year,paid_on DESC,invoice_sequence DESC`;
 return rows.map(row=>({...row,detail:JSON.parse(openRenewal(row.payload)) as PaymentSnapshot})) as PaymentRecord[];
}
export function paymentTotals(rows:{membership_year:number;amount:number;admin_fee:number;voided_at:unknown;kind:string}[]){
 const groups=new Map<number,{year:number;count:number;newFees:number;renewalFees:number;adminFees:number;total:number}>();
 for(const r of rows){if(r.voided_at)continue;let g=groups.get(r.membership_year);if(!g){g={year:r.membership_year,count:0,newFees:0,renewalFees:0,adminFees:0,total:0};groups.set(r.membership_year,g);}g.count++;g.total+=r.amount;g.adminFees+=r.admin_fee;if(r.kind==='new')g.newFees+=r.amount-r.admin_fee;else g.renewalFees+=r.amount;}
 return [...groups.values()].sort((a,b)=>a.year-b.year);
}
