import {getLanguage} from '../language';
import {MembershipCheckForm} from './form';
import '../shop/shop.css';
export const dynamic='force-dynamic';
export const metadata={title:'Check membership status | KPKMM',robots:{index:false,follow:false}};
export default async function MembershipStatusPage(){
 const bm=(await getLanguage())==='ms',t=(en:string,ms:string)=>bm?ms:en;
 return <main className="shop" style={{maxWidth:800}}><p className="eyebrow">KPKMM</p><h1>{t('Check your membership','Semak keahlian anda')}</h1><p>{t('Enter your full name exactly as registered with KPKMM, including any title. Capitalisation and extra spaces do not matter. Active membership is valid until 31 December of the current year, Malaysia time.','Masukkan nama penuh tepat seperti didaftarkan dengan KPKMM, termasuk gelaran. Huruf besar/kecil dan ruang tambahan tidak menjejaskan semakan. Keahlian aktif sah sehingga 31 Disember tahun semasa, waktu Malaysia.')}</p><section className="shop-card"><MembershipCheckForm bm={bm}/></section><section className="shop-note"><h2>{t('Status only','Status sahaja')}</h2><p>{t('Use your own registered name. Only status is shown: no member directory, contact details, identification numbers or payment receipts are revealed. Searches are limited to protect privacy.','Gunakan nama berdaftar anda sendiri. Hanya status dipaparkan: tiada senarai ahli, maklumat hubungan, nombor pengenalan atau resit bayaran didedahkan. Semakan dihadkan untuk melindungi privasi.')}</p><p>{t('Need help?','Perlukan bantuan?')} <a href="mailto:kelabpeminatkeretaminimalaysia@gmail.com">kelabpeminatkeretaminimalaysia@gmail.com</a> / <a href="tel:+60182262000">018-226 2000</a>.</p></section></main>;
}
