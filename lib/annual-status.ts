export type AnnualStatus='active'|'new'|'inactive'|'lifetime'|'deceased';
type AnnualMember={active:boolean;lifetimeSince?:number;joinedYear?:number;deceased?:boolean;paymentHistory?:{year:number;status:string}[]};
// New is an annual classification, never inferred from the membership number.
export function annualStatus(member:AnnualMember,year:number):AnnualStatus{
 if(member.deceased)return 'deceased';
 if(Number.isInteger(member.lifetimeSince)&&member.lifetimeSince!<=year)return 'lifetime';
 if(!member.active)return 'inactive';
 return member.joinedYear===year||member.paymentHistory?.some(h=>h.year===year&&h.status==='new')?'new':'active';
}
export function statusLabel(status:AnnualStatus,bm=false){
 return ({active:['Active','Aktif'],new:['New','Baharu'],inactive:['Inactive','Tidak aktif'],lifetime:['Lifetime','Seumur hidup'],deceased:['Deceased','Telah meninggal dunia']} as const)[status][bm?1:0];
}
