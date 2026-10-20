import {randomUUID} from 'node:crypto';
import {enrolmentMessage} from './enrolment';
export type ECard={type:string;data:string};
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const wrap=(s:string)=>s.match(/.{1,76}/g)?.join('\r\n')||'';
export function validateECard(type:string,bytes:Buffer){
 const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 const jpg=bytes.subarray(0,3).equals(Buffer.from([255,216,255]));
 const gif=['GIF87a','GIF89a'].includes(bytes.subarray(0,6).toString('ascii'))&&bytes.length>=14&&bytes.readUInt16LE(6)>0&&bytes.readUInt16LE(8)>0&&bytes[bytes.length-1]===0x3b;
 if(!bytes.length||bytes.length>700*1024||!(type==='image/png'&&png||type==='image/jpeg'&&jpg||type==='image/gif'&&gif))throw Error('Invalid e-card');
 return type==='image/gif'?'gif':png?'png':'jpg';
}
export async function readECard(file:File):Promise<ECard>{
 if(!file.size||file.size>700*1024)throw Error('Choose an e-card up to 700 KB');
 const bytes=Buffer.from(await file.arrayBuffer());
 validateECard(file.type,bytes);
 // Keep the original bytes, including every GIF frame and animation timing.
 return {type:file.type,data:bytes.toString('base64')};
}
export function ecardMessage(to:string,subject:string,body:string,card:ECard){
 const extension=validateECard(card.type,Buffer.from(card.data,'base64'));
 // Reuse the existing strict single-recipient validation and encoded headers.
 const headers=Buffer.from(enrolmentMessage(to,subject,body),'base64url').toString().split('MIME-Version:')[0];
 const related='related_'+randomUUID(),alternative='alternative_'+randomUUID();
 const html='<!doctype html><html><body style="margin:0;padding:20px;background:#fff8e9;color:#352318;font-family:Arial,sans-serif"><div style="max-width:640px;margin:auto"><img src="cid:kpkmm-ecard" alt="KPKMM greeting card" style="display:block;width:100%;max-width:640px;height:auto;border:0"><div style="white-space:pre-wrap;line-height:1.6">'+escape(body)+'</div></div></body></html>';
 const part=(type:string,value:string)=>`Content-Type: ${type}; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrap(Buffer.from(value).toString('base64'))}\r\n`;
 return Buffer.from(headers+`MIME-Version: 1.0\r\nContent-Type: multipart/related; boundary="${related}"\r\n\r\n--${related}\r\nContent-Type: multipart/alternative; boundary="${alternative}"\r\n\r\n--${alternative}\r\n`+part('text/plain',body)+`--${alternative}\r\n`+part('text/html',html)+`--${alternative}--\r\n--${related}\r\nContent-Type: ${card.type}\r\nContent-ID: <kpkmm-ecard>\r\nContent-Disposition: inline; filename="kpkmm-ecard.${extension}"\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrap(card.data)}\r\n--${related}--\r\n`).toString('base64url');
}
