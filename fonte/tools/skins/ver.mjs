// node tools/skins/ver.mjs <id> <textura(url relativa ao servidor) ou -> <saida.png>
import puppeteer from 'puppeteer-core'; import fs from 'fs';
const [,, id, tex, out] = process.argv;
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle'] });
const p = await b.newPage(); p.on('console', m => console.log(m.text())); p.on('pageerror', e => console.log('ERR', e.message));
await p.goto('http://localhost:5199/uvlab.html'); await p.waitForFunction('window.pronto', { timeout: 60000 });
const d = await p.evaluate((id, t) => ver(id, t === '-' ? null : t), id, tex);
fs.writeFileSync(out, Buffer.from(d.split(',')[1], 'base64')); console.log(out); await b.close();
