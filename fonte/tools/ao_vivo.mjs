// confere o site publicado: erros no console, modelos Tripo carregados e total baixado. Uso: node tools/ao_vivo.mjs <url> [saida.png] [m]
import puppeteer, { KnownDevices } from 'puppeteer-core';
const [,, url, out, movel] = process.argv;
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle'] });
const p = await b.newPage(); if (movel) await p.emulate(KnownDevices['iPhone 11 landscape']); else await p.setViewport({ width: 1600, height: 720 });
const errs = [], reqs = new Map(); const cdp = await p.createCDPSession(); await cdp.send('Network.enable');
cdp.on('Network.responseReceived', e => reqs.set(e.requestId, { url: e.response.url, st: e.response.status, n: 0 }));
cdp.on('Network.loadingFinished', e => { const r = reqs.get(e.requestId); if (r) r.n = e.encodedDataLength; });
p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); }); p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
await p.goto(url, { waitUntil: 'networkidle0', timeout: 180000 }); await p.waitForFunction('window.__pronto === true', { timeout: 240000 }).catch(() => errs.push('não ficou pronto'));
await p.evaluate(() => window.__tick && window.__tick(40, 1 / 30)); await new Promise(r => setTimeout(r, 1500));
if (out) await p.screenshot({ path: out });
const L = [...reqs.values()]; const tot = L.reduce((a, r) => a + r.n, 0); const tp = L.filter(r => /models\/tripo/.test(r.url));
console.log(`total ${(tot / 1048576).toFixed(1)} MB em ${L.length} arquivos; tripo ${tp.length} (${(tp.reduce((a, r) => a + r.n, 0) / 1048576).toFixed(1)} MB); falhas ${L.filter(r => r.st >= 400).map(r => r.st + ' ' + r.url).join(', ') || 'nenhuma'}; erros: ${errs.join(' | ') || 'nenhum'}`);
await b.close();
