const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
function load(file,mocks={}){const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:out,require:n=>n in mocks?mocks[n]:require(n),URL,Response,Map,Set,process});return out;}
const covers=load('lib/album-covers.ts');
const photos=Array.from({length:194},(_,i)=>({id:String(i),albumId:'album'+(i%4),caption:'Photo '+i,url:'/test.jpg',eventId:'e'}));
const summaries=covers.albumCovers(photos,[{id:'e',title:'Outing'}]);assert.equal(summaries.length,4);assert.equal(summaries.reduce((n,g)=>n+g.count,0),194);assert.equal(summaries[0].cover.id,'0');assert(!('photos' in summaries[0]));
let failed=false;
const api=load('app/api/albums/route.ts',{'../../../lib/public-content':{getPublicAlbumData:async()=>{if(failed)throw Error('storage');return {moments:photos};}}});
const monitor=load('app/public-speed-insights.tsx',{'@vercel/speed-insights/next':{},'next/navigation':{}});
assert.equal(monitor.cleanMetricUrl('https://club.test/shop?token=secret#private'),'https://club.test/shop');
for(const path of ['/admin','/admin/members/roster','/shop/orders/private-id','/join/payment/private-token','/api/gmail/callback'])assert.equal(monitor.cleanMetricUrl('https://club.test'+path),null);
const members=Array.from({length:70},(_,i)=>({memberNumber:'B-26-'+String(i+1).padStart(3,'0'),name:'Member '+i,active:i%2===0,annualStatus:i%2===0?'active':'inactive',recordYear:2026}));
let selected=[];
const history=load('lib/member-history.ts',{'./member-admin':{validYear:()=>{},listMembers:async(year,ids)=>{if(ids){selected=Array.from(ids);return members.filter(m=>ids.includes(m.memberNumber));}return members;}}});
(async()=>{
 let page=await history.memberPage(2026,'','all',2);assert.equal(page.members.length,25);assert.equal(page.members[0].memberNumber,'B-26-026');assert.equal(page.total,70);assert.equal(page.matching,70);assert.equal(selected.length,25);assert.equal(page.counts.active,35);
 page=await history.memberPage(2026,'Member 1','inactive',999);assert.equal(page.current,page.pages);assert(page.members.every(m=>m.name.includes('Member 1')&&!m.active));
 page=await history.memberPage(2026,'not found','all',1);assert.equal(page.matching,0);assert.equal(page.pages,1);
 assert.equal((await api.GET(new Request('https://club.test/api/albums'))).status,400);
 assert.equal((await api.GET(new Request('https://club.test/api/albums?id=missing'))).status,404);
 const response=await api.GET(new Request('https://club.test/api/albums?id=album0'));const data=await response.json();assert.equal(data.photos.length,49);assert.deepEqual(Object.keys(data.photos[0]).sort(),['caption','id','url']);assert.equal(response.headers.get('cache-control'),'no-store');
 failed=true;assert.equal((await api.GET(new Request('https://club.test/api/albums?id=album0'))).status,503);
 const roster=fs.readFileSync('lib/roster.ts','utf8');assert.match(roster,/club_applications WHERE name_hash=/);assert.match(roster,/club_renewals WHERE name_hash=/);assert.match(roster,/OR name_hash IS NULL/);
 for(const file of ['shop','membership','renewals','roster'])assert(fs.readFileSync('lib/'+file+'.ts','utf8').includes("KPKMM_SCHEMA_VERSION==='performance-v1'"));
 assert(fs.readFileSync('app/page.tsx','utf8').includes('albumCovers(gallery,data.events)'));
 console.log('PASS: 194 photos reduced to 4 covers, album endpoint errors/privacy, server pagination and selected previous-year rows, name index fallback, schema gate, metric URL redaction.');
})().catch(e=>{console.error(e);process.exitCode=1;});
