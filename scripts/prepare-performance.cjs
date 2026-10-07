// Explicit pre-release step. Never run automatically during a web request/build.
// Supply DATABASE_URL and existing encryption secrets through the deployment environment.
const fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
delete process.env.KPKMM_SCHEMA_VERSION;
async function main(){
 const {db,shopReady}=require('../lib/shop.ts');
 const {membershipReady,unseal}=require('../lib/membership.ts');
 const {renewalsReady,openRenewal}=require('../lib/renewals.ts');
 const {rosterReady,nameKey}=require('../lib/roster.ts');
 await shopReady();await membershipReady();await renewalsReady();await rosterReady();
 const sql=db();
 try{
  for(const table of ['club_applications','club_renewals']){
   let count=0;
   for(;;){
    const rows=await sql.unsafe('SELECT id,payload FROM '+table+' WHERE name_hash IS NULL LIMIT 200');
    if(!rows.length)break;
    for(const row of rows){
     const person=table==='club_applications'?unseal(row.payload):JSON.parse(openRenewal(row.payload));
     const updated=await sql.unsafe('UPDATE '+table+' SET name_hash=$1 WHERE id=$2 AND payload=$3 AND name_hash IS NULL RETURNING id',[nameKey(person.name),row.id,row.payload]);
     count+=updated.length;
    }
   }
   console.log(table+': indexed '+count+' records (no personal details logged)');
  }
  console.log('Preparation complete. Set KPKMM_SCHEMA_VERSION=performance-v1 only after this succeeds, then deploy.');
 }finally{await sql.end();}
}
main().catch(()=>{console.error('Preparation failed. Do not set the schema version or deploy. Check database access and encryption configuration.');process.exitCode=1;});
