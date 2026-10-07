import {timingSafeEqual} from 'node:crypto';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
import {db,isAdmin,digest} from '../../../../lib/shop';
import {CLUB_EMAIL,SITE_ORIGIN,CALLBACK,SEND_SCOPE,tokenRequest,gmailReady,encryptToken} from '../../../../lib/gmail';
export const runtime='nodejs';
export const dynamic='force-dynamic';
function finish(result:string){const response=NextResponse.redirect(SITE_ORIGIN+'/admin/email?result='+result);response.headers.set('Cache-Control','no-store');response.headers.set('Referrer-Policy','no-referrer');return response;}
export async function GET(request:Request){
 const jar=await cookies(),saved=jar.get('kpkmm-gmail-state')?.value;
 jar.set('kpkmm-gmail-state','',{httpOnly:true,secure:true,sameSite:'lax',path:'/api/gmail/callback',maxAge:0});
 if(!(await isAdmin('membership'))||!saved)return finish('expired');
 const query=new URL(request.url).searchParams,state=query.get('state')||'';
 const [expected,session]=saved.split('.');
 if(!/^[a-f0-9]{64}$/.test(state)||!expected||state.length!==expected.length||!timingSafeEqual(Buffer.from(state),Buffer.from(expected))||session!==digest(jar.get('kpkmm-admin')!.value))return finish('expired');
 if(query.has('error'))return finish('denied');
 const code=query.get('code');if(!code||code.length>4096)return finish('failed');
 let stage='token-exchange';
 try{
  const tokens=await tokenRequest({grant_type:'authorization_code',code,redirect_uri:CALLBACK});
  if(!tokens.access_token)return finish('access-missing');
  if(!tokens.refresh_token)return finish('refresh-missing');
  if(!tokens.scope)return finish('scope-unreported');
  if(!tokens.scope.split(' ').includes(SEND_SCOPE))return finish('send-permission');
  stage='identity-check';
  const info=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+tokens.access_token},cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!info.ok)return finish('identity-check');
  const user=await info.json();
  if(user.email!==CLUB_EMAIL)return finish('wrong-account');
  if(user.email_verified!==true)return finish('email-unverified');
  stage='storage';
  await gmailReady();await db()`INSERT INTO club_gmail_connection(id,email,token) VALUES(1,${CLUB_EMAIL},${encryptToken(tokens.refresh_token)}) ON CONFLICT(id) DO UPDATE SET email=EXCLUDED.email,token=EXCLUDED.token,connected_at=now()`;
  return finish('connected');
 }catch{return finish(stage);}
}
