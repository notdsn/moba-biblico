import puppeteer, { KnownDevices } from 'puppeteer-core'; import fs from 'fs';
globalThis.STEP = +(process.env.STEP || 3);
const [,, url, out, js] = process.argv;
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 0, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle'] });
const p = await b.newPage(); await p.emulate(KnownDevices['iPhone 11 landscape']); const erros = []; p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.text().startsWith('INFO')) console.log(m.text()); if (m.type() === 'error') erros.push(m.text()); });
await p.goto(url, { waitUntil: 'load' }); await p.waitForFunction('window.__pronto === true', { timeout: 240000 }); p.setDefaultTimeout(0);
await p.evaluate(() => __tick(20, 1 / 30)); await p.evaluate(fs.readFileSync(js, 'utf8')); await new Promise(r => setTimeout(r, 300)); await p.screenshot({ path: out }); if (process.env.FRAMES) { fs.mkdirSync(process.env.FRAMES, { recursive: true }); for (let i = 0; i < +process.env.NF; i++) { await p.evaluate((s) => __tick(s, 1 / 30), globalThis.STEP); await p.screenshot({ path: process.env.FRAMES + '/' + String(i).padStart(3, '0') + '.jpg', type: 'jpeg', quality: 80 }); } }
console.log('ERROS:', erros.length ? erros.join(' | ') : 'nenhum'); await b.close();
