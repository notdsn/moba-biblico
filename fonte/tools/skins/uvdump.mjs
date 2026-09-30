import puppeteer from 'puppeteer-core'; import fs from 'fs';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
await p.goto('http://localhost:5199/uvlab.html'); await p.waitForFunction('window.pronto', { timeout: 60000 });
for (const id of (process.argv[2] || 'davi').split(',')) { const r = await p.evaluate((id) => extrair(id), id); fs.writeFileSync('/tmp/skins/' + id + '_uv.json', JSON.stringify(r)); console.log(id, r.P.length / 3, r.I.length / 3, 'flipY', r.flipY); }
await b.close();
