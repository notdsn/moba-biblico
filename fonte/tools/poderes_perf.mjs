// iPhone 11 emulado: luta com os dois heróis soltando todos os poderes sem parar por 12 s; mede tempo de quadro (CPU, ms),
// draw calls, triângulos e partículas vivas. Uso: node tools/poderes_perf.mjs <url base> heroi vs
import puppeteer, { KnownDevices } from 'puppeteer-core';
const [,, base = 'http://localhost:5199/', hero = 'nabuco', vs = 'gideao', extra = ''] = process.argv;
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 0, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle'] });
const p = await b.newPage(); await p.emulate(KnownDevices['iPhone 11 landscape']); const erros = []; p.on('pageerror', e => erros.push(e.message));
await p.goto(`${base}?cap&cena=luta&heroi=${hero}&vs=${vs}${extra}`, { waitUntil: 'load' }); await p.waitForFunction('window.__pronto === true', { timeout: 240000 });
p.setDefaultTimeout(0); const r = await p.evaluate((modo) => { const J = __jogo, hs = [J.jogador, J.bot]; J.bot.bot = false; __tick(10, 1 / 60);
  const x0 = J.POS.torreTrevas.x - 10; J.jogador.obj.position.set(x0, 0, J.laneZ(x0)); J.bot.obj.position.set(x0 + 4.5, 0, J.laneZ(x0 + 4.5));
  const med = []; let oks = 0, calls = 0, tris = 0, pmax = 0, i = 0; const ks = 'qwer';
  for (let f = 0; f < 720; f++) {
    if (modo && f % 12 === 0) { const h = hs[(f / 12) % 2 | 0]; for (const x of ks) { h.hab[x].nv = Math.max(1, h.hab[x].nv); h.hab[x].cd = 0; } h.mana = 999; h.hp = h.maxHp; h.travado = 0; h.dash = null; h.atord = 0; if (J.usarHab(h, ks[i++ % 4])) oks++; if (h.obj.position.distanceTo(hs[0].obj.position) > 9 || Math.abs(h.obj.position.x - x0) > 8) { h.obj.position.set(x0 + (h === J.bot ? 4.5 : 0), 0, J.laneZ(x0)); } }
    for (const h of hs) { h.hp = h.maxHp; h.vivo = true; }
    const t0 = performance.now(); __atualizar(1 / 60); med.push(performance.now() - t0); pmax = Math.max(pmax, J.fx.n + J.fxD.n);
    if (f % 40 === 20) { __tick(1, 1 / 600); const inf = __info(); calls = Math.max(calls, inf.calls); tris = Math.max(tris, inf.tris); }
  }
  med.sort((a, b) => a - b); return { mediana: med[360].toFixed(1), p95: med[684].toFixed(1), maxCalls: calls, maxTris: Math.round(tris / 1000) + 'k', particulasMax: pmax, lancados: oks, limite: J.fx.max + J.fxD.max };
}, extra.includes('sempoder') ? 0 : 1);
console.log(JSON.stringify(r), 'erros:', erros.length ? erros.join(' | ') : 'nenhum'); await b.close();
