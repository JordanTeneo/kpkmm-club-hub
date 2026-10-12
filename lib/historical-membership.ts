import 'server-only';
import {db,isAdmin} from './shop';
import {rosterReady} from './roster';
import {openRenewal,renewalsReady} from './renewals';
import {membershipPaymentsReady} from './membership-payments';

export type HistoricalPayment={id:string;memberNumber:string;name:string;kind:'new'|'renewal';membershipYear:number;collectionYear:2026;amount:number;adminFee:number;source:'roster'|'renewal';receipt:string};
type Roster={member_number:string;identity_hash:string|null;detail:{name:string;lifetimeSince?:number;paymentHistory?:{year:number;status:string}[]}};
type Renewal={id:string;identity_hash:string;renewal_year:number;amount:number;detail:{name:string;rosterMemberNumber?:string}};
type Ledger={kind:string;source_id:string;membership_year:number;detail:{memberNumber:string}};
// Explicit owner-approved historical policy, 12 October 2026. Never infer cash from active status.
// This is a report overlay: no invoices, receipts or bank dates are manufactured.
export function historicalPayments(roster:Roster[],renewals:Renewal[],ledger:Ledger[],aliases:{old_number:string;new_number:string}[]=[]):HistoricalPayment[]{
 const alias=new Map(aliases.map(a=>[a.old_number,a.new_number]));
 const canonical=(n:string)=>{const visited=new Set<string>();while(alias.has(n)&&!visited.has(n)){visited.add(n);n=alias.get(n)!;}return n;};
 const key=(n:string,y:number)=>`${canonical(n)}:${y}`;
 // Include voided records too: reversing an approval must not resurrect its historical payment.
 const covered=new Set(ledger.map(p=>key(p.detail.memberNumber,p.membership_year)));
 const sources=new Set(ledger.map(p=>`${p.kind}:${p.source_id}`));
 const rows:HistoricalPayment[]=[],claimed=new Set<string>();
 const byNumber=new Map(roster.map(r=>[canonical(r.member_number),r]));
 for(const r of renewals){
  const matches=r.detail.rosterMemberNumber?[byNumber.get(canonical(r.detail.rosterMemberNumber))].filter(Boolean) as Roster[]:roster.filter(m=>m.identity_hash&&m.identity_hash===r.identity_hash);
  const member=matches.length===1?matches[0]:undefined,number=member?.member_number||r.detail.rosterMemberNumber||'';
  if(matches.length>1)throw Error('Ambiguous historical member match');
  const k=number?key(number,r.renewal_year):`renewal:${r.id}`;
  if(covered.has(k)||claimed.has(k)||sources.has(`renewal:${r.id}`))continue;
  const status=member?.detail.paymentHistory?.find(h=>h.year===r.renewal_year)?.status;
  if(['sponsored','lifetime'].includes(status||'')||(member?.detail.lifetimeSince&&member.detail.lifetimeSince<=r.renewal_year))continue;
  claimed.add(k);
  rows.push({id:`renewal:${r.id}`,memberNumber:number,name:r.detail.name,kind:'renewal',membershipYear:r.renewal_year,collectionYear:2026,amount:r.amount,adminFee:0,source:'renewal',receipt:`/admin/renewals/proof?id=${r.id}`});
 }
 for(const m of roster){
  const h=m.detail.paymentHistory?.find(h=>h.year===2026),k=key(m.member_number,2026);
  if(!h||!['paid','new'].includes(h.status)||covered.has(k)||claimed.has(k)||(m.detail.lifetimeSince&&m.detail.lifetimeSince<=2026))continue;
  claimed.add(k);const joining=h.status==='new';
  rows.push({id:`roster:${canonical(m.member_number)}:2026`,memberNumber:canonical(m.member_number),name:m.detail.name,kind:joining?'new':'renewal',membershipYear:2026,collectionYear:2026,amount:joining?25000:15000,adminFee:joining?10000:0,source:'roster',receipt:''});
 }
 return rows.sort((a,b)=>a.memberNumber.localeCompare(b.memberNumber)||a.id.localeCompare(b.id));
}
export async function historicalRegister(year:number,basis:'payment'|'membership'='payment'){
 if(!await isAdmin('membership'))throw Error('Unauthorised');
 if((basis==='payment'&&year!==2026)||(basis==='membership'&&year!==2026&&year!==2027))return [] as HistoricalPayment[];
 await Promise.all([rosterReady(),renewalsReady(),membershipPaymentsReady()]);
 const [roster,renewals,ledger,aliases]=await Promise.all([
  db()`SELECT DISTINCT ON(member_number) member_number,identity_hash,payload FROM club_member_roster ORDER BY member_number,membership_year DESC`,
  db()`SELECT id,identity_hash,renewal_year,amount,payload FROM club_renewals WHERE review_status='approved' AND renewal_year IN (2026,2027) AND created_at>=TIMESTAMPTZ '2026-01-01 00:00:00+08' AND created_at<TIMESTAMPTZ '2026-10-12 00:00:00+08'`,
  db()`SELECT kind,source_id,membership_year,payload FROM club_membership_payments WHERE membership_year IN (2026,2027)`,
  db()`SELECT old_number,new_number FROM club_member_id_history`
 ]);
 const rows=historicalPayments(roster.map(r=>({...r,detail:JSON.parse(openRenewal(r.payload))})) as Roster[],renewals.map(r=>({...r,detail:JSON.parse(openRenewal(r.payload))})) as Renewal[],ledger.map(r=>({...r,detail:JSON.parse(openRenewal(r.payload))})) as Ledger[],aliases.map(r=>({old_number:String(r.old_number),new_number:String(r.new_number)})));
 return rows.filter(r=>basis==='payment'?r.collectionYear===year:r.membershipYear===year);
}
export function historicalSheet(rows:HistoricalPayment[],bm=false){
 const t=(en:string,ms:string)=>bm?ms:en;
 return {name:t('Historical payments','Bayaran sejarah'),rows:[
  [t('Reference','Rujukan'),t('Member number','Nombor ahli'),t('Name','Nama'),t('Type','Jenis'),t('Membership year','Tahun keahlian'),t('Assigned collection year','Tahun kutipan diperuntukkan'),t('Amount RM','Amaun RM'),t('Included admin fee RM','Termasuk yuran pentadbiran RM'),t('Bank date','Tarikh bank'),t('Basis','Asas'),t('Receipt path','Laluan resit')],
  ...rows.map(r=>[r.id,r.memberNumber,r.name,r.kind==='new'?t('New','Baharu'):t('Renewal','Pembaharuan'),r.membershipYear,r.collectionYear,r.amount/100,r.adminFee/100,t('Unknown','Tidak diketahui'),r.source==='roster'?t('Owner-approved rates: renewal RM150; new RM250','Kadar diluluskan pemilik: pembaharuan RM150; baharu RM250'):t('Older approved renewal; stored amount','Pembaharuan lama diluluskan; amaun tersimpan'),r.receipt])
 ]};
}
