import puppeteer from 'puppeteer-core';
const [,, url, secs = 120, passo = 15] = process.argv;
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle', '--window-size=800,400'] });
const page = await browser.newPage();
const errs = new Set();
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') { const t = m.text(); if (!/Clock|vite/.test(t)) errs.add(t.slice(0, 200)); } if (m.type()==='log') console.log('[log]', m.text().slice(0,200)); });
page.on('pageerror', e => { errs.add('PAGEERR ' + e.message + ' ' + (e.stack || '').slice(0, 300)); });
await page.setViewport({ width: 800, height: 400 });
await page.goto(url, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('window.__pronto === true', { timeout: 180000 });
await page.evaluate(() => { __jogo.renderer.render = () => {}; });
for (let t = 0; t < +secs; t += +passo) {
  const r = await page.evaluate((n) => { try { const J = window.__jogo; for (let i = 0; i < n; i++) window.__tick(1, 1 / 15); const f = h => `${h.id} L${h.nivel} hp${Math.round(h.hp)}/${Math.round(h.maxHp)} $${Math.round(h.ouro)} x${h.obj.position.x.toFixed(1)} ${h.vivo ? '' : 'MORTO'} k${h.abates}/${h.mortes} cs${h.cs} it[${h.itens.join(',')}] ${h.canal ? 'CANAL' : ''} r[${['q','w','e','r'].map(k=>h.hab[k].nv).join('')}] u${h.usos||0}`; return `t=${J.estado.tempo.toFixed(0)} ${J.estado.luz}-${J.estado.trevas} | ${f(J.jogador)} | ${f(J.bot)} | est ${J.estruturas.map(e => e.time[0] + e.tipo[0] + (e.ordem||'') + ':' + Math.round(e.hp)).join(' ')} | un ${J.unidades.length} ${J.estado.fim ? 'FIM ' + J.estado.fim.vencedor : ''}`; } catch (e) { return 'ERR ' + e.message + e.stack; } }, +passo * 15);
  console.log(r);
  if (/FIM/.test(r)) break;
}
console.log('ERROS:', [...errs].join('\n'));
await browser.close();
