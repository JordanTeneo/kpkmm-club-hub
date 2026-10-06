const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript'),crypto=require('node:crypto');
const env={GMAIL_ENCRYPTION_KEY:'test-only-long-key-for-membership-123456789'};
function load(file,mocks={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>n in mocks?mocks[n]:require(n),process:{env},Buffer,FormData});return exports;}
const applicant={name:'Test Member',email:'test@example.invalid',phone:'+60123456789',identityType:'passport',identity:'TEST12345',country:'Test Country',address:'Testing address only'};
const member=load('lib/membership.ts',{'./shop':{db:()=>{throw Error('Unexpected DB');}}});
const v2=member.seal(applicant);assert.ok(v2.startsWith('v2.'));assert.equal(member.unseal(v2).identity,applicant.identity);
env.ADMIN_SESSION_SECRET='legacy-test-secret-at-least-24-characters';
const legacy=member.seal(applicant);assert.ok(!legacy.startsWith('v2.'));assert.equal(member.unseal(legacy).name,applicant.name);assert.equal(member.unseal(v2).name,applicant.name);
let sends=0,claimed=false;
const id=crypto.randomUUID(),queries=[];
const mail=load('lib/membership-mail.ts',{'./shop':{uuid:v=>/^[0-9a-f-]{36}$/.test(v),db:()=>async(p,...v)=>{queries.push({q:p.join('?'),v});if(p.join('').includes("SET status='sending'")){if(claimed)return [];claimed=true;return [{application_id:id}];}return [];}},'./gmail':{CLUB_EMAIL:'kelabpeminatkeretaminimalaysia@gmail.com',SITE_ORIGIN:'https://kpkmm-club-hub.vercel.app'},'./renewals':{sendClubMessage:async()=>{sends++;return {state:'unknown'};}}});
(async()=>{
 const mime=Buffer.from(mail.membershipMessage(id),'base64url').toString();assert.match(mime,/Subject: KPKMM new membership application/);assert.match(mime,/To: kelabpeminatkeretaminimalaysia@gmail.com/);const body=Buffer.from(mime.split('\r\n\r\n')[1].replace(/\s/g,''),'base64').toString();assert.ok(body.includes('/admin/members/'+id));assert.ok(!body.includes(applicant.identity));assert.ok(!body.includes(applicant.address));assert.throws(()=>mail.membershipMessage('bad\r\nBcc:x'));
 await Promise.all([mail.notifyMembership(id),mail.notifyMembership(id)]);assert.equal(sends,1);assert.ok(queries.some(q=>q.v.includes('unknown')));
 let inserted=0,notified=0,duplicate=false,allow=true,dbFails=false;
 const action=load('app/join/actions.ts',{'next/headers':{headers:async()=>({get:()=>null})},'next/cache':{revalidatePath:()=>{}},'../../lib/shop':{db:()=>async()=>{if(dbFails)throw Error('DB unavailable');inserted++;return duplicate?[]:[{application_id:id}];}},'../../lib/membership':{...member,membershipReady:async()=>{},applicationLimit:async()=>allow},'../../lib/membership-mail':{membershipMailReady:async()=>{},notifyMembership:async()=>{notified++;throw Error('Gmail unavailable');}}});
 const form=()=>{const f=new FormData();Object.entries({...applicant,postcode:'01234',state:'Selangor',mailingCountry:'Malaysia',consent:'yes'}).forEach(([k,v])=>f.set(k,v));return f;};
 const structured=member.validateApplicant(form(),true);assert.equal(structured.postcode,'01234');assert.equal(structured.country,'Test Country');assert.equal(structured.mailingCountry,'Malaysia');assert.match(structured.address,/01234 Selangor\nMalaysia/);assert.equal(member.unseal(member.seal(structured)).postcode,'01234');
 for(const key of ['postcode','state','mailingCountry']){const missing=form();missing.delete(key);assert.throws(()=>member.validateApplicant(missing,true));}
 const overseas=form();overseas.set('postcode','SW1A 1AA');assert.throws(()=>member.validateApplicant(overseas,true));overseas.set('mailingCountry','United Kingdom');assert.equal(member.validateApplicant(overseas,true).postcode,'SW1A 1AA');
 let f=form();f.delete('consent');assert.ok((await action.requestMembership({},f)).error);assert.equal(inserted,0);
 allow=false;assert.ok((await action.requestMembership({},form())).error);assert.equal(inserted,0);allow=true;
 assert.ok((await action.requestMembership({},form())).success);assert.equal(notified,1);
 duplicate=true;assert.ok((await action.requestMembership({},form())).success);assert.equal(notified,1);
 dbFails=true;assert.ok((await action.requestMembership({},form())).error);assert.equal(notified,1);
 console.log('PASS: legacy and v2 encryption compatibility, minimal fixed-recipient notification, protected review link, concurrent-send claim, uncertain delivery tracking, consent/rate limiting, save-before-email, duplicate suppression, storage failure. No real applications or emails created.');
})().catch(e=>{console.error(e);process.exitCode=1;});
