import {committeeEnabled,committeeSession} from '../../../lib/committee-access';
import {headers} from 'next/headers';
import {redirect} from 'next/navigation';
import {committeeAuth} from '../../../lib/committee-auth';
import {getLanguage} from '../../language';
import '../../shop/shop.css';
async function login(form:FormData){
 'use server';
 try{await committeeAuth().api.signInEmail({headers:await headers(),body:{email:String(form.get('email')||''),password:String(form.get('password')||'')}});}catch{redirect('/admin/sign-in?error=1');}
 const session=await committeeSession();redirect(session?.superAdmin?'/admin/users':'/admin');
}
export default async function SignIn({searchParams}:{searchParams:Promise<{error?:string}>}){
 const bm=(await getLanguage())==='ms',q=await searchParams,t=(en:string,ms:string)=>bm?ms:en;
 return <main className="shop" style={{maxWidth:520}}><h1>{t('Committee sign in','Log masuk jawatankuasa')}</h1>{q.error&&<p role="alert">{t('Unable to sign in. Check your details or contact the Super Admin.','Tidak dapat log masuk. Semak maklumat atau hubungi Super Admin.')}</p>}<form action={login}><label>{t('Email','E-mel')}<input name="email" type="email" required autoComplete="username"/></label><label>{t('Password','Kata laluan')}<input name="password" type="password" required autoComplete="current-password"/></label><button>{t('Sign in','Log masuk')}</button></form></main>;
}
