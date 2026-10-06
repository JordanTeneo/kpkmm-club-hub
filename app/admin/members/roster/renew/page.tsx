import {redirect,notFound} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {isAdmin,uuid} from '../../../../../lib/shop';
import {listMembers} from '../../../../../lib/member-admin';
import {renewMemberByAdmin} from '../../../../../lib/admin-renewal';
import {deliverRenewal} from '../../../../../lib/renewals';
import {malaysiaYear} from '../../../../../lib/member-status';
import {getLanguage} from '../../../../language';
import {ShopForm} from '../../../../shop/forms';
import '../../../../shop/shop.css';
export const dynamic='force-dynamic';
export const metadata={title:'Renew member | KPKMM',robots:{index:false,follow:false}};
async function renew(_: {error?:string;success?:string},form:FormData){
 'use server';
 const bm=(await getLanguage())==='ms',t=(en:string,ms:string)=>bm?ms:en;
 if(!(await isAdmin()))return {error:t('Please sign in again.','Sila log masuk semula.')};
 let result:string;try{result=await renewMemberByAdmin(form);}catch{return {error:t('Unable to confirm renewal. Refresh and check the renewal records before trying again.','Tidak dapat mengesahkan pembaharuan. Muat semula dan semak rekod sebelum mencuba lagi.')};}
 if(!uuid(result)){
  const errors:Record<string,[string,string]>={lifetime:['Lifetime member: no annual renewal or payment is required.','Ahli seumur hidup: tiada pembaharuan atau bayaran tahunan diperlukan.'],proof:['Attach a JPG, PNG or PDF payment proof under 700 KB.','Lampirkan bukti bayaran JPG, PNG atau PDF di bawah 700 KB.'],existing:['A renewal already exists for this member and year. Review it in Renewals; its proof has not been overwritten.','Pembaharuan ahli dan tahun ini sudah wujud. Semak dalam Pembaharuan; bukti asal tidak ditindih.'],missing:['Member not found. Return to the listing and select the member again.','Ahli tidak ditemui. Kembali ke senarai dan pilih ahli semula.'],invalid:['Choose this year or next year, confirm verified payment and provide a committee note.','Pilih tahun ini atau tahun depan, sahkan bayaran dan berikan catatan jawatankuasa.']};
  return {error:t(...(errors[result]||errors.invalid))};
 }
 try{await deliverRenewal(result);}catch{/* Renewal and proof remain saved independently of email. */}
 for(const path of ['/admin/members/roster','/admin/renewals','/membership-status'])revalidatePath(path);
 return {success:t('Renewal saved with payment proof. Membership is active for the selected year until 31 December. The existing membership number is unchanged. View the receipt under Renewals → Approved.','Pembaharuan dan bukti bayaran disimpan. Keahlian aktif untuk tahun dipilih sehingga 31 Disember. Nombor ahli dikekalkan. Lihat resit di Pembaharuan → Diluluskan.')};
}
export default async function AdminRenew({searchParams}:{searchParams:Promise<{member?:string;year?:string}>}){
 if(!(await isAdmin()))redirect('/admin');
 const bm=(await getLanguage())==='ms',t=(en:string,ms:string)=>bm?ms:en,q=await searchParams,current=malaysiaYear();
 if(!/^[A-Za-z0-9-]{1,30}$/.test(q.member||''))notFound();
 const member=(await listMembers(current+1)).find(m=>m.memberNumber===q.member);if(!member)notFound();
 if(Number.isInteger(member.lifetimeSince)&&member.lifetimeSince!<=current)return <main className="shop"><a href="/admin/members/roster">{t('Member listing','Senarai ahli')}</a><h1>{t('Lifetime membership','Keahlian seumur hidup')}</h1><p>{t('This member remains active without annual payment or renewal.','Ahli ini kekal aktif tanpa bayaran atau pembaharuan tahunan.')}</p></main>;
 const year=Number(q.year)===current+1?current+1:current;
 return <main className="shop" style={{maxWidth:850}}><a href="/admin/members/roster">← {t('Member listing','Senarai ahli')}</a><h1>{t('Renew membership','Perbaharui keahlian')}</h1><section className="shop-card"><h2>{member.name}</h2><p>{member.memberNumber}</p><p>{t('RM150 annual membership fee. The membership number remains unchanged. This is a committee-approved renewal; check eligibility or authorise reinstatement before proceeding.','Yuran keahlian tahunan RM150. Nombor ahli dikekalkan. Ini pembaharuan diluluskan jawatankuasa; semak kelayakan atau benarkan pengaktifan semula sebelum meneruskan.')}</p><ShopForm action={renew} label={t('Save proof and activate membership','Simpan bukti dan aktifkan keahlian')} confirm={t('Confirm verified payment and activate this member for the selected year?','Sahkan bayaran dan aktifkan ahli bagi tahun dipilih?')}><input type="hidden" name="member" value={member.memberNumber}/><label>{t('Renewal year','Tahun pembaharuan')}<select name="year" defaultValue={year}><option value={current}>{current}</option><option value={current+1}>{current+1}</option></select></label><p>{t('Membership ends on 31 December of the selected year. Paying for next year does not activate this year.','Keahlian tamat pada 31 Disember tahun dipilih. Bayaran tahun depan tidak mengaktifkan tahun ini.')}</p><label>{t('Payment proof (required) — JPG, PNG or PDF, under 700 KB','Bukti bayaran (wajib) — JPG, PNG atau PDF, di bawah 700 KB')}<input name="proof" type="file" accept="image/jpeg,image/png,application/pdf" required/></label><label>{t('Committee note / reinstatement reason','Catatan jawatankuasa / sebab pengaktifan semula')}<textarea name="reason" required minLength={3} maxLength={500} rows={3}/></label><label className="shop-consent"><input name="verified" type="checkbox" value="yes" required/>{t('I have verified the RM150 bank payment and committee approval, including reinstatement where necessary.','Saya mengesahkan bayaran bank RM150 dan kelulusan jawatankuasa, termasuk pengaktifan semula jika perlu.')}</label></ShopForm></section><p><a className="shop-link" href="/admin/renewals?status=approved">{t('View approved renewals and payment proofs','Lihat pembaharuan diluluskan dan bukti bayaran')}</a></p><p><a href="/admin/renewals">{t('Review existing pending renewals','Semak pembaharuan sedia ada yang menunggu')}</a></p></main>;
}
