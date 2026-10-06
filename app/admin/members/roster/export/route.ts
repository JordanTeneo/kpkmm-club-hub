import {isAdmin} from '../../../../../lib/shop';
import {listMembers,validYear} from '../../../../../lib/member-admin';
import {memberWorkbook} from '../../../../../lib/member-excel';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const privateHeaders={'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow','Vary':'Cookie'};
export async function GET(request:Request){
 if(!(await isAdmin()))return new Response('Sign in required',{status:401,headers:privateHeaders});
 const q=new URL(request.url).searchParams;let year;const status=q.get('status');
 try{year=validYear(q.get('year'));if(!['active','inactive','all'].includes(status||''))throw Error('Invalid status');}catch{return new Response('Invalid year or status',{status:400,headers:privateHeaders});}
 try{
  const members=(await listMembers(year)).filter(m=>status==='all'||m.active===(status==='active')),includeIdentity=q.get('identity')==='yes';
  const headers=['Member ID / No. ahli','Name / Nama','Year / Tahun','Status','Phone / Telefon','Email / E-mel','Address / Alamat','Postcode / Poskod','State / Negeri','Country / Negara'];
  if(includeIdentity)headers.push('Identification / Pengenalan');
  const rows=members.map(m=>[m.memberNumber,m.name,String(year),m.active?'Active / Aktif':'Inactive / Tidak aktif',m.phone,m.email,m.addressLine??m.address,m.postcode||"",m.state||"",m.mailingCountry||"",...(includeIdentity?[m.identity]:[])]);
  const file=memberWorkbook([headers,...rows],year+' '+status);
  return new Response(new Uint8Array(file),{headers:{...privateHeaders,'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="KPKMM-members-${year}-${status}.xlsx"`}});
 }catch{return new Response('Export unavailable. No partial file was generated. Please retry.',{status:503,headers:privateHeaders});}
}
