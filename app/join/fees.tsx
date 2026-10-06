
import {uiText} from '../../lib/ui-text';
export function MembershipFees({bm}:{bm:boolean}) {
 const ui = uiText(bm?'ms':'en');

 const t=(en:string,ms:string)=>bm?ms:en;
 return <section className="shop-note" aria-labelledby="membership-fees">
  <h2 id="membership-fees">{t('Membership fees','Yuran keahlian')}</h2>
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',gap:'1rem'}}>
   <section style={{padding:'1.25rem',border:'1px solid rgba(80,50,30,0.2)',borderRadius:16,background:'rgba(255,255,255,0.4)'}}>
    <h3 style={{margin:'0 0 0.75rem'}}>{t('New members','Ahli baharu')}</h3>
    <p style={{margin:'0 0 0.75rem'}}><strong style={{fontSize:'2rem'}}>RM250</strong><br/>{t('for the first year','untuk tahun pertama')}</p>
    <p style={{margin:0}}>{t('Includes RM100 one-time administrative fee + RM150 annual membership fee.','Termasuk yuran pentadbiran sekali sahaja RM100 + yuran keahlian tahunan RM150.')}</p>
   </section>
   <section style={{padding:'1.25rem',border:'1px solid rgba(80,50,30,0.2)',borderRadius:16,background:'rgba(255,255,255,0.4)'}}>
    <h3 style={{margin:'0 0 0.75rem'}}>{t('Annual renewal','Pembaharuan tahunan')}</h3>
    <p style={{margin:'0 0 0.75rem'}}><strong style={{fontSize:'2rem'}}>RM150</strong><br/>{t('per year for existing members','setahun untuk ahli sedia ada')}</p>
    <p style={{margin:0}}>{t('No further administrative fee.','Tiada lagi yuran pentadbiran.')}</p>
    <p><a className="shop-link" href="/renew">{t('Renew membership →','Perbaharui keahlian →')}</a></p>
   </section>
  </div>
 </section>;
}
