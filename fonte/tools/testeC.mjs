// Parte C: compra itens e usa Q/W/E/R (e as reativações) dos 23 heróis; falha se houver erro. node tools/testeC.mjs <url>
import puppeteer from 'puppeteer-core';
const [,, url = 'http://127.0.0.1:8765/?cap&heroi=davi&vs=golias'] = process.argv;
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 0, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--use-gl=angle'] });
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720 });
const erros = []; p.on('pageerror', e => { erros.push('PAGEERR ' + e.message); console.log('PAGEERR', e.message); }); p.on('console', m => { if (m.text()[0] === '#') console.log(m.text()); if (m.type() === 'error' || /\[erro\]/.test(m.text())) { erros.push(m.text().slice(0, 300)); console.log('ERR', m.text().slice(0, 300)); } });
await p.goto(url, { timeout: 120000 }); await p.waitForFunction('window.__pronto === true', { timeout: 240000 }); await new Promise(r => setTimeout(r, 1000));
const r = await p.evaluate(async (SO) => {
  const J = __jogo, T = J.teste, out = []; const tk = (n = 1) => __tick(n, 1 / 30);
  J.limparTropas(); const ids = ['davi', 'sansao', 'debora', 'gideao', 'josue', 'elias', 'acabe', 'dalila', 'herodes', 'hama', 'balaao', 'ester', 'ninrode', 'sarai', 'moises', 'golias2', 'golias', 'farao', 'jezabel', 'nabuco', 'daniel', 'noe', 'jonatas'].filter(x => !SO || SO.includes(x));
  for (const h of J.herois) { h.treino = true; h.obj.position.set(60, 0, 0); }
  const remover = (h) => { h.vivo = false; J.scene.remove(h.obj); if (h.barra) h.barra.remove(); const i = J.herois.indexOf(h); if (i >= 0) J.herois.splice(i, 1); const j = J.unidades.indexOf(h); if (j >= 0) J.unidades.splice(j, 1); };
  const alvo = T.criarHeroi('golias', 'trevas', true); alvo.treino = true; const alvo2 = T.criarHeroi('farao', 'trevas', true); alvo2.treino = true; const amigo = T.criarHeroi('ester', 'luz', true); amigo.treino = true;
  for (const u of [alvo, alvo2, amigo]) { J.nivelar(u, 15); }
  const resumo = [];
  for (const id of ids) {
    console.log('#' + id); const h = T.criarHeroi(id, 'luz', true); h.treino = true; J.nivelar(h, 15);
    // compra: ouro de sobra, na base (morto = pode comprar)
    h.ouro = 99999; h.vivo = false; let comprados = 0; for (const it of h.def.build.slice(0, 6)) { const e = T.comprar(h, it); if (!e) comprados++; } h.vivo = true; J.recalcular(h, true);
    const linha = [id + ' itens=' + comprados + '/' + Math.min(6, h.def.build.length)];
    for (const k of ['q', 'w', 'e', 'r']) { console.log('#  ' + k);
      for (const u of [alvo, alvo2, amigo, h]) { u.hp = u.maxHp; u.atord = 0; u.raiz = 0; u.silencio = 0; u.estase = 0; u.medo = null; u.encanto = null; u.confuso = null; u.provoc = null; u.dash = null; u.vooT = 0; u.obj.position.y = 0; u.lento = 0; u.escudos = []; u.invulneravel = false; u.saltando = false; }
      h.obj.position.set(0, 0, 0); h.obj.rotation.y = Math.PI / 2; alvo.obj.position.set(2.2, 0, .3); alvo2.obj.position.set(4, 0, -1.2); amigo.obj.position.set(-2, 0, 1.4); amigo.hp = amigo.maxHp * .4;
      for (const kk of ['q', 'w', 'e', 'r']) h.hab[kk].cd = 0; h.mana = h.manaMax = 99999; h.travado = 0; h.hab.e.sinalCargas = undefined;
      const hp0 = alvo.hp + alvo2.hp; h.mira = { dir: new J.THREE.Vector3(1, 0, 0), frac: .35 };
      let ok = J.usarHab(h, k); h.mira = null; tk(8);
      let rc = ''; const d = h.def.hab[k];
      if (J.KIT && d.tipo === 'kit') { tk(6); const rr = J.KIT.recast(h, k); if (rr !== undefined) rc = rr ? '+re' : '-re'; }
      tk(75);
      const dano = Math.round(hp0 - alvo.hp - alvo2.hp);
      linha.push(k + (ok ? '✓' : '✗') + rc + (dano > 0 ? ' ' + dano : ''));
    }
    // ataques básicos (passivas no ataque)
    h.obj.position.set(0, 0, 0); alvo.obj.position.set(2, 0, 0); for (let i = 0; i < 4; i++) { h.atkCd = 0; h.travado = 0; J.atacar(h); tk(20); }
    resumo.push(linha.join(' '));
    remover(h); tk(5);
  }
  // pós-condições: nada pendurado
  const pend = J.KIT ? J.KIT.zonas.length : -1; tk(200);
  out.push(...resumo); out.push('zonas abertas (antes/depois de 6,7 s): ' + pend + '/' + (J.KIT ? J.KIT.zonas.length : -1));
  out.push('VK nível=' + (J.VK ? J.VK.nivel + ' ktx=' + J.VK.ktx : 'SEM VK') + ' ' + (J.VK ? JSON.stringify(J.VK.stats()) : ''));
  return out.join('\n');
}, process.env.SO ? process.env.SO.split(',') : null);
console.log(r); console.log('ERROS:', erros.length); for (const e of [...new Set(erros)].slice(0, 30)) console.log('  ', e);
await b.close(); process.exit(erros.length ? 1 : 0);
