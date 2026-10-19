const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict'),crypto=require('node:crypto');
function load(file,mocks){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>mocks[n]||require(n),Buffer,URL,URLSearchParams});return exports;}
let allowed=true,enabled=true,legacy,session={user:{id:'admin-one'},session:{id:'session-one'}},saved,exchanges=0,writes=0;
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const jar={get:n=>n==='kpkmm-admin'?(legacy?{value:legacy}:undefined):saved?{value:saved}:undefined,set:()=>{saved=undefined;}};
const binding=load('lib/gmail-session.ts',{'next/headers':{cookies:async()=>jar},'./shop':{digest:hash,isAdmin:async()=>allowed},'./committee-access':{committeeEnabled:async()=>enabled,committeeSession:async()=>session}});
const state='a'.repeat(64),scope='gmail.send',origin='https://kpkmm-club-hub.vercel.app';
const callback=load('app/api/gmail/callback/route.ts',{'next/headers':{cookies:async()=>jar},'next/server':{NextResponse:{redirect:url=>({url,headers:{set(){}}})}},'../../../../lib/shop':{db:()=>async()=>{writes++;}},'../../../../lib/gmail-session':binding,'../../../../lib/gmail':{SITE_ORIGIN:origin,SEND_SCOPE:scope,tokenRequest:async()=>{exchanges++;return {};}}});
(async()=>{
 const first=await binding.gmailSessionBinding();assert.equal(first.length,64);assert.equal(legacy,undefined);
 session.session.id='session-two';assert.notEqual(await binding.gmailSessionBinding(),first);session.session.id='session-one';session.user.id='admin-two';assert.notEqual(await binding.gmailSessionBinding(),first);session.user.id='admin-one';
 allowed=false;assert.equal(await binding.gmailSessionBinding(),null);allowed=true;session=null;assert.equal(await binding.gmailSessionBinding(),null);
 enabled=false;assert.equal(await binding.gmailSessionBinding(),null);legacy='valid-legacy-session';assert.equal(await binding.gmailSessionBinding(),hash(legacy));
 enabled=true;legacy=undefined;session={user:{id:'admin-one'},session:{id:'session-one'}};
 saved=state+'.'+first;assert.ok((await callback.GET({url:origin+'/api/gmail/callback?state='+state+'&code=test'})).url.endsWith('access-missing'));assert.equal(exchanges,1);assert.equal(saved,undefined);
 for(const mode of ['changed','missing','wrong-state','permission']){
  saved=state+'.'+first;session.session.id=mode==='changed'?'other':'session-one';allowed=mode!=='permission';if(mode==='missing')saved=undefined;
  const result=await callback.GET({url:origin+'/api/gmail/callback?state='+(mode==='wrong-state'?'b'.repeat(64):state)+'&code=test'});assert.ok(result.url.endsWith('expired'),mode);assert.equal(exchanges,1);
 }
 assert.equal(writes,0);assert.ok(!fs.readFileSync('app/admin/email/page.tsx','utf8').includes("jar.get('kpkmm-admin')!.value"));
 console.log('PASS: Gmail committee/legacy session binding, missing cookie, account/session change, permission revocation, state mismatch and callback rejection before Google exchange.');
})().catch(e=>{console.error(e);process.exitCode=1;});
