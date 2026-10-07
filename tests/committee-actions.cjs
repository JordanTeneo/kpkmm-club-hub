const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const source=fs.readFileSync('app/admin/users/page.tsx','utf8');
const action=source.slice(source.indexOf('async function manage('),source.indexOf('export default async function Users'));
const code=ts.transpileModule(action,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
async function run(operation,{owner=true,role='user',fail=false,newRole,confirm}={}){
 const calls=[];const form=new FormData();if(operation)form.set('operation',operation);form.set('id','test-user');form.set('password','test-only-password');
 if(newRole)form.set('role',newRole);if(confirm)form.set('confirmSuperAdmin','yes');
 const api={setUserPassword:async()=>{calls.push('reset');if(fail)throw Error('mock failure');},revokeUserSessions:async()=>calls.push('revoke')};
 api.createUser=async({body})=>{calls.push('create:'+body.role);return {user:{id:'new-test-user'}};};
 const context={committeeEnabled:async()=>true,committeeSession:async()=>({superAdmin:owner}),committeeAuth:()=>({api}),headers:async()=>({}),db:()=>async()=>[{role}],committeeAudit:async()=>calls.push('audit'),revalidatePath:()=>calls.push('revalidate'),redirect:url=>{throw Error(url)},console:{error:()=>{}}};
 vm.createContext(context);vm.runInContext(code,context);let result;try{await context.manage(form);}catch(e){result=e.message;}return {calls,result};
}
(async()=>{
 for(const op of ['reset','permissions'])assert.ok(source.includes('type="hidden" name="operation" value="'+op+'"'));
 assert.ok(!source.includes('<button name="operation"'));
 assert.deepEqual(await run('reset'),{calls:['reset','revoke','audit','revalidate'],result:'/admin/users?result=password-reset'});
 assert.equal((await run(null)).result,'/admin/users?result=invalid-action');
 assert.deepEqual((await run('reset',{owner:false})).calls,[]);
 assert.deepEqual((await run('reset',{role:'admin'})).calls,['revalidate']);
 assert.equal((await run('reset',{fail:true})).result,'/admin/users?result=update-error');
 assert.equal((await run('create',{newRole:'admin'})).result,'/admin/users?result=update-error');
 assert.ok(!(await run('create',{newRole:'admin'})).calls.includes('create:admin'));
 assert.ok((await run('create',{newRole:'admin',confirm:true})).calls.includes('create:admin'));
 assert.ok((await run('create')).calls.includes('create:user'));
 assert.deepEqual((await run('create',{owner:false,newRole:'admin',confirm:true})).calls,[]);
 assert.equal((await run('create',{newRole:'invalid',confirm:true})).result,'/admin/users?result=update-error');
 console.log('PASS: explicit form operations, reset/revoke/audit sequence, missing-action handling, owner-only access, owner protection, safe error result.');
})().catch(e=>{console.error(e);process.exit(1)});
