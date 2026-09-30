// Números de balanceamento: para cada confronto Luz x Trevas, dano de troca (1 ataque + Q) e combo completo nos níveis 1, 5, 10 e 15,
// com itens típicos da build em cada nível. Uso: node tools/balanco.mjs [url-base] [saida.json]
import puppeteer from 'puppeteer-core'; import fs from 'fs';
const base = process.argv[2] || 'http://localhost:5199/'; const saida = process.argv[3] || '/tmp/balanco.json';
const LUZ = ['davi', 'sansao', 'debora', 'gideao'], TREVAS = ['golias', 'farao', 'jezabel', 'nabuco'];
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle'] });
const res = {};
async function um(l) {
  const p = await b.newPage(); await p.setViewport({ width: 896, height: 414 });
  for (const t of TREVAS) {
    await p.goto(`${base}?cap&heroi=${l}&vs=${t}&perfil=0`, { waitUntil: 'load', timeout: 120000 }); await p.waitForFunction('window.__pronto === true', { timeout: 180000 });
    res[l + '_' + t] = await p.evaluate(() => {
      const J = __jogo; J.renderer.render = () => { }; const out = {};
      const itensNv = (h, n) => { const bd = h.def.build; return n < 5 ? [] : n < 10 ? [bd[0], ...(J.ITENS[bd[1]].receita || []).slice(0, 1)] : n < 15 ? bd.slice(0, 3) : bd.slice(0, 5); };
      for (const n of [1, 5, 10, 15]) {
        for (const h of [J.jogador, J.bot]) { h.nivel = n; h.pontos = n; for (const k of 'qwer') h.hab[k].nv = 0; h.itens = itensNv(h, n); J.recalcular(h, true); J.autoPontos(h); }
        out[n] = { luzEmTrevas: J.medirDano(J.jogador, J.bot), trevasEmLuz: J.medirDano(J.bot, J.jogador) };
      }
      return out;
    });
  }
  await p.close();
}
for (const l of LUZ) await um(l);
fs.writeFileSync(saida, JSON.stringify(res, null, 1));
for (const n of [1, 5, 10, 15]) { const l = Object.entries(res).map(([k, v]) => `${k}: L→T ${v[n].luzEmTrevas.troca}/${v[n].luzEmTrevas.hpAlvo} (${v[n].luzEmTrevas.trocasMatar} trocas, combo ${v[n].luzEmTrevas.comboPct}%) T→L ${v[n].trevasEmLuz.troca}/${v[n].trevasEmLuz.hpAlvo} (${v[n].trevasEmLuz.trocasMatar}, ${v[n].trevasEmLuz.comboPct}%)`); console.log('NÍVEL ' + n + '\n' + l.join('\n')); }
await b.close(); process.exit(0);
