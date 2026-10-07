import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {db,isAdmin} from '../../../lib/shop';
import {remindersReady,malaysiaDay} from '../../../lib/renewal-reminders';
import {getLanguage} from '../../language';
import {reminderConfig,validateReminderSettings} from '../../../lib/reminder-settings';
import '../../shop/shop.css';
export const dynamic='force-dynamic';
async function pause(form:FormData){'use server';if(!(await isAdmin('membership')))throw Error('Unauthorised');await remindersReady();await db()`UPDATE club_reminder_settings SET paused=${form.get('paused')!=='no'} WHERE id=1`;revalidatePath('/admin/reminders');}
async function save(form:FormData){
 'use server';
 if(!(await isAdmin('membership')))redirect('/admin');
 let values;try{values=validateReminderSettings(form);}catch{redirect('/admin/reminders?result=invalid');}
 try{await remindersReady();await db()`UPDATE club_reminder_settings SET start_date=${values.startDate}::date,config=${JSON.stringify(values.config)}::jsonb WHERE id=1`;}catch{redirect('/admin/reminders?result=error');}
 revalidatePath('/admin/reminders');redirect('/admin/reminders?result=saved');
}
export default async function Reminders({searchParams}:{searchParams:Promise<{result?:string}>}){
 if(!(await isAdmin('membership')))redirect('/admin');await remindersReady();
 const bm=(await getLanguage())==='ms',t=(en:string,ms:string)=>bm?ms:en;
 const [settings,counts,rows]=await Promise.all([db()`SELECT paused,start_date::text,config FROM club_reminder_settings WHERE id=1`,db()`SELECT count(*)::integer AS count FROM club_reminder_mail WHERE attempt_day=${malaysiaDay()}::date`,db()`SELECT member_number,target_year,attempt_day::text,status FROM club_reminder_mail ORDER BY created_at DESC LIMIT 100`]);
 const config=reminderConfig(settings[0].config),result=(await searchParams).result;
 return <main className="shop"><h1>{t('Renewal reminders','Peringatan pembaharuan')}</h1>
 {result&&<p role="status">{result==='saved'?t('Settings saved. No emails were sent by saving.','Tetapan disimpan. Tiada e-mel dihantar semasa menyimpan.'):result==='invalid'?t('Check the date, daily limit (1–20), interval (1–12 months), subject and message. Only {name} and {year} placeholders are supported.','Semak tarikh, had harian (1–20), selang (1–12 bulan), subjek dan mesej. Hanya {name} dan {year} disokong.'):t('Settings could not be saved. Please try again.','Tetapan tidak dapat disimpan. Sila cuba lagi.')}</p>}
 <section className="shop-card"><h2>{t('Sending status','Status penghantaran')}</h2><p>{t('Starts','Bermula')}: {settings[0].start_date} · {settings[0].paused?t('Paused','Dijeda'):t('Enabled','Diaktifkan')}</p><p>{counts[0].count} / {config.dailyLimit} {t('attempts today (Malaysia time)','percubaan hari ini (waktu Malaysia)')}</p><p>{t('Only eligible unpaid members are included. Lifetime members, deceased records, opt-outs and pending payments are excluded. Gmail acceptance does not guarantee inbox delivery.','Hanya ahli layak yang belum membayar disertakan. Ahli seumur hidup, rekod meninggal dunia, pilihan berhenti dan bayaran menunggu dikecualikan. Penerimaan Gmail tidak menjamin penghantaran ke peti masuk.')}</p><p>{process.env.CRON_SECRET?t('Scheduler secret configured.','Rahsia penjadual dikonfigurasi.'):t('Scheduler secret is missing — reminders cannot run yet.','Rahsia penjadual belum ditetapkan — peringatan belum boleh dijalankan.')}</p><form action={pause}><input type="hidden" name="paused" value={settings[0].paused?'no':'yes'}/><button>{settings[0].paused?t('Enable reminders','Aktifkan peringatan'):t('Pause reminders','Jeda peringatan')}</button></form></section>
 <section className="shop-card"><h2>{t('Reminder settings','Tetapan peringatan')}</h2><form action={save}>
 <label>{t('Start date (Malaysia time)','Tarikh mula (waktu Malaysia)')}<input type="date" name="startDate" defaultValue={settings[0].start_date} required/></label>
 <p>{t('No messages are sent before this date. From 15 December, reminders target the next membership year; otherwise they target the current year.','Tiada mesej dihantar sebelum tarikh ini. Mulai 15 Disember, peringatan untuk tahun keahlian seterusnya; selain itu untuk tahun semasa.')}</p>
 <label>{t('Daily sending limit (1–20)','Had penghantaran harian (1–20)')}<input type="number" name="dailyLimit" min={1} max={20} defaultValue={config.dailyLimit} required/></label>
 <label>{t('Repeat every (months)','Ulang setiap (bulan)')}<input type="number" name="intervalMonths" min={1} max={12} defaultValue={config.intervalMonths} required/></label>
 <p>{t('1 means monthly. The interval is measured from the last attempt; daily capacity can delay the next reminder. Saving does not reset sending history.','1 bermaksud bulanan. Selang dikira dari percubaan terakhir; had harian boleh melewatkan peringatan berikutnya. Menyimpan tidak menetapkan semula sejarah penghantaran.')}</p>
 <label>{t('Email subject','Subjek e-mel')}<input name="subject" maxLength={150} defaultValue={config.subject} required/></label>
 <label>{t('Email message','Mesej e-mel')}<textarea name="message" rows={10} maxLength={5000} defaultValue={config.message} required/></label>
 <p>{t('Use {name} for the member’s name and {year} for the renewal year. The renewal link and unsubscribe link are always added automatically. Write the email in your preferred language; switching the admin language does not translate your saved email.','Gunakan {name} untuk nama ahli dan {year} untuk tahun pembaharuan. Pautan pembaharuan dan berhenti langganan sentiasa ditambah secara automatik. Tulis e-mel dalam bahasa pilihan anda; pertukaran bahasa pentadbir tidak menterjemah e-mel tersimpan.')}</p>
 <button>{t('Save reminder settings','Simpan tetapan peringatan')}</button></form></section>
 <h2>{t('Recent delivery attempts','Percubaan penghantaran terkini')}</h2>{!rows.length&&<p>{t('No reminders sent.','Tiada peringatan dihantar.')}</p>}{rows.map((r,i)=><p key={i}>{r.member_number} · {r.target_year} · {r.attempt_day} · {r.status}</p>)}</main>;
}
