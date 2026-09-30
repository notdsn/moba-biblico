// print de uma veste: retrato de corpo (padrão x veste) + a veste em partida (iPhone 11 deitado)
import puppeteer, { KnownDevices } from 'puppeteer-core'; import fs from 'fs';
const [,, heroi, veste, out] = process.argv;
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 0, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle'] });
const p = await b.newPage(); await p.emulate(KnownDevices['iPhone 11 landscape']); const erros = []; p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
const vs = ['davi', 'sansao', 'debora', 'gideao'].includes(heroi) ? 'golias' : 'davi';
await p.goto(`http://localhost:5199/?cap&cena=luta&heroi=${heroi}&vs=${vs}&veste=${heroi}:${veste}`, { waitUntil: 'load' }); await p.waitForFunction('window.__pronto === true', { timeout: 240000 }); p.setDefaultTimeout(0);
const r = await p.evaluate(async (h, v) => { const J = window.__jogo; const rv = await J.retratosDaVeste(h, v); return { a: J.retratosCorpo[h].toDataURL(), b: rv.corpo.toDataURL() }; }, heroi, veste);
await p.evaluate(() => __tick(20, 1 / 30)); await new Promise(r => setTimeout(r, 300));
await p.screenshot({ path: '/tmp/veste_jogo.png' });
fs.writeFileSync('/tmp/veste_a.png', Buffer.from(r.a.split(',')[1], 'base64')); fs.writeFileSync('/tmp/veste_b.png', Buffer.from(r.b.split(',')[1], 'base64'));
console.log('ERROS:', erros.length ? erros.join(' | ') : 'nenhum'); await b.close();
