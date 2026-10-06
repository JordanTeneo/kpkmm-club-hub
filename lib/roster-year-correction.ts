import {createHash,randomUUID} from 'node:crypto';
import {db,isAdmin} from './shop';
import {adminRosterReady} from './member-admin';
import {membershipReady,fingerprint} from './membership';
import {renewalsReady,renewalHash,sealRenewal,openRenewal} from './renewals';

type Plan={source:string;fromYear:2026;toYear:2025;members:{memberNumber:string;active:boolean}[]};
export function validateYearCorrection(input:unknown):Plan{
 const p=input as Plan;
 if(!p||p.source!=='Senarai ahli_Oct2026 only.xlsx'||p.fromYear!==2026||p.toYear!==2025||!Array.isArray(p.members)||p.members.length!==242)throw Error('Invalid correction plan');
 const ids=new Set<string>();
 for(const m of p.members){if(!m||typeof m.memberNumber!=='string'||! /^[A-Za-z0-9-]{1,30}$/.test(m.memberNumber)||typeof m.active!=='boolean'||ids.has(m.memberNumber))throw Error('Invalid member');ids.add(m.memberNumber);}
 if(p.members.filter(m=>m.active).length!==67)throw Error('Expected 67 paid or new members');
 return {source:p.source,fromYear:2026,toYear:2025,members:p.members.map(m=>({memberNumber:m.memberNumber,active:m.active})).sort((a,b)=>a.memberNumber.localeCompare(b.memberNumber))};
}
// Only remove the erroneous imported 2026 activation, never an independent payment.
export function corrected2026Active(originalActive:boolean,currentActive:boolean,independentlyApproved:boolean){
 return independentlyApproved||(!originalActive&&currentActive);
}
export async function correctRosterYear(input:unknown,apply=false){
 if(!(await isAdmin()))throw Error('Unauthorised');
 if(apply)throw Error('Superseded correction: 2026 status must be preserved');
 const p=validateYearCorrection(input),checksum=createHash('sha256').update('year-correction-v1:'+JSON.stringify(p)).digest('hex');
 await adminRosterReady();await membershipReady();await renewalsReady();
 return db().begin(async sql=>{
  await sql`LOCK TABLE club_member_roster IN SHARE ROW EXCLUSIVE MODE`;
  const prior=await sql`SELECT id FROM club_roster_imports WHERE checksum=${checksum}`;
  if(prior.length)return {repeated:true,total:242,active2025:67,cleared2026:0,preserved2026:0};
  const imports=await sql`SELECT payload FROM club_roster_imports WHERE source=${p.source} AND membership_year=2026 ORDER BY created_at ASC LIMIT 1`;
  if(!imports.length)throw Error('Original import missing');
  const original=JSON.parse(openRenewal(imports[0].payload));
  const originalMembers=new Map<string,any>(original.members.map((m:any)=>[m.memberNumber,m]));
  const aliases=await sql`SELECT old_number,new_number FROM club_member_id_history`;
  const resolve=(id:string)=>{const seen=new Set<string>();while(aliases.some(a=>a.old_number===id)){if(seen.has(id))throw Error('ID history conflict');seen.add(id);id=aliases.find(a=>a.old_number===id)!.new_number;}return id;};
  const allRows=await sql`SELECT * FROM club_member_roster WHERE membership_year IN (2025,2026) FOR UPDATE`;
  const apps=await sql`SELECT identity_hash FROM club_applications WHERE status='approved' AND membership_year=2026`;
  const renewals=await sql`SELECT identity_hash FROM club_renewals WHERE review_status='approved' AND renewal_year=2026`;
  const allEdits=await sql`SELECT member_number,before_payload,after_payload FROM club_roster_edits WHERE membership_year=2026`;
  const historicalRows:any[]=[],currentRows:any[]=[],audits:any[]=[];
  const resolved=new Set<string>();let cleared2026=0,preserved2026=0;
  for(const entry of p.members){
   const imported=originalMembers.get(entry.memberNumber);if(!imported)throw Error('Not in original import');
   const id=resolve(entry.memberNumber);if(resolved.has(id))throw Error('Duplicate mapped ID');resolved.add(id);
   const rows=allRows.filter(r=>r.member_number===id);
   const current=rows.find(r=>r.membership_year===2026),old=rows.find(r=>r.membership_year===2025);
   if(!current)throw Error('Current record missing');
   const member=JSON.parse(openRenewal(current.payload));
   const key=member.identityType==='passport'?'passport:'+(member.country||'Malaysia').toLowerCase()+':'+member.identity:/^\d{12}$/.test(member.identity||'')?'mykad:malaysia:'+member.identity:null;
   const hashes=[current.identity_hash,key?renewalHash(key):null,renewalHash('roster-member:'+id)].filter(Boolean);
   // A later explicit status change is independent of the original import.
   const edits=allEdits.filter(e=>e.member_number===id);
   const separatelyActivated=current.active&&edits.some(e=>{const before=JSON.parse(openRenewal(e.before_payload)),after=JSON.parse(openRenewal(e.after_payload));return before.active===false&&after.active===true;});
   const active=corrected2026Active(imported.active,current.active,!!((key&&apps.some(a=>a.identity_hash===fingerprint(key)))||renewals.some(r=>hashes.includes(r.identity_hash))||separatelyActivated));
   if(active)preserved2026++;else if(current.active)cleared2026++;
   if(!apply)continue;
   const historical={...(old?JSON.parse(openRenewal(old.payload)):member),memberNumber:id,active:entry.active};
   delete historical.renewalActivation;
   const historicalPayload=sealRenewal(JSON.stringify(historical));
   const reason=sealRenewal('Committee confirmed spreadsheet paid/new markers belong to 2025, not 2026. No new payment recorded.');
   audits.push({id:randomUUID(),member_number:id,membership_year:2025,before_payload:sealRenewal(JSON.stringify(old||null)),after_payload:historicalPayload,reason});
   historicalRows.push({member_number:id,membership_year:2025,name_hash:old?.name_hash||current.name_hash,identity_hash:old?.identity_hash??current.identity_hash,payload:historicalPayload,active:entry.active});
   const next={...member,active};
   if(imported.active&&next.renewalActivation)next.renewalActivation={...next.renewalActivation,active:false,override:false};
   const nextPayload=sealRenewal(JSON.stringify(next));
   audits.push({id:randomUUID(),member_number:id,membership_year:2026,before_payload:sealRenewal(JSON.stringify(current)),after_payload:nextPayload,reason});
   currentRows.push({member_number:id,payload:nextPayload,active});
  }
  if(apply){
   await sql`INSERT INTO club_roster_edits(id,member_number,membership_year,before_payload,after_payload,reason) SELECT id,member_number,membership_year,before_payload,after_payload,reason FROM jsonb_to_recordset(${sql.json(audits)}) AS r(id uuid,member_number text,membership_year integer,before_payload text,after_payload text,reason text)`;
   await sql`INSERT INTO club_member_roster(member_number,membership_year,name_hash,identity_hash,payload,active,status_override) SELECT member_number,membership_year,name_hash,identity_hash,payload,active,true FROM jsonb_to_recordset(${sql.json(historicalRows)}) AS r(member_number text,membership_year integer,name_hash text,identity_hash text,payload text,active boolean) ON CONFLICT(member_number,membership_year) DO UPDATE SET payload=excluded.payload,active=excluded.active,status_override=true,updated_at=now()`;
   await sql`UPDATE club_member_roster AS c SET payload=r.payload,active=r.active,status_override=false,updated_at=now() FROM jsonb_to_recordset(${sql.json(currentRows)}) AS r(member_number text,payload text,active boolean) WHERE c.member_number=r.member_number AND c.membership_year=2026`;
   await sql`INSERT INTO club_roster_imports(id,checksum,source,membership_year,total,active,payload) VALUES(${randomUUID()},${checksum},${'2025 year correction: '+p.source},2025,242,67,${sealRenewal(JSON.stringify(p))})`;
  }
  return {repeated:false,total:242,active2025:67,cleared2026,preserved2026};
 });
}

