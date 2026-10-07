const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const {renderToStaticMarkup}=require('react-dom/server');
const exportsMock={};let language='en';
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/admin/members/roster/list.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:exportsMock,URLSearchParams,require:name=>name.includes('ui-language')?{useUiText:()=>s=>s.split(' / ')[0],useUiLanguage:()=>language}:name.includes('annual-status')?{statusLabel:(s,bm)=>bm?'Aktif':'Active'}:require(name)});
const props={members:[{memberNumber:'B-26-001',name:'Test Member',annualStatus:'active',identity:'TEST-ONLY',address:'Test address',email:'test@example.test',vehicles:['TEST 1'],paymentHistory:[{year:2025,status:'paid',note:''}]}],year:2026,query:'',status:'all',counts:{active:1},total:1,matching:1,pages:1,current:1};
for(language of ['en','ms']){
 const html=renderToStaticMarkup(exportsMock.MemberList(props));
 const match=html.match(/<details class="member-disclosure"([^>]*)><summary>(.*?)<\/summary>([\s\S]*?)<\/article>/);
 assert(match);assert(!/\bopen\b/.test(match[1]),'Collapsed by default');
 assert(match[2].includes('Test Member')&&match[2].includes('B-26-001'));
 assert(!match[2].includes('TEST-ONLY')&&!match[2].includes('<a '),'No private details or nested actions in summary');
 assert(match[3].includes('TEST-ONLY')&&match[3].includes('test@example.test')&&match[3].includes('TEST 1'));
 assert(match[3].includes('/roster/edit?')&&match[3].includes('/roster/renew?'));
 assert(match[3].includes('<details style='),'Payment history remains independently collapsible');
}
console.log('PASS: member cards collapsed in EN/BM, summary only, details/actions/history preserved.');
