import type {PaymentHistory} from './roster';

// Overlay verified renewals without modifying the imported historical evidence.
export function renewalPaymentHistory(history:PaymentHistory[]|undefined, approvals:{year:number;approvedAt?:string}[]):PaymentHistory[]{
 const result=new Map((history||[]).map(h=>[h.year,{...h}]));
 for(const approval of approvals){
  const prior=result.get(approval.year);
  const preserve=prior&&['new','sponsored','lifetime'].includes(prior.status);
  result.set(approval.year,{year:approval.year,status:preserve?prior.status:'paid',note:preserve||prior?.status==='paid'?prior?.note||'':'',approvedAt:approval.approvedAt});
 }
 return [...result.values()].sort((a,b)=>a.year-b.year);
}

type HistoryMember = {
  paymentHistory?: {year:number;status:string}[];
  lifetimeSince?: number;
};
export type AnnualEvidence = {membership_year:number;active:boolean;status_override:boolean};

// Derive from recorded membership evidence, never from the number or an unpaid application.
function activeYears(member:HistoryMember,records:AnnualEvidence[],asOfYear:number):number[] {
  const years=new Set<number>();
  for(const h of member.paymentHistory||[]){
    if(['paid','new','sponsored'].includes(h.status))years.add(h.year);
  }
  for(const record of records){
    if(record.active&&!(member.lifetimeSince&&member.lifetimeSince<=record.membership_year))years.add(record.membership_year);
    else if(record.status_override&&!record.active)years.delete(record.membership_year);
  }
  return [...years].filter(y=>Number.isInteger(y)&&y>=2000&&y<=asOfYear).sort((a,b)=>a-b);
}
export function firstActiveYear(member:HistoryMember,records:AnnualEvidence[],asOfYear:number):number|undefined {
  return activeYears(member,records,asOfYear)[0];
}
export function lastActiveYear(member:HistoryMember,records:AnnualEvidence[],asOfYear:number):number|undefined {
  return activeYears(member,records,asOfYear).at(-1);
}
