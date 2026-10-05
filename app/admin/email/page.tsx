import {randomBytes} from 'node:crypto';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {isAdmin,digest} from '../../../lib/shop';
import {CLUB_EMAIL,CALLBACK,SEND_SCOPE,googleConfig,connection} from '../../../lib/gmail';
import '../../shop/shop.css';

export const dynamic='force-dynamic';
export const metadata={title:'Club email connection | KPKMM',robots:{index:false,follow:false}};
async function connect(){
 'use server';
 if(!(await isAdmin()))redirect('/admin');
 let id;try{id=googleConfig().id;}catch{redirect('/admin/email?result=settings');}
 const jar=await cookies(),state=randomBytes(32).toString('hex');
 const session=digest(jar.get('kpkmm-admin')!.value);
 jar.set('kpkmm-gmail-state',state+'.'+session,{httpOnly:true,secure:true,sameSite:'lax',path:'/api/gmail/callback',maxAge:600});
 const query=new URLSearchParams({client_id:id,redirect_uri:CALLBACK,response_type:'code',scope:'openid email '+SEND_SCOPE,access_type:'offline',prompt:'consent',login_hint:CLUB_EMAIL,state});
 redirect('https://accounts.google.com/o/oauth2/v2/auth?'+query);
}
export default async function EmailSettings({searchParams}:{searchParams:Promise<{result?:string}>}){
 if(!(await isAdmin()))redirect('/admin');
 const {result}=await searchParams;
 let configured=false,linked:null|{email:string;connected_at:Date}=null,storageError='';
 try{googleConfig();configured=true;}catch{}
 if(!process.env.GMAIL_ENCRYPTION_KEY||process.env.GMAIL_ENCRYPTION_KEY.length<32){storageError='Add GMAIL_ENCRYPTION_KEY in Vercel Production: a new random secret of at least 32 characters. Keep ADMIN_SESSION_SECRET unchanged. Redeploy after saving. / Tambah GMAIL_ENCRYPTION_KEY dalam Vercel Production: rahsia rawak baharu sekurang-kurangnya 32 aksara. Jangan ubah ADMIN_SESSION_SECRET. Terbitkan semula selepas menyimpan.';}
 else if(!process.env.DATABASE_URL&&!process.env.POSTGRES_URL){storageError='The database connection setting is missing in Production. / Tetapan sambungan pangkalan data tiada dalam Production.';}
 else try{const saved=await connection();if(saved)linked={email:String(saved.email),connected_at:new Date(saved.connected_at)};}catch{storageError='The database could not prepare secure Gmail storage. Check the Neon connection and database permissions. / Pangkalan data tidak dapat menyediakan storan Gmail. Semak sambungan Neon dan kebenaran pangkalan data.';}
 const messages:Record<string,string>={connected:'Gmail connected. / Gmail disambungkan.',settings:'Google credentials are missing. Check Production environment variables.',denied:'Google permission was not granted. Nothing was connected.',expired:'The connection attempt expired or the admin session changed. Please try again.',account:'Please select the club Gmail account and allow the requested email permissions.',failed:'Could not complete the connection. Check Google credentials and the exact redirect URI, then try again.'};
 return <main className="shop" style={{maxWidth:800}}><a href="/admin/members">← Membership admin / Pentadbiran keahlian</a><h1>Club email / E-mel kelab</h1>
 {result&&messages[result]&&<p className="shop-note" role="status">{messages[result]}</p>}
 <section className="shop-card"><h2>{linked?'Connected / Disambungkan':'Connect Gmail / Sambungkan Gmail'}</h2><p>{CLUB_EMAIL}</p><p>Google settings / Tetapan Google: {configured?'Present / Tersedia':'Missing / Tiada'}</p>{linked&&<p>Authorised on / Dibenarkan pada: {new Date(linked.connected_at).toLocaleDateString('en-MY',{timeZone:'Asia/Kuala_Lumpur'})}. This confirms authorisation, not email delivery. / Ini mengesahkan kebenaran, bukan penghantaran e-mel.</p>}
 <p>The website requests permission to send email and confirm your email address. It does not request access to read or delete your inbox. Select only the club account when Google asks.</p><p>Laman web meminta kebenaran menghantar e-mel dan mengesahkan alamat e-mel anda. Ia tidak meminta akses membaca atau memadam peti masuk. Pilih akaun kelab sahaja.</p>
 {storageError&&<p className="shop-error" role="alert">{storageError}</p>}<form action={connect}><button disabled={!configured||!!storageError}>{linked?'Reconnect Gmail / Sambung semula Gmail':'Connect club Gmail / Sambung Gmail kelab'}</button></form></section>
 <section className="shop-note"><h2>Before going live / Sebelum digunakan</h2><p>While Google OAuth is in Testing, this connection normally expires after 7 days. Production readiness must be completed before relying on automatic renewal emails. / Semasa OAuth Google dalam mod Testing, sambungan ini biasanya tamat selepas 7 hari. Persediaan Production perlu diselesaikan sebelum e-mel pembaharuan automatik digunakan.</p><p>Renewal submissions are not enabled by this setup step. / Langkah persediaan ini belum mengaktifkan permohonan pembaharuan.</p></section></main>;
}
