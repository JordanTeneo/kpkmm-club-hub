import {getLanguage} from '../language';
import {MembershipCheckForm} from './form';
import '../shop/shop.css';
export const dynamic='force-dynamic';
export const metadata={title:'Check membership status | KPKMM',robots:{index:false,follow:false}};
export default async function MembershipStatusPage(){
 const bm=(await getLanguage())==='ms',t=(en:string,ms:string)=>bm?ms:en;
 return <main className="shop" style={{maxWidth:800}}><p className="eyebrow">KPKMM</p><h1>{t('Check your membership','Semak keahlian anda')}</h1><p>{t('Enter your MyKad number. Membership is Active only when an approved membership or renewal exists for the current year. Otherwise, it is Inactive. Active membership expires on 31 December, Malaysia time.','Masukkan nombor MyKad anda. Keahlian Aktif hanya apabila terdapat keahlian atau pembaharuan diluluskan untuk tahun semasa. Jika tiada, status ialah Tidak aktif. Keahlian aktif tamat pada 31 Disember, waktu Malaysia.')}</p><section className="shop-card"><MembershipCheckForm bm={bm}/></section><section className="shop-note"><h2>{t('Status only','Status sahaja')}</h2><p>{t('No email or passport details are needed. Use your own MyKad number. Only membership status is shown; names, addresses, identification numbers and payment receipts are not revealed. Checks are limited to protect member privacy.','E-mel atau maklumat pasport tidak diperlukan. Gunakan nombor MyKad anda sendiri. Hanya status keahlian dipaparkan; nama, alamat, nombor pengenalan dan resit bayaran tidak didedahkan. Semakan dihadkan untuk melindungi privasi ahli.')}</p><p>{t('Need help?','Perlukan bantuan?')} <a href="mailto:kelabpeminatkeretaminimalaysia@gmail.com">kelabpeminatkeretaminimalaysia@gmail.com</a> / <a href="tel:+60182262000">018-226 2000</a>.</p></section></main>;
}
