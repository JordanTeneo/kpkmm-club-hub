const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const id='00000000-0000-4000-8000-000000000001',version='00000000-0000-4000-8000-000000000002';
const year=Number(new Intl.DateTimeFormat('en',{year:'numeric',timeZone:'Asia/Kuala_Lumpur'}).format(new Date()));
let admin=true,app,flow,mails,roster,audit,fail=false,sends=0,mailState='accepted';
const person={name:'Example Member',email:'example@example.com',phone:'0123456789',identityType:'mykad',identity:'900101101234',country:'Malaysia',state:'Selangor',mailingCountry:'Malaysia',addressLine:'Example street',postcode:'40000',address:'Example street'};
const sql=async(p,...v)=>{const q=p.join('?').replace(/\s+/g,' ');
 if(q.startsWith('CREATE')||q.startsWith('LOCK'))return [];
 if(q.startsWith('SELECT * FROM club_applications'))return app?[app]:[];
 if(q.startsWith('SELECT application_id FROM club_enrolments'))return flow?[flow]:[];
 if(q.startsWith('SELECT member_number FROM club_member_roster'))return roster.filter(r=>r.identity_hash===v[0]);
 if(q.startsWith('SELECT member_number AS number'))return [{number:'A-09-100'},{number:'B-20-105'}];
 if(q.startsWith('SELECT * FROM club_enrolments'))return flow&&(!q.includes('token_hash')||(v[0]===flow.token_hash&&flow.valid))?[flow]:[];
 if(q.startsWith('SELECT stage,membership_year'))return flow&&v[0]===flow.token_hash?[flow]:[];
 if(q.startsWith('INSERT INTO club_enrolments')){flow={application_id:v[0],stage:'awaiting_payment',membership_year:v[1],token_hash:v[2],token_encrypted:v[3],valid:true};return [];}
 if(q.startsWith("UPDATE club_applications SET status='approved'")){app.status='approved';app.membership_year=null;return [];}
 if(q.startsWith('INSERT INTO club_enrolment_mail')){if(fail)throw Error('Outbox failure');if(!mails.some(m=>m.kind===v[2]&&m.context===v[3]))mails.push({id:v[0],application_id:v[1],kind:v[2],context:v[3],payload:v[4],status:'queued'});return [];}
 if(q.startsWith('UPDATE club_enrolments SET proof=')){Object.assign(flow,{proof:v[0],proof_type:v[1],proof_version:v[2],stage:'proof_submitted'});return [];}
 if(q.startsWith('INSERT INTO club_member_roster')){roster.push({member_number:v[0],membership_year:v[1],name_hash:v[2],identity_hash:v[3],payload:v[4],active:true});return [];}
 if(q.startsWith('INSERT INTO club_roster_edits')){audit++;return [];}
 if(q.startsWith("UPDATE club_enrolments SET stage='active'")){flow.stage='active';flow.member_number=v[0];return [];}
 if(q.startsWith('UPDATE club_applications SET membership_year=')){app.membership_year=v[0];return [];}
 if(q.startsWith("UPDATE club_enrolments SET stage='awaiting_payment'")){Object.assign(flow,{stage:'awaiting_payment',token_hash:v[0],token_encrypted:v[1],valid:true});return [];}
 if(q.startsWith("UPDATE club_enrolment_mail SET status='superseded'")){mails.forEach(m=>{if(m.kind!=='welcome'&&['queued','failed','unknown'].includes(m.status))m.status='superseded';});return [];}
 if(q.startsWith('UPDATE club_enrolment_mail m SET')){return mails.filter(m=>(!v[1]||m.id===v[1])&&(['queued','failed'].includes(m.status)||(v[3]&&m.status==='unknown'))&&((m.kind==='invitation'&&flow.stage==='awaiting_payment'&&m.context===flow.token_hash&&flow.valid)||(m.kind==='payment_notice'&&flow.stage==='proof_submitted'&&m.context===flow.proof_version)||(m.kind==='welcome'&&flow.stage==='active'))).map(m=>{m.status='sending';return m;});}
 if(q.startsWith('UPDATE club_enrolment_mail SET status=')){mails.find(m=>m.id===v[2]).status=v[0];return [];}
 throw Error('Unhandled SQL: '+q);
};
sql.begin=async fn=>{const backup=JSON.stringify({app,flow,mails,roster,audit});try{return await fn(sql);}catch(e){({app,flow,mails,roster,audit}=JSON.parse(backup));throw e;}};
const mocks={'./shop':{db:()=>sql,isAdmin:async()=>admin,uuid:s=>/^[0-9a-f-]{36}$/.test(s)},'./membership':{membershipReady:async()=>{},unseal:JSON.parse},'./renewals':{renewalsReady:async()=>{},renewalHash:s=>'hash:'+s,sealRenewal:s=>'sealed:'+s,openRenewal:s=>s.slice(7),sendClubMessage:async raw=>{sends++;return {state:mailState,id:'gmail-id'};}},'./member-admin':{adminRosterReady:async()=>{},validYear:Number},'./roster':{nameKey:s=>'name:'+s},'./gmail':{CLUB_EMAIL:'club@example.com',SITE_ORIGIN:'https://example.com'}};
function load(file){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Buffer,Intl,Date,require:n=>mocks[n]||require(n)});return exports;}
mocks['./member-create']=load('lib/member-create.ts');const mod=load('lib/enrolment.ts');
function reset(){app={id,status:'pending',payload:JSON.stringify(person),membership_year:null};flow=null;mails=[];roster=[];audit=0;fail=false;sends=0;mailState='accepted';}
(async()=>{
 reset();admin=false;await assert.rejects(()=>mod.approveApplication(id,year,'pending'));await assert.rejects(()=>mod.approvePayment(id,version));admin=true;
 assert.equal(mod.validPaymentToken('bad'),false);assert.equal(mod.validPaymentToken('a'.repeat(64)),true);
 assert.throws(()=>mod.enrolmentMessage('a@example.com\r\nBcc: x@example.com','subject','body'));
 const message=Buffer.from(mod.enrolmentMessage('example@example.com','Welcome','hello'), 'base64url').toString();assert.match(message,/To: example@example.com/);assert.ok(message.endsWith(Buffer.from('hello').toString('base64')));
 assert.equal(await mod.approveApplication(id,year,'pending'),'saved');assert.equal(app.membership_year,null);assert.equal(roster.length,0);assert.equal(flow.stage,'awaiting_payment');assert.equal(mails.length,1);
 const token=flow.token_encrypted.slice(7);assert.equal(token.length,64);assert.equal(await mod.approveApplication(id,year,'pending'),'changed');assert.equal(mails.length,1);
 assert.equal(await mod.approvePayment(id,version),'changed');assert.equal(roster.length,0);
 flow.valid=false;assert.equal(await mod.savePayment(token,{bytes:Buffer.from('proof'),type:'image/png'}),'invalid');flow.valid=true;
 assert.equal(await mod.savePayment('b'.repeat(64),{bytes:Buffer.from('proof'),type:'image/png'}),'invalid');
 assert.equal(await mod.savePayment(token,{bytes:Buffer.from('proof'),type:'image/png'}),id);assert.equal(flow.stage,'proof_submitted');assert.equal(roster.length,0);assert.equal(app.membership_year,null);
 assert.equal(await mod.savePayment(token,{bytes:Buffer.from('again'),type:'image/png'}),'invalid');
 assert.equal(await mod.approvePayment(id,version),'changed');const proofVersion=flow.proof_version;
 fail=true;await assert.rejects(()=>mod.approvePayment(id,proofVersion));assert.equal(roster.length,0);assert.equal(flow.stage,'proof_submitted');assert.equal(audit,0);fail=false;
 assert.equal(await mod.approvePayment(id,proofVersion),'activated');assert.equal(roster.length,1);assert.equal(roster[0].member_number,'B-'+String(year).slice(-2)+'-106');assert.equal(app.membership_year,year);assert.equal(flow.stage,'active');assert.equal(audit,1);assert.equal(mails.filter(m=>m.kind==='welcome').length,1);
 assert.equal(await mod.approvePayment(id,proofVersion),'already');assert.equal(roster.length,1);assert.equal(audit,1);
 await mod.deliverEnrolment(id);assert.equal(sends,1);assert.equal(mails.find(m=>m.kind==='welcome').status,'accepted');await mod.deliverEnrolment(id);assert.equal(sends,1);
 reset();roster=[{identity_hash:'hash:mykad:malaysia:'+person.identity}];assert.equal(await mod.approveApplication(id,year,'pending'),'duplicate');assert.equal(flow,null);
 reset();app.payload=JSON.stringify({...person,state:'unconfigured'});assert.equal(await mod.approveApplication(id,year,'pending'),'prefix');assert.equal(flow,null);
 reset();fail=true;await assert.rejects(()=>mod.approveApplication(id,year,'pending'));assert.equal(app.status,'pending');assert.equal(flow,null);fail=false;
 await mod.approveApplication(id,year,'pending');const oldToken=flow.token_encrypted.slice(7);await mod.reissuePayment(id,'');assert.notEqual(flow.token_encrypted.slice(7),oldToken);assert.equal(await mod.savePayment(oldToken,{bytes:Buffer.from('proof'),type:'image/png'}),'invalid');
 mailState='unknown';await mod.deliverEnrolment(id);assert.equal(sends,1);await mod.deliverEnrolment(id);assert.equal(sends,1);await mod.deliverEnrolment(id,true,mails.find(m=>m.status==='unknown').id);assert.equal(sends,2);
 console.log('PASS: two-stage approval, no premature activation, auth, private tokens/expiry/replay, duplicate/prefix checks, atomic rollback, permanent numbering, idempotent activation, encrypted outbox and safe uncertain-email retries.');
})().catch(e=>{console.error(e);process.exitCode=1;});
