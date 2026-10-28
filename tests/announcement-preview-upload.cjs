const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
function load(path,mocks={},extra={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>mocks[n],File,Buffer,Error,...extra});return exports;}
(async()=>{
 let closed=0,encodes=0;
 const compress=load('lib/compress-poster.ts',{}, {createImageBitmap:async()=>({width:4000,height:5000,close(){closed++;}}),document:{createElement:()=>({getContext:()=>({fillRect(){},drawImage(){}}),toBlob(cb){encodes++;cb(new Blob([Buffer.alloc(encodes===1?720*1024:600*1024)],{type:'image/jpeg'}));}})}});
 const {prepareECard}=load('lib/prepare-ecard.ts',{'./compress-poster':compress});
 const large=new File([Buffer.alloc(2*1024*1024)],'large.png',{type:'image/png'}),small=new File(['small'],'small.png',{type:'image/png'}),gif=new File(['GIF89a'],'animated.gif',{type:'image/gif'});
 const result=await prepareECard(large);assert.ok(result.size<=650*1024);assert.equal(result.type,'image/jpeg');assert.equal(closed,1);assert.equal(encodes,2);
 assert.equal(await prepareECard(small),small);assert.equal(await prepareECard(gif),gif);assert.equal(encodes,2);
 await assert.rejects(prepareECard(new File([Buffer.alloc(701*1024)],'big.gif',{type:'image/gif'})),/gif-size/);
 await assert.rejects(prepareECard(new File([Buffer.alloc(41*1024*1024)],'big.png',{type:'image/png'})),/size/);
 await assert.rejects(prepareECard(new File(['x'],'x.webp',{type:'image/webp'})),/file/);
 let messages=[],pushed=[],calls=0,release;
 const jsx=(type,props)=>({type,props});
 class Form {constructor(){this.data=new Map([['ecard',small],['subject','My update']]);}get(key){return this.data.get(key);}set(key,value){this.data.set(key,value);}}
 const component=load('app/admin/announcements/preview-form.tsx',{'react/jsx-runtime':{jsx,jsxs:jsx},react:{useRef:()=>({current:false}),useState:()=>[false,v=>messages.push(v)]},'next/navigation':{useRouter:()=>({push:x=>pushed.push(x),refresh(){}})},'../../../lib/prepare-ecard':{prepareECard}},{FormData:Form}).default;
 const form=component({bm:false,children:'fields',action:async data=>{calls++;assert.equal(data.get('subject'),'My update');await new Promise(r=>release=r);return {id:'draft-1'};}});
 const event={preventDefault(){},currentTarget:{reset(){throw Error('must not reset');}}};
 const first=form.props.onSubmit(event);await new Promise(r=>setImmediate(r));await form.props.onSubmit(event);assert.equal(calls,1);release();await first;assert.equal(pushed[0],'/admin/announcements?id=draft-1');
 const failed=component({bm:false,children:'fields',action:async()=>({error:'preview'})});await failed.props.onSubmit(event);assert.ok(messages.some(x=>String(x).includes('Your entries are kept')));assert.equal(pushed.length,1);
 console.log('PASS: PNG compression below email limit, GIF preservation/size limits, duplicate submission guard, successful preview navigation and retained form on failure.');
})().catch(e=>{console.error(e);process.exitCode=1;});
