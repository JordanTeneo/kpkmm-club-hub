import {statusLabel} from '../../../../../lib/annual-status';
import {isAdmin} from '../../../../../lib/shop';
import {listMembers,validYear} from '../../../../../lib/member-admin';
import {memberWorkbook,memberYearWorkbook} from '../../../../../lib/member-excel';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const privateHeaders={'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow','Vary':'Cookie'};
export async function GET(request:Request){
 if(!(await isAdmin('membership')))return new Response('Sign in required',{status:401,headers:privateHeaders});
 const q=new URL(request.url).searchParams;let year,endYear;const status=q.get('status');
 try{year=validYear(q.get('from')??q.get('year'));endYear=q.has('to')?validYear(q.get('to')):year;if(endYear<year||endYear-year>=25||!['active','new','lifetime','deceased','inactive','all'].includes(status||''))throw Error('Invalid range or status');}catch{return new Response('Choose a valid year range (up to 25 years) and status. / Pilih julat tahun yang sah (sehingga 25 tahun) dan status.',{status:400,headers:privateHeaders});}
 try{
  const includeIdentity=q.get('identity')==='yes';
  const headers=['Member ID / No. ahli','Name / Nama','Year / Tahun','Status','Phone / Telefon','Email / E-mel','Address / Alamat','Postcode / Poskod','State / Negeri','Country / Negara','Vehicle numbers / Nombor kenderaan','Lifetime since / Seumur hidup sejak','Member since / Ahli sejak','Last active year / Tahun terakhir aktif'];
  if(includeIdentity)headers.push('Identification / Pengenalan');
  const sheets=[];
  // Load sequentially to keep a large year range from flooding the database.
  for(let selectedYear=year;selectedYear<=endYear;selectedYear++){
   const members=(await listMembers(selectedYear)).filter(m=>status==='all'||m.annualStatus===status);
   const rows=members.map(m=>[m.memberNumber,m.name,String(selectedYear),statusLabel(m.annualStatus)+' / '+statusLabel(m.annualStatus,true),m.phone,m.email,m.addressLine??m.address,m.postcode||"",m.state||"",m.mailingCountry||"",(m.vehicles||[]).join(", "),m.lifetimeSince?String(m.lifetimeSince):"",m.memberSince?String(m.memberSince):"",m.lastActiveYear?String(m.lastActiveYear):"",...(includeIdentity?[m.identity]:[])]);
   sheets.push({name:selectedYear+' '+status,rows:[headers,...rows]});
  }
  const file=sheets.length===1?memberWorkbook(sheets[0].rows,sheets[0].name):memberYearWorkbook(sheets);
  const period=year===endYear?String(year):`${year}-${endYear}`;
  return new Response(new Uint8Array(file),{headers:{...privateHeaders,'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="KPKMM-members-${period}-${status}.xlsx"`}});
 }catch{return new Response('Export unavailable. No partial file was generated. Please retry.',{status:503,headers:privateHeaders});}
}
