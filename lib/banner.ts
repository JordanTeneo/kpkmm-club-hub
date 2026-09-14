import {db} from './shop';
export type Banner={url:string;en:string;ms:string;position:string};
export const defaultBanner:Banner={url:'/480344529_938897448327800_71183251801792565_n.jpg',en:'KPKMM TOGETHER',ms:'BERSAMA KPKMM',position:'center'};
export async function bannerReady(){await db()`CREATE TABLE IF NOT EXISTS club_banner (id integer PRIMARY KEY CHECK(id=1), settings jsonb NOT NULL)`;}
export async function getBanner(strict=false):Promise<Banner>{try{await bannerReady();const rows=await db()`SELECT settings FROM club_banner WHERE id=1`;return rows[0]?.settings||defaultBanner;}catch(e){if(strict)throw e;return defaultBanner;}}
