const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const jsx=(type,props)=>({type,props});
function text(n){if(n==null||n===false)return '';if(Array.isArray(n))return n.map(text).join(' ');return typeof n==='object'?text(n.props?.children):String(n);}
function nodes(n,type){if(!n||typeof n!=='object')return [];if(Array.isArray(n))return n.flatMap(x=>nodes(x,type));return [...(n.type===type?[n]:[]),...nodes(n.props?.children,type)];}
let auth=true,lang='en',status='draft',reads=0;const env={CRON_SECRET:'test-only-placeholder-of-32-characters'};
const db=()=>async(parts)=>{reads++;const q=parts.join('?');if(q.includes('SELECT config'))return [{config:{}}];if(q.includes('SELECT * FROM club_reminder_campaigns'))return [{id:'test',target_year:2026,status,payload:'{"subject":"Renew {year}","message":"Dear {name}"}'}];if(q.includes('SELECT payload,status'))return [{payload:'{"number":"B-001","name":"Test member","email":"test@example.com"}',status:'pending'}];return [];};
const exportsPage={};const mocks={'react/jsx-runtime':{jsx,jsxs:jsx},'next/navigation':{redirect:x=>{throw Error(x);}},'../../../../lib/shop':{db,isAdmin:async()=>auth,uuid:()=>true},'../../../../lib/reminder-campaigns':{campaignsReady:async()=>{},campaignBody:(m,n,y)=>m.replace('{name}',n)+' '+y},'../../../../lib/renewals':{openRenewal:x=>x},'../../../../lib/renewal-reminders':{malaysiaDay:()=> '2026-10-19'},'../../../../lib/reminder-settings':{reminderConfig:()=>({subject:'Renew {year}',message:'Dear {name}'}),reminderText:(m,n,y)=>m.replace('{year}',y).replace('{name}',n)},'../../../language':{getLanguage:async()=>lang}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/admin/reminders/campaigns/page.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exportsPage,require:n=>mocks[n]||{},process:{env},Date});
(async()=>{
 const render=()=>exportsPage.default({searchParams:Promise.resolve({id:'test'})});let tree=await render(),copy=text(tree);
 assert.ok(copy.includes('does not send immediately'));assert.ok(copy.includes('Test member'));assert.ok(copy.includes('test@example.com'));assert.ok(copy.includes('2026'));assert.ok(!copy.includes('Cipta pratonton'));
 assert.ok(nodes(tree,'input').some(x=>x.props.name==='confirm'&&x.props.required&&x.props.type==='checkbox'));
 assert.ok(nodes(tree,'a').some(x=>x.props.href==='/admin/reminders'));
 assert.equal(nodes(tree,'select')[0].props.defaultValue,2026);
 env.CRON_SECRET='';tree=await render();assert.ok(text(tree).includes('confirmation is disabled'));assert.ok(nodes(tree,'button').find(x=>text(x)==='Confirm and queue campaign').props.disabled);
 lang='ms';tree=await render();assert.ok(text(tree).includes('Cipta pratonton'));assert.ok(!text(tree).includes('Create a preview'));
 status='completed';tree=await render();assert.equal(nodes(tree,'input').some(x=>x.props.name==='confirm'),false);
 auth=false;const before=reads;await assert.rejects(render,/\/admin/);assert.equal(reads,before);
 console.log('PASS: campaign page preview, recipient list, required confirmation, missing scheduler guard, fixed year selection, navigation, single-language controls and read authorization.');
})().catch(e=>{console.error(e);process.exitCode=1;});
