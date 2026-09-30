// prints dos poderes no meio do efeito: para cada herói, lança Q/W/E/R e fotografa cada um (1 tile por habilidade)
// uso: node tools/poderes_print.mjs <base url> <pasta saída> [heróis separados por vírgula]
import puppeteer from 'puppeteer-core';
const [,, base = 'http://localhost:5199/', out = '/tmp/pod', lista = 'davi,sansao,debora,gideao,golias,farao,jezabel,nabuco'] = process.argv;
const VS = { davi: 'golias', sansao: 'nabuco', debora: 'farao', gideao: 'jezabel', golias: 'davi', farao: 'debora', jezabel: 'gideao', nabuco: 'sansao' };
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle', '--window-size=960,540'] });
let erros = [];
for (const id of lista.split(',')) {
  const page = await b.newPage(); page.on('pageerror', e => erros.push(id + ': ' + e.message)); page.on('console', m => { if (m.type() === 'error') erros.push(id + ': ' + m.text()); });
  await page.setViewport({ width: 960, height: 540, deviceScaleFactor: 1 });
  await page.goto(`${base}?cap&cena=luta&heroi=${id}&vs=${VS[id]}`, { waitUntil: 'load', timeout: 120000 }); await page.waitForFunction('window.__pronto === true', { timeout: 180000 });
  await page.evaluate(() => { __tick(20, 1 / 30); const J = __jogo; J.bot.bot = false; document.querySelectorAll('#aviso,#abate').forEach(e => e.style.display = 'none'); });
  for (const k of ['q', 'w', 'e', 'r']) {
    const r = await page.evaluate((k) => { const J = __jogo, h = J.jogador, o = J.bot, T = J.THREE; const d = h.def.hab[k];
      if (h.hab[k].nv === 0) h.hab[k].nv = 1; for (const x of 'qwer') h.hab[x].cd = 0; h.mana = h.manaMax; h.hp = h.maxHp; o.hp = o.maxHp; o.vivo = true; o.atord = 0; h.atord = 0; h.travado = 0; h.dash = null;
      const x0 = J.POS.torreTrevas.x - 11; h.obj.position.set(x0, 0, J.laneZ(x0) + 1); const dist = d.tipo === 'area' && d.centro !== 'self' && d.centro !== 'frente' ? 6 : d.tipo === 'proj' ? 8 : d.tipo === 'dash' || d.tipo === 'salto' ? 5.5 : 3.2;
      o.obj.position.set(x0 + dist, 0, J.laneZ(x0 + dist) + .6); h.olharPara(o.obj.position, 1, 99); o.olharPara(h.obj.position, 1, 99);
      const ok = J.usarHab(h, k);
      const t = { proj: (d.atraso || .25) + .16, area: d.impactos ? (d.atraso || 0) + (d.intervalo || 0) * 1.5 + .12 : (d.atraso || 0) + (d.visual === 'coluna' ? .15 : .1), zona: 1.2, dash: d.blink ? .08 : d.dist / d.vel + (d.fxId === 'nabuco.e' ? .3 : .12), buff: .45, linha: (d.atraso || .3) + .08, invocar: .35, salto: .75, marca: 1.25 }[d.tipo] || .3;
      __tick(Math.max(1, Math.round(t * 30)), 1 / 30); return { ok, nome: d.nome, tipo: d.tipo, t }; }, k);
    await new Promise(r => setTimeout(r, 150));
    await page.screenshot({ path: `${out}/${id}_${k}.png` }); console.log(id, k, JSON.stringify(r));
    await page.evaluate(() => __tick(75, 1 / 30));
  }
  await page.close();
}
console.log('ERROS:', erros.length ? erros.join(' | ') : 'nenhum');
await b.close();
