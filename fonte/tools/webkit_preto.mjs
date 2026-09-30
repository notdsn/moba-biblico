// reproduz no WebKit (motor do Safari) com o iPhone 11: tira prints em cada cenário do snippet e mede o brilho médio
import { webkit, devices } from 'playwright'; import fs from 'fs';
const [,, url, js, dir] = process.argv; fs.mkdirSync(dir, { recursive: true });
const b = await webkit.launch(); const ctx = await b.newContext({ ...devices['iPhone 11 landscape'] }); const p = await ctx.newPage(); const erros = [];
p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') erros.push(m.text().slice(0, 200)); });
await p.goto(url); await p.waitForFunction('window.__pronto === true', null, { timeout: 300000 });
await p.evaluate(() => __tick(20, 1 / 30)); await p.evaluate(fs.readFileSync(js, 'utf8'));
for (let i = 0; i < 5; i++) { await p.evaluate(() => __tick(45, 1 / 30)); const fase = await p.evaluate(() => window.__fase); const f = dir + '/' + i + '.png'; await p.screenshot({ path: f }); console.log('FASE', i, fase); }
console.log('ERROS:', erros.length ? [...new Set(erros)].slice(0, 8).join(' | ') : 'nenhum'); await b.close();
