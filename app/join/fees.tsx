import {getFees} from '../../lib/membership-fees';
import {feeQuote} from '../../lib/membership-pricing';
import {MembershipPrice} from '../membership-price';
export async function MembershipFees({bm}:{bm:boolean}){
 const {settings}=await getFees(),t=(a:string,b:string)=>bm?b:a;
 return <section className="shop-note"><h2>{t('Membership fees','Yuran keahlian')}</h2><h3>{t('New members — first year','Ahli baharu — tahun pertama')}</h3><MembershipPrice quote={feeQuote(settings,'new')} bm={bm}/><h3>{t('Annual renewal','Pembaharuan tahunan')}</h3><MembershipPrice quote={feeQuote(settings,'renewal')} bm={bm}/><a className="shop-link" href="/renew">{t('Renew membership →','Perbaharui keahlian →')}</a></section>;
}
