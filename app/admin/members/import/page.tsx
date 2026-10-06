import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {db,isAdmin} from '../../../../lib/shop';
import {importRoster,rosterReady,validateRoster} from '../../../../lib/roster';
import {importAddresses} from '../../../../lib/member-address-import';
import '../../../shop/shop.css';
export const dynamic='force-dynamic';
export const metadata={title:'Member roster import | KPKMM',robots:{index:false,follow:false}};
export const maxDuration=60;
async function saveAddresses(form:FormData){
 'use server';
 if(!(await isAdmin()))redirect('/admin');
 let result='address-error';
 try{
  const file=form.get('addresses');
  if(!(file instanceof File)||!file.size||file.size>800000||form.get('verified')!=='yes')throw Error('Invalid file');
  const saved=await importAddresses(JSON.parse(await file.text()));
  result='addresses&updated='+saved.updated+'&skipped='+saved.skipped;
 }catch{/* No private data in logs. Transaction rolls back on failure. */}
 revalidatePath('/admin/members/roster');
 redirect('/admin/members/import?result='+result);
}
async function save(form:FormData){
 'use server';
 if(!(await isAdmin()))redirect('/admin');
 let result='file';
 try{
  const file=form.get('roster');
  if(!(file instanceof File)||!file.size||file.size>800000||form.get('confirmed')!=='yes')throw Error('Invalid file');
  result='validation';const data=validateRoster(JSON.parse(await file.text()));
  result='storage';const imported=await importRoster(data);
  result=imported.repeated?'unchanged':'saved';
 }catch{ /* Never log personal data or database parameters. */ }
 revalidatePath('/admin/members/import');redirect('/admin/members/import?result='+result);
}
export default async function ImportMembers({searchParams}:{searchParams:Promise<{result?:string;updated?:string;skipped?:string}>}){
 if(!(await isAdmin()))redirect('/admin');
 const {result,updated,skipped}=await searchParams;
 let totals,history;
 try{await rosterReady();[totals,history]=await Promise.all([
  db()`SELECT membership_year,count(*)::int AS total,count(*) FILTER(WHERE active)::int AS active FROM club_member_roster GROUP BY membership_year ORDER BY membership_year DESC`,
  db()`SELECT source,membership_year,total,active,created_at FROM club_roster_imports ORDER BY created_at DESC LIMIT 5`
 ]);}catch{return <main className="shop"><h1>Member roster</h1><p>Private storage is unavailable. No import can be verified. Please contact the administrator.</p></main>;}
 return <main className="shop" style={{maxWidth:850}}><a href="/admin/members">← Membership administration / Pentadbiran keahlian</a><h1>Member roster / Daftar ahli</h1><p><a className="shop-link" href="/admin/members/roster">Manage members and Excel downloads / Urus ahli dan muat turun Excel →</a></p><p>Private administrator import. Membership numbers are retained, including dormant members. Records not present in the import are unchanged. No emails are sent.</p>
 {result&&!result.startsWith('address')&&<p role="status" className="shop-note">{result==='saved'?'Import saved successfully. / Import berjaya disimpan.':result==='unchanged'?'This exact import is already saved. No duplicate records were created. / Import ini telah disimpan.':result==='file'?'Choose a roster file and tick the verification checkbox. / Pilih fail dan tandakan pengesahan.':result==='validation'?'File validation failed. Check the membership numbers, names and format. No records changed. / Pengesahan fail gagal. Tiada rekod diubah.':'Database import failed. No partial changes were saved. Please retry. / Import pangkalan data gagal. Tiada perubahan separa disimpan.'}</p>}
 {result==='addresses'&&<p role="status" className="shop-note">Address update complete / Kemas kini alamat selesai: {Number(updated)||0} updated, {Number(skipped)||0} skipped. Membership IDs, payments and status were not changed.</p>}
 {result==='address-error'&&<p role="alert">Address update failed. No partial changes saved. / Kemas kini alamat gagal. Tiada perubahan separa disimpan.</p>}
 {totals.map(r=><section className="shop-card" key={r.membership_year}><h2>{r.membership_year} membership roster</h2><p><strong>{r.total}</strong> members · <strong>{r.active}</strong> active · <strong>{r.total-r.active}</strong> inactive</p></section>)}
 <section className="shop-card"><h2>Address-only update / Kemas kini alamat sahaja</h2><p>Upload a reviewed address plan. Updates only unseparated addresses that still match the original member name and address. Newer edits are skipped. Membership numbers, payments, status and other personal details stay unchanged. Previous addresses are retained in the private audit history. Do not upload private files to GitHub.</p><form action={saveAddresses}><label>Private address plan<input type="file" name="addresses" accept="application/json,.json" required/></label><label className="shop-consent"><input type="checkbox" name="verified" value="yes" required/>Addresses have been reviewed / Alamat telah disemak</label><button>Update addresses only / Kemas kini alamat sahaja</button></form></section>
 <section className="shop-card"><h2>Upload verified roster / Muat naik daftar disahkan</h2><p>Use a prepared JSON file containing year, source and members. Each member must include memberNumber, name, active, identity, phone, email, address and sourceRow. Blank personal details are allowed. Never upload this file to GitHub.</p><form action={save}><label>Private roster file<input type="file" name="roster" accept="application/json,.json" required/></label><label className="shop-consent"><input type="checkbox" name="confirmed" value="yes" required/>I verified the year and active/inactive payment markers. / Saya telah menyemak tahun dan status bayaran.</label><button>Import roster / Import daftar</button></form></section>
 <section className="shop-card"><h2>Recent imports / Import terkini</h2>{history.map((r,i)=><p key={i}>{r.source} — {r.membership_year}: {r.total} members, {r.active} active. {new Date(r.created_at).toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur'})}</p>)}</section></main>;
}
