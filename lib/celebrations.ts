import 'server-only';
import {unstable_cache} from 'next/cache';
import {db,isAdmin} from './shop';
import {savePhoto} from './club-data';
import {randomUUID} from 'node:crypto';
export type Celebration={id:string;en:string;ms:string;url:string;starts:string;ends:string;enabled:boolean};
let ready:Promise<void>|undefined;
async function prepare(){if(!ready)ready=(async()=>{await db()`CREATE TABLE IF NOT EXISTS club_celebrations(id uuid PRIMARY KEY, settings jsonb NOT NULL)`;})().catch(e=>{ready=undefined;throw e;});await ready;}
export async function listCelebrations(){await prepare();const rows=await db()`SELECT settings FROM club_celebrations`;return rows.map(r=>r.settings as Celebration).sort((a,b)=>b.starts.localeCompare(a.starts));}
export function validDates(start:string,end:string){return [start,end].every(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d)&&start<=end;}
export function visibleCelebrations(items:Celebration[],now=new Date()){const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);return items.filter(c=>c.enabled&&c.starts<=today&&c.ends>=today);}
const cached=unstable_cache(listCelebrations,['celebrations-v1'],{tags:['public-celebrations'],revalidate:300});
export async function publicCelebrations(){try{return visibleCelebrations(await cached());}catch{return [];}}
export async function saveCelebration(form:FormData){
 if(!await isAdmin('content'))throw Error('access');
 const id=String(form.get('id')||'');if(id&&!/^[0-9a-f-]{36}$/.test(id))throw Error('invalid');
 await prepare();
 if(form.get('operation')==='delete'){if(!id)throw Error('invalid');await db()`DELETE FROM club_celebrations WHERE id=${id}`;return;}
 const en=String(form.get('en')||'').trim(),ms=String(form.get('ms')||'').trim(),starts=String(form.get('starts')||''),ends=String(form.get('ends')||'');
 if(!en||!ms||en.length>300||ms.length>300||!validDates(starts,ends))throw Error('invalid');
 const old=id?(await listCelebrations()).find(c=>c.id===id):undefined;if(id&&!old)throw Error('missing');
 let url=old?.url||'';const photo=form.get('photo');
 if(photo instanceof File&&photo.size){if(!/^image\/(jpeg|png|webp)$/.test(photo.type)||photo.size>750*1024)throw Error('image');url=(await savePhoto(photo)).url;}
 if(!url)throw Error('image');
 const settings:Celebration={id:id||randomUUID(),en,ms,starts,ends,url,enabled:form.get('enabled')==='yes'};
 await db()`INSERT INTO club_celebrations(id,settings) VALUES(${settings.id},${db().json(settings)}) ON CONFLICT(id) DO UPDATE SET settings=excluded.settings`;
}
