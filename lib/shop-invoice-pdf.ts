import {PDFDocument,rgb} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {orderPriceLines} from './shop-order-pricing';
import type {ShopInvoiceSnapshot} from './shop-invoices';
export async function shopInvoicePdf(invoice:{number:string;issuedAt:Date;order:ShopInvoiceSnapshot},bm=false){
 const {order}=invoice,t=(en:string,ms:string)=>bm?ms:en;
 const [fontBytes,logoBytes]=await Promise.all([readFile(path.join(process.cwd(),'node_modules/@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff')),readFile(path.join(process.cwd(),'public/KPKMM-logo-transparent.png'))]);
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
 const font=await pdf.embedFont(fontBytes,{subset:true}),logo=await pdf.embedPng(logoBytes);
 let page=pdf.addPage([595.28,841.89]),y=660;
 const ink=rgb(.22,.15,.11),accent=rgb(.62,.29,.14);
 page.drawRectangle({x:0,y:815,width:596,height:27,color:accent});
 page.drawImage(logo,{x:45,y:706,width:80,height:80*logo.height/logo.width});
 page.drawText('KELAB PEMINAT KERETA MINI MALAYSIA',{x:145,y:766,size:13,font,color:ink});
 page.drawText('KPKMM',{x:145,y:742,size:12,font,color:ink});
 page.drawText('kelabpeminatkeretaminimalaysia@gmail.com',{x:145,y:720,size:9,font,color:ink});
 function text(value:string,size=11){
  const chars=[...value.replace(/[\r\n\t]/g,' ')];let line='';
  const flush=()=>{if(y<65){page=pdf.addPage([595.28,841.89]);y=780;}page.drawText(line,{x:45,y,size,font,color:ink});y-=size*1.55;line='';};
  for(const ch of chars){if(font.widthOfTextAtSize(line+ch,size)>500)flush();line+=ch;}if(line)flush();
 }
 text(t('PAID MARKETPLACE INVOICE','INVOIS KEDAI BERBAYAR'),20);text(invoice.number,12);y-=16;
 text(order.customer_name,13);text(t('Order reference: ','Rujukan tempahan: ')+order.id,10);
 text(t('Payment approved: ','Bayaran diluluskan: ')+new Date(invoice.issuedAt).toLocaleDateString(bm?'ms-MY':'en-MY',{timeZone:'Asia/Kuala_Lumpur'}));y-=12;
 text(t('Item: ','Barangan: ')+order.product_name);y-=10;
 for(const [label,value] of orderPriceLines(order,bm)){
  const total=label===(bm?'Jumlah bayaran yang perlu disahkan':'Expected payment total');
  text((total?t('Total paid','Jumlah dibayar'):label)+': '+value,total?13:11);
 }
 y-=12;text(t('Fulfilment: ','Kaedah penerimaan: ')+(order.fulfilment==='delivery'?t('Delivery','Penghantaran'):order.fulfilment==='pickup'?t('Pickup','Pengambilan'):t('Not recorded','Tidak direkodkan')));
 y-=12;text(t('Bank transfer - Maybank','Pindahan bank - Maybank'));text('Kelab Peminat Kereta Mini Malaysia | 5123 4360 5508',10);
 y-=12;text(t('Payment verified by KPKMM. No further payment is due.','Bayaran disahkan KPKMM. Tiada bayaran lanjut diperlukan.'),10);
 text(t('Computer-generated invoice. No signature is required.','Invois dijana komputer. Tandatangan tidak diperlukan.'),9);
 pdf.setTitle(invoice.number);pdf.setAuthor('KPKMM');pdf.setCreationDate(new Date(invoice.issuedAt));return pdf.save();
}
