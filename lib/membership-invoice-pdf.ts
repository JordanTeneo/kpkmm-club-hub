import type {FeeQuote} from './membership-pricing';
import {PDFDocument,rgb} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
export type InvoiceData={quote?:FeeQuote;number:string;name:string;memberNumber:string;year:number;paidOn:string;approvedAt:Date|string;amount:number;adminFee:number;voided:boolean};
// Assets are local and explicitly traced into the deployment; no remote fetches or customer URLs.
export async function membershipInvoicePdf(d:InvoiceData,bm=false){
 const [fontBytes,logoBytes]=await Promise.all([
  readFile(path.join(process.cwd(),'node_modules/@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff')),
  readFile(path.join(process.cwd(),'public/KPKMM-logo-transparent.png'))
 ]);
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
 const font=await pdf.embedFont(fontBytes,{subset:true}),logo=await pdf.embedPng(logoBytes),page=pdf.addPage([595.28,841.89]);
 const ink=rgb(.22,.15,.11),accent=rgb(.62,.29,.14),pale=rgb(.97,.94,.87);
 const t=(en:string,ms:string)=>bm?ms:en;
 function text(value:string,x:number,y:number,size=11,width=495){
  const clean=value.replace(/[\r\n\t]/g,' ');let line='',dy=0;
  for(const word of clean.split(' ')){const next=line?line+' '+word:word;if(font.widthOfTextAtSize(next,size)>width&&line){page.drawText(line,{x,y:y-dy,size,font,color:ink});line=word;dy+=size*1.5;}else line=next;}
  page.drawText(line,{x,y:y-dy,size,font,color:ink});return dy+size*1.5;
 }
 page.drawRectangle({x:0,y:815,width:596,height:27,color:accent});
 page.drawImage(logo,{x:45,y:706,width:80,height:80*logo.height/logo.width});
 text('KELAB PEMINAT KERETA MINI MALAYSIA',145,766,13,410);
 text('KPKMM',145,744,12);text('kelabpeminatkeretaminimalaysia@gmail.com',145,722,9);
 text(d.voided?t('INVOICE - APPROVAL REVERSED','INVOIS - KELULUSAN DIBATALKAN'):t('PAID INVOICE','INVOIS BERBAYAR'),45,664,20);
 text(d.number,45,638,12);
 const height=text(d.name,45,589,13);text(t('Membership number: ','Nombor ahli: ')+d.memberNumber,45,589-height-12);
 text(t('Membership year: ','Tahun keahlian: ')+d.year,45,516);
 text(t('Bank payment date: ','Tarikh bayaran bank: ')+d.paidOn,45,493);
 text(t('Payment approved: ','Bayaran diluluskan: ')+new Date(d.approvedAt).toLocaleDateString(bm?'ms-MY':'en-MY',{timeZone:'Asia/Kuala_Lumpur'}),45,470);
 page.drawRectangle({x:45,y:410,width:505,height:32,color:pale});
 text(t('Description','Butiran'),57,420);text(t('Amount (RM)','Amaun (RM)'),430,420);
 text(t('Annual membership fee','Yuran keahlian tahunan')+' '+d.year,57,384);text(((d.quote?.annual??(d.amount-d.adminFee))/100).toFixed(2),462,384);
 if(d.quote?.administration||d.adminFee){text(t('One-time administrative fee','Yuran pentadbiran sekali sahaja'),57,350);text(((d.quote?.administration??d.adminFee)/100).toFixed(2),462,350);}
 if(d.quote?.discount){text(t('Discount','Diskaun'),57,326);text('-'+(d.quote.discount/100).toFixed(2),462,326);}
 page.drawLine({start:{x:45,y:312},end:{x:550,y:312},thickness:1,color:accent});
 text(t('Total paid','Jumlah dibayar'),57,298,13);text('RM '+(d.amount/100).toFixed(2),429,298,13);
 text(d.voided?t('Approval reversed. This document is not proof of an approved payment.','Kelulusan dibatalkan. Dokumen ini bukan bukti bayaran diluluskan.'):t('Payment verified by the KPKMM committee. No further payment is due.','Bayaran disahkan jawatankuasa KPKMM. Tiada bayaran lanjut diperlukan.'),45,250,10);
 text(t('Payment method: Bank transfer - Maybank','Kaedah bayaran: Pindahan bank - Maybank'),45,204,10);
 text('Kelab Peminat Kereta Mini Malaysia | 5123 4360 5508',45,183,10);
 text(t('Computer-generated invoice. No signature is required.','Invois dijana komputer. Tandatangan tidak diperlukan.'),45,94,9);
 text('Small Cars, Big Spirit!',45,73,9);
 pdf.setTitle(d.number);pdf.setAuthor('KPKMM');pdf.setCreationDate(new Date(d.approvedAt));
 return pdf.save();
}
