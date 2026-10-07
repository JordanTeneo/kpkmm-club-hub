const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript'),vm=require('node:vm');
const source=fs.readFileSync('app/admin/page.tsx','utf8');
const guard=source.match(/const canManageAccounts = (.*);/)[1];
const links=source.split('{ title: "Shop & settings"')[1].split('return <main')[0];
assert(links.includes('...(canManageAccounts ? [["/admin/users"'));
assert(links.includes('Akaun jawatankuasa'));
assert(links.includes('Committee accounts'));
async function evaluate(section,individual,superAdmin){
 let calls=0;
 const output=ts.transpileModule(`async function check(){return ${guard};} exports.check=check;`,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};vm.runInNewContext(output,{exports,section,individual,committeeSession:async()=>{calls++;return superAdmin===null?null:{superAdmin};}});
 return {allowed:await exports.check(),calls};
}
(async()=>{
 assert.deepEqual(await evaluate('overview',true,true),{allowed:true,calls:1});
 assert.deepEqual(await evaluate('overview',true,false),{allowed:false,calls:1});
 assert.deepEqual(await evaluate('overview',true,null),{allowed:false,calls:1});
 assert.deepEqual(await evaluate('overview',false,false),{allowed:true,calls:0});
 assert.deepEqual(await evaluate('photos',true,true),{allowed:false,calls:0});
 console.log('PASS: Committee accounts dashboard shortcut, EN/BM and Super Admin visibility');
})().catch(e=>{console.error(e);process.exitCode=1;});
