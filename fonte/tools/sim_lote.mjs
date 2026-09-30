// Partidas bot x bot (?auto) em lote: node tools/sim_lote.mjs <url-base> <heroiLuz> <reps> <saida.json>
// Para cada vilão das Trevas roda <reps> partidas até o Núcleo cair (máx. 20 min) e grava vencedor, duração e abates.
import puppeteer from 'puppeteer-core'; import fs from 'fs';
const [,, base = 'http://localhost:5199/', luz = 'davi', reps = 2, saida = '/tmp/sim_' + luz + '.json'] = process.argv;
const TREVAS = ['golias', 'farao', 'jezabel', 'nabuco'];
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 0, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle'] });
const res = [];
for (let r = 0; r < +reps; r++) for (const t of TREVAS) {
  const p = await b.newPage(); await p.setViewport({ width: 640, height: 320 }); const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.goto(`${base}?auto&heroi=${luz}&vs=${t}&perfil=0&seed=${r}`, { waitUntil: 'load', timeout: 120000 }); await p.waitForFunction('window.__pronto === true', { timeout: 240000 });
  await p.evaluate(() => { __jogo.renderer.render = () => { }; __jogo.jogador.nomeSim = 1; });
  let o = null;
  for (let k = 0; k < 90 && !(o && o.fim); k++) o = await p.evaluate(() => { for (let i = 0; i < 225; i++) __tick(1, 1 / 15); const J = __jogo, e = J.estado, a = J.jogador, c = J.bot; return { t: Math.round(e.tempo), fim: e.fim ? e.fim.vencedor : null, luz: e.luz, trevas: e.trevas, nivL: a.nivel, nivT: c.nivel, torresL: J.estruturas.filter(x => x.time === 'luz' && x.tipo === 'torre' && !x.vivo).length, torresT: J.estruturas.filter(x => x.time === 'trevas' && x.tipo === 'torre' && !x.vivo).length, danoL: Math.round(a.stats.danoHerois), danoT: Math.round(c.stats.danoHerois) }; });
  res.push({ ...o, abatesL: o.luz, abatesT: o.trevas, luz, trevas: t, rep: r, erros: erros.slice(0, 3) }); console.log(JSON.stringify(res[res.length - 1]));
  fs.writeFileSync(saida, JSON.stringify(res, null, 1)); await Promise.race([p.close(), new Promise(r => setTimeout(r, 5000))]);
}
await Promise.race([b.close(), new Promise(r => setTimeout(r, 5000))]); process.exit(0);
