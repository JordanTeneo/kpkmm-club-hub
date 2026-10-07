const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
function load(file,imports){const source=fs.readFileSync(file,'utf8');const context={exports:{},require:name=>{if(!(name in imports))throw Error(name);return imports[name]},structuredClone};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);return context.exports;}
(async()=>{
 let calls={banner:0,club:0,videos:0},fail=false,entries=new Map;
 const cache=(fn,keys,options)=>{assert.equal(options.revalidate,300);return async()=>{const tag=options.tags[0];if(entries.has(tag))return entries.get(tag);const value=await fn();entries.set(tag,value);return value;}};
 const content=load('lib/public-content.ts',{
  'next/cache':{unstable_cache:cache},'./banner':{defaultBanner:{url:'fallback'},getBanner:async strict=>{assert.ok(strict);calls.banner++;if(fail)throw Error('outage');return {url:'live'};}},
  './club-data':{fallbackData:{events:[],notices:[],moments:[]},getClubData:async strict=>{assert.ok(strict);calls.club++;return {events:[1],notices:[],moments:[]};}},
  './shop':{db:()=>async()=>{calls.videos++;return [{id:1}];}},'./videos':{videosReady:async()=>{}}
 });
 await content.getPublicContent();await content.getPublicContent();assert.deepEqual(calls,{banner:1,club:1,videos:1});
 entries.delete('public-banner');fail=true;assert.equal((await content.getPublicContent()).homeBanner.url,'fallback');assert.ok(!entries.has('public-banner'));fail=false;assert.equal((await content.getPublicContent()).homeBanner.url,'live');
 for(const [file,tag]of [['app/admin/page.tsx','public-club'],['app/admin/banner/page.tsx','public-banner'],['app/admin/videos/page.tsx','public-videos']])assert.ok(fs.readFileSync(file,'utf8').includes('updateTag('+JSON.stringify(tag)+')')||fs.readFileSync(file,'utf8').includes("updateTag('"+tag+"')"));
 let action=false,reads=0,permissions=0,session={user:{id:'test',role:'member'}},memo=new Map;
 const access=load('lib/committee-access.ts',{'react':{cache:fn=>()=>{if(!memo.has(fn))memo.set(fn,fn());return memo.get(fn);}},'next/headers':{headers:async()=>({has:()=>action,get:()=>action?'test-action':null})},'./shop':{db:()=>async strings=>{const sql=strings.join('');if(sql.includes('SELECT enabled')){reads++;return [{enabled:true}];}if(sql.includes('SELECT scopes')){permissions++;return [{scopes:['content'],disabled:false}];}return [];}},'./committee-auth':{committeeAuth:()=>({api:{getSession:async()=>session}})}});
 await access.committeeEnabled();await access.committeeEnabled();await access.committeeSession();await access.committeeSession();assert.equal(reads,1);assert.equal(permissions,1);
 memo.clear();await access.committeeSession();assert.equal(permissions,2,'new request checks permission again');
 action=true;await access.committeeSession();await access.committeeSession();assert.equal(permissions,4,'mutations bypass render memoization');session=null;assert.equal(await access.committeeSession(),null);
 const album=fs.readFileSync('app/album-ui.tsx','utf8');assert.match(album,/const group = opened \? groups\[selected\] : undefined/);assert.match(album,/sizes="80px"/);assert.match(album,/onClose=\{\(\)=>setOpened\(false\)\}/);
 console.log('PASS: public cache reuse/invalidation wiring, errors not cached, access fresh across requests and mutations, gallery originals deferred until open.');
})().catch(error=>{console.error(error);process.exitCode=1;});
