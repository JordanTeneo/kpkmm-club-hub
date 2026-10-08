import {cookies} from 'next/headers';
import {revalidatePath} from 'next/cache';
import {SiteNavigation} from './site-navigation';
import {marketplaceEnabled} from '../lib/shop-settings';
export type Language='en'|'ms';
export async function getLanguage():Promise<Language>{return (await cookies()).get('kpkmm-language')?.value==='ms'?'ms':'en';}
async function changeLanguage(form:FormData){
 'use server';
 const value=form.get('language');if(value!=='en'&&value!=='ms')return;
 (await cookies()).set('kpkmm-language',value,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:31536000});revalidatePath('/','layout');
}
export async function LanguageBar({lang}:{lang:Language}){
 let showMarketplace=false;
 try{showMarketplace=await marketplaceEnabled();}catch{/* Keep other navigation usable if storage is unavailable. */}
 return <SiteNavigation bm={lang==='ms'} showMarketplace={showMarketplace}>{(['en','ms'] as const).map(language=><form key={language} action={changeLanguage} aria-label={language==='en'?'English':'Bahasa Malaysia'}><input type="hidden" name="language" value={language}/><button type="submit" lang={language} aria-label={language==='en'?'English':'Bahasa Malaysia'} aria-pressed={lang===language}>{language==='en'?'EN':'BM'}</button></form>)}</SiteNavigation>;
}
