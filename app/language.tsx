import {cookies} from 'next/headers';
import {revalidatePath} from 'next/cache';
import {SiteNavigation} from './site-navigation';
export type Language='en'|'ms';
export async function getLanguage():Promise<Language>{return (await cookies()).get('kpkmm-language')?.value==='ms'?'ms':'en';}
async function changeLanguage(form:FormData){
 'use server';
 const value=form.get('language');if(value!=='en'&&value!=='ms')return;
 (await cookies()).set('kpkmm-language',value,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:31536000});revalidatePath('/','layout');
}
export function LanguageBar({lang}:{lang:Language}){
 return <SiteNavigation bm={lang==='ms'}><form action={changeLanguage} aria-label={lang==='ms'?'Pilih bahasa':'Choose language'}><button name="language" value="en" lang="en" aria-label="English" aria-pressed={lang==='en'}>EN</button><button name="language" value="ms" lang="ms" aria-label="Bahasa Malaysia" aria-pressed={lang==='ms'}>BM</button></form></SiteNavigation>;
}
