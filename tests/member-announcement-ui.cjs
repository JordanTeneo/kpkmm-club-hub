const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const jsx=(type,props)=>({type,props});
function text(n){if(n==null||n===false)return '';if(Array.isArray(n))return n.map(text).join(' ');return typeof n==='object'?text(n.props?.children):String(n);}
function nodes(n,type){if(!n||typeof n!=='object')return [];if(Array.isArray(n))return n.flatMap(x=>nodes(x,type));return [...(n.type===type?[n]:[]),...nodes(n.props?.children,type)];}
let auth=true,lang='en',status='draft',reads=0;const env={CRON_SECRET:'test-only-placeholder-of-32-characters'};
const db=()=>async(parts)=>{reads++;const q=parts.join('?');if(q.includes('SELECT count'))return [{count:0}];if(q.includes('SELECT config'))return [{config:{}}];if(q.includes('SELECT * FROM club_announcement_campaigns'))return [{id:'test',target_year:2026,status,payload:'{"subject":"News {year}","message":"Dear {name}","audience":"active"}'}];if(q.includes('SELECT payload,status'))return [{payload:'{"number":"B-001","name":"Test member","email":"test@example.com"}',status:'pending'}];return [];};
const exportsPage={};const mocks={'react/jsx-runtime':{jsx,jsxs:jsx},'next/navigation':{redirect:x=>{throw Error(x);}},'../../../lib/shop':{db,isAdmin:async()=>auth,uuid:()=>true},'../../../lib/member-announcements':{announcementsReady:async()=>{},announcementBody:(m,n,y)=>m.replace('{name}',n)+' '+y},'../../../lib/renewals':{openRenewal:x=>x},'../../../lib/renewal-reminders':{malaysiaDay:()=> '2026-10-19'},'../../../lib/reminder-settings':{reminderConfig:()=>({dailyLimit:20,subject:'Renew {year}',message:'Dear {name}'}),reminderText:(m,n,y)=>m.replace('{year}',y).replace('{name}',n)},'../../language':{getLanguage:async()=>lang}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/admin/announcements/page.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exportsPage,require:n=>mocks[n]||{},process:{env},Date});
(async()=>{
 const render=()=>exportsPage.default({searchParams:Promise.resolve({id:'test'})});let tree=await render(),copy=text(tree);
 assert.ok(copy.includes('Member announcements'));assert.ok(copy.includes('Test member'));assert.ok(copy.includes('test@example.com'));
 assert.ok(nodes(tree,'input').some(x=>x.props.name==='confirm'&&x.props.required&&x.props.type==='checkbox'));
 assert.equal(nodes(tree,'select').find(n=>n.props.name==='audience').props.defaultValue,'active');
 assert.ok(nodes(tree,'option').some(n=>n.props.value==='all'));
 env.CRON_SECRET='';tree=await render();assert.ok(nodes(tree,'button').find(x=>text(x)==='Confirm and queue announcement').props.disabled);
 lang='ms';tree=await render();assert.ok(text(tree).includes('Pengumuman ahli'));assert.ok(!text(tree).includes('Member announcements'));
 status='completed';tree=await render();assert.equal(nodes(tree,'input').some(x=>x.props.name==='confirm'),false);
 auth=false;const before=reads;await assert.rejects(render,/\/admin/);assert.equal(reads,before);
 const pref=fs.readFileSync('app/announcement-preferences/[token]/page.tsx','utf8');
 assert.ok(pref.includes('UPDATE club_announcement_preferences SET opt_out=true'));assert.ok(!pref.includes('UPDATE club_reminder_preferences'));
 assert.ok(pref.includes('referrer:'));assert.ok(pref.includes('if(!/^[a-f0-9]{64}$/'));
 assert.ok(fs.readFileSync('app/admin/navigation.tsx','utf8').includes('/admin/announcements'));
 assert.ok(fs.readFileSync('app/admin/page.tsx','utf8').includes('/admin/announcements'));
 console.log('PASS: announcement UI preview, recipient lists, confirmation, scheduler, EN/BM, auth, navigation and isolated unsubscribe.');
})().catch(e=>{console.error(e);process.exitCode=1;});
