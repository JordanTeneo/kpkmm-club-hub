import {listMembers,type ManagedMember,validYear} from './member-admin';
export function attachPreviousYear(current:ManagedMember[],previous:ManagedMember[],year:number){
 const prior=new Map(previous.map(m=>[m.memberNumber,m]));
 return current.map(m=>{
  const record=prior.get(m.memberNumber);
  // An older roster alone is not evidence of inactivity in the requested year.
  const previousActive=record?.active?true:record?.recordYear===year-1?false:null;
  return {...m,previousActive,previousStatus:previousActive===null?null:record?.annualStatus};
 });
}
export async function listMembersWithHistory(year:number){
 validYear(year);
 const current=await listMembers(year);
 const previous=year>2000?await listMembers(year-1):[];
 return attachPreviousYear(current,previous,year);
}
