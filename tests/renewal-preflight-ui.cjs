const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const jsx=(type,props)=>({type,props});let checked=false,hook=0,changes=[];
const react={useState:v=>[hook++===0?checked:v,x=>changes.push(x)],useActionState:()=>[{},()=>{},false]};
const mod={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/renew/form.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{exports:mod,require:n=>n==='react'?react:n==='react/jsx-runtime'?{jsx,jsxs:jsx}:n==='../ui-language'?{useUiText:()=>s=>s}:{}});
function nodes(n){return Array.isArray(n)?n.flatMap(nodes):n&&typeof n==='object'?[n,...nodes(n.props?.children)]:[];}
for(const eligible of [false,true]){checked=eligible;hook=0;changes=[];const tree=mod.RenewalForm({bm:false,year:2026,feeToken:'mock',paymentInstructions:jsx('section',{children:'BANK DETAILS'})});const all=nodes(tree);assert.equal(all.some(n=>n.props?.name==='proof'),eligible);assert.equal(all.some(n=>n.props?.children==='BANK DETAILS'),eligible);assert.equal(all.some(n=>n.props?.name==='consent'),eligible);
 const year=all.find(n=>n.props?.name==='year');year.props.onChange({target:{value:'2027'}});assert.ok(changes.includes(2027));assert.ok(changes.includes(false));
 const lookup=all.find(n=>n.props?.name==='lookupValue');lookup.props.onChange({target:{value:'Changed member'}});assert.ok(changes.includes('Changed member'));assert.ok(changes.includes(false));
}
console.log('PASS: bank instructions, receipt and consent absent until eligibility succeeds; year and identity edits require recheck.');

