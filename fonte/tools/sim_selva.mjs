// 2v2 com selva, bot x bot: node tools/sim_selva.mjs <base> <heroi> <vs> <funcao>
import puppeteer from 'puppeteer-core';
const [,, base = 'http://localhost:5199/', luz = 'davi', vs = 'golias', fn = 'meio'] = process.argv;
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 0, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage(); const erros = []; p.on('pageerror', e => erros.push(e.message));
await p.goto(`${base}?auto&heroi=${luz}&vs=${vs}&funcao=${fn}&perfil=0`, { waitUntil: 'load', timeout: 120000 }); await p.waitForFunction('window.__pronto === true', { timeout: 240000 });
await p.evaluate(async () => { __jogo.renderer.render = () => { }; await __selva.pronto; });
let o = null;
for (let k = 0; k < 90 && !(o && o.fim); k++) o = await p.evaluate(() => { for (let i = 0; i < 225; i++) __tick(1, 1 / 15); const J = __jogo, e = J.estado, S = __selva.selva;
  const hs = [J.jogador, J.aliado, J.bot, J.cacador].map(h => `${h.id}/${h.funcao}:${h.abates}-${h.mortes}-${h.assist} nv${h.nivel} cs${h.cs} m${h.stats.monstros || 0}`);
  return { t: Math.round(e.tempo), fim: e.fim ? e.fim.vencedor : null, placar: e.luz + '-' + e.trevas, drag: S.dragoes, hs }; });
console.log(JSON.stringify(o), 'ERROS:', erros.length ? [...new Set(erros)].join(' | ') : 'nenhum'); await b.close();
