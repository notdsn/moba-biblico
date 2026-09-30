import puppeteer from 'puppeteer-core';
const [,, url] = process.argv;
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--use-gl=angle'] });
const p = await b.newPage(); await p.setViewport({ width: 800, height: 400 }); p.on('pageerror', e => console.log('ERR', e.message));
await p.goto(url, { waitUntil: 'load' }); await p.waitForFunction('window.__pronto === true', { timeout: 180000 });
await p.evaluate(() => { __jogo.renderer.render = () => {}; });
await p.evaluate(() => { for (let i = 0; i < 15 * 360; i++) __tick(1, 1 / 15); });
for (let k = 0; k < 24; k++) {
  const r = await p.evaluate(() => { for (let i = 0; i < 15 * 5; i++) __tick(1, 1 / 15); const J = __jogo; const m = t => J.unidades.filter(u => u.tipo === 'minion' && u.vivo && u.time === t).map(u => Math.round(u.obj.position.x)).sort((a, b) => a - b).join(',');
    const e = J.estruturas.map(e => `${e.time[0]}${e.tipo[0]}${e.ordem || ''}@${Math.round(e.obj.position.x)}:${Math.round(e.hp)}`).join(' ');
    const h = J.herois.map(h => `${h.id}(${h.time[0]}) x${Math.round(h.obj.position.x)} hp${Math.round(100 * h.hp / h.maxHp)}% ${h.vivo ? '' : 'MORTO'}${h.recuando ? 'REC' : ''}${h.canal ? 'CANAL' : ''}`).join(' | ');
    return `t=${Math.round(J.estado.tempo)} L[${m('luz')}] T[${m('trevas')}] ${h} || ${e}`; });
  console.log(r);
}
await b.close();
