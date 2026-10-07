const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const cases=[['committee-access','committeeReady',4],['roster','rosterReady',6],['member-admin','adminRosterReady',1],['membership','membershipReady',5],['renewals','renewalsReady',5],['banner','bannerReady',1]];
function fixture(file,name,prepared=false){
 const source=fs.readFileSync('lib/'+file+'.ts','utf8');
 const ast=ts.createSourceFile(file+'.ts',source,ts.ScriptTarget.Latest,true);
 const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);
 let calls=0,fail=false,dependencies=0;
 const context={process:{env:{KPKMM_SCHEMA_VERSION:prepared?'performance-v1':undefined}},exports:{},db:()=>async()=>{calls++;if(fail){fail=false;throw Error('temporary database failure');}await Promise.resolve();},key:()=>{},rosterReady:async()=>{dependencies++;}};
 vm.runInNewContext(ts.transpileModule('let ready:Promise<void>|undefined;\n'+fn.getText(ast),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
 return {run:context.exports[name],count:()=>calls,fail:()=>{fail=true;},dependencies:()=>dependencies};
}
(async()=>{
 for(const [file,name,count] of cases){
  const f=fixture(file,name);
  await Promise.all([f.run(),f.run(),f.run()]);assert.equal(f.count(),count,file+' shares concurrent setup');
  await f.run();assert.equal(f.count(),count,file+' skips warm setup');
  const retry=fixture(file,name);retry.fail();
  const failed=await Promise.allSettled([retry.run(),retry.run()]);assert.ok(failed.every(x=>x.status==='rejected'));
  await retry.run();assert.equal(retry.count(),count+1,file+' retries after failure');
 }
 for(const [file,name] of cases.filter(([file])=>['membership','renewals','roster'].includes(file))){const f=fixture(file,name,true);await f.run();assert.equal(f.count(),0,'prepared '+file+' does no DDL');}
 const access=fs.readFileSync('lib/committee-access.ts','utf8');
 assert.match(access,/readEnabled\(\)\{await committeeReady\(\);return !!\(await db\(\)/);
 assert.match(access,/readSession\(\)\{\s*const session=await committeeAuth\(\)\.api\.getSession/);
 console.log('PASS: six schema initializers share concurrent work, skip warm DDL, retry failures; authentication and permission reads remain live.');
})().catch(e=>{console.error(e);process.exitCode=1;});
