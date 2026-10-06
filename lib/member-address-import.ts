import {randomUUID} from 'node:crypto';
import {db,isAdmin} from './shop';
import {adminRosterReady,validYear} from './member-admin';
import {normalizeName} from './roster';
import {openRenewal,sealRenewal} from './renewals';

type AddressRow={memberNumber:string;name:string;expectedAddress:string;addressLine:string;postcode:string;state:string;mailingCountry:string};
export function validateAddressPlan(input:unknown):{year:number;members:AddressRow[]}{
 const d=input as {year:number;members:AddressRow[]};
 if(!d||!Array.isArray(d.members)||!d.members.length||d.members.length>2000)throw Error('Invalid address plan');
 const year=validYear(d.year),seen=new Set<string>();
 const members=d.members.map(r=>{
  if(!r||typeof r.memberNumber!=='string'||! /^[A-Za-z0-9-]{1,30}$/.test(r.memberNumber)||seen.has(r.memberNumber))throw Error('Invalid member');
  seen.add(r.memberNumber);
  for(const [key,max] of [['name',150],['expectedAddress',1500],['addressLine',1500],['postcode',20],['state',100],['mailingCountry',80]] as const){
   if(typeof r[key]!=='string'||!r[key].trim()||r[key].length>max)throw Error('Invalid address');
  }
  if(r.mailingCountry==='Malaysia'&&!/^\d{5}$/.test(r.postcode))throw Error('Invalid postcode');
  return {memberNumber:r.memberNumber,name:r.name,expectedAddress:r.expectedAddress,addressLine:r.addressLine.trim(),postcode:r.postcode.trim(),state:r.state.trim(),mailingCountry:r.mailingCountry.trim()};
 });
 return {year,members};
}
export function addressPatch(previous:Record<string,unknown>,row:AddressRow){
 if(typeof previous.name!=='string'||normalizeName(previous.name)!==normalizeName(row.name)||previous.address!==row.expectedAddress)return null;
 if(['addressLine','postcode','state','mailingCountry'].some(k=>previous[k]!==undefined&&previous[k]!==''))return null;
 return {...previous,addressLine:row.addressLine,postcode:row.postcode,state:row.state,mailingCountry:row.mailingCountry,address:[row.addressLine,row.postcode+' '+row.state,row.mailingCountry].join('\n')};
}
export async function importAddresses(input:unknown){
 if(!(await isAdmin()))throw Error('Unauthorised');
 const data=validateAddressPlan(input);await adminRosterReady();
 return db().begin(async sql=>{
  await sql`LOCK TABLE club_member_roster IN SHARE ROW EXCLUSIVE MODE`;
  let skipped=0;
  const records=await sql`SELECT member_number,payload,active,status_override,updated_at::text AS revision FROM club_member_roster WHERE membership_year=${data.year} FOR UPDATE`;
  const byId=new Map(records.map(r=>[r.member_number,r]));
  const changes:{member_number:string;payload:string}[]=[],audits:{id:string;member_number:string;before_payload:string;after_payload:string;reason:string}[]=[];
  for(const member of data.members){
   const record=byId.get(member.memberNumber);
   if(!record){skipped++;continue;}
   const next=addressPatch(JSON.parse(openRenewal(record.payload)),member);
   if(!next){skipped++;continue;}
   const payload=sealRenewal(JSON.stringify(next));
   audits.push({id:randomUUID(),member_number:member.memberNumber,before_payload:sealRenewal(JSON.stringify(record)),after_payload:payload,reason:sealRenewal('Address-only formatting from reviewed source; original address matched. Membership status and personal details preserved.')});
   changes.push({member_number:member.memberNumber,payload});
  }
  if(changes.length){
   await sql`INSERT INTO club_roster_edits(id,member_number,membership_year,before_payload,after_payload,reason) SELECT id,member_number,${data.year},before_payload,after_payload,reason FROM jsonb_to_recordset(${sql.json(audits)}) AS a(id uuid,member_number text,before_payload text,after_payload text,reason text)`;
   await sql`UPDATE club_member_roster AS m SET payload=a.payload,updated_at=now() FROM jsonb_to_recordset(${sql.json(changes)}) AS a(member_number text,payload text) WHERE m.member_number=a.member_number AND m.membership_year=${data.year}`;
  }
  return {updated:changes.length,skipped};
 });
}
