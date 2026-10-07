import {db} from './shop';
import {nameKey, normalizeName, rosterReady, renewalEligibility, type RosterMember} from './roster';
import {openRenewal, renewalHash, type RenewalDetails} from './renewals';

export type RenewalLookup = {mode:'name'|'identity'; value:string};
export function renewalLookup(form:FormData):RenewalLookup {
 const mode=form.get('lookupMode'),value=String(form.get('lookupValue')||'').normalize('NFKC').trim();
 if(mode==='name'&&value.length>=2&&value.length<=150)return {mode,value:normalizeName(value)};
 if(mode==='identity'&&value.length>=5&&value.length<=30&&/^[a-z0-9\s-]+$/i.test(value))return {mode,value:value.toUpperCase().replace(/\s/g,'')};
 throw Error('Invalid member lookup');
}
function identification(value:string){
 const compact=value.normalize('NFKC').toUpperCase().replace(/\s/g,'');
 return /^\d{6}-?\d{2}-?\d{4}$/.test(compact)?compact.replace(/-/g,''):compact;
}
type Match = {status:'missing'|'ambiguous'|'review'|'reinstate'|'lifetime'|'already-active'|'deceased'} | {status:'eligible';identityHash:string;details:RenewalDetails};
// Server-only lookup: never return this record to a public component or action result.
export async function findRenewalMember(lookup:RenewalLookup,currentYear:number,year:number):Promise<Match>{
 await rosterReady();
 // Select the latest record before matching so obsolete names/IDs cannot be used.
 // Passport issuing country is not required from the applicant: compare privately.
 const rows=lookup.mode==='name'
  ?await db()`SELECT member_number,identity_hash,payload FROM (SELECT DISTINCT ON(member_number) member_number,name_hash,identity_hash,payload FROM club_member_roster WHERE membership_year<=${currentYear} ORDER BY member_number,membership_year DESC) AS latest WHERE name_hash=${nameKey(lookup.value)} LIMIT 3`
  :await db()`SELECT DISTINCT ON(member_number) member_number,identity_hash,payload FROM club_member_roster WHERE membership_year<=${currentYear} ORDER BY member_number,membership_year DESC LIMIT 10001`;
 if(rows.length>10000)throw Error('Member index requires maintenance');
 const matches=rows.map(row=>({row,member:JSON.parse(openRenewal(row.payload)) as RosterMember})).filter(({member})=>lookup.mode==='name'?normalizeName(member.name)===normalizeName(lookup.value):!!member.identity&&identification(member.identity)===identification(lookup.value));
 if(matches.length!==1)return {status:matches.length?'ambiguous':'missing'};
 const {row,member}=matches[0];
 if(member.deceased)return {status:'deceased'};
 if(Number.isInteger(member.lifetimeSince)&&member.lifetimeSince!<=year)return {status:'lifetime'};
 const selected=await db()`SELECT active FROM club_member_roster WHERE member_number=${row.member_number} AND membership_year=${year}`;
 if(selected.some(r=>r.active))return {status:'already-active'};
 const history=await db()`SELECT max(membership_year) AS year FROM club_member_roster WHERE member_number=${row.member_number} AND active=true AND membership_year<=${currentYear}`;
 const last=history[0]?.year;
 let eligibility:'eligible'|'reinstate'|'review'=typeof last==='number'?(year-last>1?'reinstate':'eligible'):'review';
 const identityType=member.identityType||'mykad',country=member.country||'Malaysia';
 // Retain eligibility from approved online records where an identity exists.
 if(row.identity_hash&&member.identity){
  const online=await renewalEligibility(identityType+':'+country.toLowerCase()+':'+member.identity,year);
  if(online==='eligible')eligibility='eligible';
  else if(eligibility==='review')eligibility=online;
 }
 if(eligibility!=='eligible')return {status:eligibility};
 return {status:'eligible',identityHash:row.identity_hash||renewalHash('roster-member:'+row.member_number),details:{
  rosterMemberNumber:row.member_number,year,name:member.name,identity:member.identity,identityType,country,
  email:member.email||'',phone:member.phone||'',address:member.address||'',
  ...(member.addressLine===undefined?{}:{addressLine:member.addressLine,postcode:member.postcode,state:member.state,mailingCountry:member.mailingCountry})
 }};
}
