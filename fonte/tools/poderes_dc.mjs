// iPhone 11 emulado: draw calls extras de cada poder (pico nos 0,8 s depois de lançar). Uso: node tools/poderes_dc.mjs <url> <js>
import puppeteer, { KnownDevices } from 'puppeteer-core'; import fs from 'fs';
const [,, url, js] = process.argv;
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 0, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle'] });
const p = await b.newPage(); await p.emulate(KnownDevices['iPhone 11 landscape']); const erros = []; p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.text().startsWith('DC')) console.log(m.text()); });
await p.goto(url, { waitUntil: 'load' }); await p.waitForFunction('window.__pronto === true', { timeout: 240000 }); p.setDefaultTimeout(0);
await p.evaluate(fs.readFileSync(js, 'utf8')); console.log('erros:', erros.length ? erros.join(' | ') : 'nenhum'); await b.close();
