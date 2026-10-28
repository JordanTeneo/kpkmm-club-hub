const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
function load(path,mocks={},extra={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>mocks[n],File,Buffer,...extra});return exports;}
let admin=true,readFails=false,writeFails=false,uploads=0,saves=0;
let data={notices:[{id:'notice-1',posterUrl:'old'}],events:[{id:'event'}],moments:[]};
const lib=load('lib/notice-poster.ts',{'./shop':{isAdmin:async permission=>{assert.equal(permission,'content');return admin;}},'./club-data':{getClubData:async strict=>{assert.equal(strict,true);if(readFails)throw Error('read');return structuredClone(data);},savePhoto:async()=>{uploads++;return {url:'new'};},saveClubData:async value=>{if(writeFails)throw Error('write');saves++;data=value;}}});
function form(file=new File([Buffer.from([255,216,255,0])],'poster.jpg',{type:'image/jpeg'}),id='notice-1'){const f=new FormData();f.set('id',id);f.set('poster',file);return f;}
(async()=>{
 admin=false;assert.equal((await lib.uploadNoticePoster(form())).error,'session');assert.equal(uploads,0);admin=true;
 for(const file of [new File([],'empty.jpg',{type:'image/jpeg'}),new File(['bad'],'fake.png',{type:'image/png'}),new File([Buffer.alloc(751*1024)],'large.jpg',{type:'image/jpeg'})])assert.equal((await lib.uploadNoticePoster(form(file))).error,'file');
 assert.equal((await lib.uploadNoticePoster(form(undefined,'missing'))).error,'missing');assert.equal(uploads,0);
 readFails=true;assert.equal((await lib.uploadNoticePoster(form())).error,'storage');assert.equal(uploads,0);assert.equal(saves,0);readFails=false;
 assert.equal((await lib.uploadNoticePoster(form())).error,undefined);assert.equal(data.notices[0].posterUrl,'new');assert.equal(data.events[0].id,'event');assert.equal(saves,1);
 writeFails=true;assert.equal((await lib.uploadNoticePoster(form())).error,'storage');
 let closed=0,calls=0;const bitmap={width:4000,height:5000,close(){closed++;}};
 const compress=load('lib/compress-poster.ts',{}, {createImageBitmap:async()=>bitmap,document:{createElement:()=>({getContext:()=>({fillRect(){},drawImage(){}}),toBlob(cb){calls++;cb(new Blob([Buffer.alloc(calls===1?800*1024:500*1024)],{type:'image/jpeg'}));}})}}).compressPoster;
 const small=new File(['small'],'small.png',{type:'image/png'});assert.equal(await compress(small),small);
 await assert.rejects(compress(new File(['bad'],'bad.gif',{type:'image/gif'})),/file/);
 const output=await compress(new File([Buffer.alloc(2*1024*1024)],'large.png',{type:'image/png'}));assert.equal(output.type,'image/jpeg');assert.ok(output.size<=750*1024);assert.equal(closed,1);assert.equal(calls,2);
 const page=fs.readFileSync('app/admin/page.tsx','utf8');assert.ok(page.includes('<PosterUpload'));assert.ok(page.includes('if(!result.error)refresh()'));
 console.log('PASS: poster auth, type/size, strict reads, missing notice, storage errors, persistence, compression, resource cleanup and page wiring.');
})().catch(error=>{console.error(error);process.exitCode=1;});
