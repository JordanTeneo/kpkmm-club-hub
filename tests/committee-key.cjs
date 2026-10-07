const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const code=ts.transpileModule(fs.readFileSync('lib/committee-auth.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function config(env){const exports={};vm.runInNewContext(code,{exports,process:{env},require:n=>({'better-auth':{betterAuth:o=>o},'better-auth/plugins/admin':{admin:()=>({})},'better-auth/next-js':{nextCookies:()=>({})},pg:{Pool:class{}},'node:crypto':crypto}[n])});return exports.committeeAuth();}
const storage='strong-storage-key-for-tests-only-12345678';
const env={ADMIN_SESSION_SECRET:'legacy-short',GMAIL_ENCRYPTION_KEY:storage};
const actual=config(env);assert.equal(actual.secret,crypto.createHmac('sha256',storage).update('kpkmm-committee-auth-v1').digest('hex'));
assert.equal(env.ADMIN_SESSION_SECRET,'legacy-short');assert.equal(env.GMAIL_ENCRYPTION_KEY,storage);assert.notEqual(actual.secret,storage);
const legacy='strong-existing-committee-key-123456789';assert.equal(config({...env,ADMIN_SESSION_SECRET:legacy}).secret,crypto.createHmac('sha256',legacy).update('kpkmm-committee-auth-v1').digest('hex'));
assert.throws(()=>config({ADMIN_SESSION_SECRET:'short',GMAIL_ENCRYPTION_KEY:'short'}),/not configured/);
assert.throws(()=>config({}),/not configured/);
assert.equal(actual.emailAndPassword.disableSignUp,true);assert.equal(actual.advanced.useSecureCookies,true);
console.log('PASS: strong purpose-separated fallback, legacy session compatibility, unchanged storage keys, missing/weak key rejection, closed signup.');
