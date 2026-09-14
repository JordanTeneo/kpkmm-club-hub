import {getLanguage} from '../language';
import {db} from '../../lib/shop';
import {videosReady,type ClubVideo} from '../../lib/videos';
import {getClubData} from '../../lib/club-data';
import '../shop/shop.css';
export const dynamic='force-dynamic';
export const metadata={title:'Videos | KPKMM'};
export default async function Videos(){
  const bm=(await getLanguage())==='ms';const t=(en:string,ms:string)=>bm?ms:en;
  let videos:ClubVideo[]=[];let failed=false;
  try{await videosReady();videos=await db()<ClubVideo[]>`SELECT * FROM club_videos WHERE deleted=false ORDER BY updated_at DESC`;}catch{failed=true;}
  const {events}=await getClubData();
  return <main className="shop"><p className="eyebrow">KPKMM · YOUTUBE</p><h1>{t('Club videos','Video kelab')}</h1><p>{t('Club stories and moments, on film.','Kisah dan kenangan kelab dalam video.')}</p>{failed?<p role="alert">{t('Videos are temporarily unavailable. Please try again later.','Video tidak tersedia buat sementara waktu. Sila cuba lagi nanti.')}</p>:!videos.length?<p>{t('No videos published yet.','Belum ada video diterbitkan.')}</p>:videos.map(v=><article className="shop-card" key={v.id}><h2>{v.title}</h2><iframe src={'https://www.youtube-nocookie.com/embed/'+v.youtube_id} title={v.title} loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" style={{display:'block',width:'100%',aspectRatio:'16 / 9',height:'auto',border:0,borderRadius:12}}/><p style={{whiteSpace:'pre-wrap'}}>{v.description}</p>{events.find(e=>e.id===v.event_id)&&<p>{t('Club outing','Aktiviti kelab')}: <a href="/#events">{events.find(e=>e.id===v.event_id)?.title}</a></p>}<a className="shop-link" href={'https://www.youtube.com/watch?v='+v.youtube_id} target="_blank" rel="noopener noreferrer">{t('Watch on YouTube ↗','Tonton di YouTube ↗')}</a></article>)}</main>;
}
