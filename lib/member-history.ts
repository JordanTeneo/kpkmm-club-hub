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

export async function memberPage(year:number,query='',status='all',page=1){
 validYear(year);
 const members=await listMembers(year),needle=query.trim().slice(0,150).toLocaleLowerCase();
 const counts=Object.fromEntries(['active','new','inactive','lifetime','deceased'].map(s=>[s,members.filter(m=>m.annualStatus===s).length]));
 const filtered=members.filter(m=>(status==='all'||m.annualStatus===status)&&(!needle||(m.name+' '+m.memberNumber).toLocaleLowerCase().includes(needle)));
 const pages=Math.max(1,Math.ceil(filtered.length/25)),current=Math.min(pages,Math.max(1,Number.isFinite(page)?Math.floor(page):1));
 const selected=filtered.slice((current-1)*25,current*25);
 const previous=year>2000&&selected.length?await listMembers(year-1,selected.map(m=>m.memberNumber)):[];
 return {members:attachPreviousYear(selected,previous,year),counts,total:members.length,matching:filtered.length,pages,current};
}
