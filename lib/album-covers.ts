import type {ClubMoment,ClubItem} from './club-data';
export type AlbumCover={id:string;cover:ClubMoment;count:number;eventTitle?:string};
export function albumCovers(photos:ClubMoment[],events:ClubItem[]):AlbumCover[]{
 const groups=new Map<string,AlbumCover>(),titles=new Map(events.map(e=>[e.id,e.title]));
 for(const photo of photos){const id=photo.albumId||photo.id,entry=groups.get(id);if(entry)entry.count++;else groups.set(id,{id,cover:photo,count:1,eventTitle:titles.get(photo.eventId||'')});}
 return [...groups.values()];
}
