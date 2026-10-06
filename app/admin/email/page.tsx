
import {uiText} from '../../../lib/ui-text';
import {getLanguage as getUiLanguage} from '../../language';
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
 const language = await getUiLanguage(), ui = uiText(language);

 if(!(await isAdmin()))redirect('/admin');
 const {result}=await searchParams;
 let configured=false,linked:null|{email:string;connected_at:Date}=null,storageError='';
 try{googleConfig();configured=true;}catch{}
 if(!process.env.GMAIL_ENCRYPTION_KEY||process.env.GMAIL_ENCRYPTION_KEY.length<32){storageError='Add GMAIL_ENCRYPTION_KEY in Vercel Production: a new random secret of at least 32 characters. Keep ADMIN_SESSION_SECRET unchanged. Redeploy after saving. / Tambah GMAIL_ENCRYPTION_KEY dalam Vercel Production: rahsia rawak baharu sekurang-kurangnya 32 aksara. Jangan ubah ADMIN_SESSION_SECRET. Terbitkan semula selepas menyimpan.';}
 else if(!process.env.DATABASE_URL&&!process.env.POSTGRES_URL){storageError='The database connection setting is missing in Production. / Tetapan sambungan pangkalan data tiada dalam Production.';}
 else try{const saved=await connection();if(saved)linked={email:String(saved.email),connected_at:new Date(saved.connected_at)};}catch{storageError='The database could not prepare secure Gmail storage. Check the Neon connection and database permissions. / Pangkalan data tidak dapat menyediakan storan Gmail. Semak sambungan Neon dan kebenaran pangkalan data.';}
 const messages:Record<string,string>={connected:'Gmail connected. / Gmail disambungkan.',settings:'Google credentials are missing. Check Production environment variables.',denied:'Google permission was not granted. Nothing was connected.',expired:'The connection attempt expired or the admin session changed. Please try again.',account:'Please select the club Gmail account and allow the requested email permissions.',failed:'Could not complete the connection. Check Google credentials and the exact redirect URI, then try again.'};
 Object.assign(messages,{
  'token-exchange':'Google could not exchange the authorisation code. Check the client credentials and redirect URI. / Google tidak dapat menukar kod kebenaran. Semak kelayakan klien dan URI ubah hala.',
  'access-missing':'Google did not return an access token. / Google tidak memulangkan token akses.',
  'refresh-missing':'Google did not grant a lasting connection (refresh token missing). / Google tidak memberikan sambungan berterusan (token pembaharuan tiada).',
  'scope-unreported':'Google did not report the granted permissions, so the connection was not saved. / Google tidak melaporkan kebenaran yang diberikan, jadi sambungan tidak disimpan.',
  'send-permission':'The permission to send Gmail was not granted. / Kebenaran menghantar Gmail tidak diberikan.',
  'identity-check':'Google could not confirm the account identity. / Google tidak dapat mengesahkan identiti akaun.',
  'wrong-account':'The authorised account does not match the club email shown below. / Akaun yang dibenarkan tidak sepadan dengan e-mel kelab di bawah.',
  'email-unverified':'Google did not confirm that the email address is verified. / Google tidak mengesahkan alamat e-mel ini.',
  storage:'Google authorisation passed, but the connection could not be saved securely. / Kebenaran Google berjaya, tetapi sambungan tidak dapat disimpan dengan selamat.'
 });
 return <main className="shop" style={{maxWidth:800}}><a href="/admin/members">{ui("← Membership admin / Pentadbiran keahlian")}</a><h1>{ui("Club email / E-mel kelab")}</h1>
 {result&&messages[result]&&<p className="shop-note" role="status">{ui(messages[result])}{result!=='connected'&&<> <small>{ui("Reference / Rujukan: ")}{result}</small></>}</p>}
 <section className="shop-card"><h2>{linked?ui('Connected / Disambungkan'):ui('Connect Gmail / Sambungkan Gmail')}</h2><p>{CLUB_EMAIL}</p><p>{ui("Google settings / Tetapan Google: ")}{configured?ui('Present / Tersedia'):ui('Missing / Tiada')}</p>{linked&&<p>{ui("Authorised on / Dibenarkan pada: ")}{new Date(linked.connected_at).toLocaleDateString(language==='ms'?'ms-MY':'en-MY',{timeZone:'Asia/Kuala_Lumpur'})}{ui(". This confirms authorisation, not email delivery. / Ini mengesahkan kebenaran, bukan penghantaran e-mel.")}</p>}
 <p>{ui("The website requests permission to send email and confirm your email address. It does not request access to read or delete your inbox. Select only the club account when Google asks.")}</p>
 {storageError&&<p className="shop-error" role="alert">{ui(storageError)}</p>}<form action={connect}><button disabled={!configured||!!storageError}>{linked?ui('Reconnect Gmail / Sambung semula Gmail'):ui('Connect club Gmail / Sambung Gmail kelab')}</button></form></section>
 <section className="shop-note"><h2>{ui("Renewal emails / E-mel pembaharuan")}</h2><p>{ui("While Google OAuth is in Testing, this connection normally expires after 7 days. Complete production readiness before relying on unattended emails. Requests are saved even if email fails; reconnect Gmail and retry from renewal administration. / Semasa OAuth Google dalam mod Testing, sambungan biasanya tamat selepas 7 hari. Lengkapkan persediaan Production sebelum bergantung pada e-mel tanpa pengawasan. Permohonan tetap disimpan jika e-mel gagal; sambung semula Gmail dan cuba lagi dalam pentadbiran pembaharuan.")}</p><p>{ui("Keep GMAIL_ENCRYPTION_KEY unchanged: it protects both the Gmail connection and private renewal records. / Jangan ubah GMAIL_ENCRYPTION_KEY: ia melindungi sambungan Gmail dan rekod pembaharuan sulit.")}</p><a className="shop-link" href="/admin/renewals">{ui("Manage renewals and test email / Urus pembaharuan dan uji e-mel →")}</a></section></main>;
}
