import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(new URL('../package.json', import.meta.url));
const QRCode = require('qrcode');
const TOK = { A: 'C0FFEE'.repeat(10) + 'ABCD', REV: 'DEADBE'.repeat(10) + '1234' }; // 64 hex, mayúsculas como Convert.ToHexString
for (const [k, v] of Object.entries(TOK)) if (v.length !== 64) throw new Error(k);
writeFileSync('tokens.json', JSON.stringify(TOK));
for (const [name, text] of [['A', TOK.A], ['REV', TOK.REV], ['ALIEN', 'https://example.com/promo?x=1']]) {
  writeFileSync(`qr_${name}.png`, await QRCode.toBuffer(text, { errorCorrectionLevel: 'M', margin: 3, width: 220 }));
}
console.log('qr listos', TOK);
