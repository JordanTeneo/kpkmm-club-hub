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
 const [current,previous]=await Promise.all([
  listMembers(year),
  year>2000?listMembers(year-1):Promise.resolve([])
 ]);
 return attachPreviousYear(current,previous,year);
}
