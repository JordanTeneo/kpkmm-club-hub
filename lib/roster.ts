import {annualStatus} from './annual-status';
import {createHash,randomUUID} from 'node:crypto';
import {db} from './shop';
import {membershipReady,fingerprint,unseal} from './membership';
import {renewalsReady,renewalHash,sealRenewal,openRenewal} from './renewals';

export type PaymentHistory={year:number;note:string;status:'paid'|'new'|'sponsored'|'lifetime'|'inactive'|'review'};
export type RosterMember={memberNumber:string;name:string;active:boolean;identity:string;identityType?:'mykad'|'passport';country?:string;phone:string;email:string;address:string;addressLine?:string;postcode?:string;state?:string;mailingCountry?:string;sourceRow:number;vehicles?:string[];joinedYear?:number;deceased?:boolean;lifetimeSince?:number;paymentHistory?:PaymentHistory[]};
export type RosterImport={year:number;source:string;members:RosterMember[]};
export function normalizeName(value:string){return value.normalize('NFKC').trim().replace(/\s+/gu,' ').toLocaleUpperCase('en-MY');}
export function nameKey(value:string){return renewalHash('member-name:'+normalizeName(value));}
export function identityKey(value:string,type='mykad',country='Malaysia'){return type==='passport'&&/^[A-Z0-9-]{5,20}$/.test(value)?renewalHash('passport:'+country.toLowerCase()+':'+value):type==='mykad'&&/^\d{12}$/.test(value)?renewalHash('mykad:malaysia:'+value):null;}
export function validateRoster(input:unknown):RosterImport{
 const data=input as RosterImport;
 if(!data||!Number.isInteger(data.year)||data.year<2000||data.year>2200||typeof data.source!=='string'||data.source.length>180||!Array.isArray(data.members)||!data.members.length||data.members.length>2000)throw Error('Invalid roster');
 const ids=new Set<string>();
 const members=data.members.map((row,i)=>{
  if(!row||typeof row.memberNumber!=='string'||! /^[A-Za-z0-9-]{1,30}$/.test(row.memberNumber)||ids.has(row.memberNumber))throw Error('Invalid or duplicate membership number at record '+(i+1));
  ids.add(row.memberNumber);
  if(typeof row.name!=='string'||normalizeName(row.name).length<2||row.name.length>150||typeof row.active!=='boolean'||!Number.isInteger(row.sourceRow)||row.sourceRow<2)throw Error('Invalid member at record '+(i+1));
  for(const key of ['identity','phone','email','address'] as const)if(typeof row[key]!=='string'||row[key].length>(key==='address'?1500:254))throw Error('Invalid details at record '+(i+1));
  const mailing:Partial<RosterMember>={};
  for(const [key,max] of [['addressLine',1500],['postcode',20],['state',100],['mailingCountry',80]] as const){if(row[key]!==undefined){if(typeof row[key]!=='string'||row[key]!.length>max)throw Error('Invalid address');mailing[key]=row[key]!.trim();}}
  if(mailing.mailingCountry?.toLowerCase()==='malaysia'&&mailing.postcode&&!/^\d{5}$/.test(mailing.postcode))throw Error('Invalid postcode');
  if(row.identityType!==undefined&&!['mykad','passport'].includes(row.identityType))throw Error('Invalid identity type');
  if(row.country!==undefined&&(typeof row.country!=='string'||row.country.length>80))throw Error('Invalid country');
  return {...mailing,...(row.identityType?{identityType:row.identityType,country:row.country||'Malaysia'}:{}),memberNumber:row.memberNumber,name:row.name.trim(),active:row.active,identity:row.identityType==='passport'?row.identity.trim().toUpperCase():row.identity.trim().replace(/[- ]/g,''),phone:row.phone,email:row.email,address:row.address,sourceRow:row.sourceRow};
 });
 return {year:data.year,source:data.source,members};
}
let ready:Promise<void>|undefined;
export async function rosterReady(){
 if(!ready)ready=(async()=>{
 await db()`CREATE TABLE IF NOT EXISTS club_member_id_history(old_number text PRIMARY KEY,new_number text NOT NULL,created_at timestamptz NOT NULL DEFAULT now())`;
 await db()`CREATE TABLE IF NOT EXISTS club_member_roster(member_number text NOT NULL,membership_year integer NOT NULL CHECK(membership_year BETWEEN 2000 AND 2200),name_hash text NOT NULL,identity_hash text,payload text NOT NULL,active boolean NOT NULL,updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(member_number,membership_year))`;
 await db()`ALTER TABLE club_member_roster ADD COLUMN IF NOT EXISTS status_override boolean NOT NULL DEFAULT false`;
 await db()`CREATE INDEX IF NOT EXISTS club_roster_name ON club_member_roster(name_hash)`;
 await db()`CREATE INDEX IF NOT EXISTS club_roster_identity ON club_member_roster(identity_hash)`;
 await db()`CREATE TABLE IF NOT EXISTS club_roster_imports(id uuid PRIMARY KEY,checksum text UNIQUE NOT NULL,source text NOT NULL,membership_year integer NOT NULL,total integer NOT NULL,active integer NOT NULL,payload text NOT NULL,created_at timestamptz NOT NULL DEFAULT now())`;
 })().catch(error=>{ready=undefined;throw error;});
 await ready;
}
export async function importRoster(input:unknown){
 const data=validateRoster(input),raw=JSON.stringify(data),checksum=createHash('sha256').update(raw).digest('hex');
 await rosterReady();
 return db().begin(async sql=>{
  await sql`LOCK TABLE club_member_roster IN SHARE ROW EXCLUSIVE MODE`;
  const retired=await sql`SELECT old_number FROM club_member_id_history`;
  if(data.members.some(m=>retired.some(r=>r.old_number.toUpperCase()===m.memberNumber.toUpperCase())))throw Error('Import includes a corrected membership ID. Update the source to the current ID before importing.');
  // The unique import checksum makes repeated submissions safe, including simultaneous requests.
  const receipt=await sql`INSERT INTO club_roster_imports(id,checksum,source,membership_year,total,active,payload) VALUES(${randomUUID()},${checksum},${data.source},${data.year},${data.members.length},${data.members.filter(m=>m.active).length},${sealRenewal(raw)}) ON CONFLICT(checksum) DO NOTHING RETURNING id`;
  if(!receipt.length)return {total:data.members.length,active:data.members.filter(m=>m.active).length,repeated:true};
  const values=data.members.map(m=>({member_number:m.memberNumber,membership_year:data.year,name_hash:nameKey(m.name),identity_hash:identityKey(m.identity,m.identityType,m.country),payload:sealRenewal(JSON.stringify(m)),active:m.active}));
  await sql`INSERT INTO club_member_roster(member_number,membership_year,name_hash,identity_hash,payload,active) SELECT member_number,membership_year,name_hash,identity_hash,payload,active FROM jsonb_to_recordset(${sql.json(values)}) AS r(member_number text,membership_year integer,name_hash text,identity_hash text,payload text,active boolean) ON CONFLICT(member_number,membership_year) DO UPDATE SET name_hash=excluded.name_hash,identity_hash=excluded.identity_hash,payload=excluded.payload,active=excluded.active,updated_at=now()`;
  return {total:data.members.length,active:data.members.filter(m=>m.active).length,repeated:false};
 });
}

