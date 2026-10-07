const fs = require('node:fs');
const assert = require('node:assert/strict');
const source = fs.readFileSync('app/admin/page.tsx', 'utf8');
const catalog = JSON.parse(fs.readFileSync('lib/ui-catalog.json', 'utf8'));
const websiteGroup = source.split('{ title: "Website"')[1].split('{ title: "Shop & settings"')[0];
assert.ok(websiteGroup.includes('["/admin/celebrations", "Celebration greetings", "Manage festive banners, greeting cards and display dates"]'));
assert.deepEqual(catalog['Celebration greetings'], ['Celebration greetings', 'Ucapan perayaan']);
assert.deepEqual(catalog['Manage festive banners, greeting cards and display dates'], ['Manage festive banners, greeting cards and display dates', 'Urus sepanduk perayaan, kad ucapan dan tarikh paparan']);
console.log('PASS: Website dashboard celebration card and separate EN/BM labels.');
