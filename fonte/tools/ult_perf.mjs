// Pico de quadro ao soltar o R de cada herói (iPhone 11 emulado): node tools/ult_perf.mjs <base> [herois,...]
import puppeteer, { KnownDevices } from 'puppeteer-core';
const [,, base = 'http://localhost:5199/', lista = 'davi,sansao,debora,gideao,golias,farao,jezabel,nabuco', extra = ''] = process.argv;
const LUZ = ['davi', 'sansao', 'debora', 'gideao'];
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 0, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle'] });
for (const hero of lista.split(',')) {
  const vs = LUZ.includes(hero) ? 'golias' : 'davi';
  const p = await b.newPage(); await p.emulate(KnownDevices['iPhone 11 landscape']); const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.goto(`${base}?cap&cena=luta&heroi=${hero}&vs=${vs}&perfil=0${extra}`, { waitUntil: 'load' }); await p.waitForFunction('window.__pronto === true', { timeout: 240000 }); p.setDefaultTimeout(0);
  const r = await p.evaluate(() => { const J = __jogo, h = J.jogador, gl = J.renderer.getContext(); const fr = () => { const t0 = performance.now(); __tick(1, 1 / 60); gl.finish(); return performance.now() - t0; };
    for (let i = 0; i < 60; i++) fr(); const base = []; for (let i = 0; i < 20; i++) base.push(fr()); base.sort((a, b) => a - b); const med = base[10];
    const i0 = __info(); h.hab.r.nv = Math.max(1, h.hab.r.nv); h.hab.r.cd = 0; h.mana = 9999; h.travado = 0; h.atord = 0; const ok = J.usarHab(h, 'r');
    const ts = []; for (let i = 0; i < 90; i++) { ts.push(fr()); if (i % 10 === 0) { h.hp = h.maxHp; J.bot.hp = J.bot.maxHp; } } const i1 = __info();
    const mx = Math.max(...ts); return { ok: !!ok, med: +med.toFixed(1), max: +mx.toFixed(1), quadro: ts.indexOf(mx), pico: +(mx - med).toFixed(1), progs: i1.progs - i0.progs, novos: (J.renderer.info.programs||[]).slice(i0.progs, i1.progs).map(p=>p.name+":"+(p.cacheKey||"").slice(0,90)), geos: i1.geos - i0.geos, tex: i1.tex - i0.tex }; });
  console.log(hero, JSON.stringify(r), erros.length ? 'ERROS ' + erros.join('|') : ''); await p.close();
}
await b.close();
