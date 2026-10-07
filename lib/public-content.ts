import {unstable_cache} from 'next/cache';
import {getBanner,defaultBanner} from './banner';
import {getClubData,fallbackData} from './club-data';
import {db} from './shop';
import {videosReady,type ClubVideo} from './videos';

// Only already-public website content belongs here. Admin reads stay uncached.
// Reject errors inside the cache so a temporary outage never caches fallback data.
const banner=unstable_cache(()=>getBanner(true),['public-banner-v1'],{tags:['public-banner'],revalidate:300});
const club=unstable_cache(()=>getClubData(true),['public-club-v1'],{tags:['public-club'],revalidate:300});
const videos=unstable_cache(async()=>{
 await videosReady();
 return await db()<ClubVideo[]>`SELECT * FROM club_videos WHERE deleted=false ORDER BY updated_at DESC`;
},['public-videos-v1'],{tags:['public-videos'],revalidate:300});

export async function getPublicContent(){
 const [homeBanner,data,clubVideos]=await Promise.all([
  banner().catch(()=>({...defaultBanner})),
  club().catch(()=>structuredClone(fallbackData)),
  videos().catch(()=>[] as ClubVideo[])
 ]);
 return {homeBanner,data,videos:clubVideos};
}
