import {notFound,redirect} from 'next/navigation';
import {db} from '../../../lib/shop';
import {remindersReady} from '../../../lib/renewal-reminders';
import {getLanguage} from '../../language';
import '../../shop/shop.css';
export const metadata={robots:{index:false,follow:false},referrer:'no-referrer' as const};
async function optOut(form:FormData){
 'use server';
 const token=String(form.get('token')||'');if(!/^[a-f0-9]{64}$/.test(token))notFound();
 await remindersReady();await db()`UPDATE club_reminder_preferences SET opt_out=true WHERE token=${token}`;redirect('/reminder-preferences/'+token+'?saved=1');
}
export default async function Preferences({params,searchParams}:{params:Promise<{token:string}>;searchParams:Promise<{saved?:string}>}){
 const {token}=await params;if(!/^[a-f0-9]{64}$/.test(token))notFound();await remindersReady();
 if(!(await db()`SELECT 1 FROM club_reminder_preferences WHERE token=${token}`).length)notFound();
 const bm=(await getLanguage())==='ms',saved=(await searchParams).saved;
 return <main className="shop"><h1>{bm?'Peringatan keahlian':'Membership reminders'}</h1>{saved?<p>{bm?'Peringatan dihentikan. Keahlian anda tidak berubah.':'Reminders stopped. Your membership is unchanged.'}</p>:<form action={optOut}><input type="hidden" name="token" value={token}/><p>{bm?'Ini hanya menghentikan peringatan pembaharuan.':'This only stops renewal reminders.'}</p><button>{bm?'Hentikan peringatan':'Stop reminders'}</button></form>}</main>;
}
