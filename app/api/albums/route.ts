import {getPublicAlbumData} from '../../../lib/public-content';
export async function GET(request:Request){
 const id=new URL(request.url).searchParams.get('id');
 if(!id||id.length>500)return Response.json({error:'Invalid album'},{status:400});
 try{
  const data=await getPublicAlbumData();
  const photos=data.moments.filter(p=>(p.albumId||p.id)===id).map(({id,url,caption})=>({id,url,caption}));
  if(!photos.length)return Response.json({error:'Album not found'},{status:404});
  return Response.json({photos},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Album temporarily unavailable'},{status:503});}
}
