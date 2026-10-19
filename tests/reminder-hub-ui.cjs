const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict');
const jsx=(type,props)=>({type,props});
function nodes(n){return Array.isArray(n)?n.flatMap(nodes):n&&typeof n==='object'?[n,...nodes(n.props?.children)]:[];}
function text(n){return n==null||n===false?'':Array.isArray(n)?n.map(text).join(' '):typeof n==='object'?text(n.props?.children):String(n);}
let lang='en',paused=true,auth=true,rows=[],reads=0;const processMock={env:{CRON_SECRET:'x'.repeat(32)}};
const sql=async p=>{reads++;const q=p.join('?');assert.match(q,/^SELECT/);if(q.includes('SELECT paused'))return [{paused,start_date:'2026-12-15',config:{dailyLimit:20,intervalMonths:1,subject:'Renew',message:'Dear {name}'}}];if(q.includes('SELECT count'))return [{count:2}];return rows;};
const mocks={'react/jsx-runtime':{jsx,jsxs:jsx},'next/navigation':{redirect:x=>{throw Error(x);}},'../../../lib/shop':{db:()=>sql,isAdmin:async()=>auth},'../../../lib/renewal-reminders':{remindersReady:async()=>{},malaysiaDay:()=> '2026-10-19'},'../../language':{getLanguage:async()=>lang},'../../../lib/reminder-settings':{reminderConfig:x=>x}};
const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/admin/reminders/page.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{exports:out,require:n=>mocks[n]||{},process:processMock,Date});
(async()=>{
 const render=result=>out.default({searchParams:Promise.resolve({result})});let tree=await render(),all=nodes(tree),copy=text(tree);
 for(const s of ['One-time reminder','Automatic reminders','Sending history','Turn on automatic reminders','Shared by reminders and announcements','No sending attempts yet.'])assert.ok(copy.includes(s),s);
 assert.equal(all.filter(n=>n.type==='details').every(n=>!n.props.open),true);
 assert.ok(all.some(n=>n.type==='a'&&n.props.href==='/admin/reminders/campaigns'&&text(n)==='Create one-time reminder'));
 for(const name of ['targetYear','startDate','dailyLimit','intervalMonths','subject','message'])assert.equal(all.filter(n=>n.props?.name===name).length,1,name);
 assert.ok(all.some(n=>n.type==='select'&&n.props.name==='targetYear'&&n.props.defaultValue==='automatic'));
 assert.ok(all.some(n=>n.type==='option'&&n.props.value===2026));
 assert.ok(all.some(n=>n.type==='option'&&n.props.value===2027));
 assert.ok(copy.includes('start date applies only to automatic reminders'));
 assert.ok(copy.includes('does not cancel one-time campaigns'));
 tree=await render('invalid');assert.ok(nodes(tree).some(n=>n.type==='details'&&n.props.open));
 processMock.env.CRON_SECRET='';tree=await render();assert.ok(nodes(tree).find(n=>n.type==='button'&&text(n)==='Turn on automatic reminders').props.disabled);
 paused=false;tree=await render();assert.equal(nodes(tree).find(n=>n.type==='button'&&text(n)==='Turn off automatic reminders').props.disabled,false);
 rows=['accepted','failed','skipped','unknown','sending'].map(status=>({member_number:'TEST',target_year:2026,attempt_day:'2026-10-19',status}));tree=await render();assert.ok(text(tree).includes('Accepted by Gmail'));assert.ok(text(tree).includes('Unconfirmed — not retried'));assert.equal(nodes(tree).filter(n=>n.type==='li').length,8);
 lang='ms';tree=await render();assert.ok(text(tree).includes('Peringatan automatik'));assert.ok(!text(tree).includes('Automatic reminders'));
 auth=false;const before=reads;await assert.rejects(render,/\/admin/);assert.equal(reads,before);
 console.log('PASS: reminder hub sections, collapsed settings, clear automatic-only switch, unchanged form fields, scheduler guard, delivery labels, EN/BM and read authorization.');
})().catch(e=>{console.error(e);process.exitCode=1;});
