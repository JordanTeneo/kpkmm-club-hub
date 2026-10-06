const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
let effects=[],refs=[],seq=0;
const react={useRef:()=>{const ref={current:null};refs.push(ref);return ref;},useId:()=> 'popup-'+(++seq),useEffect:fn=>effects.push(fn)};
const jsx=(type,props)=>({type,props});const exportsMock={};
const source=fs.readFileSync('app/renew/form.tsx','utf8')+'\nexport {RenewalOutcome};';
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exportsMock,require:n=>n==='react'?react:n==='react/jsx-runtime'?{jsx,jsxs:jsx}:n==='../ui-language'?{useUiText:()=>x=>x}:{}});
function text(node){if(node==null||node===false)return '';if(Array.isArray(node))return node.map(text).join(' ');if(typeof node==='object')return text(node.props?.children);return String(node);}
for(const [result,bm,title]of [[{success:'Saved for review',reference:'test-reference'},false,'Renewal request submitted'],[{success:'Already on file'},false,'Request already recorded'],[{error:'No matching member'},false,'Unable to submit renewal'],[{success:'Disimpan',reference:'ujian'},true,'Permohonan pembaharuan dihantar'],[{error:'Tiada padanan'},true,'Pembaharuan tidak dapat dihantar']]){
 effects=[];refs=[];const tree=exportsMock.RenewalOutcome({result,bm});assert.equal(tree.type,'dialog');assert.ok(tree.props['aria-labelledby']);assert.ok(tree.props['aria-describedby']);assert.ok(text(tree).includes(title));
 if(result.success)assert.ok(text(tree).includes(bm?'Ini bukan kelulusan keahlian':'This is not membership approval'));
 const modal={open:false,showModal(){this.open=true;},close(){this.open=false;}};refs[0].current=modal;effects.forEach(fn=>fn());assert.equal(modal.open,true);
 const close=tree.props.children.find(n=>n?.type==='button');assert.equal(close.props.type,'button');close.props.onClick();assert.equal(modal.open,false);
 effects.forEach(fn=>fn());assert.equal(modal.open,true);
}
effects=[];refs=[];exportsMock.RenewalOutcome({result:{},bm:false});refs[0].current={open:false,showModal(){throw Error('Must not show empty popup');}};effects.forEach(fn=>fn());
console.log('PASS: EN/BM success, duplicate and error dialogs, pending-approval wording, accessible labels, close/reopen and no empty popup. No member data or emails used.');
