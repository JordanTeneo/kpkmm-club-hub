import {createCipheriv,createDecipheriv,hkdfSync,randomBytes} from 'node:crypto';
import {db} from './shop';

export const CLUB_EMAIL='kelabpeminatkeretaminimalaysia@gmail.com';
export const SITE_ORIGIN='https://kpkmm-club-hub.vercel.app';
export const CALLBACK=SITE_ORIGIN+'/api/gmail/callback';
export const SEND_SCOPE='https://www.googleapis.com/auth/gmail.send';
export function googleConfig(){
 const id=process.env.GOOGLE_CLIENT_ID?.trim(),secret=process.env.GOOGLE_CLIENT_SECRET?.trim();
 if(!id||!secret)throw Error('Google settings missing');
 return {id,secret};
}
function key(){const secret=process.env.ADMIN_SESSION_SECRET;if(!secret||secret.length<24)throw Error('Encryption unavailable');return Buffer.from(hkdfSync('sha256',secret,'kpkmm-gmail-v1','oauth-refresh-token',32));}
export function encryptToken(value:string){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),iv);const data=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return [iv,cipher.getAuthTag(),data].map(b=>b.toString('base64')).join('.');}
export function decryptToken(value:string){const [iv,tag,data]=value.split('.').map(v=>Buffer.from(v,'base64'));const cipher=createDecipheriv('aes-256-gcm',key(),iv);cipher.setAuthTag(tag);return Buffer.concat([cipher.update(data),cipher.final()]).toString('utf8');}
export async function gmailReady(){key();await db()`CREATE TABLE IF NOT EXISTS club_gmail_connection(id integer PRIMARY KEY CHECK(id=1),email text NOT NULL,token text NOT NULL,connected_at timestamptz NOT NULL DEFAULT now())`;}
export async function connection(){await gmailReady();const rows=await db()`SELECT email,connected_at FROM club_gmail_connection WHERE id=1`;return rows[0]||null;}
export async function tokenRequest(params:Record<string,string>){
 const {id,secret}=googleConfig();
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...params,client_id:id,client_secret:secret}),cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Google token request failed');
 return await response.json() as {access_token?:string;refresh_token?:string;scope?:string};
}
