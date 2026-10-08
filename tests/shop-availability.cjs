const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const {renderToStaticMarkup}=require('react-dom/server');
function load(file,mocks){const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:out,require:n=>n in mocks?mocks[n]:require(n)});return out;}
let enabled=true,allowed=true,writes=0;const invalidated=[];
const sql=async(parts,...v)=>{if(parts.join('').includes('UPDATE shop_settings')){writes++;enabled=v[0];}return [];};
const settings=load('app/admin/shop/availability.tsx',{'../../../lib/shop-settings':{marketplaceEnabled:async()=>enabled,shopSettingsReady:async()=>{}},'../../../lib/shop':{db:()=>sql,isAdmin:async scope=>{assert.equal(scope,'shop');return allowed;}},'next/cache':{revalidatePath:(...args)=>invalidated.push(args)},'../../shop/forms':{ShopForm:()=>null}});
const react=require('react');
const nav=load('app/site-navigation.tsx',{'next/link':{default:({children,...p})=>react.createElement('a',p,children)},'next/navigation':{usePathname:()=>'/about'}});
(async()=>{
 const f=new FormData();f.set('enabled','false');allowed=false;assert((await settings.saveMarketplaceAvailability({},f)).error);assert.equal(writes,0);
 allowed=true;f.set('enabled','wrong');assert((await settings.saveMarketplaceAvailability({},f)).error);assert.equal(writes,0);
 f.set('enabled','false');assert((await settings.saveMarketplaceAvailability({},f)).success);assert.equal(enabled,false);assert(invalidated.some(a=>a[0]==='/'&&a[1]==='layout'));
 f.set('enabled','true');assert((await settings.saveMarketplaceAvailability({},f)).success);assert.equal(enabled,true);
 for(const bm of [true,false])for(const visible of [true,false]){const html=renderToStaticMarkup(react.createElement(nav.SiteNavigation,{bm,showMarketplace:visible,children:null}));assert.equal(html.includes('href="/shop"'),visible);assert(html.includes('href="/join"'));}
 const actions=fs.readFileSync('app/shop/actions.ts','utf8');assert(actions.indexOf('SELECT enabled FROM shop_settings')<actions.indexOf('UPDATE shop_products SET stock=stock-'));assert(actions.includes('FOR SHARE'));
 const existing=actions.slice(actions.indexOf('export async function openOrder'));assert(!existing.includes('shopSettingsReady()'),'Existing orders are not gated by new-order switch');
 const page=fs.readFileSync('app/shop/page.tsx','utf8');assert(page.indexOf('if(!enabled)return')<page.indexOf('SELECT * FROM shop_products'));assert(page.includes('Existing orders remain available.'));
 console.log('PASS: admin-only enable/disable, input validation, layout refresh, hidden EN/BM navigation, checkout gate and existing-order preservation.');
})().catch(e=>{console.error(e);process.exitCode=1;});
