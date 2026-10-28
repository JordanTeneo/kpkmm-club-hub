export async function compressPoster(file:File):Promise<File>{
 if(!/^image\/(jpeg|png|webp)$/.test(file.type)||!file.size)throw Error('file');
 if(file.size>40*1024*1024)throw Error('size');
 if(file.size<=750*1024)return file;
 const bitmap=await createImageBitmap(file);
 try{
  const canvas=document.createElement('canvas'),context=canvas.getContext('2d');
  if(!context)throw Error('compress');
  for(const edge of [2400,1920,1440,1080]){
   const scale=Math.min(1,edge/Math.max(bitmap.width,bitmap.height));
   canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
   context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);
   context.drawImage(bitmap,0,0,canvas.width,canvas.height);
   for(const quality of [0.9,0.8,0.68,0.5]){
    const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
    if(blob&&blob.size<=750*1024)return new File([blob],'notice-poster.jpg',{type:'image/jpeg'});
   }
  }
  throw Error('compress');
 }finally{bitmap.close();}
}