export async function restore2026Statuses(apply=false){
 if(!(await isAdmin()))throw Error('Unauthorised');
 await adminRosterReady();
 return db().begin(async sql=>{
  await sql`LOCK TABLE club_member_roster IN SHARE ROW EXCLUSIVE MODE`;
  const marker='restore-2026-after-year-correction-v1';
  const done=await sql`SELECT id FROM club_roster_imports WHERE checksum=${marker}`;
  if(done.length)return {repeated:true,restored:0,skipped:0};
  const edits=await sql`SELECT member_number,before_payload,after_payload,reason,created_at FROM club_roster_edits WHERE membership_year=2026 ORDER BY created_at ASC`;
  const rows=await sql`SELECT * FROM club_member_roster WHERE membership_year=2026 FOR UPDATE`;
  const reasonText='Committee confirmed spreadsheet paid/new markers belong to 2025, not 2026. No new payment recorded.';
  const changes:any[]=[],audits:any[]=[];const seen=new Set<string>();let skipped=0;
  for(const edit of edits){
   if(openRenewal(edit.reason)!==reasonText)continue;
   const before=JSON.parse(openRenewal(edit.before_payload)),after=JSON.parse(openRenewal(edit.after_payload));
   if(before?.active!==true||after.active!==false)continue;
   if(seen.has(edit.member_number))throw Error('Duplicate correction audit');seen.add(edit.member_number);
   const row=rows.find(r=>r.member_number===edit.member_number);if(!row)throw Error('Missing current member');
   if(row.active){skipped++;continue;}
   const laterDeactivation=edits.some(e=>e.member_number===edit.member_number&&new Date(e.created_at)>new Date(edit.created_at)&&JSON.parse(openRenewal(e.before_payload))?.active===true&&JSON.parse(openRenewal(e.after_payload)).active===false);
   if(laterDeactivation){skipped++;continue;}
   const member=JSON.parse(openRenewal(row.payload));
   const payload=sealRenewal(JSON.stringify({...member,active:true}));
   changes.push({member_number:row.member_number,payload,active:true,status_override:!!before.status_override});
   audits.push({id:randomUUID(),member_number:row.member_number,membership_year:2026,before_payload:sealRenewal(JSON.stringify(row)),after_payload:payload,reason:sealRenewal('Restore 2026 active status removed by historical correction, as requested. Keep 2025 history unchanged.')});
  }
  if(!seen.size)throw Error('No correction audit found');
  if(apply){
   await sql`INSERT INTO club_roster_edits(id,member_number,membership_year,before_payload,after_payload,reason) SELECT id,member_number,membership_year,before_payload,after_payload,reason FROM jsonb_to_recordset(${sql.json(audits)}) AS r(id uuid,member_number text,membership_year integer,before_payload text,after_payload text,reason text)`;
   await sql`UPDATE club_member_roster AS c SET payload=r.payload,active=r.active,status_override=r.status_override,updated_at=now() FROM jsonb_to_recordset(${sql.json(changes)}) AS r(member_number text,payload text,active boolean,status_override boolean) WHERE c.member_number=r.member_number AND c.membership_year=2026`;
   await sql`INSERT INTO club_roster_imports(id,checksum,source,membership_year,total,active,payload) VALUES(${randomUUID()},${marker},'Restore 2026 status after historical correction',2026,${changes.length},${changes.length},${sealRenewal(JSON.stringify({restored:changes.length,skipped}))})`;
  }
  return {repeated:false,restored:changes.length,skipped};
 });
}
