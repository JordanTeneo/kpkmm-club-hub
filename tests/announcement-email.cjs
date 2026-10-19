const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
function load(file,mocks){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Buffer,require:n=>mocks[n]||(n.startsWith('node:')?require(n):{})});return exports;}
const enrol=load('lib/enrolment.ts',{'./gmail':{CLUB_EMAIL:'club@example.com'}});
const {ecardMessage}=load('lib/announcement-email.ts',{'./enrolment':enrol});
const bytes=fs.readFileSync('public/Logo.jpg');
const card={type:'image/jpeg',data:bytes.toString('base64')};
const raw=Buffer.from(ecardMessage('test@example.com','Greeting — 2026','Hello <script>alert(1)</script>\nhttps://example.com/unsubscribe',card),'base64url').toString();
assert.ok(raw.includes('multipart/related'));assert.ok(raw.includes('multipart/alternative'));assert.ok(raw.includes('Content-ID: <kpkmm-ecard>'));assert.ok(raw.includes('Content-Disposition: inline;'));
const html=raw.split('Content-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n')[1].split('\r\n--')[0];
const decoded=Buffer.from(html.replace(/\s/g,''),'base64').toString();assert.ok(decoded.includes('cid:kpkmm-ecard'));assert.ok(decoded.includes('&lt;script&gt;'));assert.ok(!decoded.includes('<script>'));assert.ok(decoded.includes('https://example.com/unsubscribe'));
const image=raw.split('Content-Disposition: inline; filename="kpkmm-ecard.jpg"\r\nContent-Transfer-Encoding: base64\r\n\r\n')[1].split('\r\n--')[0];assert.deepEqual(Buffer.from(image.replace(/\s/g,''),'base64'),bytes);
assert.throws(()=>ecardMessage('bad\r\nBcc: victim@example.com','Test','Test',card));assert.throws(()=>ecardMessage('test@example.com','Test','Test',{type:'image/svg+xml',data:card.data}));assert.throws(()=>ecardMessage('test@example.com','Test','Test',{type:'image/png',data:Buffer.from('not an image').toString('base64')}));assert.throws(()=>ecardMessage('test@example.com','Test','Test',{type:'image/png',data:Buffer.concat([bytes,Buffer.alloc(700*1024)]).toString('base64')}));
console.log('PASS: e-card multipart MIME, inline CID image bytes, HTML escaping, text fallback, recipient/type/size validation.');
