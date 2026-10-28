import {compressPoster} from './compress-poster';

export async function prepareECard(file:File):Promise<File>{
 if(!file.size||!['image/jpeg','image/png','image/gif'].includes(file.type))throw Error('file');
 if(file.type==='image/gif'){
  if(file.size>700*1024)throw Error('gif-size');
  return file;
 }
 const image=await compressPoster(file,650*1024);
 return image===file?file:new File([image],'kpkmm-ecard.jpg',{type:image.type});
}
