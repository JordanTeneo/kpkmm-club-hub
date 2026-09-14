import {db} from './shop';
export type Banner={url:string;en:string;ms:string;position:string};
export const defaultBanner:Banner={url:'/480344529_938897448327800_71183251801792565_n.jpg',en:'KPKMM TOGETHER',ms:'BERSAMA KPKMM',position:'center'};
export async function bannerReady(){await db()`CREATE TABLE IF NOT EXISTS club_banner (id integer PRIMARY KEY CHECK(id=1), settings jsonb NOT NULL)`;}
export function decodeBanner(raw:unknown):Banner{
 for(let i=0;i<3&&typeof raw==='string';i++)raw=JSON.parse(raw);
 if(raw==null)return {...defaultBanner};
 if(typeof raw!=='object'||Array.isArray(raw))throw new Error('Invalid banner settings');
 const value=raw as Partial<Banner>;
 if(typeof value.url!=='string'||!value.url)throw new Error('Missing banner image');
 return {url:value.url,en:typeof value.en==='string'?value.en:defaultBanner.en,ms:typeof value.ms==='string'?value.ms:defaultBanner.ms,position:['top','center','bottom'].includes(value.position||'')?value.position!:defaultBanner.position};
}
export async function getBanner(strict=false):Promise<Banner>{try{await bannerReady();const rows=await db()`SELECT settings FROM club_banner WHERE id=1`;return decodeBanner(rows[0]?.settings);}catch(e){if(strict)throw e;return {...defaultBanner};}}
