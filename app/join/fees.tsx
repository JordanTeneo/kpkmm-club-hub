export function MembershipFees({bm}:{bm:boolean}) {
 const t=(en:string,ms:string)=>bm?ms:en;
 return <section className="shop-note" aria-labelledby="membership-fees">
  <h2 id="membership-fees">{t('Membership fees','Yuran keahlian')}</h2>
  <dl style={{margin:0}}>
   {[
    [t('Administrative fee — new members, one time only','Yuran pentadbiran — ahli baharu, sekali sahaja'),'RM100'],
    [t('Annual membership fee','Yuran keahlian tahunan'),t('RM150 per year','RM150 setahun')],
    [t('New member: first-year total','Ahli baharu: jumlah tahun pertama'),'RM250'],
    [t('Subsequent annual renewal','Pembaharuan tahunan seterusnya'),t('RM150 per year','RM150 setahun')],
   ].map(([label,amount])=><div key={label} style={{display:'flex',flexWrap:'wrap',gap:'0.5rem 1rem',justifyContent:'space-between',padding:'0.75rem 0',borderBottom:'1px solid rgba(80,50,30,0.15)'}}><dt>{label}</dt><dd style={{margin:0,fontWeight:700}}>{amount}</dd></div>)}
  </dl>
  <p>{t('The RM100 administrative fee is charged only when joining, not on annual renewal. Submitting this request does not make a payment or confirm membership.','Yuran pentadbiran RM100 dikenakan sekali sahaja semasa menyertai kelab, bukan semasa pembaharuan tahunan. Penghantaran permohonan ini bukan pembayaran atau pengesahan keahlian.')}</p>
 </section>;
}