// Private online records stay encrypted. Only a bounded, server-side exact name comparison is made.
// No matching names, IDs or other personal fields are returned to the public form.
export async function lookupName(name:string,year:number):Promise<{status:'active'|'inactive'|'ambiguous'|'unmatched';year:number;lifetime?:boolean;newMember?:boolean}>{
 await Promise.all([rosterReady(),membershipReady(),renewalsReady()]);
 const [roster,apps,renewals]=await Promise.all([
  db()`SELECT member_number,identity_hash,membership_year,active,status_override,payload FROM club_member_roster WHERE name_hash=${nameKey(name)}`,
  db()`SELECT payload,status,membership_year FROM club_applications LIMIT 5001`,
  db()`SELECT payload,review_status,renewal_year FROM club_renewals LIMIT 5001`
 ]);
 if(apps.length>5000||renewals.length>5000)throw Error('Name index requires maintenance');
 if(roster.some(r=>r.payload&&JSON.parse(openRenewal(r.payload)).deceased))return {status:'ambiguous',year};
 const people=new Map<string,boolean>();
 for(const r of roster){const details=r.payload?JSON.parse(openRenewal(r.payload)):{};const lifetime=Number.isInteger(details.lifetimeSince)&&details.lifetimeSince<=year;people.set('member:'+r.member_number,(people.get('member:'+r.member_number)||false)||lifetime||(r.active&&r.membership_year===year));}
 const expected=normalizeName(name);
 for(const row of [...apps.map(r=>({details:unseal(r.payload),active:r.status==='approved'&&r.membership_year===year})),...renewals.map(r=>({details:JSON.parse(openRenewal(r.payload)),active:r.review_status==='approved'&&r.renewal_year===year}))]){
  if(normalizeName(row.details.name)!==expected)continue;
  const hash=renewalHash(row.details.identityType+':'+row.details.country.toLowerCase()+':'+row.details.identity);
  const matches=roster.filter(r=>r.identity_hash===hash);
  if(matches.some(r=>r.membership_year===year&&r.status_override))continue;
  const key=matches.length?'member:'+matches[0].member_number:'identity:'+hash;
  people.set(key,(people.get(key)||false)||row.active);
 }
 const lifetime=people.size===1&&roster.some(r=>{const m=r.payload?JSON.parse(openRenewal(r.payload)):{};return Number.isInteger(m.lifetimeSince)&&m.lifetimeSince<=year;});
 const newMember=people.size===1&&roster.some(r=>r.membership_year===year&&r.payload&&annualStatus({...JSON.parse(openRenewal(r.payload)),active:r.active},year)==='new');
 return {...(newMember?{newMember:true}:{}),status:people.size===0?'unmatched':people.size>1?'ambiguous':[...people.values()].some(Boolean)?'active':'inactive',year,...(lifetime?{lifetime:true}:{})};
}
// Exact hashed MyKad match; no personal details leave this server-side lookup.
export async function lookupMyKadRoster(key:string,year:number):Promise<{status:'active'|'inactive'|'ambiguous';year:number;lifetime?:boolean;newMember?:boolean;checkOnline?:boolean}|null>{
 if(!/^mykad:malaysia:\d{12}$/.test(key))throw Error('Invalid MyKad');
 await rosterReady();
 const rows=await db()`SELECT member_number,membership_year,active,status_override,payload FROM (
  SELECT DISTINCT ON(member_number) member_number,membership_year,identity_hash,active,status_override,payload
  FROM club_member_roster WHERE membership_year<=${year}
  ORDER BY member_number,membership_year DESC
 ) AS latest WHERE identity_hash=${renewalHash(key)} LIMIT 2`;
 if(rows.length>1)return {status:'ambiguous',year};
 if(!rows.length)return null;
 const row=rows[0],details=JSON.parse(openRenewal(row.payload));
 if(details.deceased)return {status:'ambiguous',year};
 const lifetime=Number.isInteger(details.lifetimeSince)&&details.lifetimeSince<=year;
 if(lifetime)return {status:'active',year,lifetime:true};
 if(row.membership_year===year){
  if(row.active)return {status:'active',year,...(annualStatus({...details,active:true},year)==='new'?{newMember:true}:{})};
  if(row.status_override)return {status:'inactive',year};
 }
 // A historical roster alone must not hide a newer approved online renewal.
 return {status:'inactive',year,checkOnline:true};
}
export async function renewalMemberMatches(name:string,key:string,currentYear:number){
 await rosterReady();
 // Match the latest registered details, not an old name or identification number.
 // Never expose matching member details to the public renewal form.
 const rows=await db()`SELECT member_number,name_hash FROM (SELECT DISTINCT ON(member_number) member_number,name_hash,identity_hash FROM club_member_roster WHERE membership_year<=${currentYear} ORDER BY member_number,membership_year DESC) AS latest WHERE identity_hash=${renewalHash(key)} LIMIT 2`;
 return rows.length===1&&rows[0].name_hash===nameKey(name);
}
export async function renewalEligibility(key:string,currentYear:number){
 await Promise.all([rosterReady(),membershipReady(),renewalsReady()]);
 const [roster,apps,renewals]=await Promise.all([
  db()`SELECT max(membership_year) AS year FROM club_member_roster WHERE identity_hash=${renewalHash(key)} AND active=true AND membership_year<=${currentYear}`,
  db()`SELECT max(membership_year) AS year FROM club_applications WHERE identity_hash=${fingerprint(key)} AND status='approved' AND membership_year<=${currentYear}`,
  db()`SELECT max(renewal_year) AS year FROM club_renewals WHERE identity_hash=${renewalHash(key)} AND review_status='approved' AND renewal_year<=${currentYear}`
 ]);
 const years=[roster[0]?.year,apps[0]?.year,renewals[0]?.year].filter((v):v is number=>typeof v==='number');
 if(!years.length)return 'review';
 return currentYear-Math.max(...years)>1?'reinstate':'eligible';
}
