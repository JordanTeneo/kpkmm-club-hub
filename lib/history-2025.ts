import {createHash,randomUUID} from 'node:crypto';
import {db,isAdmin} from './shop';
import {adminRosterReady} from './member-admin';
import {sealRenewal,openRenewal} from './renewals';
export async function updateHistory2025(input:unknown,apply=false){
 if(!(await isAdmin('membership')))throw Error('Unauthorised');
 const p=input as {year:number;source:string;members:{memberNumber:string;active:boolean}[]};
 if(!p||p.year!==2025||p.source!=='Senarai ahli_Oct2025 only.xlsx'||!Array.isArray(p.members)||p.members.length!==242||p.members.filter(m=>m.active===true).length!==100)throw Error('Invalid 2025 plan');
 const ids=new Set<string>();for(const m of p.members){if(!/^[A-Za-z0-9-]{1,30}$/.test(m.memberNumber)||typeof m.active!=='boolean'||ids.has(m.memberNumber))throw Error('Invalid member');ids.add(m.memberNumber);}
 const raw=JSON.stringify(p),checksum=createHash('sha256').update('2025-status-only-v1:'+raw).digest('hex');
 await adminRosterReady();
 return db().begin(async sql=>{
  await sql`LOCK TABLE club_member_roster IN SHARE ROW EXCLUSIVE MODE`;
  const prior=await sql`SELECT id FROM club_roster_imports WHERE checksum=${checksum}`;if(prior.length)return {repeated:true,changed:0};
  const rows=await sql`SELECT * FROM club_member_roster WHERE membership_year=2025 FOR UPDATE`;
  const aliases=await sql`SELECT old_number,new_number FROM club_member_id_history`;
  const values:any[]=[],audits:any[]=[];const resolved=new Set<string>();
  for(const entry of p.members){
   let id=entry.memberNumber;const seen=new Set<string>();
   while(aliases.some(a=>a.old_number===id)){if(seen.has(id))throw Error('ID cycle');seen.add(id);id=aliases.find(a=>a.old_number===id)!.new_number;}
   if(resolved.has(id))throw Error('Duplicate ID');resolved.add(id);
   const row=rows.find(r=>r.member_number===id);if(!row)throw Error('Historical member missing');
   if(row.active===entry.active&&row.status_override)continue;
   const member=JSON.parse(openRenewal(row.payload));
   const payload=sealRenewal(JSON.stringify({...member,active:entry.active}));
   values.push({member_number:id,payload,active:entry.active});
   audits.push({id:randomUUID(),member_number:id,membership_year:2025,before_payload:sealRenewal(JSON.stringify(row)),after_payload:payload,reason:sealRenewal('2025 status reconciled against Senarai ahli_Oct2025 only.xlsx: paid/new active; blank inactive. No other year changed.')});
  }
  if(apply){
   await sql`INSERT INTO club_roster_edits(id,member_number,membership_year,before_payload,after_payload,reason) SELECT id,member_number,membership_year,before_payload,after_payload,reason FROM jsonb_to_recordset(${sql.json(audits)}) AS r(id uuid,member_number text,membership_year integer,before_payload text,after_payload text,reason text)`;
   await sql`UPDATE club_member_roster AS c SET payload=r.payload,active=r.active,status_override=true,updated_at=now() FROM jsonb_to_recordset(${sql.json(values)}) AS r(member_number text,payload text,active boolean) WHERE c.member_number=r.member_number AND c.membership_year=2025`;
   await sql`INSERT INTO club_roster_imports(id,checksum,source,membership_year,total,active,payload) VALUES(${randomUUID()},${checksum},${p.source},2025,242,100,${sealRenewal(raw)})`;
  }
  return {repeated:false,changed:values.length};
 });
}
