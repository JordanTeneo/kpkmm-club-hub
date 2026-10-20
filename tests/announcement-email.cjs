const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
function load(file,mocks){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Buffer,require:n=>mocks[n]||(n.startsWith('node:')?require(n):{})});return exports;}
const enrol=load('lib/enrolment.ts',{'./gmail':{CLUB_EMAIL:'club@example.com'}});
const {ecardMessage,readECard,validateECard}=load('lib/announcement-email.ts',{'./enrolment':enrol});
const bytes=fs.readFileSync('public/Logo.jpg');
const card={type:'image/jpeg',data:bytes.toString('base64')};
const raw=Buffer.from(ecardMessage('test@example.com','Greeting — 2026','Hello <script>alert(1)</script>\nhttps://example.com/unsubscribe',card),'base64url').toString();
assert.ok(raw.includes('multipart/related'));assert.ok(raw.includes('multipart/alternative'));assert.ok(raw.includes('Content-ID: <kpkmm-ecard>'));assert.ok(raw.includes('Content-Disposition: inline;'));
const html=raw.split('Content-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n')[1].split('\r\n--')[0];
const decoded=Buffer.from(html.replace(/\s/g,''),'base64').toString();assert.ok(decoded.includes('cid:kpkmm-ecard'));assert.ok(decoded.includes('&lt;script&gt;'));assert.ok(!decoded.includes('<script>'));assert.ok(decoded.includes('https://example.com/unsubscribe'));
const image=raw.split('Content-Disposition: inline; filename="kpkmm-ecard.jpg"\r\nContent-Transfer-Encoding: base64\r\n\r\n')[1].split('\r\n--')[0];assert.deepEqual(Buffer.from(image.replace(/\s/g,''),'base64'),bytes);
assert.throws(()=>ecardMessage('bad\r\nBcc: victim@example.com','Test','Test',card));assert.throws(()=>ecardMessage('test@example.com','Test','Test',{type:'image/svg+xml',data:card.data}));assert.throws(()=>ecardMessage('test@example.com','Test','Test',{type:'image/png',data:Buffer.from('not an image').toString('base64')}));assert.throws(()=>ecardMessage('test@example.com','Test','Test',{type:'image/png',data:Buffer.concat([bytes,Buffer.alloc(700*1024)]).toString('base64')}));
console.log('PASS: e-card multipart MIME, inline CID image bytes, HTML escaping, text fallback, recipient/type/size validation.');
// Two-frame 1px GIF, with frame delay preserved byte for byte through upload and MIME.
const gifHeader='47494638396101000100800000000000ffffff';
const gifFrame='21f904000a0000002c0000000001000100000202440100';
const gif=Buffer.from(gifHeader+gifFrame+gifFrame+'3b','hex');
assert.equal(validateECard('image/gif',gif),'gif');
const gif87=Buffer.from(gif);gif87.write('GIF87a');assert.equal(validateECard('image/gif',gif87),'gif');
assert.throws(()=>validateECard('image/gif',bytes));
assert.throws(()=>validateECard('image/png',gif));
assert.throws(()=>validateECard('image/gif',gif.subarray(0,-1)));
assert.throws(()=>validateECard('image/gif',Buffer.concat([gif,Buffer.alloc(700*1024)])));
(async()=>{
 const uploaded=await readECard(new File([gif],'animated.gif',{type:'image/gif'}));
 assert.deepEqual(Buffer.from(uploaded.data,'base64'),gif);
 const message=Buffer.from(ecardMessage('test@example.com','Animated card','Hello',uploaded),'base64url').toString();
 assert.ok(message.includes('Content-Type: image/gif'));
 const attachment=message.split('Content-Disposition: inline; filename="kpkmm-ecard.gif"\r\nContent-Transfer-Encoding: base64\r\n\r\n')[1].split('\r\n--')[0];
 assert.deepEqual(Buffer.from(attachment.replace(/\s/g,''),'base64'),gif);
 await assert.rejects(readECard(new File(['bad'],'fake.gif',{type:'image/gif'})));
 console.log('PASS: animated GIF upload and inline MIME preserve both frames; invalid, mismatched and oversized GIFs rejected.');
})().catch(e=>{console.error(e);process.exitCode=1;});
