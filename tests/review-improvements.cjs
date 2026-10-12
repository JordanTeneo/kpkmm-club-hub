const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const jsx=(type,props)=>({type,props});
function load(file,mocks,globals={},suffix=''){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8')+suffix,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>mocks[n]||{},...globals});return exports;}
function text(n){if(n==null||n===false)return '';if(Array.isArray(n))return n.map(text).join(' ');return typeof n==='object'?text(n.props?.children):String(n);}
let hook=0,filter='outing-a',effects=[],filterUpdates=[],scrolls=0,listener;
const window={location:{hash:'#gallery-event-outing-b'},addEventListener:(_,fn)=>listener=fn,removeEventListener:(_,fn)=>assert.equal(fn,listener)};
const gallery=load('app/public-gallery.tsx',{'react/jsx-runtime':{jsx,jsxs:jsx},react:{useRef:v=>({current:v}),useState:v=>[hook++%6===5?filter:v,x=>filterUpdates.push(x)],useEffect:f=>effects.push(f)}},{window,document:{getElementById:()=>({scrollIntoView:()=>scrolls++})},Map});
const albums=[{id:'album-a',cover:{caption:'ALBUM A',eventId:'outing-a'},count:2,eventTitle:'Outing A'},{id:'album-b',cover:{caption:'ALBUM B',eventId:'outing-b'},count:3,eventTitle:'Outing B'}];
let tree=gallery.PublicGallery({albums,lang:'en'});assert.ok(text(tree).includes('ALBUM A'));assert.ok(!text(tree).includes('ALBUM B'));assert.ok(text(tree).includes('View all albums'));
const cleanup=effects[0]();assert.equal(filterUpdates.at(-1),'outing-b');assert.equal(scrolls,1);window.location.hash='#gallery';listener();assert.equal(filterUpdates.at(-1),null);cleanup();
filter=null;tree=gallery.PublicGallery({albums,lang:'ms'});assert.ok(text(tree).includes('ALBUM A'));assert.ok(text(tree).includes('ALBUM B'));
const home=fs.readFileSync('app/page.tsx','utf8');assert.ok(home.includes('"#gallery-event-"+encodeURIComponent(event.id)'));
let auth=true,writes=0;const process={env:{}};
const admin=load('app/admin/reminders/page.tsx',{'next/navigation':{redirect:url=>{throw Error(url);}},'next/cache':{revalidatePath:()=>{}},'../../../lib/shop':{isAdmin:async()=>auth,db:()=>async()=>{writes++;}},'../../../lib/renewal-reminders':{remindersReady:async()=>{}}},{process},'\nexport {pause};');
(async()=>{const form=new FormData();form.set('paused','no');await assert.rejects(()=>admin.pause(form),/result=scheduler/);assert.equal(writes,0);process.env.CRON_SECRET='short';await assert.rejects(()=>admin.pause(form),/result=scheduler/);assert.equal(writes,0);process.env.CRON_SECRET='x'.repeat(32);await admin.pause(form);assert.equal(writes,1);auth=false;await assert.rejects(()=>admin.pause(form),/Unauthorised/);assert.equal(writes,1);
 const dashboard=fs.readFileSync('app/admin/page.tsx','utf8');assert.ok(!dashboard.includes('Membership payments / Bayaran keahlian'));assert.ok(dashboard.includes("language==='ms'?'Bayaran keahlian':'Membership payments'"));
 console.log('PASS: outing-specific albums and clear filter, hash listener cleanup, scheduler missing/weak credential and permission guards, and single-language payment dashboard. No live writes or emails.');
})().catch(e=>{console.error(e);process.exitCode=1;});

