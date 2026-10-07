import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {db,isAdmin} from '../../../lib/shop';
import {remindersReady,malaysiaDay} from '../../../lib/renewal-reminders';
import {getLanguage} from '../../language';
import '../../shop/shop.css';
export const dynamic='force-dynamic';
async function pause(form:FormData){'use server';if(!(await isAdmin('membership')))throw Error('Unauthorised');await remindersReady();await db()`UPDATE club_reminder_settings SET paused=${form.get('paused')!=='no'} WHERE id=1`;revalidatePath('/admin/reminders');}
export default async function Reminders(){
 if(!(await isAdmin('membership')))redirect('/admin');await remindersReady();
 const bm=(await getLanguage())==='ms',t=(en:string,ms:string)=>bm?ms:en;
 const [settings,counts,rows]=await Promise.all([db()`SELECT paused,start_date::text FROM club_reminder_settings WHERE id=1`,db()`SELECT count(*)::integer AS count FROM club_reminder_mail WHERE attempt_day=${malaysiaDay()}::date`,db()`SELECT member_number,target_year,attempt_day::text,status FROM club_reminder_mail ORDER BY created_at DESC LIMIT 100`]);
 return <main className="shop"><h1>{t('Renewal reminders','Peringatan pembaharuan')}</h1><section className="shop-card"><p>{t('Starts','Bermula')}: {settings[0].start_date} · {settings[0].paused?t('Paused','Dijeda'):t('Enabled','Diaktifkan')}</p><p>{counts[0].count} / 20 {t('attempts today (Malaysia time)','percubaan hari ini (waktu Malaysia)')}</p><p>{t('One reminder per calendar month at most. Only eligible unpaid members are included. Lifetime members, deceased records, opt-outs and pending payments are excluded. Gmail acceptance does not guarantee inbox delivery.','Maksimum satu peringatan setiap bulan kalendar. Hanya ahli layak yang belum membayar disertakan. Ahli seumur hidup, rekod meninggal dunia, pilihan berhenti dan bayaran menunggu dikecualikan.')}</p><p>{process.env.CRON_SECRET?t('Scheduler secret configured.','Rahsia penjadual dikonfigurasi.'):t('Scheduler secret is missing — reminders cannot run yet.','Rahsia penjadual belum ditetapkan — peringatan belum boleh dijalankan.')}</p><form action={pause}><input type="hidden" name="paused" value={settings[0].paused?'no':'yes'}/><button>{settings[0].paused?t('Enable reminders','Aktifkan peringatan'):t('Pause reminders','Jeda peringatan')}</button></form></section><h2>{t('Recent delivery attempts','Percubaan penghantaran terkini')}</h2>{!rows.length&&<p>{t('No reminders sent.','Tiada peringatan dihantar.')}</p>}{rows.map((r,i)=><p key={i}>{r.member_number} · {r.target_year} · {r.attempt_day} · {r.status}</p>)}</main>;
}
