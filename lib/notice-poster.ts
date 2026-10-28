import {isAdmin} from './shop';
import {getClubData,saveClubData,savePhoto} from './club-data';

export async function uploadNoticePoster(form:FormData):Promise<{error?:string}>{
 if(!await isAdmin('content'))return {error:'session'};
 const id=String(form.get('id')||''),file=form.get('poster');
 if(!id||id.length>200||!(file instanceof File)||!file.size||file.size>750*1024)return {error:'file'};
 const bytes=Buffer.from(await file.arrayBuffer());
 const valid=file.type==='image/jpeg'&&bytes.subarray(0,3).equals(Buffer.from([255,216,255]))||file.type==='image/png'&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||file.type==='image/webp'&&bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';
 if(!valid)return {error:'file'};
 try{
  // Never overwrite saved club content with fallback data after a storage read failure.
  const data=await getClubData(true),notice=data.notices.find(n=>n.id===id);
  if(!notice)return {error:'missing'};
  const stored=await savePhoto(file);
  notice.posterUrl=stored.url;
  await saveClubData(data);
  return {};
 }catch{return {error:'storage'};}
}
