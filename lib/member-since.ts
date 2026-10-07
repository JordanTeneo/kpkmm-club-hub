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
