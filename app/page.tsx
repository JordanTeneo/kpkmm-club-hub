import Image from "next/image";

const facebook = "https://www.facebook.com/people/Mini-Malaysia-KPKMM/100066226611735/";
const logo = "https://scontent.fkul16-2.fna.fbcdn.net/v/t39.30808-6/612924143_1180342907516585_7828694552614307395_n.jpg";
const photos = ["https://scontent.fkul16-4.fna.fbcdn.net/v/t39.30808-6/646133977_26319588700983038_9023344281882941263_n.jpg", "https://scontent.fkul16-2.fna.fbcdn.net/v/t39.30808-6/646030079_26319589587649616_5924321005256345969_n.jpg", "https://scontent.fkul16-1.fna.fbcdn.net/v/t39.30808-6/646022497_26319588547649720_3781234041328606086_n.jpg"];

export default function Home() {
  return <main>
    <nav><Image src={logo} alt="KPKMM logo" width={48} height={48} unoptimized /><b>KPKMM</b><span><a href="#events">Events</a><a href="#gallery">Gallery</a><a href="#notices">Notices</a><a href={facebook}>Facebook ↗</a></span></nav>
    <header><Image src={logo} alt="KPKMM club logo" width={170} height={170} unoptimized priority /><p>EST. MALAYSIA · KELAB PEMINAT KERETA MINI MALAYSIA</p><h1>Small cars.<br/><i>Big spirit.</i></h1><p>Malaysia's welcoming mini-car community — sharing compact classics, memorable routes and proper days out.</p><a className="button" href="#events">Club archive →</a></header>
    <section id="events"><p className="eyebrow">ON THE ROAD</p><h2>Club archive</h2><article><b>17 MAY 2025</b><div><p className="eyebrow">COMMUNITY OUTING</p><h3>Larian Bersama Bomba</h3><p>A memorable KPKMM community outing at Dewan Kota Shah Alam, captured by the club and its members.</p></div></article></section>
    <section id="gallery"><p className="eyebrow">SHARED MOMENTS</p><h2>Outings, captured</h2><div className="gallery">{[...Array(6)].map((_, i) => <figure key={i}><Image src={photos[i % 3]} alt="KPKMM outing" fill sizes="33vw" unoptimized /><figcaption>{["Fire & wheel", "Club gathering", "On the road", "15 years together", "Mini heritage", "KPKMM family"][i]}</figcaption></figure>)}</div></section>
    <section id="notices"><p className="eyebrow">STAY IN THE LOOP</p><h2>Notice board</h2><div className="notices"><article><b>17 MAY</b><div><h3>Larian Bersama Bomba 2025</h3><p>See photographs from the Dewan Kota Shah Alam outing.</p></div></article><article><b>27 FEB</b><div><h3>15 Tahun KPKMM</h3><p>Celebrating at PD London Bus Retro Village, Kampong Si Rusa.</p></div></article><article><b>FOLLOW</b><div><h3>Latest club news</h3><p>Follow the Mini Malaysia KPKMM Facebook page.</p></div></article></div></section>
    <footer><Image src={logo} alt="KPKMM logo" width={46} height={46} unoptimized /><b>KPKMM</b><p>Kelab Peminat Kereta Mini Malaysia</p><a href="mailto:kelabpeminatkeretaminimalaysia@gmail.com">Get in touch</a></footer>
  </main>;
}
