import {nameKey as searchNameKey} from './roster';
import {randomUUID} from 'node:crypto';
import {db,isAdmin,readImage} from './shop';
import {adminRosterReady,validYear} from './member-admin';
import {renewalsReady,renewalHash,sealRenewal,openRenewal} from './renewals';
import {malaysiaYear} from './member-status';

export async function renewMemberByAdmin(form:FormData){
 if(!(await isAdmin('membership')))throw Error('Unauthorised');
 const number=String(form.get('member')||''),year=validYear(form.get('year'));
 const reason=String(form.get('reason')||'').trim();
 if(!/^[A-Za-z0-9-]{1,30}$/.test(number)||year<malaysiaYear()||year>malaysiaYear()+1||form.get('verified')!=='yes'||reason.length<3||reason.length>500)return 'invalid';
 const file=form.get('proof');if(!(file instanceof File)||!file.size)return 'proof';
 let proof;try{proof=await readImage(file,true);}catch{return 'proof';}
 await adminRosterReady();await renewalsReady();
 return db().begin(async sql=>{
  await sql`LOCK TABLE club_member_roster IN SHARE ROW EXCLUSIVE MODE`;
  const rows=await sql`SELECT * FROM club_member_roster WHERE member_number=${number} AND membership_year<=${year} ORDER BY membership_year DESC LIMIT 1 FOR UPDATE`;
  const row=rows[0];if(!row)return 'missing';
  const member=JSON.parse(openRenewal(row.payload));
  if(member.deceased)return 'deceased';
  if(row.membership_year===year&&row.active)return 'existing';
  if(Number.isInteger(member.lifetimeSince)&&member.lifetimeSince<=year)return 'lifetime';
  const hash=row.identity_hash||renewalHash('roster-member:'+number);
  const prior=await sql`SELECT id FROM club_renewals WHERE identity_hash=${hash} AND renewal_year=${year} LIMIT 1`;
  if(prior.length)return 'existing';
  const id=randomUUID(),details={...member,identityType:member.identityType||'mykad',country:member.country||'Malaysia',year,rosterMemberNumber:number,submittedByAdmin:true};
  const inserted=await sql`INSERT INTO club_renewals(id,identity_hash,name_hash,renewal_year,payload,proof,proof_type,review_status,mail_status) VALUES(${id},${hash},${searchNameKey(details.name)},${year},${sealRenewal(JSON.stringify(details))},${sealRenewal(proof.bytes.toString('base64'))},${proof.type},'approved','queued') ON CONFLICT(identity_hash,renewal_year) DO NOTHING RETURNING id`;
  if(!inserted.length)return 'existing';
  await sql`UPDATE club_renewals SET member_mail_status='queued' WHERE id=${id}`;
  const next={...member,active:true,renewalActivation:{id,active:row.membership_year===year?row.active:false,override:row.membership_year===year?row.status_override:false}};
  const payload=sealRenewal(JSON.stringify(next));
  await sql`INSERT INTO club_roster_edits(id,member_number,membership_year,before_payload,after_payload,reason) VALUES(${randomUUID()},${number},${year},${sealRenewal(JSON.stringify(row))},${payload},${sealRenewal('Admin verified renewal '+id+': '+reason)})`;
  await sql`INSERT INTO club_member_roster(member_number,membership_year,name_hash,identity_hash,payload,active,status_override) VALUES(${number},${year},${row.name_hash},${row.identity_hash},${payload},true,false) ON CONFLICT(member_number,membership_year) DO UPDATE SET payload=excluded.payload,active=true,status_override=false,updated_at=now()`;
  return id;
 });
}
