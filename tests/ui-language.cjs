const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const catalog=require('../lib/ui-catalog.json'),moduleMock={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../lib/ui-text.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,{exports:moduleMock.exports,require:()=>catalog});
const {uiText}=moduleMock.exports,en=uiText('en'),bm=uiText('ms');
assert.equal(en('Add member / Tambah ahli'),'Add member');assert.equal(bm('Add member / Tambah ahli'),'Tambah ahli');
assert.equal(bm('Address / Alamat:'),'Alamat:');assert.equal(en('Address / Alamat:'),'Address:');
assert.equal(en('MyKad / Passport'),'MyKad / Passport');assert.equal(bm('MyKad / Passport'),'MyKad / Pasport');
assert.equal(bm('  Delete '),'  Padam ');assert.equal(en('private name / address'),'private name / address');
assert.equal(bm(42),42);assert.equal(bm(undefined),undefined);assert.equal(bm('toString'),'toString');
for(const [key,pair]of Object.entries(catalog)){assert.equal(pair.length,2,key);assert.ok(pair.every(x=>typeof x==='string'),key);}
console.log('Interface translations, whitespace, non-string values and unknown content passed.');
