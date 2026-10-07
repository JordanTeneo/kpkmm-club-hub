import {headers} from 'next/headers';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {getMigrations} from 'better-auth/db/migration';
import {committeeAuth} from '../../../lib/committee-auth';
import {committeeEnabled,committeeSession,committeeReady,committeeAudit} from '../../../lib/committee-access';
import {db,isAdmin} from '../../../lib/shop';
import {getLanguage} from '../../language';
import '../../shop/shop.css';
export const dynamic='force-dynamic';
async function setup(form:FormData){
 'use server';
 if(await committeeEnabled()||!(await isAdmin()))throw Error('Unauthorised');
 let result='created';
 try{
 const auth=committeeAuth();const migration=await getMigrations(auth.options);await migration.runMigrations();
 await db().begin(async sql=>{
  await sql`SELECT id FROM club_committee_settings WHERE id=1 FOR UPDATE`;
 const existing=await sql`SELECT id FROM committee_user LIMIT 1`;if(existing.length){result='exists';return;}
  await auth.api.createUser({body:{email:String(form.get('email')||''),password:String(form.get('password')||''),name:String(form.get('name')||''),role:'admin'}});
 });
 }catch{result='setup-error';console.error('Committee owner setup failed; credentials omitted');}
 redirect('/admin/users?result='+result);
}
async function activate(){
 'use server';
 await committeeReady();const session=await committeeSession();if(!session?.superAdmin)throw Error('Sign in to the new owner account first');
 await db()`UPDATE club_committee_settings SET enabled=true WHERE id=1`;
 await committeeAudit('individual-accounts-enabled',session.user.id);redirect('/admin/users');
}
async function manage(form:FormData){
 'use server';
 if(!(await committeeEnabled()))throw Error('Activate individual accounts first');
 const session=await committeeSession();if(!session?.superAdmin)throw Error('Unauthorised');
 const auth=committeeAuth(),h=await headers(),operation=String(form.get('operation')),id=String(form.get('id')||'');
 if(!['create','disable','enable','reset','permissions'].includes(operation))redirect('/admin/users?result=invalid-action');
 let outcome='saved';
 try{
 if(operation==='create'){
  const role=String(form.get('role')||'user');
  if(!['user','admin'].includes(role))throw Error('Invalid account role');
  if(role==='admin'&&form.get('confirmSuperAdmin')!=='yes')throw Error('Confirm full administrator access');
  const scopes=form.getAll('scope').map(String).filter(s=>['membership','content','shop','appointments'].includes(s));
  const result=await auth.api.createUser({headers:h,body:{email:String(form.get('email')||'').trim(),name:String(form.get('name')||'').trim(),password:String(form.get('password')||''),role:role as 'user'|'admin'}});
  await db()`INSERT INTO club_committee_permissions(user_id,scopes) VALUES(${result.user.id},${scopes})`;
  await committeeAudit(role==='admin'?'create-super-admin':'create-user',result.user.id);
 }else{
  const rows=await db()`SELECT role FROM committee_user WHERE id=${id}`;
  if(!rows.length||rows[0].role==='admin')throw Error('Owner accounts cannot be changed here');
  if(operation==='disable'){
   await db()`UPDATE club_committee_permissions SET disabled=true WHERE user_id=${id}`;
   await auth.api.revokeUserSessions({headers:h,body:{userId:id}});
  }else if(operation==='enable')await db()`UPDATE club_committee_permissions SET disabled=false WHERE user_id=${id}`;
  else if(operation==='reset'){
   await auth.api.setUserPassword({headers:h,body:{userId:id,newPassword:String(form.get('password')||'')}});
   await auth.api.revokeUserSessions({headers:h,body:{userId:id}});
  }else if(operation==='permissions'){
   const scopes=form.getAll('scope').map(String).filter(s=>['membership','content','shop','appointments'].includes(s));
   await db()`UPDATE club_committee_permissions SET scopes=${scopes} WHERE user_id=${id}`;
  }else throw Error('Invalid action');
  await committeeAudit(operation,id);
 }
 }catch{
  console.error('Committee account update failed; credentials omitted');
  outcome='update-error';
 }
 revalidatePath('/admin/users');
 redirect('/admin/users?result='+(outcome==='saved'&&operation==='reset'?'password-reset':outcome));
}
export default async function Users({searchParams}:{searchParams:Promise<{result?:string}>}){
 const bm=(await getLanguage())==='ms',t=(en:string,ms:string)=>bm?ms:en;
 const {result}=await searchParams;
 const enabled=await committeeEnabled();let session=null;try{session=await committeeSession();}catch{}
 if(enabled?!session?.superAdmin:!(await isAdmin())&&!session?.superAdmin)redirect('/admin');
 const fields=<><label>{t('Name','Nama')}<input name="name" required maxLength={150}/></label><label>{t('Email — sign-in ID','E-mel — ID log masuk')}<input name="email" type="email" required/></label><label>{t('Password (at least 12 characters)','Kata laluan (sekurang-kurangnya 12 aksara)')}<input name="password" type="password" minLength={12} required autoComplete="new-password"/></label></>;
 if(!enabled){
  let configured=true;try{committeeAuth();}catch{configured=false;}
  return <main className="shop"><h1>{t('Set up your Super Admin account','Sediakan akaun Super Admin')}</h1>
   <p>{t('Create your personal owner account, then sign in below and activate individual accounts. Your existing admin access stays available until activation. Activation disables the shared-password login.','Cipta akaun pemilik, kemudian log masuk dan aktifkan akaun individu. Akses sedia ada kekal sehingga pengaktifan. Log masuk kata laluan bersama dihentikan selepas pengaktifan.')}</p>
   {!configured&&<p role="alert">{t('Secure account configuration is unavailable. Keep the existing encryption keys unchanged and contact the website administrator.','Konfigurasi akaun selamat tidak tersedia. Jangan ubah kunci penyulitan sedia ada dan hubungi pentadbir laman.')}</p>}
   {result==='setup-error'&&<p role="alert">{t('Account setup could not be completed. Check your email format and use a password of at least 12 characters. If this continues, contact the website administrator. Existing admin access is unchanged.','Persediaan akaun tidak berjaya. Semak format e-mel dan gunakan kata laluan sekurang-kurangnya 12 aksara. Jika berterusan, hubungi pentadbir laman. Akses pentadbir sedia ada tidak berubah.')}</p>}
   {['created','exists'].includes(result||'')&&<p role="status">{t('Your owner account is available. Sign in below, then activate individual accounts.','Akaun pemilik tersedia. Log masuk di bawah, kemudian aktifkan akaun individu.')}</p>}
   {configured&&!['created','exists'].includes(result||'')&&<form action={setup}>{fields}<button>{t('Create owner account','Cipta akaun pemilik')}</button></form>}
   <a className="shop-link" href="/admin/sign-in">{t('Sign in to your owner account','Log masuk akaun pemilik')}</a>{session?.superAdmin&&<form action={activate}><button>{t('Activate individual accounts','Aktifkan akaun individu')}</button></form>}
  </main>;
 }
 const rows=await db()`SELECT u.id,u.name,u.email,u.role,p.scopes,p.disabled FROM committee_user u LEFT JOIN club_committee_permissions p ON p.user_id=u.id ORDER BY u.name`;
 const superAdminForm=<section className="shop-card"><details><summary>{t('Add another Super Admin','Tambah Super Admin lain')}</summary><p>{t('Full access to member records, payment records, website content and account administration. Your existing Super Admin account remains unchanged.','Akses penuh kepada rekod ahli, rekod bayaran, kandungan laman dan pentadbiran akaun. Akaun Super Admin sedia ada tidak berubah.')}</p><form action={manage}><input type="hidden" name="operation" value="create"/><input type="hidden" name="role" value="admin"/>{fields}<label><input type="checkbox" name="confirmSuperAdmin" value="yes" required/>{t('I confirm this account should have full Super Admin access.','Saya mengesahkan akaun ini diberi akses penuh Super Admin.')}</label><button>{t('Create Super Admin','Cipta Super Admin')}</button></form><p>{t('Enter the password privately here. No invitation email is sent automatically.','Masukkan kata laluan secara sulit di sini. Tiada e-mel jemputan automatik dihantar.')}</p></details></section>;
 const scopes=(selected:string[]=[])=>['membership','content','shop','appointments'].map(s=><label key={s}><input type="checkbox" name="scope" value={s} defaultChecked={selected.includes(s)}/>{t(...({membership:['Membership','Keahlian'],content:['Website content','Kandungan laman'],shop:['Marketplace','Kedai'],appointments:['Committee appointments','Pelantikan jawatankuasa']} as Record<string,[string,string]>)[s])}</label>);
 return <main className="shop"><h1>{t('Committee accounts','Akaun jawatankuasa')}</h1>{result==='password-reset'&&<p role="status">{t('Password reset successfully. Previous sign-in sessions have been ended.','Kata laluan berjaya ditetapkan semula. Sesi log masuk terdahulu telah ditamatkan.')}</p>}{result==='saved'&&<p role="status">{t('Account updated successfully.','Akaun berjaya dikemas kini.')}</p>}{['invalid-action','update-error'].includes(result||'')&&<p role="alert">{t('The account update could not be completed. Refresh this page and try again. For passwords, use at least 12 characters.','Akaun tidak dapat dikemas kini. Muat semula halaman dan cuba lagi. Gunakan kata laluan sekurang-kurangnya 12 aksara.')}</p>}<section className="shop-card"><h2>{t('Create committee account','Cipta akaun jawatankuasa')}</h2><form action={manage}><input type="hidden" name="operation" value="create"/>{fields}{scopes()}<button>{t('Create account','Cipta akaun')}</button></form><p>{t('Share credentials privately. No invitation email is sent automatically.','Kongsi maklumat log masuk secara sulit. Tiada e-mel jemputan automatik dihantar.')}</p></section>{superAdminForm}{rows.map(u=><section className="shop-card" key={u.id}><h2>{u.name}</h2><p>{u.email} · {u.role==='admin'?t('Super Admin','Pentadbir Utama'):u.disabled?t('Disabled','Dinyahaktifkan'):t('Enabled','Diaktifkan')}</p>{u.role!=='admin'&&<><form action={manage}><input type="hidden" name="id" value={u.id}/><input type="hidden" name="operation" value={u.disabled?'enable':'disable'}/><button>{u.disabled?t('Reactivate','Aktifkan semula'):t('Disable and revoke sessions','Nyahaktif dan tamatkan sesi')}</button></form><form action={manage}><input type="hidden" name="id" value={u.id}/>{scopes(u.scopes)}<input type="hidden" name="operation" value="permissions"/><button>{t('Save permissions','Simpan kebenaran')}</button></form><form action={manage}><input type="hidden" name="id" value={u.id}/><label>{t('New password','Kata laluan baharu')}<input name="password" type="password" required minLength={12} autoComplete="new-password"/></label><input type="hidden" name="operation" value="reset"/><button>{t('Reset password','Tetap semula kata laluan')}</button></form></>}</section>)}</main>;
}
