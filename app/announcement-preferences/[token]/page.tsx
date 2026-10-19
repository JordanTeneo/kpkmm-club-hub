import {notFound,redirect} from 'next/navigation';
import {db} from '../../../lib/shop';
import {announcementsReady} from '../../../lib/member-announcements';
import {getLanguage} from '../../language';
import '../../shop/shop.css';
export const metadata={robots:{index:false,follow:false},referrer:'no-referrer' as const};
async function optOut(form:FormData){
 'use server';
 const token=String(form.get('token')||'');if(!/^[a-f0-9]{64}$/.test(token))notFound();
 await announcementsReady();await db()`UPDATE club_announcement_preferences SET opt_out=true WHERE token=${token}`;redirect('/announcement-preferences/'+token+'?saved=1');
}
export default async function Preferences({params,searchParams}:{params:Promise<{token:string}>;searchParams:Promise<{saved?:string}>}){
 const {token}=await params;if(!/^[a-f0-9]{64}$/.test(token))notFound();await announcementsReady();
 if(!(await db()`SELECT 1 FROM club_announcement_preferences WHERE token=${token}`).length)notFound();
 const bm=(await getLanguage())==='ms',saved=(await searchParams).saved;
 return <main className="shop"><h1>{bm?'Pengumuman kelab':'Club announcements'}</h1>{saved?<p>{bm?'Pengumuman dihentikan. Keahlian dan peringatan pembaharuan tidak berubah.':'Announcements stopped. Your membership and renewal reminders are unchanged.'}</p>:<form action={optOut}><input type="hidden" name="token" value={token}/><p>{bm?'Ini hanya menghentikan pengumuman kelab.':'This only stops club announcements.'}</p><button>{bm?'Hentikan pengumuman':'Stop announcements'}</button></form>}</main>;
}
