const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
let result;
const exportsObject={};
const mocks={'react':{...React,useActionState:()=>[{membership:result},()=>{},false]},'../ui-language':{useUiText:()=>s=>s},'./actions':{checkMembership:()=>{}}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/membership-status/form.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:exportsObject,require:n=>mocks[n]||require(n)});
function render(status,bm=false,extra={}){result={status,year:2026,...extra};return renderToStaticMarkup(React.createElement(exportsObject.MembershipCheckForm,{bm}));}
assert(render('unmatched').includes('href="/join"'));assert(render('unmatched',true).includes('Sertai Kelab'));
assert(render('active',false,{newMember:true}).includes('<h2>Active</h2>'));
assert(render('inactive').includes('<h2>Inactive</h2>'));assert(!render('inactive').includes('href="/join"'));
assert(render('active',false,{lifetime:true}).includes('no annual renewal'));assert(!render('active',false,{lifetime:true}).includes('31 December'));
for(const bm of [false,true]){const html=render('ambiguous',bm);assert(html.includes('tel:+60182262000'));assert(!/deceased|meninggal|Lifetime membership|Membership year/.test(html));assert(!html.includes('href="/join"'));}
console.log('PASS: EN/BM unmatched join link, active/new display, inactive result, lifetime without expiry and private committee-contact result.');
