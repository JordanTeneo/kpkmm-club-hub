const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
let visible=false,effect,cleanup,listener,reduced=false,scrolled,focused;
const window={scrollY:0,addEventListener:(event,fn,options)=>{assert.equal(event,'scroll');assert.equal(options.passive,true);listener=fn;},removeEventListener:(event,fn)=>{assert.equal(event,'scroll');assert.equal(fn,listener);},matchMedia:()=>({matches:reduced}),scrollTo:options=>{scrolled=options;}};
const exportsObject={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/back-to-top.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{
 exports:exportsObject,window,document:{getElementById:id=>{assert.equal(id,'page-top');return {focus:options=>{focused=options.preventScroll;}};}},
 require:name=>name==='react'?{useState:()=>[visible,value=>{visible=value;}],useEffect:fn=>{effect=fn;}}:{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})}
});
const render=label=>exportsObject.BackToTop({label});
assert.equal(render('Back to top').props.hidden,true);cleanup=effect();
window.scrollY=301;listener();let button=render('Back to top');assert.equal(button.props.hidden,false);assert.equal(button.props.type,'button');button.props.onClick();assert.equal(scrolled.top,0);assert.equal(scrolled.behavior,'smooth');assert.equal(focused,true);
reduced=true;button.props.onClick();assert.equal(scrolled.behavior,'instant');
assert.equal(render('Kembali ke atas').props['aria-label'],'Kembali ke atas');
window.scrollY=0;listener();assert.equal(render('Back to top').props.hidden,true);cleanup();
const layout=fs.readFileSync('app/layout.tsx','utf8');assert.match(layout,/<BackToTop/);assert.match(layout,/id="page-top" tabIndex=\{-1\}/);
console.log('PASS: Global back-to-top integration, scroll visibility, passive listener cleanup, focus, EN/BM and reduced motion.');
