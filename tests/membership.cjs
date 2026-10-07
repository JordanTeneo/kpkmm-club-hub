const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
const code=ts.transpileModule(fs.readFileSync('lib/membership.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exportsObject={};
vm.runInNewContext(code,{exports:exportsObject,require:(id)=>id==='./shop'?{db:()=>{throw Error('Database not used by unit tests');}}:require(id),Buffer,process:{env:{ADMIN_SESSION_SECRET:'test-only-not-production-key-0123456789'}},FormData});
const {validateApplicant,seal,unseal,fingerprint}=exportsObject;
const form=new FormData();for(const [k,v] of Object.entries({name:'Test Applicant',email:'test@example.com',phone:'+60 120000000',identityType:'mykad',identity:'000101-01-0000',country:'Malaysia',address:'Test address, 00000, Malaysia'}))form.set(k,v);
const applicant=validateApplicant(form);assert.equal(applicant.identity,'000101010000');
assert.equal(applicant.vehicles.length,0);
form.set('vehicles','abc 1234, WXY 5678\nABC 1234\r\n jk 99 ');
assert.equal(JSON.stringify(validateApplicant(form).vehicles),JSON.stringify(['ABC 1234','WXY 5678','JK 99']));
assert.equal(JSON.stringify(unseal(seal(validateApplicant(form))).vehicles),JSON.stringify(['ABC 1234','WXY 5678','JK 99']));
for(const invalid of ['x'.repeat(2001),'x'.repeat(81),Array.from({length:31},(_,i)=>'ABC '+i).join(','),'AB\u0000CD']){form.set('vehicles',invalid);assert.throws(()=>validateApplicant(form));}
form.delete('vehicles');
const ciphertext=seal(applicant);assert.ok(!ciphertext.includes(applicant.name));assert.equal(JSON.stringify(unseal(ciphertext)),JSON.stringify(applicant));assert.notEqual(seal(applicant),ciphertext);
const chunks=ciphertext.split('.');const bytes=Buffer.from(chunks[2],'base64');bytes[0]^=1;chunks[2]=bytes.toString('base64');assert.throws(()=>unseal(chunks.join('.')));
assert.equal(fingerprint('same'),fingerprint('same'));assert.notEqual(fingerprint('same'),fingerprint('different'));
form.set('identity','123');assert.throws(()=>validateApplicant(form));form.set('identityType','passport');form.set('identity','TEST12345');form.set('country','Test country');assert.equal(validateApplicant(form).identityType,'passport');form.set('email','invalid');assert.throws(()=>validateApplicant(form));
console.log('PASS: MyKad/passport validation, encryption round-trip, random IV, tamper rejection, keyed fingerprints. No real applicant data or database writes.');
