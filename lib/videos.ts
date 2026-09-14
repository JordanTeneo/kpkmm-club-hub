import { db } from './shop';
export type ClubVideo={id:string;youtube_id:string;title:string;description:string;event_id:string;deleted:boolean;updated_at:Date};
export function youtubeId(input:string):string|null {
  try { const url=new URL(input); if(url.protocol!=='https:'||url.username||url.password)return null;
    const host=url.hostname.toLowerCase(); let id:string|null=null;
    if(host==='youtu.be')id=url.pathname.split('/')[1];
    else if(['youtube.com','www.youtube.com','m.youtube.com'].includes(host)) {
      if(url.pathname==='/watch')id=url.searchParams.get('v');
      else if(/^\/(shorts|embed|live)\//.test(url.pathname))id=url.pathname.split('/')[2];
    }
    return id&&/^[A-Za-z0-9_-]{11}$/.test(id)?id:null;
  }catch{return null;}
}
let ready:Promise<void>|undefined;
export async function videosReady(){
  if(!ready)ready=db().begin(async sql=>{
    await sql`SELECT pg_advisory_xact_lock(708230091)`;
    await sql`CREATE TABLE IF NOT EXISTS club_videos(id uuid PRIMARY KEY,youtube_id text NOT NULL,title text NOT NULL,description text NOT NULL DEFAULT '',event_id text NOT NULL DEFAULT '',deleted boolean NOT NULL DEFAULT false,updated_at timestamptz NOT NULL DEFAULT now())`;
    await sql`INSERT INTO club_videos(id,youtube_id,title,description) VALUES('ed2426e3-66d6-4132-8803-45f9f43b0642','Q3savKE7sAM',${"PRIHATIN | 30 Warga Emas Teruja Naik Kereta Mini, Nikmati 'Kenduri Durian'"},'Buletin TV3') ON CONFLICT(id) DO NOTHING`;
  }).then(()=>{}).catch(e=>{ready=undefined;throw e;});
  await ready;
}
