import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 0, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--use-gl=angle'] });
const p = await b.newPage(); await p.setViewport({ width: 800, height: 400 }); p.on('pageerror', e => console.log('ERR', e.message));
await p.goto(process.argv[2], { waitUntil: 'load' }); await p.waitForFunction('window.__pronto === true', { timeout: 180000 });
await p.evaluate(() => { __jogo.renderer.render = () => {}; });
for (let t = 0; t < +process.argv[3]; t += 5) {
  const r = await p.evaluate(() => { for (let i = 0; i < 75; i++) __tick(1, 1 / 15); const J = __jogo, a = J.jogador, c = J.bot; const d = a.obj.position.distanceTo(c.obj.position);
    if (d > 10 || !a.vivo || !c.vivo) return null; const la = J.avaliarLuta(a, c, false, a.hp / a.maxHp, c.hp / c.maxHp), lb = J.avaliarLuta(c, a, false, c.hp / c.maxHp, a.hp / a.maxHp); const da = J.danoCombo(a, c), db = J.danoCombo(c, a);
    return `t=${Math.round(J.estado.tempo)} d=${d.toFixed(1)} davi hp${Math.round(a.hp)} sc${la.score.toFixed(2)} ab${la.abate} combo${Math.round(da.total)} | golias hp${Math.round(c.hp)} sc${lb.score.toFixed(2)} ab${lb.abate} combo${Math.round(db.total)}`; });
  if (r) console.log(r);
}
await b.close();
