import {createHash,randomUUID} from 'node:crypto';
import {db,isAdmin} from './shop';
import {adminRosterReady} from './member-admin';
import {openRenewal,sealRenewal} from './renewals';
import type {PaymentHistory} from './roster';
export function paymentMarker(note:string):PaymentHistory['status']{
 const n=note.trim().toLowerCase();
 if(n==='live mber'||n==='lifetime')return 'lifetime';
 if(n.startsWith('sponsor'))return 'sponsored';
 if(/^new(?:$|[_\s-])/.test(n))return 'new';
 if(/(?:^|[\s\/-])paid(?:$|[\s\d_.,(-])/.test(n)||n==='renew')return 'paid';
 if(!n||n==='n/a')return 'inactive';
 return 'review';
}
export function splitVehicles(...values:string[]){return [...new Map(values.flatMap(v=>v.split(/[,\n\r]+/)).map(v=>v.trim().toUpperCase()).filter(Boolean).map(v=>[v.replace(/\s/g,''),v])).values()];}
type Entry={memberNumber:string;email:string;vehicles:string[];history:{year:number;note:string}[]};
export async function importMasterHistory(input:unknown,apply=false){
 if(!(await isAdmin()))throw Error('Unauthorised');
 const p=input as {source:string;members:Entry[]};
 if(!p||p.source!=='Senarai ahli_Oct2026.xlsx'||!Array.isArray(p.members)||p.members.length!==242)throw Error('Invalid master');
 const seen=new Set<string>();
 for(const m of p.members){
  if(!m||typeof m.memberNumber!=='string'||! /^[A-Za-z0-9-]{1,30}$/.test(m.memberNumber)||seen.has(m.memberNumber)||typeof m.email!=='string'||m.email.length>254||!Array.isArray(m.vehicles)||m.vehicles.length>30||m.vehicles.some(v=>typeof v!=='string'||v.length>80)||!Array.isArray(m.history)||m.history.length!==14)throw Error('Invalid member');seen.add(m.memberNumber);
  if(m.history.some((h,i)=>h.year!==2013+i||typeof h.note!=='string'||h.note.length>500))throw Error('Invalid annual history');
 }
 const raw=JSON.stringify(p),checksum=createHash('sha256').update('master-history-v1:'+raw).digest('hex');
 await adminRosterReady();
 return db().begin(async sql=>{
  await sql`LOCK TABLE club_member_roster IN SHARE ROW EXCLUSIVE MODE`;
  const prior=await sql`SELECT id FROM club_roster_imports WHERE checksum=${checksum}`;if(prior.length)return {repeated:true,records:0,lifetime:0,review:0,vehicles:0,emailConflicts:0};
  const rows=await sql`SELECT * FROM club_member_roster ORDER BY membership_year DESC FOR UPDATE`;
  const aliases=await sql`SELECT old_number,new_number FROM club_member_id_history`;
  const values:any[]=[],audits:any[]=[];const mapped=new Set<string>();let lifetime=0,review=0,vehicles=0,emailConflicts=0;
  for(const entry of p.members){
   let id=entry.memberNumber;const trail=new Set<string>();while(aliases.some(a=>a.old_number===id)){if(trail.has(id))throw Error('ID cycle');trail.add(id);id=aliases.find(a=>a.old_number===id)!.new_number;}
   if(mapped.has(id))throw Error('Duplicate member');mapped.add(id);
   const existing=rows.filter(r=>r.member_number===id),latest=existing[0];if(!latest)throw Error('Unknown member');
   const current=JSON.parse(openRenewal(latest.payload));
   const history=entry.history.map(h=>({...h,status:paymentMarker(h.note)}));
   const lifeYears=[current.lifetimeSince,...history.filter(h=>h.status==='lifetime').map(h=>h.year)].filter(y=>Number.isInteger(y));
   const lifetimeSince=lifeYears.length?Math.min(...lifeYears):undefined;if(lifetimeSince)lifetime++;
   review+=history.filter(h=>h.status==='review').length;
   const plates=splitVehicles(...(current.vehicles||[]),...entry.vehicles);if(plates.length)vehicles++;
   const email=current.email||entry.email;
   const emailConflict=!!(current.email&&entry.email&&current.email.toLowerCase()!==entry.email.toLowerCase());if(emailConflict)emailConflicts++;
   const joining=Number(id.split('-')[1])+2000;
   const years=[...new Set([...history.filter(h=>h.note||h.year>=joining).map(h=>h.year),...existing.map(r=>r.membership_year)])];
   for(const year of years){
    const old=existing.find(r=>r.membership_year===year),base=old?JSON.parse(openRenewal(old.payload)):current,h=history.find(h=>h.year===year);
    // Preserve all current/future-year activations, receipts and overrides. Lifetime is the only override.
    const isLife=!!lifetimeSince&&year>=lifetimeSince;
    const active=isLife||(year>=2026?!!old?.active:h?.status==='review'?!!old?.active:['paid','new','sponsored','lifetime'].includes(h?.status||''));
    const next={...base,memberNumber:id,active,email:base.email||email,vehicles:plates,paymentHistory:history,...(lifetimeSince?{lifetimeSince}:{}),...(emailConflict?{masterEmail:entry.email}: {})};
    if(!old)delete next.renewalActivation;
    const payload=sealRenewal(JSON.stringify(next));
    values.push({member_number:id,membership_year:year,name_hash:old?.name_hash||latest.name_hash,identity_hash:old?.identity_hash??latest.identity_hash,payload,active,status_override:year>=2026?!!old?.status_override:true});
    audits.push({id:randomUUID(),member_number:id,membership_year:year,before_payload:sealRenewal(JSON.stringify(old||null)),after_payload:payload,reason:sealRenewal('Master history import: sponsorship waives annual fee; Live Mber is lifetime. Existing 2026 annual statuses preserved; no emails sent.')});
   }
  }
  const result={repeated:false,records:values.length,lifetime,review,vehicles,emailConflicts};
  if(apply){
   await sql`INSERT INTO club_roster_edits(id,member_number,membership_year,before_payload,after_payload,reason) SELECT id,member_number,membership_year,before_payload,after_payload,reason FROM jsonb_to_recordset(${sql.json(audits)}) AS r(id uuid,member_number text,membership_year integer,before_payload text,after_payload text,reason text)`;
   await sql`INSERT INTO club_member_roster(member_number,membership_year,name_hash,identity_hash,payload,active,status_override) SELECT member_number,membership_year,name_hash,identity_hash,payload,active,status_override FROM jsonb_to_recordset(${sql.json(values)}) AS r(member_number text,membership_year integer,name_hash text,identity_hash text,payload text,active boolean,status_override boolean) ON CONFLICT(member_number,membership_year) DO UPDATE SET payload=excluded.payload,active=excluded.active,status_override=excluded.status_override,updated_at=now()`;
   await sql`INSERT INTO club_roster_imports(id,checksum,source,membership_year,total,active,payload) VALUES(${randomUUID()},${checksum},${p.source},2026,242,${values.filter(v=>v.membership_year===2026&&v.active).length},${sealRenewal(JSON.stringify({plan:p,result}))})`;
  }
  return result;
 });
}
