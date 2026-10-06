import {redirect} from 'next/navigation';
import {isAdmin} from '../../../../lib/shop';
import {listMembers,validYear} from '../../../../lib/member-admin';
import {malaysiaYear} from '../../../../lib/member-status';
import {MemberList} from './list';
import '../../../shop/shop.css';
export const dynamic='force-dynamic';
export const metadata={title:'Manage members | KPKMM',robots:{index:false,follow:false}};
export default async function Roster({searchParams}:{searchParams:Promise<{year?:string}>}){
 if(!(await isAdmin()))redirect('/admin');
 const q=await searchParams;let year=malaysiaYear();try{if(q.year)year=validYear(q.year);}catch{}
 let members;try{members=await listMembers(year);}catch{return <main className="shop"><a href="/admin/members">← Admin</a><h1>Member listing / Senarai ahli</h1><p>Private records are temporarily unavailable. No changes were made. / Rekod sulit tidak tersedia buat sementara waktu.</p></main>;}
 return <main className="shop"><nav className="shop-actions"><a href="/admin/members">← Applications / Permohonan</a><a href="/admin/renewals">Renewals / Pembaharuan</a><a href="/admin/members/import">Import roster / Import daftar</a></nav><h1>Member listing / Senarai ahli</h1><p>Private administrator access. Membership numbers remain permanent. Edit details, maintain annual status or download an Excel list. / Akses pentadbir sahaja. Nombor ahli kekal.</p>
 <form className="shop-actions"><label>Membership year / Tahun keahlian<input name="year" type="number" min="2000" max="2200" defaultValue={year} required/></label><button>View year / Lihat tahun</button></form>
 <MemberList year={year} members={members.map(m=>({memberNumber:m.memberNumber,name:m.name,active:m.active}))}/>
 <section className="shop-card"><h2>Excel downloads / Muat turun Excel</h2><p>Exports include member number, name, annual status, phone, email and registered address. Identification numbers are excluded by default. Keep downloaded files private. / Nombor pengenalan tidak disertakan secara lalai. Simpan fail secara sulit.</p><form action="/admin/members/roster/export" method="get"><input type="hidden" name="year" value={year}/><label>Members to export / Ahli untuk dieksport<select name="status"><option value="active">Active / Aktif</option><option value="inactive">Inactive / Tidak aktif</option><option value="all">All / Semua</option></select></label><label className="shop-consent"><input type="checkbox" name="identity" value="yes"/>Include identification numbers (private) / Sertakan nombor pengenalan (sulit)</label><button>Download Excel (.xlsx) / Muat turun Excel</button></form></section>
 </main>;
}
