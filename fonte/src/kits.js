// Parte C: kits novos dos 23 heróis (versão final do Jarvys). Executa as habilidades tipo 'kit' e as passivas,
// com os VFX realistas (vfx_kits.js / manifest). main.js injeta as funções do motor em criarKits(K).
// Ganchos chamados pelo main: pode, usar, recast, aoAcertarHab, modHab, modDano, aposDano, ataque, alcExtra,
// dashFim, dashTick, atualizar, aoMorrer, vis, ia, antesUsar.
export function criarKits(K) {
  const { THREE, estado } = K;
  const V = () => K.VK(); // vfx dos kits (pode ser null: ?poderes=antigos ou falha de carga)
  const T = () => estado.tempo;
  const TAU = Math.PI * 2, rnd = (a = 1) => (Math.random() - .5) * 2 * a;
  const vec = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const P = (u) => u.obj.position;
  const J = () => K.jogador();
  const msg = (h, t) => { if (h === J()) K.aviso(t, true); return false; };
  const porNv = (h, d, nv, arr) => arr ? arr[Math.min(arr.length, nv) - 1] * K.multRank(h, d, nv) : 0;
  const hit = (h, u, d, nv, dano, extra = {}) => K.acertarHab(h, u, d, nv, dano, extra);
  const inim = (h, c, r) => K.inimigosEm(c, h.time, r);
  const inimEst = (h, c, r) => inim(h, c, r).filter(u => u.tipo !== 'torre' && u.tipo !== 'nucleo');
  const herInim = (h, c, r) => K.herois.filter(u => u.vivo && u.time !== h.time && P(u).distanceTo(c) < r);
  const aliadosH = (h, c, r, eu = true) => K.herois.filter(u => u.vivo && u.time === h.time && (eu || u !== h) && P(u).distanceTo(c) < r);
  const dirDe = (a, b) => { const v = b.clone().sub(a).setY(0); const L = v.length(); return L > 1e-4 ? v.multiplyScalar(1 / L) : vec(0, 0, 1); };
  const ehEst = (u) => u.tipo === 'torre' || u.tipo === 'nucleo';
  const C3 = (c) => c && c.isColor ? [c.r, c.g, c.b] : c;
  const dirMira = (h, m) => m.alvo && m.alvo.vivo && !m.manual ? dirDe(P(h), P(m.alvo)) : m.dir.clone();
  // ponto da habilidade (mira manual > alvo > à frente), limitado ao alcance
  function pontoHab(h, m, alc, padrao = 6) {
    let p = m.manual ? m.ponto.clone() : m.alvo && P(m.alvo).distanceTo(P(h)) < alc + 1 ? P(m.alvo).clone() : P(h).clone().addScaledVector(m.dir, Math.min(alc, padrao));
    const v = p.clone().sub(P(h)).setY(0); if (v.length() > alc) p = P(h).clone().addScaledVector(v.normalize(), alc); p.y = 0; K.limitar(p); return p;
  }
  // alvo herói inimigo (mira > trava > mais próximo)
  function alvoHeroi(h, m, alc) { if (m.alvo && m.alvo.tipo === 'heroi' && m.alvo.time !== h.time && m.alvo.vivo && P(m.alvo).distanceTo(P(h)) < alc + 1) return m.alvo; if (m.manual) { let b = null, bd = 3.5; for (const u of K.herois) { if (!u.vivo || u.time === h.time || !K.visivelPara(u, h.time)) continue; const dd = P(u).distanceTo(m.ponto); if (dd < bd && P(u).distanceTo(P(h)) < alc + 1) { bd = dd; b = u; } } if (b) return b; } return K.heroiInimigoProximo(h, alc); }
  function alvoInimigo(h, m, alc) { const a = alvoHeroi(h, m, alc); if (a) return a; let b = null, bd = alc + .5; for (const u of inim(h, P(h), alc + .5)) { if (ehEst(u) || !K.visivelPara(u, h.time)) continue; const dd = P(u).distanceTo(P(h)); if (dd < bd) { bd = dd; b = u; } } return b; }
  // aliado: o que o bot escolheu > o mais perto da mira > o mais ferido ao alcance > ele mesmo
  function alvoAliado(h, m, alc, eu = true) {
    if (h.kitAlvo && h.kitAlvo.vivo && h.kitAlvo.time === h.time && P(h.kitAlvo).distanceTo(P(h)) < alc + 1 && (eu || h.kitAlvo !== h)) return h.kitAlvo;
    if (m.manual) { let b = null, bd = 3; for (const u of aliadosH(h, P(h), alc + 1, eu)) { const dd = P(u).distanceTo(m.ponto); if (dd < bd) { bd = dd; b = u; } } if (b) return b; }
    let b = null, pior = eu ? .999 : 2; for (const u of aliadosH(h, P(h), alc + 1, false)) { const f = u.hp / u.maxHp; if (f < pior) { pior = f; b = u; } }
    return b || (eu ? h : null);
  }
  const noCone = (o, dir, u, alc, ang) => { const v = P(u).clone().sub(o).setY(0); const L = v.length(); if (L > alc + (u.raio || .5)) return false; if (L < .6) return true; return v.multiplyScalar(1 / L).dot(dir) >= Math.cos(ang * Math.PI / 360); };
  const inimCone = (h, o, dir, alc, ang) => inimEst(h, o, alc + 1).filter(u => noCone(o, dir, u, alc, ang));
  const efeito = (vida, up) => K.efeitos.push({ t: 0, vida, up });
  // projétil com malha/trilha do vfx_kits (cai no padrão do main se não houver VK)
  function proj(h, d, o) { const de = o.de || (() => { const p = K.posMao(h); p.y = Math.max(p.y, 1.3); return p; })(); K.lancar(de, o.alvo || null, { dir: o.dir, time: h.time, fonte: h, vel: o.vel || d.vel || 26, max: o.max ?? d.alc ?? 10, perfura: o.perfura, larg: o.larg || .9, cor: o.cor || d.cor || h.def.cor, vis: o.vis, esc: o.esc || 1, giro: !!o.giro, onHit: o.onHit, onFim: o.onFim, trilha: o.trilha }); }
  // salto em arco (h vai até b em dur)
  function saltar(h, b, dur, alt, fim, tick) { const a = P(h).clone(); b = b.clone(); K.limitar(b); h.saltando = true; h.travado = dur + .2; h.dash = null; efeito(dur, (e) => { const k = Math.min(1, e.t / dur); P(h).lerpVectors(a, b, k); P(h).y = Math.sin(k * Math.PI) * alt; if (tick) tick(k); if (k >= 1 || !h.vivo) { P(h).y = 0; h.saltando = false; if (h.vivo && fim) fim(); return false; } return true; }); }
  // arrastar uma unidade junto (agarrar)
  function carregarU(u, b, dur, alt = 2) { const a = P(u).clone(); b = b.clone(); K.limitar(b); u.dash = null; u.empurrao = null; u.saltando = true; efeito(dur, (e) => { const k = Math.min(1, e.t / dur); P(u).lerpVectors(a, b, k); P(u).y = Math.sin(k * Math.PI) * alt; if (k >= 1 || !u.vivo) { P(u).y = 0; u.saltando = false; return false; } return true; }); }
  // dash próprio dos kits (usa o h.dash do main; fim e tick por kit)
  function dashKit(h, dir, dist, vel, d, fim, tick) { h.obj.rotation.y = Math.atan2(dir.x, dir.z); h.dash = { dir: dir.clone(), t: dist / vel, vel, d: { ...d, _tick: tick }, fim }; }
  // obstáculo entre a e b? (estrutura, muro temporário ou borda do mapa)
  function obstaculo(a, b) { const L = a.distanceTo(b), dir = dirDe(a, b); for (let s = .5; s < L; s += .5) { const p = a.clone().addScaledVector(dir, s); const q = p.clone(); K.limitar(q); if (q.distanceTo(p) > .3) return true; for (const e of K.estruturas) if (e.vivo && Math.hypot(e.obj.position.x - p.x, e.obj.position.z - p.z) < (e.raio || 1.5) * .8) return true; for (const w of K.MUROS_T) if (Math.hypot(w.x - p.x, w.z - p.z) < w.r) return true; } return false; }
  const vx = { // atalhos de VFX (no-op sem VK)
    poeira: (c, r, cor) => V() && V().poeira(c, r, cor), onda: (c, r, cor, vida) => V() && V().onda(c, r, cor, vida), brilho: (c, cor, s, vida) => V() && V().brilho(c, cor, s, vida),
    fogo: (c, r) => V() && V().impactoFogo(c, r), pedra: (c, r) => V() && V().impactoPedra(c, r), clarao: (c, cor, i, dd) => V() && V().clarao(c, cor, i, dd), decal: (c, cel, r, vida, cor) => V() && V().decal(c, cel, r, vida, cor),
    magia: (c, n, cor, r, s) => V() && V().magia(c, n, cor, r, s), estrelas: (c, n, cor, r, s, vida) => V() && V().estrelas(c, n, cor, r, s, vida), nevoa: (c, r, n, cor, a, s, vida) => V() && V().nevoa(c, r, n, cor, a, s, vida),
    fumaca: (c, s, n, cor, a) => V() && V().fumaca(c, s, n, cor, a), chamas: (c, r, n, s, vida, sis, cor) => V() && V().chamas(c, r, n, s, vida, sis, cor), det: (c, cel, n, s, t, cor, g, vida, y) => V() && V().detritos(c, cel, n, s, t, cor, g, vida, y),
    explP: (c, s, cor) => V() && V().explosaoP(c, s, cor), expl: (c, s) => V() && V().explosao(c, s, true), brasas: (c, s) => V() && V().brasas(c, s), corte: (c, cor, s, ang, vida, faixa) => V() && V().corte(c, cor, s, ang, vida, faixa),
    raio: (c, h, cor) => V() && V().raio(c, h, cor), faiscas: (c, n, cor, s, y) => V() && V().faiscas(c, n, cor, s, y), marca: (c, r, cor, vida) => V() && V().marcaChao(c, r, cor, vida), simbolo: (c, cor, s, vida) => V() && V().simbolo(c, cor, s, vida),
    emit: (s, p, o, ess) => V() && V().M.emitir(s, p, o, ess),
  };
  const yv = (p, y) => vec(p.x, y, p.z);
  // malha temporária do pool do vfx_kits presa a uma função de atualização
  function malhaTemp(nome, vida, up) { const m = V() && V().pegarMalha(nome); if (!m) return null; efeito(vida, (e, dt) => { const r = up(m, e, dt); if (r === false || e.t >= e.vida) { V().soltarMalha(m); return false; } return true; }); return m; }
  const linhaVis = (o, dir, comp, larg, cor, t) => K.avisoLinha(o, dir, comp, larg, new THREE.Color(...C3(cor)), t);
  const marcaTxt = (u, t) => { if (u.tipo === 'heroi') K.textoInfo(u, t); };
  const zonas = []; // { c, r, fim, tick(dt, z) }
  function zona(c, r, dur, tick, fim) { const z = { c: c.clone(), r, fim: T() + dur, tick, aoFim: fim, acc: 0 }; zonas.push(z); return z; }
  const H = {}; const PODE = {}; const RECAST = {};
  const reg = (id, k, f, pode, recast) => { (H[id] = H[id] || {})[k] = f; if (pode) (PODE[id] = PODE[id] || {})[k] = pode; if (recast) (RECAST[id] = RECAST[id] || {})[k] = recast; };
  const precisaHeroi = (h, d, m) => alvoHeroi(h, m, d.alc) ? true : msg(h, 'Nenhum herói inimigo ao alcance');

  // ---------- DAVI ----------
  reg('davi', 'q', (h, d, nv, m, dano) => { K.agendar(d.atraso || .3, () => { if (!h.vivo) return; const dir = dirMira(h, m); let quicou = false;
    proj(h, d, { dir, vel: d.vel, max: d.alc, vis: { malha: 'pedra', trilha: 'pedra' }, giro: true, larg: .8, de: yv(P(h), 1.1).addScaledVector(dir, .6),
      trilha: (p, dt, pp) => { const k = pp.dist / d.quique; if (k < 1) p.y = 1.1 - .85 * k; else { if (!quicou) { quicou = true; vx.poeira(yv(p, 0), .7); vx.det(yv(p, .2), 'lasca_pedra', 4, 3, .15); } const k2 = (pp.dist - d.quique) / Math.max(1, d.alc - d.quique); p.y = .25 + Math.sin(Math.min(1, k2) * Math.PI) * 1.1; } },
      onHit: (u, pp) => { const pos = pp.dist >= d.quique; hit(h, u, d, nv, dano * (pos ? 1.2 : 1)); if (pos && !ehEst(u)) { K.atordoar(u, d.atordoa2); vx.estrelas(yv(P(u), 2.4), 5, [1, .95, .6], .5, .35); } vx.pedra(yv(P(u), 1.1), .9); if (h === J()) K.tremer(.1); } }); }); return true; });
  reg('davi', 'r', (h, d, nv, m, dano) => { const alvo = alvoHeroi(h, m, d.alc); h.travado = d.canal + .25; h.kitCanal = { t: d.canal };
    efeito(d.canal, (e) => { if (!h.vivo || K.controlado(h)) { h.kitCanal = null; return false; } h.olharPara(P(alvo), 1, 1); if (Math.random() < .5) vx.det(K.posMao(h), 'faisca_alongada', 1, 1.5, .18, [1, .85, .45], 0, .3);
      if (e.t >= e.vida) { h.kitCanal = null; if (!alvo.vivo) return false; h.tocar(h.anim.ataque, .05, true, 1.6); let quem = alvo; const de = K.posMao(h); de.y = Math.max(1.4, de.y);
        proj(h, d, { alvo, de, vel: 42, max: d.alc + 6, vis: { malha: 'pedraG', trilha: 'pedraOuro' }, giro: true,
          trilha: (p, dt, pp) => { for (const u of K.herois) if (u.vivo && u !== quem && u.time !== h.time && Math.hypot(P(u).x - p.x, P(u).z - p.z) < 1) { quem = u; pp.alvo = u; } },
          onHit: (u) => { hit(h, u, d, nv, dano); vx.pedra(yv(P(u), 1.2), 1.6); vx.onda(P(u), 1.6, [1, .9, .6], .45); vx.clarao(P(u), [1, .85, .5], 6, .25); if (h === J()) K.tremer(.35); } }); return false; } return true; }); return true; }, precisaHeroi);

  // ---------- SANSÃO ----------
  const pegarQueixada = (h, c) => { if (h.vivo && P(h).distanceTo(c) < 1.4) { h.hab.q.cd = Math.max(0, h.hab.q.cd - 4); h.buffs.push({ tipo: 'as', v: .4, t: 3 }); marcaTxt(h, 'Queixada!'); vx.brilho(yv(c, 1), [1, .95, .8], 1.5); return true; } return false; };
  reg('sansao', 'q', (h, d, nv, m, dano) => { K.agendar(d.atraso, () => { if (!h.vivo) return; const dir = dirMira(h, m);
    proj(h, d, { dir, vel: d.vel, max: d.comp, perfura: true, larg: d.larg / 2 + .3, vis: { malha: 'queixada', trilha: 'osso' }, giro: true, onHit: (u) => { hit(h, u, d, nv, dano); vx.faiscas(yv(P(u), 1.2), 5, [1, .95, .8], 4); },
      onFim: (p) => { const c = yv(p, 0); vx.poeira(c, .8); const ms = malhaTemp('queixada', 6, (mm, e) => { mm.position.set(c.x, .35, c.z); mm.rotation.set(.5, e.t * .2, 0); if (pegarQueixada(h, c)) return false; }); if (!ms) efeito(6, () => !pegarQueixada(h, c)); } }); }); return true; });
  const agarravel = (h, d, livre) => { const f = K.frente(h); let u = null, bd = 1e9; for (const x of inimEst(h, P(h), d.alc + 1)) { const v = P(x).clone().sub(P(h)).setY(0); if (!livre && v.length() > .8 && v.normalize().dot(f) < 0) continue; const s = P(x).distanceTo(P(h)) - (x.tipo === 'heroi' ? 1 : 0); if (s < bd) { bd = s; u = x; } } return u; };
  reg('sansao', 'w', (h, d, nv, m, dano) => { const u = agarravel(h, d) || agarravel(h, d, true); if (!u) return false; const f = K.frente(h); const destino = P(h).clone().addScaledVector(f, -4); K.limitar(destino);
    if (!K.imune(u) && u.tipo !== 'monstro') { K.atordoar(u, .5); carregarU(u, destino, .45, 2.4); }
    K.agendar(.46, () => { if (!h.vivo) return; hit(h, u, d, nv, dano); vx.pedra(yv(P(u), .3), 1.2); vx.onda(P(u), 1.4, [.9, .8, .6], .4); if (u.tipo === 'heroi') K.curarU(h, (h.maxHp - h.hp) * .08, true); if (h === J()) K.tremer(.25); }); return true; },
    (h, d) => agarravel(h, d) ? true : msg(h, 'Ninguém à frente para agarrar'));
  reg('sansao', 'r', (h, d, nv, m, dano, cor) => { h.imparavel = d.imparavel; K.limparControles(h); marcaTxt(h, 'Imparável!'); const o = P(h).clone(), dir = m.dir.clone(); linhaVis(o, dir, d.comp, d.larg, cor, d.atraso);
    for (let i = 0; i < 3; i++) { const p = o.clone().addScaledVector(dir, 2 + i * 3).addScaledVector(vec(dir.z, 0, -dir.x), i % 2 ? .9 : -.9); const lado = i % 2 ? 1 : -1; malhaTemp('coluna', d.atraso + 1.2, (mm, e) => { const k = Math.min(1, e.t / (d.atraso + .1)); mm.position.set(p.x, 2.1 * Math.cos(k * Math.PI / 2) + .3, p.z); mm.rotation.set(0, Math.atan2(dir.x, dir.z), lado * k * Math.PI / 2); if (e.t > d.atraso + .8) mm.position.y -= (e.t - d.atraso - .8) * 2; }); }
    K.agendar(d.atraso, () => { if (!h.vivo) return; for (const u of K.inimigosEmLinha(o, dir, d.comp, d.larg, h.time)) hit(h, u, d, nv, dano, { dirL: dir }); for (let i = 0; i < 4; i++) { const p = o.clone().addScaledVector(dir, 1.5 + i * 2.6); vx.pedra(yv(p, .4), 1.6); vx.decal(p, 'rachadura', 1.8, 3); } vx.nevoa(o.clone().addScaledVector(dir, d.comp / 2), 3, 5, [.75, .68, .55], .6, 3, 1.6); if (h === J()) K.tremer(.6); }); return true; });

  // ---------- DÉBORA ----------
  reg('debora', 'q', (h, d, nv, m, dano) => { K.agendar(d.atraso, () => { if (!h.vivo) return; const dir = dirMira(h, m); let n = 0;
    proj(h, d, { dir, vel: d.vel, max: d.alc, perfura: true, vis: { malha: 'lancaLuz', trilha: 'luz' }, onHit: (u, pp) => { if (n >= 2) return; n++; hit(h, u, d, nv, dano); K.enraizar(u, n === 1 ? 1.25 : .75); vx.raio(P(u), 2.4, [.7, .85, 1]); vx.brilho(yv(P(u), 1.2), [.7, .85, 1], 1.6); if (n >= 2) pp.max = 0; } }); }); return true; });
  reg('debora', 'e', (h, d, nv) => { for (const u of aliadosH(h, P(h), d.raio)) { u.buffs.push({ tipo: 'ms', v: .3, t: 2 }); vx.estrelas(yv(P(u), 1.6), 4, [.8, 1, .7], .5, .4); } K.curarU(h, porNv(h, d, nv, d.cura) + d.kCura * h.st.ap, true); vx.onda(P(h), d.raio * .7, [.85, 1, .7], .55); vx.brilho(yv(P(h), 1.4), [.8, 1, .7], 2.2); return true; });
  reg('debora', 'r', (h, d, nv, m, dano) => { const c0 = pontoHab(h, m, d.alc); vx.marca(c0, d.raio, [1, .45, .2], d.atraso + d.intervalo * 2 + .2);
    for (let i = 0; i < 3; i++) { const t0 = d.atraso + i * d.intervalo - .45; const c = i === 2 ? c0.clone() : c0.clone().add(vec(rnd(d.raio * .45), 0, rnd(d.raio * .45))); const ini = c.clone().add(vec(-4, 14, -3));
      K.agendar(Math.max(0, t0), () => { efeito(.45, (e) => { const k = Math.min(1, e.t / .45); const p = ini.clone().lerp(c, k); if (V()) { V().bolaFogo(p, 1.6, .2); if (Math.random() < .6) vx.emit('fumaca', p, { vida: .8, t0: .5, t1: 1.2, cor: [.2, .16, .14], alpha: .55, q0: -1 }); } return k < 1; }); });
      K.agendar(d.atraso + i * d.intervalo, () => { if (!h.vivo) return; const rr = i === 2 ? d.raio : d.raio * .6; for (const u of inim(h, c, rr)) { hit(h, u, d, nv, dano, { semAtordoar: i < 2 }); if (i === 2) { K.atordoar(u, 1); K.aterrar(u, 1.5); } } vx.fogo(c, i === 2 ? 3.2 : 2.2); vx.decal(c, 'rachadura_lava', rr * .8, 4); vx.onda(c, rr, [1, .7, .4], .5); if (h === J()) K.tremer(i === 2 ? .45 : .2); }); }
    return true; });

  // ---------- GIDEÃO ----------
  reg('gideao', 'q', (h, d, nv, m, dano) => { K.agendar(d.atraso, () => { if (!h.vivo) return; const dir = dirMira(h, m);
    proj(h, d, { dir, vel: d.vel, max: d.alc, vis: { malha: 'cantaro', trilha: 'seco' }, giro: true, onHit: (u) => { hit(h, u, d, nv, dano); const c = P(u).clone(); const dd = dirDe(P(h), c);
      for (const w of inimCone(h, c, dd, 4, 40)) if (w !== u) hit(h, w, d, nv, dano * .6, { semAtordoar: true });
      vx.explP(yv(c, .9), 1.6); vx.det(yv(c, 1.1), 'caco_barro', 9, 5, .22); vx.chamas(c, .3, 2, 1.2, .8, 'tocha'); vx.brasas(c, 1.6); for (let i = 0; i < 6; i++) { const a = Math.atan2(dd.x, dd.z) + rnd(.35), r = 1 + Math.random() * 3; vx.det(c.clone().add(vec(Math.sin(a) * r, 1, Math.cos(a) * r)), 'brasa', 1, 1, .2, [1, .7, .3], 3, .6); } } }); }); return true; });
  reg('gideao', 'e', (h, d, nv, m, dano) => { const dir = m.dir.clone(); const ini = P(h).clone(); const dist = obstaculo(ini, ini.clone().addScaledVector(dir, d.dist)) ? d.dist : d.distLivre; const b = ini.clone().addScaledVector(dir, dist);
    vx.poeira(ini, 1); h.obj.rotation.y = Math.atan2(dir.x, dir.z);
    saltar(h, b, .5, dist > 4 ? 3.2 : 2, () => { for (const u of inim(h, P(h), d.raio)) hit(h, u, d, nv, dano, { centro: P(h).clone() }); h.buffs.push({ tipo: 'as', v: .3, t: 3 }); vx.poeira(P(h), 1.8); vx.onda(P(h), 1.8, [1, .8, .5], .4); vx.chamas(P(h), .6, 3, 1, .6, 'tocha'); if (h === J()) K.tremer(.2); }, () => { if (Math.random() < .5) vx.emit('fumaca', yv(P(h), P(h).y + 1), { vida: .6, t0: .4, t1: .8, cor: [.15, .13, .12], alpha: .5, q0: -1 }); }); return true; });

  // ---------- JOSUÉ ----------
  const DUMMY = new THREE.Object3D();
  const quebraArm = (u, f, t) => { if (u.st && !ehEst(u)) u.buffs.push({ tipo: 'arm', v: -f * u.st.arm, t }); };
  reg('josue', 'q', (h, d, nv, m, dano, cor) => { const o = P(h).clone(), dir = m.dir.clone(); linhaVis(o, dir, d.comp, d.larg, cor, d.atraso);
    const arca = h.arcaJ && h.arcaJ.fim > T() ? h.arcaJ : null; let ateArca = null;
    if (arca) { const v = arca.c.clone().sub(o); const a = v.x * dir.x + v.z * dir.z, pd = Math.abs(v.x * dir.z - v.z * dir.x); if (a > 0 && a < d.comp + 1 && pd < d.larg / 2 + 1) ateArca = arca.c.clone(); }
    K.agendar(d.atraso, () => { if (!h.vivo) return; for (const u of K.inimigosEmLinha(o, dir, d.comp, d.larg, h.time)) { hit(h, u, d, nv, dano, { dirL: dir }); quebraArm(u, .15, 3); }
      vx.corte(yv(P(h).clone().addScaledVector(dir, 1.2), 1.2), [1, .9, .6], 2.6, Math.atan2(dir.z, dir.x), .16); for (let i = 1; i <= 3; i++) vx.poeira(o.clone().addScaledVector(dir, i * d.comp / 3.2), .6);
      if (ateArca) { const L = P(h).distanceTo(ateArca); const ja = new Set(); dashKit(h, dirDe(P(h), ateArca), Math.max(.5, L - 1), 24, d, () => { vx.onda(P(h), 2, [1, .85, .45], .4); }, (hh) => { for (const u of inimEst(hh, P(hh), 1.6)) if (!ja.has(u)) { ja.add(u); K.arremessar(u, .75); } }); } }); return true; });
  reg('josue', 'w', (h, d, nv) => { K.darEscudo(h, porNv(h, d, nv, d.escudo) + .15 * h.maxHp, 3); for (const u of inimEst(h, P(h), d.raio)) K.aplicarLento(u, .2, 1.5); vx.onda(P(h), d.raio * .8, [1, .85, .5], .5); vx.brilho(yv(P(h), 1.5), [1, .9, .6], 2.2); vx.poeira(P(h), 2.2); return true; });
  reg('josue', 'e', (h, d, nv, m, dano) => { const c = pontoHab(h, m, d.alc); const de = yv(P(h), 1.6); const ms = malhaTemp('arca', 8 + d.atraso, (mm, e) => { const k = Math.min(1, e.t / d.atraso); mm.position.lerpVectors(de, yv(c, .35), k); mm.position.y += Math.sin(k * Math.PI) * 2.5; mm.rotation.y = e.t * (k < 1 ? 6 : 0); if (e.t > d.atraso + 7.6) mm.position.y -= (e.t - d.atraso - 7.6) * 2; });
    K.agendar(d.atraso, () => { if (!h.vivo) return; for (const u of inim(h, c, d.raio)) hit(h, u, d, nv, dano, { centro: c }); vx.pedra(c, 1.4); vx.onda(c, d.raio, [1, .85, .4], .45); vx.brilho(yv(c, 1), [1, .9, .5], 2.4); h.arcaJ = { c: c.clone(), fim: T() + 8 };
      zona(c, 5, 8, (dt, z) => { if ((z.acc += dt) < .5) return; z.acc = 0; for (const u of aliadosH(h, z.c, 5)) u.buffs.push({ tipo: 'as', v: .15, t: .6 }); if (Math.random() < .5) vx.estrelas(yv(z.c, 1.2), 2, [1, .9, .5], .6, .3); }); }); return true; });
  reg('josue', 'r', (h, d, nv, m, dano) => { const alvo = alvoHeroi(h, m, d.alc); const c = P(alvo).clone();
    saltar(h, c.clone().addScaledVector(dirDe(c, P(h)), 1.2), .45, 3, () => { vx.poeira(P(h), 2); if (h === J()) K.tremer(.3);
      const n = 14, muros = []; for (let i = 0; i < n; i++) { const a = i / n * TAU, p = vec(c.x + Math.cos(a) * d.raio, 0, c.z + Math.sin(a) * d.raio); const w = { x: p.x, z: p.z, r: 1, fim: T() + 3, ms: DUMMY }; K.MUROS_T.push(w); muros.push(w);
        malhaTemp('muro', 3.6, (mm, e) => { const sobe = Math.min(1, e.t / .25); const cai = Math.max(0, (e.t - 3) / .3); mm.position.set(p.x, -1.1 + 2.2 * sobe - (cai > 0 ? 0 : 0), p.z); mm.rotation.set(-cai * Math.PI / 2, -a + Math.PI / 2, 0); if (cai > 0) mm.position.lerp(vec(c.x + Math.cos(a) * (d.raio - 1), .35, c.z + Math.sin(a) * (d.raio - 1)), Math.min(1, cai)); });
        if (i % 2) vx.det(yv(p, .4), 'lasca_pedra', 3, 3, .2); }
      vx.poeira(c, d.raio, [.8, .72, .58], 10);
      K.agendar(3, () => { for (const w of muros) w.fim = 0; for (const u of inim(h, c, d.raio + .5)) { hit(h, u, d, nv, dano, { centro: c }); if (!ehEst(u)) K.arremessar(u, .75); } vx.poeira(c, d.raio * 1.1, [.8, .72, .58], 12); vx.decal(c, 'rachadura', d.raio, 3); vx.onda(c, d.raio, [1, .85, .55], .5); if (P(J() || h).distanceTo(c) < 20) K.tremer(.5); }); }); return true; }, precisaHeroi);

  // ---------- ELIAS ----------
  const brasas = (u) => u.brasa && u.brasa.t > T() ? u.brasa.n : 0;
  reg('elias', 'q', (h, d, nv, m, dano) => { K.agendar(d.atraso, () => { if (!h.vivo) return; const dir = dirMira(h, m);
    proj(h, d, { dir, vel: d.vel, max: d.alc, vis: { trilha: 'fogo' }, larg: .9, onHit: (u) => { const tinha = brasas(u) > 0; hit(h, u, d, nv, dano); if (tinha && !ehEst(u)) { K.atordoar(u, 1.25); vx.estrelas(yv(P(u), 2.4), 4, [1, .7, .3], .5, .35); } vx.fogo(yv(P(u), .2), 1.4); } }); }); return true; });
  reg('elias', 'w', (h, d, nv, m, dano) => { const c = pontoHab(h, m, d.alc); vx.marca(c, d.raio, [1, .45, .1], d.atraso + .1);
    efeito(d.atraso, (e) => { if (V() && Math.random() < .7) { const p = vec(c.x + rnd(.6), 9 - 9 * e.t / d.atraso, c.z + rnd(.6)); V().bolaFogo(p, 1.4, .18); } return true; });
    K.agendar(d.atraso, () => { if (!h.vivo) return; for (const u of inim(h, c, d.raio)) { if (u.escudos && u.escudos.length) { u.escudos = []; marcaTxt(u, 'Escudo queimado!'); } hit(h, u, d, nv, dano * (brasas(u) > 0 ? 1.25 : 1), { centro: c }); }
      vx.fogo(c, d.raio); vx.chamas(c, d.raio * .7, 6, 1.6, 1.4, 'chao'); vx.decal(c, 'queimado', d.raio, 5); if (h === J()) K.tremer(.25); }); return true; });
  reg('elias', 'e', (h, d, nv, m, dano) => { const alvo = alvoInimigo(h, m, d.alc); const tinha = brasas(alvo) > 0; const de = K.posMao(h);
    efeito(.25, (e) => { const p = de.clone().lerp(yv(P(alvo), 1.2), Math.min(1, e.t / .25)); if (V()) V().bolaFogo(p, .8, .15); return true; });
    K.agendar(.25, () => { if (!h.vivo || !alvo.vivo) return; hit(h, alvo, d, nv, dano); vx.fogo(yv(P(alvo), .2), 1.2); vx.chamas(P(alvo), .5, 4, 1.4, 1.2, 'tocha');
      if (tinha) for (const u of inimEst(h, P(alvo), 3)) if (u !== alvo) { const a = P(alvo).clone(); efeito(.2, (e) => { if (V()) V().bolaFogo(a.clone().lerp(yv(P(u), 1.2), Math.min(1, e.t / .2)).setY(1.2 + Math.sin(e.t / .2 * Math.PI)), .6, .12); return true; }); K.agendar(.2, () => { if (u.vivo) { hit(h, u, d, nv, dano); vx.explP(yv(P(u), .8), 1.2); } }); } }); return true; },
    (h, d, m) => alvoInimigo(h, m, d.alc) ? true : msg(h, 'Nenhum inimigo ao alcance'));
  reg('elias', 'r', (h, d, nv, m, dano) => { const ini = P(h).clone(); const c = pontoHab(h, m, d.alc); h.invulneravel = true; h.travado = 1.7; h.saltando = true; marcaTxt(h, 'Carro de fogo!');
    efeito(1.2, (e) => { const k = Math.min(1, e.t / 1.2); P(h).set(ini.x, Math.sin(k * Math.PI / 2) * 9, ini.z); h.obj.rotation.y += .25; vx.nevoa(ini, 1.2, 1, [.85, .75, .6], .45, 1.6, .9); if (Math.random() < .5) vx.chamas(yv(P(h), P(h).y - .5), .5, 1, 1, .5, 'tocha'); if (k >= 1) { P(h).set(c.x, 9, c.z); } return k < 1; });
    vx.marca(c, d.raio, [1, .45, .1], 1.7);
    K.agendar(1.2, () => efeito(.45, (e) => { const k = Math.min(1, e.t / .45); P(h).set(c.x, 9 * (1 - k), c.z); if (V()) { V().bolaFogo(yv(P(h), P(h).y + 1), 2.4, .2); V().chamas(yv(P(h), P(h).y), .8, 2, 1.6, .5, 'fornalha'); }
      if (k >= 1) { P(h).y = 0; h.saltando = false; h.invulneravel = false; for (const u of inim(h, c, d.raio)) { hit(h, u, d, nv, dano, { centro: c }); K.aplicarLento(u, .4, 2); }
        vx.expl(c, 4.5); vx.fogo(c, d.raio); vx.decal(c, 'rachadura_lava', d.raio, 5); if (P(J() || h).distanceTo(c) < 22) K.tremer(.55);
        const dir = dirDe(ini, c), L = ini.distanceTo(c), dps = porNv(h, d, nv, d.dpsFaixa) + .1 * h.st.ap * K.K_AP; for (let s = 1; s < L; s += 2.2) vx.decal(ini.clone().addScaledVector(dir, s), 'queimado', 1.4, 3.5);
        zona(ini.clone().lerp(c, .5), L / 2 + 1, 3, (dt, z) => { if ((z.acc += dt) < .5) return; z.acc = 0; for (const u of K.inimigosEmLinha(ini, dir, L, 2, h.time)) K.danificar(h, u, dps * .5, { mag: true, hab: true }); for (let i = 0; i < 3; i++) vx.chamas(ini.clone().addScaledVector(dir, Math.random() * L), .4, 1, 1.3, .9, 'chao'); }); return false; }
      return true; })); return true; });

  // ---------- ESTER ----------
  const esterForca = (h, u) => { if (h.id !== 'ester' || !h.esterProx || h.esterProx.u !== u || h.esterProx.t < T()) return 1; h.esterProx = null; marcaTxt(u, 'Para um tempo como este!'); return 1.4; };
  reg('ester', 'q', (h, d, nv, m, dano, cor) => { const o = P(h).clone(), dir = m.dir.clone(); let comp = d.comp, n = 0;
    for (const u of K.herois) { if (n >= 2 || !u.vivo || u === h || u.time !== h.time) continue; const v = P(u).clone().sub(o); const a = v.x * dir.x + v.z * dir.z, pd = Math.abs(v.x * dir.z - v.z * dir.x); if (a > 0 && a < comp && pd < d.larg / 2 + .6) { comp += 3; n++; vx.brilho(yv(P(u), 1.3), [1, .85, .45], 1.4); } }
    linhaVis(o, dir, comp, d.larg, cor, d.atraso);
    K.agendar(d.atraso, () => { if (!h.vivo) return; for (const u of K.inimigosEmLinha(o, dir, comp, d.larg, h.time)) { hit(h, u, d, nv, dano, { dirL: dir }); K.aplicarLento(u, .25, 1.5); vx.faiscas(yv(P(u), 1.2), 6, [1, .85, .4], 4); }
      for (let s = .5; s < comp; s += 1.2) vx.emit('flash', yv(o.clone().addScaledVector(dir, s), 1.2), { vida: .3, t0: .9, t1: .3, cor: [1, .82, .4], rot: Math.random() * TAU }); }); return true; });
  reg('ester', 'w', (h, d, nv, m) => { const ini = m.alvo && m.alvo.time !== h.time && m.alvo.tipo === 'heroi' && P(m.alvo).distanceTo(P(h)) < d.alc + 1 && !h.kitAlvo ? m.alvo : null;
    if (ini) { K.silenciar(ini, 1.25); ini.desarmT = T() + 1.25; marcaTxt(ini, 'Selado!'); K.acertarHab(h, ini, d, nv, 0); vx.simbolo(yv(P(ini), 2.6), [1, .8, .35], 1.1, 1.25); vx.onda(P(ini), 1.2, [1, .8, .4], .4); return true; }
    const a = alvoAliado(h, m, d.alc); const v = (porNv(h, d, nv, d.escudo) + .4 * h.st.ap) * esterForca(h, a); K.darEscudo(a, v, 2.5); a.imuneSilT = T() + 2.5; vx.simbolo(yv(P(a), 2.4), [1, .85, .45], .9, 1); vx.brilho(yv(P(a), 1.3), [1, .85, .45], 1.8); return true; });
  reg('ester', 'r', (h, d, nv, m) => { const a = alvoAliado(h, m, d.alc); const v = (porNv(h, d, nv, d.vida) + .5 * h.st.ap) * esterForca(h, a);
    if (!(a.esterR && a.esterR.fim > T())) { a.obj.scale.multiplyScalar(1.3); K.agendar(5, () => { a.obj.scale.multiplyScalar(1 / 1.3); a.esterR = null; K.recalcular(a); }); }
    a.esterR = { v, fim: T() + 5 }; K.recalcular(a); a.hp = Math.min(a.maxHp, a.hp + v); marcaTxt(a, 'Se perecer, pereci!');
    for (const u of inimEst(h, P(a), 3)) K.arremessar(u, .75); vx.onda(P(a), 3, [1, .75, .9], .5); vx.estrelas(yv(P(a), 2), 10, [1, .8, .9], 1.2, .5, 1); vx.poeira(P(a), 2.4);
    zona(P(a), 5, 5, (dt, z) => { z.c.copy(P(a)); if ((z.acc += dt) < .5) return; z.acc = 0; if (!a.vivo) return; for (const u of inimEst(h, P(a), 4.5)) K.aplicarLento(u, .3, .6); if (Math.random() < .4) vx.estrelas(yv(P(a), 2.6), 2, [1, .8, .9], .8, .4); }); return true; });

  // ---------- SARAI ----------
  reg('sarai', 'q', (h, d, nv, m, dano) => { K.agendar(d.atraso, () => { if (!h.vivo) return; const dir = dirMira(h, m), o = yv(P(h), 1.2); const ida = new Set(), volta = new Set(); const st = { p: o.clone(), viva: true };
    h.saraiAdaga = st; const ms = V() && V().pegarMalha('adaga'); const r = V() && V().M.pegarRastro ? V().M.pegarRastro() : null; if (r) r.iniciar({ cor: [.85, .95, 1], larg: .08, dur: .16, tex: V().RAS.ar });
    const tIda = d.alc / d.vel; efeito(tIda * 2 + 1.5, (e) => { const k = e.t / tIda; let p; if (k <= 1) p = o.clone().addScaledVector(dir, d.alc * Math.sin(k * Math.PI / 2)); else { const de = o.clone().addScaledVector(dir, d.alc); const alvo = yv(P(h), 1.2); const L = de.distanceTo(alvo); const kk = Math.min(1, (k - 1) * d.alc / Math.max(1, L)); p = de.lerp(alvo, kk * kk); if (kk >= 1 || P(h).distanceTo(p) < 1) st.viva = false; }
      st.p.copy(p); if (ms) { ms.position.copy(p); ms.rotation.set(0, e.t * 18, 0); } if (r) r.seguir(p, V().M.agora());
      for (const u of inimEst(h, p, 1.1)) { if (k <= 1 && !ida.has(u)) { ida.add(u); hit(h, u, d, nv, dano); vx.corte(yv(P(u), 1.2), [.85, .95, 1], 1.4, Math.random() * 6, .12); } else if (k > 1 && !volta.has(u)) { volta.add(u); hit(h, u, d, nv, dano * (ida.has(u) ? 1.5 : 1)); vx.faiscas(yv(P(u), 1.2), 5, [.8, .95, 1], 4); } }
      if (!st.viva || !h.vivo) { st.viva = false; if (ms) V().soltarMalha(ms); if (r) r.solto = true; return false; } return true; }); }); return true; },
    null, (h) => { const st = h.saraiAdaga; if (!st || !st.viva) return; st.viva = false; const p = yv(st.p, 0); vx.poeira(P(h), .8); h.peregrSoma = (h.peregrSoma || 0) + P(h).distanceTo(p); P(h).copy(p); K.limitar(P(h)); vx.poeira(P(h), 1, [.95, .85, .6]); vx.brilho(yv(P(h), 1.2), [.85, .95, 1], 1.4); return true; });
  reg('sarai', 'w', (h, d) => { const c = P(h).clone(); h.miragem = { c, fim: T() + d.dur };
    zona(c, d.raio, d.dur, (dt, z) => { if (P(h).distanceTo(c) < d.raio && !(h.miragemRevela > T())) { h.invis = Math.max(h.invis, .2); const b = h.buffs.find(x => x.miragem); if (b) b.t = .25; else h.buffs.push({ tipo: 'ms', v: .2, t: .25, miragem: true }); } if ((z.acc += dt) > .25) { z.acc = 0; vx.nevoa(c, d.raio * .8, 2, [.92, .8, .55], .4, 2.4, 1.4); } }); vx.poeira(c, d.raio, [.95, .82, .55], 10); return true; });
  reg('sarai', 'r', (h, d, nv, m) => { const dir = m.dir.clone(); const marc = new Set(); h.saraiR = { marc, t: T() + 10, d0: h.distAndada || 0, nv };
    dashKit(h, dir, d.dist, 26, d, () => { vx.poeira(P(h), 1.2, [.95, .85, .6]); }, (hh) => { for (const u of herInim(hh, P(hh), 1.6)) if (!marc.has(u)) { marc.add(u); marcaTxt(u, 'Promessa!'); vx.simbolo(yv(P(u), 2.6), [1, .9, .5], .8, 2); } if (Math.random() < .6) vx.emit('poeira', yv(P(hh), .3), { vida: .6, t0: .5, t1: 1, cor: [.95, .85, .6], alpha: .6, rot: Math.random() * TAU }); }); return true; },
    null, (h) => { const s = h.saraiR; if (!s || s.t < T()) return; const alvos = [...s.marc].filter(u => u.vivo && P(u).distanceTo(P(h)) < 22); if (!alvos.length) return; h.saraiR = null; const u = alvos.sort((a, b) => P(a).distanceTo(P(h)) - P(b).distanceTo(P(h)))[0];
      const d = h.def.hab.r, nv = s.nv; const andou = Math.min(20, (h.distAndada || 0) - s.d0); const dano = K.valorHab(h, d, nv) * (1 + 2 * andou / 20); const dir = dirDe(P(h), P(u));
      dashKit(h, dir, Math.max(.5, P(h).distanceTo(P(u)) - 1), 34, d, () => { if (u.vivo) { hit(h, u, d, nv, dano); vx.corte(yv(P(u), 1.2), [1, .9, .5], 2.6, Math.atan2(dir.z, dir.x), .18); vx.brilho(yv(P(u), 1.3), [1, .9, .5], 2.4); vx.onda(P(u), 1.6, [1, .9, .55], .4); if (h === J()) K.tremer(.3); } }); h.hab.r.cd = Math.max(h.hab.r.cd, 1); return true; });

  // ---------- MOISÉS ----------
  reg('moises', 'q', (h, d, nv, m, dano) => { const c = pontoHab(h, m, d.alc); vx.decal(c, 'chao_molhado', d.raio, d.atraso + 2); vx.marca(c, d.raio, [.45, .7, 1], d.atraso);
    efeito(d.atraso, () => { if (V() && Math.random() < .4) V().detritos(yv(c, .1), 'gota', 1, 2, .12, [.8, .9, 1], 9, .5); return true; });
    K.agendar(d.atraso, () => { if (!h.vivo) return; for (const u of inim(h, c, d.raio)) { hit(h, u, d, nv, dano, { centro: c }); if (!ehEst(u)) K.arremessar(u, 1); } if (V()) V().jatoAgua(c, 5, d.raio); vx.onda(c, d.raio * 1.2, [.6, .8, 1], .45); if (h === J()) K.tremer(.2); }); return true; });
  reg('moises', 'w', (h, d, nv, m, dano) => { const ini = m.alvo && m.alvo.time !== h.time && P(m.alvo).distanceTo(P(h)) < d.alc + 1 && !h.kitAlvo ? m.alvo : null; let atual = ini || alvoAliado(h, m, d.alc); let inimigoVez = !!ini; const ja = new Set(); let de = K.posMao(h); let mult = 1;
    const pulo = (i) => { if (!atual || !atual.vivo || i >= 3) return; const alvo = atual, eInim = inimigoVez, mm = mult; ja.add(alvo); const a = de.clone(); const ms = malhaTemp('serpente', .32, (s, e) => { const k = Math.min(1, e.t / .3); s.position.lerpVectors(a, yv(P(alvo), 1), k); s.position.y += Math.sin(k * Math.PI) * 1.5; s.lookAt(yv(P(alvo), 1)); });
      K.agendar(.3, () => { if (!h.vivo) return; if (alvo.vivo) { if (eInim) { hit(h, alvo, d, nv, dano * mm); vx.det(yv(P(alvo), 1.2), 'gota', 4, 2, .12, [.4, .9, .35]); } else { K.curarU(alvo, (porNv(h, d, nv, d.cura) + .3 * h.st.ap) * mm, true, h); vx.estrelas(yv(P(alvo), 1.5), 4, [.5, 1, .5], .5, .4); } vx.onda(P(alvo), .9, [.4, .9, .35], .35); }
        de = yv(P(alvo), 1); mult *= .85; inimigoVez = !eInim; let prox = null, bd = 6; const lista = inimigoVez ? inimEst(h, P(alvo), 6).filter(u => K.visivelPara(u, h.time)) : aliadosH(h, P(alvo), 6); for (const u of lista) { if (ja.has(u)) continue; const dd = P(u).distanceTo(P(alvo)); if (dd < bd) { bd = dd; prox = u; } } atual = prox; pulo(i + 1); }); if (!ms) vx.emit('det', a, { q0: 0, vida: .3 }); };
    pulo(0); return true; });
  reg('moises', 'e', (h, d, nv, m) => { const a = alvoAliado(h, m, d.alc); a.colunaFogo = { n: 3, t: T() + 5, v: porNv(h, d, nv, d.extra) + .2 * h.st.ap * K.K_AP, por: h }; marcaTxt(a, 'Coluna de fogo!'); vx.chamas(P(a), .6, 5, 1.4, 1, 'tocha'); vx.nevoa(P(a), .8, 3, [.9, .92, 1], .5, 2, 1.2); return true; });
  reg('moises', 'r', (h, d, nv, m, dano) => { const o = P(h).clone(), dir = m.dir.clone(), lado = vec(dir.z, 0, -dir.x); const ja = new Set(); const vel = 8, dur = d.comp / vel;
    if (V() && V().temAgua()) { const ang = Math.atan2(dir.x, dir.z); // paredes do mar (fx_agua_onda, quebrando para a frente) + faixa d'água na frente (fx_agua_faixa)
      for (const sg of [-1, 1]) V().frenteOnda(o, ang - Math.PI / 2, 5.5, 3.4, dur + .5, { x: dir.x, z: dir.z }, (mm, t) => { mm.position.copy(o).addScaledVector(dir, Math.max(0, Math.min(d.comp, t * vel) - 2.4)).addScaledVector(lado, sg * (d.larg * .5 + .15)); });
      V().faixaAgua(o, ang, d.larg + .6, 1.7, dur + .3, (mm, t) => { mm.position.copy(o).addScaledVector(dir, Math.min(d.comp, t * vel)); }); }
    efeito(dur, (e, dt) => { const s = Math.min(d.comp, e.t * vel); const fr = o.clone().addScaledVector(dir, s);
      for (const u of K.inimigosEmLinha(o.clone().addScaledVector(dir, Math.max(0, s - 1.5)), dir, 2, d.larg, h.time)) if (!ja.has(u)) { ja.add(u); hit(h, u, d, nv, dano, { dirL: dir }); if (!ehEst(u)) { K.arremessar(u, .5 + s / d.comp); K.aplicarLento(u, .4, 2 + .5 + s / d.comp); } }
      if (V()) { for (let i = -2; i <= 2; i++) if (Math.random() < .6) V().agua(fr.clone().addScaledVector(lado, i * d.larg / 5), 1.3, 1, 4); if (Math.random() < .3) V().onda(fr, d.larg * .4, [.6, .8, 1], .35); }
      if (e.t >= e.vida) { vx.decal(o.clone().addScaledVector(dir, d.comp / 2), 'chao_molhado', d.larg, 4); } return true; }); if (h === J()) K.tremer(.25); return true; });

  // ---------- DANIEL ----------
  reg('daniel', 'q', (h, d, nv, m, dano) => { const o = P(h).clone(), dir = m.dir.clone(); const ja = new Set();
    K.agendar(d.atraso, () => { if (!h.vivo) return; const vel = 22; efeito(d.comp / vel, (e) => { const s = Math.min(d.comp, e.t * vel); const p = o.clone().addScaledVector(dir, s);
      vx.chamas(p, .6, 2, 1.1, .45, 'tocha'); if (Math.random() < .5) vx.emit('poeira', yv(p, .3), { vida: .6, t0: .6, t1: 1.2, cor: [.85, .7, .45], alpha: .6, rot: Math.random() * TAU }); if (Math.floor(e.t * 8) !== Math.floor((e.t - .016) * 8)) vx.decal(p, 'pegadas_leao_humano', .8, 2.5);
      for (const u of K.inimigosEmLinha(o, dir, s, d.larg, h.time)) if (!ja.has(u)) { ja.add(u); hit(h, u, d, nv, dano, { dirL: dir }); if (!ehEst(u)) K.empurrar(u, dir, 1, .2); vx.corte(yv(P(u), 1.1), [1, .7, .3], 1.8, Math.random() * 6, .14); } return true; }); }); return true; });
  reg('daniel', 'w', (h, d, nv, m, dano) => { const o = P(h).clone(), dir = m.dir.clone(); K.agendar(d.atraso, () => { if (!h.vivo) return; for (const u of inimCone(h, o, dir, d.alc, d.ang)) { hit(h, u, d, nv, dano); u.fragilMagT = T() + 3; vx.simbolo(yv(P(u), 2.4), [1, .85, .45], .8, 1.2); }
    for (let i = 1; i <= 3; i++) vx.decal(o.clone().addScaledVector(dir, i * d.alc / 3.5), 'mene_tequel', 1.2 + i * .5, 3); vx.magia(yv(o.clone().addScaledVector(dir, 2), 1.5), 8, [1, .85, .45], 1.4, .8); }); return true; });
  reg('daniel', 'e', (h, d, nv, m) => { const a = alvoAliado(h, m, d.alc); K.darEscudo(a, porNv(h, d, nv, d.escudo) + .4 * h.st.ap, 3); a.anjoD = { t: T() + 3, v: porNv(h, d, nv, d.espinho) + .2 * h.st.ap, por: h }; marcaTxt(a, 'Anjo guardião!'); vx.brilho(yv(P(a), 2.2), [1, .95, .8], 2.6, .3); vx.estrelas(yv(P(a), 2), 6, [1, .95, .8], .8, .4); return true; });
  reg('daniel', 'r', (h, d, nv, m, dano) => { const c = pontoHab(h, m, d.alc); vx.decal(c, 'buraco_pedra', d.raio, 30); vx.decal(c, 'rachadura', d.raio * 1.1, 4);
    K.agendar(d.atraso, () => { if (!h.vivo) return; for (const u of inim(h, c, d.raio)) hit(h, u, d, nv, dano, { centro: c }); vx.poeira(c, d.raio, [.75, .62, .45], 10); vx.fumaca(c, 2, 4); if (P(J() || h).distanceTo(c) < 20) K.tremer(.15);
      if (h.leao && h.leao.vivo) { h.leao.vidaT = 0; }
      const L = K.novoMinion(h.time, c.x, c.z, true); L.invocado = h; L.vidaT = 30; L.ouro = 0; L.xpV = 20; L.leaoDaniel = true; L.nome = 'Leão de Daniel'; L.maxHp = L.hp = porNv(h, d, nv, d.vidaLeao) / K.multRank(h, d, nv) * 1 + .5 * h.st.ap; L.dano = 40 + 6 * h.nivel + .25 * h.st.ap; L.vel = 4.2; L.st = { arm: 30, rm: 30 }; L.obj.scale.multiplyScalar(1.35); L.raio = 1;
      L.obj.traverse(o => { if (o.isMesh && o.material && o.material.color) { o.material = o.material.clone(); o.material.color.lerp(new THREE.Color(1, .62, .22), .6); if (o.material.emissive) o.material.emissive.setRGB(.25, .1, 0); } });
      const y0 = -2; L.obj.position.y = y0; efeito(.6, (e) => { L.obj.position.y = y0 * (1 - Math.min(1, e.t / .6)); if (Math.random() < .5) vx.det(yv(P(L), 1), 'lasca_pedra', 1, 2, .15); return true; });
      h.leao = L; }); return true; },
    null, (h) => { const L = h.leao; if (!L || !L.vivo || h.hab.r.cd <= 0) return; const m = K.mirar(h, h.def.hab.r); let b = null, bd = 12; for (const u of inimEst(h, m.ponto, 8)) { const dd = P(u).distanceTo(m.ponto); if (dd < bd && K.visivelPara(u, h.time)) { bd = dd; b = u; } } if (!b) return msg(h, 'Nenhum inimigo para o leão'); L.provoc = { por: b, t: 4 }; marcaTxt(b, 'O leão vem!'); vx.onda(P(L), 1.4, [1, .65, .2], .35); return true; });

  // ---------- NOÉ ----------
  reg('noe', 'q', (h, d, nv, m, dano) => { K.agendar(d.atraso, () => { if (!h.vivo) return; const dir = dirMira(h, m);
    proj(h, d, { dir, vel: d.vel, max: d.alc, vis: { malha: 'corvo', trilha: 'sombra' }, larg: .9, onHit: (u) => { hit(h, u, d, nv, dano); if (u.tipo === 'heroi' && u.vivo) { u.corvo = { n: 1, t: T() + 4, por: h, nv }; marcaTxt(u, 'Corvo 1/4'); const ms = malhaTemp('corvo', 4, (mm, e) => { if (!u.vivo || !u.corvo) return false; const a = e.t * 3; mm.position.set(P(u).x + Math.cos(a) * .9, 3 + Math.sin(e.t * 6) * .15, P(u).z + Math.sin(a) * .9); mm.rotation.set(0, -a, Math.sin(e.t * 12) * .3); }); } vx.det(yv(P(u), 1.4), 'pena_preta', 6, 2.5, .2, [1, 1, 1], 3, 1); } }); }); return true; });
  const marcaCorvo = (f, u) => { const c = u.corvo; if (!c || c.t < T() || !f || f.time !== c.por.time) return; c.n++; marcaTxt(u, 'Corvo ' + Math.min(4, c.n) + '/4'); if (c.n >= 4) { u.corvo = null; K.atordoar(u, 1); const h = c.por; const v = porNv(h, h.def.hab.q, c.nv, h.def.hab.q.extraMarca); K.danificar(h, u, v, { hab: true }); vx.det(yv(P(u), 2), 'pena_preta', 12, 4, .22, [1, 1, 1], 3, 1); vx.estrelas(yv(P(u), 2.4), 5, [.9, .9, 1], .5, .35); } };
  reg('noe', 'w', (h, d, nv, m) => { const a = alvoAliado(h, m, d.alc, false); const b = P(a).clone().addScaledVector(dirDe(P(a), P(h)), 1.2);
    saltar(h, b, .45, 2.5, () => { if (!a.vivo) return; const r = porNv(h, d, nv, d.res) / K.multRank(h, d, nv); for (const u of [h, a]) { u.buffs.push({ tipo: 'arm', v: r, t: 3 }); u.buffs.push({ tipo: 'rm', v: r, t: 3 }); } K.curarU(a, porNv(h, d, nv, d.curaAlvo) + .03 * h.maxHp, true, h); vx.estrelas(yv(P(a), 1.6), 6, [.95, .95, 1], .7, .4); vx.det(yv(P(a), 1.6), 'folha', 5, 2, .2, [.6, .9, .4], 2, 1.2); },
      () => { if (Math.random() < .4) vx.det(yv(P(h), P(h).y + 1.5), 'pena_branca', 1, 1, .2, [1, 1, 1], 1, .8); }); return true; },
    (h, d, m) => alvoAliado(h, m, d.alc, false) ? true : msg(h, 'Nenhum aliado ao alcance'));
  reg('noe', 'e', (h, d, nv) => { const dur = d.dur[nv - 1]; h.portaNoe = { t: T() + dur, red: d.red[nv - 1], bloq: true }; marcaTxt(h, 'Porta da Arca!');
    malhaTemp('porta', dur, (mm, e) => { if (!h.vivo || !h.portaNoe) return false; const f = K.frente(h); mm.position.set(P(h).x + f.x * 1.1, 1.1 + Math.min(0, (e.t - .2) * 5) , P(h).z + f.z * 1.1); mm.rotation.set(0, h.obj.rotation.y, 0); }); vx.poeira(P(h), 1); return true; });
  reg('noe', 'r', (h, d, nv, m, dano) => { const c = P(h).clone(); const ja = new Set(); const red = d.red[nv - 1];
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI; malhaTemp('costela', d.dur, (mm, e) => { const s = Math.min(1, e.t / .3); mm.position.set(c.x, 0, c.z); mm.scale.set(d.raio * s, d.raio * s * 1.1, d.raio * s); mm.rotation.set(0, a, 0); if (e.t > d.dur - .3) mm.position.y = -(e.t - d.dur + .3) * 8; }); }
    vx.poeira(c, d.raio, [.7, .55, .35], 10); if (h === J()) K.tremer(.25);
    if (V() && V().temAgua()) for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + .3, dd = { x: Math.cos(a), z: Math.sin(a) }; // frente do dilúvio empurrando para fora (fx_agua_onda)
      V().frenteOnda(c, null, 2.6, 1.9, .9, dd, (mm, t) => { const r = .8 + Math.min(1, t / .7) * (d.raio + .4); mm.position.set(c.x + dd.x * r, 0, c.z + dd.z * r); }, [.85, .92, 1]); }
    zona(c, d.raio, d.dur, (dt) => { for (const u of aliadosH(h, c, d.raio)) { u.arcaRed = { v: red, t: T() + .25 }; u.semDeslocT = T() + .25; }
      for (const u of inimEst(h, c, d.raio)) { if (!ja.has(u)) { ja.add(u); hit(h, u, d, nv, dano, { centro: c }); } const L = P(u).distanceTo(c); if (L < d.raio && !K.imune(u) && !u.empurrao) K.empurrar(u, dirDe(c, P(u)), d.raio - L + .8, .2); } }); return true; });

  // ---------- JÔNATAS ----------
  reg('jonatas', 'q', (h, d, nv, m, dano) => { K.agendar(d.atraso, () => { if (!h.vivo) return; const dir0 = dirMira(h, m); const ja = new Set();
    for (let i = 0; i < 7; i++) { const a = (i / 6 - .5) * d.ang * Math.PI / 180; const dir = dir0.clone().applyAxisAngle(vec(0, 1, 0), a);
      proj(h, d, { dir, vel: d.vel, max: d.alc, vis: { malha: 'flecha', trilha: i % 2 && V() && V().nivel !== 'pc' ? 'seco' : 'flecha' }, larg: .6, onHit: (u) => { const pri = !ja.has(u); ja.add(u); hit(h, u, d, nv, dano * (pri ? 1 : .2)); K.aplicarLento(u, .3, 2); vx.det(yv(P(u), 1.1), 'lasca_pedra', 2, 2, .14); },
        onFim: (p) => { if (Math.random() < .5) vx.poeira(yv(p, 0), .4); } }); } }); return true; });
  reg('jonatas', 'e', (h, d, nv, m) => { const H = h.hab.e; if (!h._ecoAtivo) H.sinalCargas = (H.sinalCargas ?? d.cargas) - 1; const c = pontoHab(h, m, d.alc, 14); const de = K.posMao(h); const L = P(h).distanceTo(c);
    const ms = malhaTemp('flecha', .8, (mm, e) => { const k = Math.min(1, e.t / .75); const p = de.clone().lerp(yv(c, .3), k); p.y += Math.sin(k * Math.PI) * Math.min(8, L * .3); mm.position.copy(p); const q = de.clone().lerp(yv(c, .3), Math.min(1, k + .02)); q.y += Math.sin(Math.min(1, k + .02) * Math.PI) * Math.min(8, L * .3); mm.lookAt(q); if (Math.random() < .6) vx.fumaca(p, .5, 1, [.95, .95, .95], .6, .2); });
    K.agendar(.75, () => { const fim = T() + 5; h.sinais = (h.sinais || []).filter(s => s.fim > T()); h.sinais.push({ c: c.clone(), fim, r: d.raio }); vx.marca(c, d.raio, [1, 1, 1], 5); zona(c, d.raio, 5, (dt, z) => { for (const u of K.unidades) if (u.vivo && u.time !== h.time && P(u).distanceTo(c) < d.raio) { u.revelado = T() + .3; u.revelaPara = h.time; } if ((z.acc += dt) > .5) { z.acc = 0; vx.fumaca(c, 1.2, 2, [.95, .95, .95], .5, .6); } }); });
    return true; },
    (h, d) => { const H = h.hab.e; if (H.sinalCargas === undefined) H.sinalCargas = d.cargas; if (H.sinalCargas <= 0) return msg(h, 'Sem flechas de sinal'); return true; });
  reg('jonatas', 'r', (h, d, nv, m, dano) => { const dir = dirMira(h, m); const ini = P(h).clone(); h.travado = .5;
    K.agendar(.3, () => { if (!h.vivo) return;
      proj(h, d, { dir, vel: d.vel, max: d.alc, larg: 1.2, esc: 2, perfura: true, vis: { malha: 'flecha', trilha: 'flecha' },
        trilha: (p, dt, pp) => { if (Math.floor(pp.dist / 2) !== pp._anel) { pp._anel = Math.floor(pp.dist / 2); vx.emit('onda', p, { vida: .35, t0: .4, t1: 1.2, cor: [1, .9, .8], rot: Math.random() * TAU }); } if (V()) V().clarao(p, [1, .55, .4], 2.5, .05); },
        onHit: (u, pp) => { if (u.tipo !== 'heroi' || pp.max === 0) return; const c = P(u).clone(); const k = Math.min(1, pp.dist / 60); for (const w of inim(h, c, d.raio)) { hit(h, w, d, nv, dano, { centro: c }); if (!ehEst(w)) K.atordoar(w, 1 + .75 * k); }
          let al = null, bd = 1e9; for (const a of K.herois) if (a.vivo && a.time === h.time) { const dd = P(a).distanceTo(c); if (dd < bd) { bd = dd; al = a; } } if (al) { K.curarU(al, porNv(h, d, nv, d.cura), true, h); vx.estrelas(yv(P(al), 1.5), 5, [1, .5, .45], .6, .4); }
          vx.brilho(yv(c, 1.2), [1, .7, .5], 3); vx.onda(c, d.raio * 1.2, [1, .8, .7], .45); vx.pedra(yv(c, .5), 1.6); vx.decal(c, 'rachadura', d.raio, 3); if (P(J() || h).distanceTo(c) < 25) K.tremer(.14); pp.max = 0; } }); }); return true; });

  // ---------- GOLIAS ----------
  reg('golias', 'q', (h, d, nv, m, dano) => { K.agendar(d.atraso, () => { if (!h.vivo) return; const dir = dirMira(h, m);
    proj(h, d, { dir, vel: d.vel, max: d.alc, vis: { malha: 'lanca', trilha: 'virote' }, larg: .9, onHit: (u) => { hit(h, u, d, nv, dano); if (!ehEst(u)) { const r = d.rouba[nv - 1]; K.aplicarLento(u, r, 3); h.buffs.push({ tipo: 'ms', v: r, t: 3 }); } vx.faiscas(yv(P(u), 1.2), 8, [1, .8, .5], 5); vx.poeira(P(u), .8); } }); }); return true; });
  reg('golias', 'e', (h, d, nv, m, dano) => { K.agendar(d.atraso, () => { if (!h.vivo) return; const v = dano + d.kArm * K.arm(h); for (const u of inim(h, P(h), d.raio)) { hit(h, u, d, nv, v, { centro: P(h).clone() }); if (u.buffs && !ehEst(u)) u.buffs.push({ tipo: 'as', v: -.3, t: 3 }); }
    vx.poeira(P(h), d.raio, [.8, .68, .5], 10); vx.decal(P(h), 'rachadura', d.raio * .8, 3); vx.onda(P(h), d.raio, [.9, .75, .5], .45); vx.det(yv(P(h), .3), 'lasca_pedra', 8, 4, .22); if (h === J()) K.tremer(.35); }); return true; });
  reg('golias', 'r', (h, d, nv, m, dano) => { const alvo = alvoHeroi(h, m, d.alc); const dir = dirDe(P(h), P(alvo)); const L = Math.max(.5, P(h).distanceTo(P(alvo)) - .8); h.imparavel = Math.max(h.imparavel, L / 20 + .4); K.limparControles(h);
    dashKit(h, dir, L, 20, d, () => { const c = P(h).clone(); for (const u of inim(h, c, d.raio)) { hit(h, u, d, nv, dano, { centro: c }); if (!ehEst(u)) K.arremessar(u, 1.5); } vx.poeira(c, d.raio * 1.2, [.8, .68, .5], 12); vx.decal(c, 'rachadura', d.raio, 3.5); vx.onda(c, d.raio * 1.2, [1, .7, .4], .5); vx.pedra(c, 2); if (P(J() || h).distanceTo(c) < 20) K.tremer(.5); },
      (hh) => { if (Math.random() < .7) vx.emit('poeira', yv(P(hh), .3), { vida: .7, t0: .6, t1: 1.2, cor: [.8, .7, .52], alpha: .7, rot: Math.random() * TAU }); }); return true; }, precisaHeroi);

  // ---------- LAMI (golias2) ----------
  reg('golias2', 'q', (h, d, nv, m, dano) => { K.agendar(d.atraso, () => { if (!h.vivo) return; const dir = dirMira(h, m);
    proj(h, d, { dir, vel: d.vel, max: d.alc, vis: { malha: 'lanca', trilha: 'corda' }, larg: .9, onHit: (u) => { hit(h, u, d, nv, dano); if (!ehEst(u) && u.tipo !== 'monstro' && !K.imune(u)) { const dv = P(h).clone().sub(P(u)).setY(0); const L = dv.length(); if (L > 1.6) K.empurrar(u, dv, L - 1.4, .3); marcaTxt(u, 'Puxado!'); } vx.faiscas(yv(P(u), 1.2), 6, [.7, 1, .5], 4); } }); }); return true; });
  reg('golias2', 'w', (h, d, nv, m, dano) => { const v = porNv(h, d, nv, d.escudo) + .08 * h.maxHp; K.darEscudo(h, v, 4); const esc = h.escudos[h.escudos.length - 1]; vx.det(yv(P(h), 1.4), 'lasca_pedra', 6, 1.5, .2, [1, .97, .88], 1, .8);
    const ms = []; for (let i = 0; i < 4; i++) { const a = i / 4 * TAU; ms.push(malhaTemp('queixada', 3.1, (mm, e) => { const b = a + e.t * 2.5; mm.position.set(P(h).x + Math.cos(b) * 1.2, 1.2 + Math.sin(e.t * 3 + i) * .2, P(h).z + Math.sin(b) * 1.2); mm.rotation.set(0, -b, 0); if (!h.vivo || !(esc.v > 0)) return false; })); }
    K.agendar(3, () => { if (!h.vivo || !(esc.v > 0) || esc.t <= 0) return; for (const u of inim(h, P(h), d.raio)) hit(h, u, d, nv, dano + (ehEst(u) ? 0 : .1 * Math.min(u.maxHp, 3000)), { centro: P(h).clone() }); vx.det(yv(P(h), 1.2), 'lasca_pedra', 14, 6, .22, [1, .97, .88], 9, .9); vx.onda(P(h), d.raio, [.7, 1, .5], .4); vx.explP(yv(P(h), 1), 2, [.8, 1, .7]); }); return true; });
  const soltarHaste = (h) => { const c = h.lamiCarga; if (!c) return; h.lamiCarga = null; const d = h.def.hab.e, nv = c.nv; const f = Math.min(1, (T() - c.t0) / d.carga); const adb = h.st.ad - h.st.adBase; const v = porNv(h, d, nv, d.dano) + (.6 + .9 * f) * adb; const dir = K.frente(h), o = P(h).clone();
    h.tocar(h.anim.ataque, .05, true, 1.4); h.travado = .35; K.agendar(.15, () => { if (!h.vivo) return; for (const u of K.inimigosEmLinha(o, dir, d.comp, d.larg, h.time)) { hit(h, u, { ...d, k: 0 }, nv, v, { dirL: dir }); if (f >= 1 && !ehEst(u)) K.atordoar(u, 1); }
      vx.corte(yv(o.clone().addScaledVector(dir, 1.6), 1.1), [.75, 1, .55], 3 + f, Math.atan2(dir.z, dir.x), .16); vx.poeira(o.clone().addScaledVector(dir, d.comp * .7), 1.2 + f); if (f >= 1) vx.decal(o.clone().addScaledVector(dir, d.comp * .6), 'rachadura', 1.6, 2.5); if (h === J()) K.tremer(.15 + .25 * f); }); return true; };
  reg('golias2', 'e', (h, d, nv) => { h.lamiCarga = { t0: T(), nv }; h.travado = d.carga + .6; marcaTxt(h, 'Carregando…'); return true; }, null, (h) => h.lamiCarga ? soltarHaste(h) : undefined);

  // ---------- FARAÓ ----------
  reg('farao', 'q', (h, d, nv, m, dano) => { const c = pontoHab(h, m, d.alc); const de = K.posMao(h);
    malhaTemp('cetro', .35, (mm, e) => { const k = Math.min(1, e.t / .3); mm.position.lerpVectors(de, yv(c, .4), k); mm.position.y += Math.sin(k * Math.PI) * 1.5; mm.rotation.set(e.t * 14, 0, 0); });
    K.agendar(.3, () => { if (!h.vivo) return; for (const u of inim(h, c, d.raio)) hit(h, u, d, nv, dano * .6, { centro: c }); vx.poeira(c, .9, [.75, .7, .45]); vx.decal(c, 'sulco_serpente', 1.6, 3);
      const alvo = K.herois.filter(u => u.vivo && u.time !== h.time && K.visivelPara(u, h.time) && P(u).distanceTo(c) < 6).sort((a, b) => P(a).distanceTo(c) - P(b).distanceTo(c))[0]; const p = c.clone();
      malhaTemp('serpente', 2.5, (mm, e, dt) => { if (!h.vivo) return false; const al = alvo && alvo.vivo ? alvo : null; if (!al) { mm.position.set(p.x, .15, p.z); if (e.t > .6) return false; return; } const dir = dirDe(p, P(al)); p.addScaledVector(dir, 9 * dt); mm.position.set(p.x, .15, p.z); mm.rotation.set(0, Math.atan2(dir.x, dir.z), Math.sin(e.t * 14) * .2);
        if (Math.random() < .3) vx.decal(p, 'sulco_serpente', .7, 1.2);
        const bloq = inimEst(h, p, .9).find(u => u.tipo === 'minion' || u.tipo === 'monstro'); const quem = bloq || (P(al).distanceTo(p) < 1 ? al : null);
        if (quem) { hit(h, quem, d, nv, dano, { centro: p }); K.enraizar(quem, 1.25); vx.det(yv(P(quem), 1), 'gota', 5, 2, .12, [.45, 1, .4]); vx.onda(P(quem), .9, [.4, 1, .45], .35); return false; } }); }); return true; });
  reg('farao', 'w', (h, d, nv, m) => { const c = pontoHab(h, m, d.alc); const dps = porNv(h, d, nv, d.dps) + d.k * h.st.ap * K.K_AP;
    zona(c, d.raio, d.dur, (dt, z) => { if (V() && Math.random() < .5) V().detritos(vec(c.x + rnd(d.raio * .7), 1 + Math.random(), c.z + rnd(d.raio * .7)), 'gafanhoto', 2, 3, .16, [1, 1, 1], 0, .7); if ((z.acc += dt) < .5) return; z.acc = 0; vx.nevoa(c, d.raio * .7, 2, [.42, .45, .16], .45, 2.4, 1.3);
      for (const u of inimEst(h, c, d.raio)) { K.danificar(h, u, dps * .5 * (u.tipo === 'heroi' ? 1 : 1.5), { mag: true, hab: true }); u.antiCura = { v: .5, t: 1.5 }; } }); return true; });
  reg('farao', 'r', (h, d, nv, m, dano) => { const alvos = herInim(h, P(h), d.raio).filter(u => K.visivelPara(u, h.time)); const lig = alvos.map(u => ({ u, ok: true, n: 0 })); marcaTxt(h, 'As Dez Pragas!'); vx.onda(P(h), d.raio, [.6, .9, .3], .6); vx.nevoa(P(h), 2, 4, [.35, .4, .15], .5, 3, 1.5);
    efeito(d.dur, (e, dt) => { for (const l of lig) { if (!l.ok) continue; const u = l.u; if (!u.vivo || !h.vivo || P(u).distanceTo(P(h)) > d.quebra) { l.ok = false; if (u.vivo) { marcaTxt(u, 'Livre das pragas'); vx.faiscas(yv(P(u), 1.4), 6, [.6, .9, .3], 3); } continue; }
        const alvoN = Math.floor(e.t / d.dur * 10); while (l.n < Math.min(10, alvoN + 1)) { l.n++; hit(h, u, d, nv, dano); }
        if (Math.random() < .5) { const k = Math.random(); const a = yv(P(h), 1.3).lerp(yv(P(u), 1.3), k); vx.emit('det', a, { q0: V().D[Math.random() < .5 ? "gafanhoto" : "gota"] ?? 0, vida: .3, t0: .18, t1: .1, cor: Math.random() < .5 ? [.6, .9, .3] : [.8, .15, .1] }); } }
      if (e.t >= e.vida) for (const l of lig) if (l.ok && l.u.vivo) { K.atordoar(l.u, 1.5); vx.estrelas(yv(P(l.u), 2.4), 5, [.6, .9, .3], .5, .35); } return true; }); return true; },
    (h, d) => herInim(h, P(h), d.raio).length ? true : msg(h, 'Nenhum herói inimigo a 6 m'));

  // ---------- NABUCODONOSOR ----------
  reg('nabuco', 'q', (h, d, nv, m, dano) => { K.agendar(d.atraso, () => { if (!h.vivo) return; const c = P(h).clone(); let n = 0; for (const u of inim(h, c, d.raio)) { const borda = P(u).distanceTo(c) >= 2 - (u.raio || .5) * .5; hit(h, u, d, nv, dano * (borda ? 1 : .35), { centro: c }); if (borda && u.tipo === 'heroi') n++; } if (n) K.curarU(h, (h.maxHp - h.hp) * .12 * n, true);
    for (let i = 0; i < 3; i++) vx.corte(yv(c, 1.1), [1, .85, .4], 5.6, i * TAU / 3, .22); vx.poeira(c, d.raio * .8, [.85, .72, .5], 8); vx.onda(c, d.raio, [1, .8, .35], .4); }); return true; });
  reg('nabuco', 'w', (h, d, nv, m, dano) => { const o = P(h).clone(), dir = m.dir.clone(); const ms = malhaTemp('mao', d.atraso + .5, (mm, e) => { const k = Math.min(1, e.t / d.atraso); const s = k < 1 ? d.alc * k : d.alc * (1 - (e.t - d.atraso) / .5); mm.position.copy(o).addScaledVector(dir, Math.max(.8, s)).setY(1); mm.rotation.set(0, Math.atan2(dir.x, dir.z), 0); mm.scale.setScalar(1.2); });
    K.agendar(d.atraso, () => { if (!h.vivo) return; for (const u of inimCone(h, o, dir, d.alc, d.ang)) { hit(h, u, d, nv, dano); if (!ehEst(u) && !K.imune(u)) { const dv = P(h).clone().sub(P(u)).setY(0); const L = dv.length(); if (L > 1.4) K.empurrar(u, dv, L - 1.2, .3); K.aplicarLento(u, .35, 1); } } vx.poeira(o.clone().addScaledVector(dir, d.alc * .7), 1.6, [.8, .7, .55]); vx.det(yv(o.clone().addScaledVector(dir, d.alc * .6), 1), 'lasca_pedra', 6, 3, .2); }); return true; });
  reg('nabuco', 'e', (h, d, nv, m, dano) => { const dir = m.alvo && !m.manual ? dirDe(P(h), P(m.alvo)) : m.dir.clone(); let parou = false;
    dashKit(h, dir, d.dist, d.vel, d, () => { vx.poeira(P(h), 1.4); }, (hh, dd) => { if (parou) return; const u = herInim(hh, P(hh).clone().addScaledVector(dir, .8), 1.4)[0]; if (Math.random() < .6) vx.emit('poeira', yv(P(hh), .3), { vida: .6, t0: .6, t1: 1.1, cor: [.85, .72, .5], alpha: .6, rot: Math.random() * TAU }); if (u) { parou = true; hit(hh, u, d, nv, dano); K.atordoar(u, .75); vx.pedra(yv(P(u), 1), 1.2); vx.onda(P(u), 1.4, [1, .7, .3], .35); if (hh === J()) K.tremer(.25); hh.dash.t = 0; } }); return true; });
  const agarraNabuco = (h, d) => K.herois.filter(u => u.vivo && u.time !== h.time && !K.imune(u) && K.visivelPara(u, h.time) && P(u).distanceTo(P(h)) < d.alc + (u.raio || .5)).sort((a, b) => P(a).distanceTo(P(h)) - P(b).distanceTo(P(h)))[0];
  reg('nabuco', 'r', (h, d, nv, m, dano) => { const u = agarraNabuco(h, d); const dir = m.dir.clone(); const b = P(h).clone().addScaledVector(dir, 6); K.limitar(b); K.atordoar(u, 1);
    efeito(.6, () => { if (u.vivo) { P(u).set(P(h).x + dir.x * .6, P(h).y + 1.8, P(h).z + dir.z * .6); u.dash = null; } return true; });
    saltar(h, b, .6, 4, () => { const c = P(h).clone().addScaledVector(dir, 1.5); K.limitar(c); if (u.vivo) { P(u).set(c.x, 0, c.z); hit(h, u, d, nv, dano, { centro: c }); }
      const bonus = u.def ? Math.max(0, u.maxHp - (u.def.base.hp + u.def.base.hpN * ((u.nivel || 1) - 1))) : 0; for (const w of inim(h, c, d.raio)) if (w !== u) hit(h, w, d, nv, dano + .25 * bonus, { centro: c });
      if (V()) { V().chamas(c, d.raio * .6, 10, 2, 1.6, 'fornalha'); V().explosao(c, 4); V().decal(c, 'rachadura_lava', d.raio, 4); V().clarao(c, [1, .45, .1], 8, .4); V().onda(c, d.raio, [1, .55, .2], .5); } if (P(J() || h).distanceTo(c) < 22) K.tremer(.55);
      const dps = porNv(h, d, nv, d.dpsChao); zona(c, d.raio, 3, (dt, z) => { if ((z.acc += dt) < .5) return; z.acc = 0; for (const w of inimEst(h, c, d.raio)) K.danificar(h, w, dps * .5, { hab: true }); vx.chamas(c, d.raio * .7, 3, 1.5, .9, 'fornalha'); }); }); return true; },
    (h, d) => agarraNabuco(h, d) ? true : msg(h, 'Nenhum herói a 3 m para agarrar'));

  // ---------- ACABE ----------
  const soltarFlecha = (h) => { const c = h.acabeCarga; if (!c) return; h.acabeCarga = null; const d = h.def.hab.q, nv = c.nv; const f = Math.min(1, (T() - c.t0) / d.carga); const alc = d.alc0 + (d.alc - d.alc0) * f; let mult = 1 + f; const dano = K.valorHab(h, d, nv); const m = K.mirar(h, d); const dir = dirMira(h, m);
    h.tocar(h.anim.ataque, .05, true, 1.6); h.travado = .3; h.olharPara(P(h).clone().add(dir), 1, 1);
    proj(h, d, { dir, vel: d.vel, max: alc, perfura: true, larg: .7, esc: 1 + .5 * f, vis: { malha: 'flecha', trilha: f > .6 ? 'ouro' : 'flecha' }, onHit: (u) => { hit(h, u, d, nv, dano * mult); mult *= .85; vx.faiscas(yv(P(u), 1.2), 4, [1, .95, .8], 3); } }); return true; };
  reg('acabe', 'q', (h, d, nv) => { h.acabeCarga = { t0: T(), nv }; marcaTxt(h, 'Puxando o arco…'); return true; }, null, (h) => h.acabeCarga ? soltarFlecha(h) : undefined);
  reg('acabe', 'e', (h, d) => { h.disfarceAcabeT = T() + d.dur; h.buffs.push({ tipo: 'ms', v: .2, t: d.dur, disfarce: true }); for (const u of K.unidades) if (u.alvoU === h) u.alvoU = null; marcaTxt(h, 'Disfarçado!'); vx.fumaca(P(h), 1.4, 4, [.6, .55, .45], .6); return true; });
  const quebrarDisfarce = (h) => { if (!(h.disfarceAcabeT > T())) return; h.disfarceAcabeT = 0; h.buffs = h.buffs.filter(b => !b.disfarce); h.acabeBonusT = T() + 3; marcaTxt(h, 'Disfarce desfeito'); vx.fumaca(P(h), 1.2, 3, [.6, .55, .45], .5); };
  reg('acabe', 'r', (h, d, nv, m, dano) => { textoGlobal(h, 'Flecha ao acaso…'); K.agendar(d.atraso, () => { if (!h.vivo) return; let alvo = null; for (const u of K.herois) if (u.vivo && u.time !== h.time && (!alvo || u.hp < alvo.hp)) alvo = u; if (!alvo) return;
    const extra = Math.min(300, 3 * ((h.ouroRoubado && h.ouroRoubado.get(alvo)) || 0)); alvo.revelado = T() + 3; alvo.revelaPara = h.time; marcaTxt(alvo, 'Flecha ao acaso!'); const de = yv(P(h), 2);
    proj(h, d, { alvo, de, vel: 55, max: 999, esc: 1.6, vis: { malha: 'flecha', trilha: 'pedraOuro' }, onHit: (u) => { hit(h, u, d, nv, dano + extra); vx.brilho(yv(P(u), 1.3), [1, .5, .25], 2.6); vx.onda(P(u), 1.6, [1, .5, .3], .4); vx.faiscas(yv(P(u), 1.2), 10, [1, .6, .3], 6); } }); }); return true; },
    (h) => K.herois.some(u => u.vivo && u.time !== h.time) ? true : msg(h, 'Nenhum herói inimigo vivo'));
  const textoGlobal = (h, t) => { if (h === J()) K.aviso(t); };

  // ---------- DALILA ----------
  reg('dalila', 'q', (h, d, nv, m, dano) => { const dir = dirMira(h, m), o = P(h).clone(); K.agendar(d.atraso, () => { if (!h.vivo) return; for (const u of inimCone(h, o, dir, d.raio, 120)) { const so = !K.unidades.some(w => w !== u && w.vivo && w.time === u.time && w.tipo !== 'torre' && P(w).distanceTo(P(u)) < 4); hit(h, u, d, nv, dano * (so ? 1.5 : 1)); if (so) vx.brilho(yv(P(u), 1.2), [1, .4, .7], 1.4); }
    vx.corte(yv(o.clone().addScaledVector(dir, .8), 1.1), [.92, .92, 1], 3.4, Math.atan2(dir.z, dir.x), .14); vx.det(yv(o.clone().addScaledVector(dir, 1.5), 1.2), 'fio_cabelo', 6, 2.5, .25, [.25, .15, .1], 4, .9); }); return true; });
  reg('dalila', 'w', (h, d, nv, m, dano) => { K.agendar(d.atraso, () => { if (!h.vivo) return; const dir = dirMira(h, m);
    proj(h, d, { dir, vel: d.vel, max: d.alc, vis: { trilha: 'corda' }, larg: .9, onHit: (u) => { hit(h, u, d, nv, dano); if (ehEst(u) || !u.vivo) return; const pino = P(u).clone(); u.tearDalila = { pino, t: T() + 2.5, puxou: false, por: h }; vx.decal(pino, 'laco_corda', 1, 2.5); vx.faiscas(yv(P(u), 1.1), 4, [1, .7, .9], 3); } }); }); return true; });
  reg('dalila', 'e', (h, d, nv, m, dano) => { const b = pontoHab(h, m, d.dist, d.dist); saltar(h, b, .45, 2.4, () => { for (const u of inim(h, P(h), d.raio)) hit(h, u, d, nv, dano, { centro: P(h).clone() }); vx.onda(P(h), d.raio, [.8, .4, .9], .4); vx.det(yv(P(h), .6), 'petala', 8, 3, .2, [.9, .5, .9], 3, 1); vx.poeira(P(h), 1.2); }); return true; });
  reg('dalila', 'r', (h, d) => { h.invis = 1.5; h.buffs.push({ tipo: 'ms', v: .4, t: 1.5 }); h.dalilaEmb = T() + 4; for (const u of K.unidades) if (u.alvoU === h) u.alvoU = null; vx.fumaca(P(h), 1.6, 4, [.4, .2, .35], .6); marcaTxt(h, 'Os filisteus sobre ti!');
    const H = h.hab.r; if (!(h.dalilaR2 > T())) { h.dalilaR2 = T() + 10; const real = H.cd; K.agendar(0, () => { h.dalilaRcd = real; H.cd = 1.5; }); } else { h.dalilaR2 = 0; } return true; });

  // ---------- HERODES ----------
  reg('herodes', 'w', (h, d, nv, m, dano) => { const c = pontoHab(h, m, d.alc); vx.marca(c, d.raio, [.6, .3, .9], d.atraso); vx.decal(c, 'runas_cuneiformes', d.raio * .9, d.atraso + .3);
    efeito(d.atraso, () => { if (Math.random() < .3) vx.magia(yv(c, .5), 1, [.6, .3, .9], d.raio * .6, .5); return true; });
    K.agendar(d.atraso, () => { if (!h.vivo) return; for (const u of inim(h, c, d.raio)) { hit(h, u, d, nv, dano, { centro: c }); K.aplicarLento(u, .4, 1.5); u.revelado = T() + 3; u.revelaPara = h.time; } vx.explP(yv(c, .6), 3, [.75, .45, 1]); vx.nevoa(c, d.raio * .7, 4, [.2, .08, .3], .6, 2.4, 1.2); vx.onda(c, d.raio, [.65, .35, 1], .45); }); return true; });
  reg('herodes', 'e', (h, d, nv, m, dano) => { K.agendar(d.atraso, () => { if (!h.vivo) return; const dir = dirMira(h, m);
    proj(h, d, { dir, vel: d.vel, max: d.alc, vis: { trilha: 'sombra' }, larg: .9, onHit: (u, pp) => { if (u.tipo !== 'heroi') return; pp.max = 0; hit(h, u, d, nv, dano); marcaTxt(u, 'Enganado!'); vx.simbolo(yv(P(u), 2.4), [.6, .3, .9], .8, .5);
      K.agendar(.5, () => { if (!h.vivo || !u.vivo || K.imune(u)) return; const a = P(h).clone(), b = P(u).clone(); P(h).copy(b); P(u).copy(a); u.dash = null; h.dash = null; K.aplicarLento(u, .3, 1.5); for (const p of [a, b]) { vx.fumaca(p, 1.4, 3, [.15, .06, .22], .7); vx.onda(p, 1.4, [.6, .3, .9], .35); } }); }, perfura: true }); }); return true; });
  reg('herodes', 'r', (h, d, nv) => { h.ecoT = T() + d.dur; h.sinedrio = { fim: T() + d.dur, nv }; marcaTxt(h, 'Sinédrio corrompido!'); vx.onda(P(h), d.raio, [.6, .3, .9], .6);
    const dps = porNv(h, d, nv, d.dreno) + .1 * h.st.ap * K.K_AP;
    zona(P(h), d.raio, d.dur, (dt, z) => { z.c.copy(P(h)); if (!h.vivo || !h.sinedrio) { z.fim = 0; return; } if (Math.random() < .5) vx.nevoa(P(h), d.raio * .8, 1, [.2, .08, .28], .5, 2.2, 1.2); if ((z.acc += dt) < .5) return; z.acc = 0; for (const u of inimEst(h, P(h), d.raio)) { K.danificar(h, u, dps * .5, { mag: true, hab: true }); K.curarU(h, dps * .25, false); if (Math.random() < .5) vx.magia(yv(P(u), 1.4), 1, [.6, .3, .9], .4, .4); } }); return true; },
    null, (h) => { const s = h.sinedrio; if (!s || s.fim < T()) return; h.sinedrio = null; h.ecoT = 0; const d = h.def.hab.r; const v = K.valorHab(h, d, s.nv); for (const u of inim(h, P(h), d.raio)) { hit(h, u, d, s.nv, v, { centro: P(h).clone() }); if (!ehEst(u)) K.amedrontar(u, P(h).clone(), .75); } vx.explP(yv(P(h), 1), 3.5, [.7, .4, 1]); vx.onda(P(h), d.raio, [.6, .3, .9], .5); if (h === J()) K.tremer(.3); return true; });

  // ---------- HAMÃ ----------
  const FACES = ['ouro', 'vermelho', 'azul'], COR_FACE = { ouro: [1, .8, .25], vermelho: [1, .2, .15], azul: [.3, .5, 1] };
  const faceDado = (c) => FACES[Math.floor((T() - c.t0) / .25) % 3];
  const lancarDado = (h) => { const c = h.hamaDado; if (!c) return; h.hamaDado = null; const face = faceDado(c); const d = h.def.hab.q, nv = c.nv; const dano = K.valorHab(h, d, nv); const m = K.mirar(h, d); const dir = dirMira(h, m); marcaTxt(h, 'Dado: ' + face);
    h.tocar(h.anim.ataque, .05, true, 1.5); h.travado = .3;
    proj(h, d, { dir, vel: d.vel, max: d.alc, larg: .9, giro: true, vis: { malha: 'dado', trilha: 'ouro' }, onHit: (u) => { const cr = COR_FACE[face];
      if (face === 'vermelho') { const cc = P(u).clone(); for (const w of inim(h, cc, 2)) hit(h, w, d, nv, dano, { centro: cc }); vx.explP(yv(cc, .8), 2, [1, .5, .3]); }
      else { hit(h, u, d, nv, dano); if (face === 'ouro' && !ehEst(u)) { K.atordoar(u, 1); vx.estrelas(yv(P(u), 2.4), 5, cr, .5, .35); } if (face === 'azul') { h.mana = Math.min(h.manaMax, h.mana + 50); vx.brilho(yv(P(h), 1.4), cr, 1.4); } }
      vx.brilho(yv(P(u), 1.2), cr, 1.8); } }); return true; };
  reg('hama', 'q', (h, d, nv) => { h.hamaDado = { t0: T(), nv }; return true; }, null, (h) => h.hamaDado ? lancarDado(h) : undefined);
  reg('hama', 'w', (h, d, nv, m, dano) => { K.agendar(d.atraso, () => { if (!h.vivo) return; const dir = dirMira(h, m);
    proj(h, d, { dir, vel: d.vel, max: d.alc, larg: .9, vis: { malha: 'virote', trilha: 'virote' }, esc: 1.5, onHit: (u) => { hit(h, u, d, nv, dano); if (ehEst(u) || K.imune(u)) return; const fim = P(u).clone().addScaledVector(dir, 3); const bate = obstaculo(P(u), fim); K.empurrar(u, dir, 3, .3);
      if (bate) K.agendar(.25, () => { if (!u.vivo) return; K.atordoar(u, 1.25); marcaTxt(u, 'Pregado!'); vx.pedra(yv(P(u), 1), 1.2); vx.estrelas(yv(P(u), 2.4), 5, [1, .9, .6], .5, .35); if (h === J()) K.tremer(.2); }); vx.faiscas(yv(P(u), 1.2), 6, [1, .85, .6], 4); } }); }); return true; });
  const tropaHama = (h, d, m) => { let b = null, bd = 1e9; for (const u of K.unidades) { if (!u.vivo || u.time === h.time || (u.tipo !== 'minion' && u.tipo !== 'monstro') || u.epico || u.invocado || u.hamaOrig) continue; if (u.tipo === 'monstro' && (u.maxHp > 4000 || u.chefe)) continue; const dh = P(u).distanceTo(P(h)); if (dh > d.alc + 1) continue; const s = m && m.manual ? P(u).distanceTo(m.ponto) : dh; if (s < bd) { bd = s; b = u; } } return b; };
  reg('hama', 'e', (h, d, nv, m) => { const u = tropaHama(h, d, m); const dur = u.bruto || u.tipo === 'monstro' && u.maxHp > 1500 ? 5 : 8; const a = K.posMao(h);
    malhaTemp('anel', .4, (mm, e) => { const k = Math.min(1, e.t / .35); mm.position.lerpVectors(a, yv(P(u), 1.4), k); mm.position.y += Math.sin(k * Math.PI) * 2; });
    K.agendar(.35, () => { if (!u.vivo) return; u.hamaOrig = { time: u.time, dano: u.dano }; u.time = h.time; u.dano = (u.dano || 0) * 1.3; u.alvoU = null; u.ultimoAgressor = null; vx.poeira(P(u), 1.2); vx.faiscas(yv(P(u), 1.6), 8, [1, 1, 1], 3); if (u.barra) u.barra.classList.add('subornado');
      K.agendar(dur, () => { if (!u.hamaOrig) return; u.time = u.hamaOrig.time; u.dano = u.hamaOrig.dano; u.hamaOrig = null; if (u.barra) u.barra.classList.remove('subornado'); if (u.vivo) vx.poeira(P(u), 1); }); }); return true; },
    (h, d, m) => tropaHama(h, d, m) ? true : msg(h, 'Nenhuma tropa ou monstro pequeno ao alcance'));
  reg('hama', 'r', (h, d, nv, m, dano) => { const dir = m.dir.clone(), o = P(h).clone(); h.travado = d.canal + .2; h.kitCanal = { t: d.canal }; let i = 0; const int = d.canal / d.ondas; marcaTxt(h, 'Edito Real!');
    efeito(d.canal, (e) => { if (!h.vivo || K.controlado(h) || h.silencio > 0) { h.kitCanal = null; return false; } while (i < d.ondas && e.t >= i * int) { i++; for (const u of inimCone(h, o, dir, d.alc, d.ang)) { hit(h, u, d, nv, dano, { semAtordoar: true }); K.aplicarLento(u, .25, 1); }
        const n = V() && V().nivel === 'pc' ? 3 : 1; for (let j = 0; j < n; j++) { const a = (Math.random() - .5) * d.ang * Math.PI / 180, r = 2 + Math.random() * (d.alc - 2); const p = o.clone().addScaledVector(dir.clone().applyAxisAngle(vec(0, 1, 0), a), r); const top = yv(p, 7).add(vec(rnd(.5), 0, rnd(.5)));
          malhaTemp('virote', 1.2, (mm, e2) => { const k = Math.min(1, e2.t / .25); mm.position.lerpVectors(top, yv(p, .25), k); mm.lookAt(p.x, -5, p.z); if (k >= 1 && !mm.userData.cravou) { mm.userData.cravou = true; if (j === 0) vx.emit('poeira', yv(p, .3), { vida: .6, t0: .4, t1: .9, cor: [.85, .75, .6], alpha: .6, rot: Math.random() * TAU }); } if (e2.t < .05) mm.userData.cravou = false; }); } }
      if (e.t >= e.vida) h.kitCanal = null; return true; }); return true; });

  // ---------- BALAÃO ----------
  reg('balaao', 'w', (h, d, nv, m) => { let a = alvoAliado(h, m, d.alc); if (!h.kitAlvo && K.controlado(h)) a = h; K.limparControles(a); K.curarU(a, porNv(h, d, nv, d.cura) + .25 * h.st.ap, true, h); a.imparavel = Math.max(a.imparavel || 0, 1); marcaTxt(a, 'Bênção!'); vx.det(yv(P(a), 1.2), 'faisca_alongada', 10, 4, .2, [1, .9, .5], 6, .6); vx.brilho(yv(P(a), 1.4), [1, .9, .5], 2.2); vx.onda(P(a), 1.4, [1, .9, .55], .4); return true; });
  reg('balaao', 'e', (h, d, nv, m) => { const c = pontoHab(h, m, d.alc); const dir = m.dir.clone(); const lado = vec(dir.z, 0, -dir.x); const muros = [];
    for (let i = -2; i <= 2; i++) { const p = c.clone().addScaledVector(lado, i * d.comp / 5); const w = { x: p.x, z: p.z, r: .75, fim: T() + d.dur, ms: DUMMY }; K.MUROS_T.push(w); muros.push(w); }
    for (const u of K.inimigosEmLinha(c.clone().addScaledVector(lado, -d.comp / 2), lado, d.comp, 1.6, h.time)) if (!ehEst(u)) K.atordoar(u, 1);
    vx.raio(c, 5, [1, .95, .75]); vx.brilho(yv(c, 2), [1, .95, .7], 3.5, .3); vx.clarao(c, [1, .9, .6], 5, .3); vx.corte(yv(c, 1.4), [1, .95, .8], d.comp, Math.atan2(lado.z, lado.x) + Math.PI / 2, .2);
    zona(c, d.comp / 2, d.dur, (dt, z) => { if ((z.acc += dt) < .15) return; z.acc = 0; const k = Math.random() - .5; vx.emit('flash', yv(c.clone().addScaledVector(lado, k * d.comp), 1 + Math.random() * 1.6), { vida: .3, t0: .7, t1: .2, cor: [1, .95, .75], rot: Math.random() * TAU }); }); return true; });
  reg('balaao', 'r', (h, d, nv, m) => { const c = pontoHab(h, m, d.alc); vx.marca(c, d.raio, [1, .85, .4], d.atraso); vx.decal(c, 'estrela_gravada', d.raio, d.atraso + d.dur);
    K.agendar(d.atraso, () => { let n = 0; for (const u of K.unidades) if (u.vivo && P(u).distanceTo(c) < d.raio + (u.raio || .5) * .5) { u.estase = Math.max(u.estase || 0, d.dur); u.dash = null; u.empurrao = null; if (u.canal) u.canal = null; if (u.tipo === 'heroi') { marcaTxt(u, 'Estase'); n++; } }
      for (const e of K.estruturas) if (e.vivo && e.tipo === 'torre' && e.obj.position.distanceTo(c) < d.raio + (e.raio || 2)) e.estase = d.dur;
      vx.onda(c, d.raio, [1, .9, .55], .6); vx.brilho(yv(c, 1.5), [1, .9, .6], 4, .3); vx.clarao(c, [1, .9, .6], 6, .4);
      zona(c, d.raio, d.dur, (dt, z) => { if ((z.acc += dt) < .2) return; z.acc = 0; vx.estrelas(vec(c.x + rnd(d.raio * .7), 1 + Math.random() * 1.5, c.z + rnd(d.raio * .7)), 2, [1, .92, .6], .4, .4, 1); }); }); return true; });

  // ---------- NINRODE ----------
  reg('ninrode', 'q', (h, d, nv, m, dano) => { K.agendar(d.atraso, () => { if (!h.vivo) return; const dir = dirMira(h, m);
    proj(h, d, { dir, vel: d.vel, max: d.alc, larg: .7, vis: { malha: 'flecha', trilha: 'trevas' }, onHit: (u) => { hit(h, u, d, nv, dano); if (ehEst(u)) return; u.rastreado = { por: h, t: T() + 4 }; u.revelado = T() + 4; u.revelaPara = h.time; h.ninrodeQ = { u, t: T() + 4 }; marcaTxt(u, 'Rastreado!'); vx.magia(yv(P(u), 1.4), 4, [.75, .4, 1], .5, .5); } }); }); return true; });
  reg('ninrode', 'w', (h, d, nv, m, dano) => { const c = pontoHab(h, m, d.alc); const de = yv(P(h), 2);
    malhaTemp('rede', d.atraso + 1, (mm, e) => { const k = Math.min(1, e.t / d.atraso); mm.position.lerpVectors(de, yv(c, .1), k); mm.position.y += Math.sin(k * Math.PI) * 3; mm.rotation.set(Math.PI / 2, 0, e.t * 3); mm.scale.setScalar(d.raio * (.4 + .6 * k)); });
    K.agendar(d.atraso, () => { if (!h.vivo) return; for (const u of inim(h, c, d.raio)) { hit(h, u, d, nv, dano, { centro: c }); if (!ehEst(u)) { K.enraizar(u, 1); u.revelado = T() + 3; u.revelaPara = h.time; } } vx.decal(c, 'laco_corda', d.raio, 1.5); vx.poeira(c, d.raio * .8, [.75, .62, .42]); }); return true; });
  reg('ninrode', 'r', (h, d, nv, m, dano) => { const c = pontoHab(h, m, d.alc); vx.marca(c, d.raio, [1, .5, .25], 5); vx.decal(c, 'circulo_areia', d.raio, 5);
    for (let i = 0; i < 5; i++) { const p = c.clone().add(vec(rnd(d.raio * .6), 0, rnd(d.raio * .6))); const top = yv(p, 12).add(vec(-2, 0, -1)); K.agendar(i * .08, () => malhaTemp('flecha', 1.4, (mm, e) => { const k = Math.min(1, e.t / .35); mm.position.lerpVectors(top, yv(p, .4), k); mm.lookAt(p.x + .4, -5, p.z + .2); mm.scale.setScalar(2); if (k >= 1 && !mm.userData.ok) { mm.userData.ok = true; vx.pedra(yv(p, .4), 1.3); } if (e.t < .05) mm.userData.ok = false; })); }
    K.agendar(.4, () => { if (!h.vivo) return; for (const u of inim(h, c, d.raio)) hit(h, u, d, nv, dano, { centro: c }); if (P(J() || h).distanceTo(c) < 20) K.tremer(.3); });
    zona(c, d.raio, 5, (dt, z) => { h.terraCacador = { c, r: d.raio, t: T() + .3 }; for (const u of inimEst(h, c, d.raio)) { u.revelado = T() + .4; u.revelaPara = h.time; if (u.ultPos) { const v = P(u).clone().sub(u.ultPos); const afasta = v.lengthSq() > 1e-4 && v.dot(dirDe(P(h), P(u))) > 0; if (afasta) K.aplicarLento(u, .3, .3); } u.ultPos = P(u).clone(); } }); return true; });

  // ================= passivas e ganchos =================
  const ninrodeP = (h, u) => { if (h.id !== 'ninrode' || ehEst(u) || !u.vivo) return; if (!(u.raiz > 0 || u.atord > 0 || u.lento > 0)) return; u.ninrodeCd = u.ninrodeCd || new WeakMap(); if ((u.ninrodeCd.get(h) || 0) > T()) return; const naTerra = h.terraCacador && h.terraCacador.t > T() && P(u).distanceTo(h.terraCacador.c) < h.terraCacador.r; u.ninrodeCd.set(h, T() + (naTerra ? 1.5 : 4)); const v = .06 * Math.min(u.maxHp, u.tipo === 'heroi' ? 1e9 : 3000); K.agendar(.05, () => K.danificar(h, u, v, { puro: true })); vx.det(yv(P(u), 1.3), 'faisca_alongada', 5, 3, .2, [1, .45, .25], 4, .5); };
  const marchaJosue = (h, u) => { if (h.id !== 'josue' || u.tipo !== 'heroi') return; const m = u.marchaJ && u.marchaJ.por === h && u.marchaJ.t > T() ? u.marchaJ : (u.marchaJ = { n: 0, por: h, t: 0 }); m.n = Math.min(7, m.n + 1); m.t = T() + 4; u.buffs = u.buffs.filter(b => !b.marchaJ); u.buffs.push({ tipo: 'arm', v: -.04 * m.n * (u.st ? u.st.arm : 0), t: 4, marchaJ: true }); if (m.n >= 7 && h.josue7 !== u) { h.josue7 = u; marcaTxt(u, 'Sétimo dia!'); vx.simbolo(yv(P(u), 2.6), [1, .85, .45], .9, 1.5); } };
  const brasa = (h, u) => { if (ehEst(u) || !u.vivo) return; const n = Math.min(3, brasas(u) + 1); u.brasa = { n, t: T() + 4, por: h }; u.dots = u.dots.filter(x => !x.brasa); u.dots.push({ dps: .02 * Math.min(u.maxHp, u.tipo === 'heroi' ? 1e9 : 3000) / 3, t: 3, fonte: h, mag: true, brasa: true }); queimando.add(u);
    if (n >= 3) { u.brasa = null; marcaTxt(u, 'Fogo que consome!'); K.agendar(1, () => { if (!h.vivo && !u.vivo) return; const c = P(u).clone(); const v = (.10 + .02 * h.st.ap / 100) * Math.min(u.maxHp, u.tipo === 'heroi' ? 1e9 : 3000); for (const w of inim(h, c, 3)) K.danificar(h, w, v, { mag: true, hab: true }); vx.fogo(c, 2.4); if (P(J() || h).distanceTo(c) < 18) K.tremer(.2); }); } };
  const queimando = new Set(); const amarrados = () => K.unidades.filter(u => u.tearDalila);
  const jezBonus = (h) => { const n = h.nivel || 1; return (n < 6 ? 30 : n < 11 ? 50 : 70) + .2 * h.st.ap; };
  const tem = (h, k) => !!(H[h.id] && H[h.id][k]);
  function pode(h, k, d, m) { const f = PODE[h.id] && PODE[h.id][k]; if (f) return f(h, d, m); if (d.tipo !== 'kit') return true; if (d.ia === 'alvoHeroi') return precisaHeroi(h, d, m); if (d.ia === 'alvo') return alvoInimigo(h, m, d.alc) ? true : msg(h, 'Nenhum inimigo ao alcance'); return true; }
  function usar(h, k, d, nv, m, dano, cor) { const f = H[h.id] && H[h.id][k]; if (!f) return false; const r = f(h, d, nv, m, dano, cor); return r !== false; }
  function recast(h, k) { const f = RECAST[h.id] && RECAST[h.id][k]; if (!f) return undefined; return f(h); }
  function antesUsar(h, k, d) {
    if (h.id === 'daniel') { if (h.oracaoPronta && d.dano) { h.oracaoPronta = false; h.oracaoUsa = d; K.agendar(3, () => { if (h.oracaoUsa === d) h.oracaoUsa = null; }); } else { h.oracao = (h.oracao || 0) + 1; if (h.oracao >= 3) { h.oracao = 0; h.oracaoPronta = true; marcaTxt(h, 'Oração pronta'); vx.estrelas(yv(P(h), 2.4), 4, [1, .9, .6], .5, .35); } } }
    if (h.id === 'acabe' && k !== 'e') quebrarDisfarce(h);
    if (h.id === 'jezabel' && h.camuflada) { h.camuflada = false; h.jezBonusT = T() + 1.5; h.invis = 0; }
    if (h.id === 'sarai' && h.miragem && h.miragem.fim > T()) { h.miragemRevela = T() + .5; h.invis = 0; }
  }
  function modHab(h, u, d, v) { if (h.id === 'herodes' && h.paranoiaN) v *= 1 + .04 * h.paranoiaN; if (d.porPerdida && u.maxHp) { v *= 1 + d.porPerdida * Math.floor((1 - u.hp / u.maxHp) * 10); u.jezMarca = { por: h, t: T() + .5 }; } return v; }
  function aoAcertarHab(h, u, d, nv) { if (!u || ehEst(u)) return;
    if (d.brasa && h.id === 'elias') brasa(h, u);
    if (h.id === 'gideao' && u.tipo === 'heroi' && !((u.gideaoT || 0) > T())) { u.gideaoT = T() + 6; const atras = P(u).clone().addScaledVector(dirDe(P(h), P(u)), 1.2); vx.fumaca(atras, 1, 2, [.3, .28, .25], .5); K.agendar(.5, () => { if (!h.vivo || !u.vivo) return; K.danificar(h, u, 40 + .5 * (h.st.ad - h.st.adBase), { hab: true }); vx.corte(yv(P(u), 1.2), [1, .8, .45], 2, Math.random() * 6, .14); vx.chamas(atras, .3, 1, .9, .5, 'tocha'); }); }
    ninrodeP(h, u);
    if (u.corvo && !(h.id === 'noe' && d === h.def.hab.q)) marcaCorvo(h, u);
    if (h.id === 'dalila' && u.tipo === 'heroi') { const meus = h.buffs.filter(b => b.tranca); const deste = meus.filter(b => b.de === u).length; if (deste < 5 && meus.length < 20) { h.buffs.push({ tipo: 'ad', v: 4, t: 5, tranca: true, de: u }); u.buffs.push({ tipo: 'ad', v: -4, t: 5 }); vx.det(yv(P(u), 1.6), 'fio_cabelo', 2, 1.5, .2, [.25, .15, .1], 2, .6); } }
    marchaJosue(h, u);
    if (h.oracaoUsa === d && d.dano && h.id === 'daniel') K.atordoar(u, h.nivel >= 13 ? 1.25 : 1);
    if (d.encRM) u.encRM = { por: h, t: T() + d.encRM + 1.25 };
    if (d.lentoTiro) K.aplicarLento(u, d.lentoTiro, 1);
    if (d.maldicaoAtord && u.maldicao) { u.maldicao.atord = d.maldicaoAtord; u.maldicao.curada = false; malditos.add(u); }
    if (h.id === 'jezabel' && h.jezBonusT > T() && u.tipo === 'heroi') { h.jezBonusT = 0; K.danificar(h, u, jezBonus(h), { mag: true }); K.aplicarLento(u, .3, 1); vx.det(yv(P(u), 1.4), 'petala', 5, 2, .18, [1, .4, .8], 3, .8); }
  }
  const malditos = new Set();
  function modDano(f, a, v, o) {
    if (o.mag && a.fragilMagT > T()) v *= 1.1;
    if (a.arcaRed && a.arcaRed.t > T()) v *= 1 - a.arcaRed.v;
    const pt = a.portaNoe; if (pt && pt.t > T() && f && f.obj && f !== a) { const dd = dirDe(P(a), P(f)); if (dd.dot(K.frente(a)) > .35) { if (pt.bloq && (o.hab || (f.def && f.def.distancia) || f.tipo === 'torre') && !o.reflexo) { pt.bloq = false; marcaTxt(a, 'Bloqueado!'); vx.faiscas(yv(P(a).clone().addScaledVector(K.frente(a), 1), 1.2), 8, [1, .85, .6], 4); return 0; } v *= 1 - pt.red; } }
    return v; }
  function aposDano(f, a, v, o) {
    if (f && f.id === 'sansao' && o.ataque && f.vivo) { const k = Math.max(0, Math.min(1, (1 - f.hp / f.maxHp) / .75)); if (k > 0) K.curarU(f, v * .15 * k, false); }
    if (a.anjoD && a.anjoD.t > T() && f && f !== a && f.vivo && (f.tipo === 'heroi' || f.tipo === 'minion' || f.tipo === 'monstro') && !o.reflexo && !((a.anjoD.cd || 0) > T())) { a.anjoD.cd = T() + .5; K.danificar(a.anjoD.por, f, a.anjoD.v, { mag: true, reflexo: true }); vx.brilho(yv(P(f), 1.3), [1, .95, .8], 1.2); }
    if (f && f.tipo === 'heroi' && a.tipo === 'heroi') { f.combHeroiT = T(); a.combHeroiT = T(); if (a.id === 'acabe') quebrarDisfarce(a); if (a.camuflada) { a.camuflada = false; a.invis = 0; } }
  }
  function ataque(h, alvo, dano, crit) { let mag = 0; const heroi = alvo.tipo === 'heroi', est = ehEst(alvo);
    if (h.id === 'davi' && heroi && (h.pedras || 0) > 0) { h.pedras--; dano *= 1.5; }
    if (h.id === 'josue' && !est) { if (h.josue7 === alvo) { dano += .08 * alvo.hp; h.josue7 = null; alvo.marchaJ = null; vx.brilho(yv(P(alvo), 1.3), [1, .85, .45], 2); } marchaJosue(h, alvo); }
    if (h.id === 'jonatas' && !est) { const lento = alvo.lento > 0; if (crit && lento) dano *= 1.1; K.aplicarLento(alvo, crit ? .35 : .2, 1.5); }
    if (h.id === 'sarai') { if (h.miragem && h.miragem.fim > T()) { h.miragemRevela = T() + .5; h.invis = 0; } if ((h.peregr || 0) >= 1 && !est) { h.peregr = 0; dano += .4 * h.st.ad; K.aplicarLento(alvo, .3, 1); const L = P(h).distanceTo(P(alvo)); if (L > 1.6) { const b = P(alvo).clone().addScaledVector(dirDe(P(alvo), P(h)), 1.2); saltar(h, b, .18, 1.2); } vx.poeira(P(alvo), 1, [.95, .85, .6]); marcaTxt(h, 'Peregrinação!'); } }
    if (h.id === 'ninrode') { if (h.ninrodeQ && h.ninrodeQ.u === alvo && h.ninrodeQ.t > T()) { dano += .4 * h.st.ad; h.ninrodeQ = null; } ninrodeP(h, alvo); }
    if (h.colunaFogo && h.colunaFogo.n > 0 && h.colunaFogo.t > T() && !est) { h.colunaFogo.n--; mag += h.colunaFogo.v; K.aplicarLento(alvo, .2, 1); vx.chamas(P(alvo), .4, 2, 1, .6, 'tocha'); }
    if (h.id === 'dalila' && h.dalilaEmb > T() && heroi) { h.dalilaEmb = 0; h.invis = 0; K.silenciar(alvo, 1); alvo.revelado = T() + 4; alvo.revelaPara = h.time; for (const a of aliadosH(h, P(h), 20)) a.buffs.push({ tipo: 'ms', v: .25, t: 4 }); vx.corte(yv(P(alvo), 1.2), [.9, .3, .5], 2.2, Math.random() * 6, .15); }
    if (h.id === 'jezabel') { if (alvo.encRM && alvo.encRM.por === h && alvo.encRM.t > T() && alvo.st) { alvo.buffs = alvo.buffs.filter(b => !b.encRM); alvo.buffs.push({ tipo: 'rm', v: -.25 * alvo.st.rm, t: 4, encRM: true }); } if ((h.camuflada || h.jezBonusT > T()) && !est) { h.camuflada = false; h.jezBonusT = 0; h.invis = 0; mag += jezBonus(h); K.aplicarLento(alvo, .3, 1); } }
    if (h.id === 'acabe') { quebrarDisfarce(h); const bon = h.acabeBonusT > T(); if (bon) { dano *= 1.5; h.acabeBonusT = 0; } if (heroi && alvo.ouro > 0) { const mi = Math.floor(T() / 60); if (h.acabeMin !== mi) { h.acabeMin = mi; h.acabeMinN = 0; } const r = Math.min(alvo.ouro, bon ? 6 : 3, 60 - h.acabeMinN); if (r > 0) { alvo.ouro -= r; h.ouro += r; h.acabeMinN += r; h.ouroRoubado = h.ouroRoubado || new Map(); h.ouroRoubado.set(alvo, (h.ouroRoubado.get(alvo) || 0) + r); } } }
    if (alvo.corvo) marcaCorvo(h, alvo);
    return { dano, mag }; }
  const alcExtra = (h) => (h.id === 'davi' && (h.pedras || 0) > 0 ? 1.5 : 0) + (h.alcProxT > T() ? 1 : 0) + (h.id === 'sarai' && (h.peregr || 0) >= 1 ? 3 : 0);
  function dashFim(h, d) { if (d.alcProx) h.alcProxT = T() + 4; if (d.pedraExtra && h.id === 'davi') { h.pedras = Math.min(6, (h.pedras || 0) + 1); h.pedraExtraT = T() + 4; } if (h._portao) { V() && V().soltarMalha(h._portao); h._portao = null; } }
  function dashTick(h, d, dt) { if (!d) return; if (d._tick) d._tick(h, d, dt); if (d.portoes && V()) { if (!h._portao) h._portao = V().pegarMalha('portao'); const m = h._portao; if (m) { const f = h.dash ? h.dash.dir : K.frente(h); m.position.set(P(h).x + f.x * 1.3, 1.4, P(h).z + f.z * 1.3); m.rotation.set(0, Math.atan2(f.x, f.z), 0); } if (Math.random() < .6) vx.emit('poeira', yv(P(h), .3), { vida: .6, t0: .6, t1: 1.2, cor: [.8, .7, .52], alpha: .6, rot: Math.random() * TAU }); } }
  function aoMorrer(u, f) {
    if (f && f.id === 'davi' && u.tipo === 'minion') f.pedras = Math.min(Math.max(5, f.pedras || 0), (f.pedras || 0) + 1);
    queimando.delete(u); malditos.delete(u); u.brasa = null; u.tearDalila = null;
    if (u.tipo !== 'heroi') return;
    for (const h of K.herois) { if (!h.vivo || h.time === u.time) continue; const ajudou = h === f || (u.agressorT && T() - u.agressorT < 10 && P(h).distanceTo(P(u)) < 14);
      if (!ajudou) continue;
      if (h.id === 'nabuco' && (h.babilonia || 0) < 10) { h.babilonia = (h.babilonia || 0) + 1; h.obj.scale.multiplyScalar(1.02); K.recalcular(h); marcaTxt(h, 'Babilônia ' + h.babilonia + '/10'); }
      if (h.id === 'dalila') h.hab.e.cd = 0; }
    if (u.jezMarca && u.jezMarca.t > T()) { const j = u.jezMarca.por; j.hab.r.cd *= .5; let al = null, bd = 14; for (const a of K.herois) if (a.vivo && a !== j && a.time === j.time && P(a).distanceTo(P(u)) < bd) { bd = P(a).distanceTo(P(u)); al = a; } if (al && K.ganharOuro) { K.ganharOuro(al, 150, yv(P(al), 3)); marcaTxt(al, 'Decreto de Jezreel!'); } }
  }
  // visuais dos tipos genéricos (main chama; true = já desenhou)
  function vis(ev, d, h, c, r) { if (!V()) return false; const cor = C3(d.cor || h.def.cor);
    if (ev === 'area') { if (d.visual === 'trombeta') { for (let i = 0; i < 3; i++) K.agendar(i * .12, () => vx.onda(c, r * (.6 + i * .25), [1, .9, .45], .45)); vx.brilho(yv(P(h), 1.8), [1, .9, .5], 1.8); vx.poeira(c, r * .7, [.9, .8, .6], 6); vx.det(yv(c, 1.2), 'faisca_alongada', 8, 5, .2, [1, .85, .4], 3, .5); return true; }
      if (d.visual === 'pisao') { vx.onda(c, r, [1, .85, .6], .45); vx.decal(c, 'circulo_areia', r, 2.5); vx.poeira(c, r * .8, [.95, .85, .6], 8); vx.estrelas(yv(c, 2), 5, [1, .9, .6], r * .5, .4, .8); return true; }
      if (d.visual === 'desafio') { vx.poeira(c, r, [.8, .68, .5], 10); vx.onda(c, r, [1, .35, .2], .5); vx.faiscas(yv(P(h), 1.6), 12, [1, .7, .4], 6); vx.decal(c, 'rachadura', r * .7, 2.5); if (h === J()) K.tremer(.25); return true; }
      if (d.visual === 'trevas') { vx.nevoa(c, r * .8, 8, [.12, .05, .18], .8, 3, 2.2); vx.decal(c, 'mancha_escura', r, 2.5); vx.magia(yv(c, 1), 4, [.6, .3, .9], r * .5, .6); return true; }
      vx.onda(c, r, cor, .45); vx.poeira(c, r * .6); return true; }
    if (ev === 'salto') { vx.poeira(c, r, [.85, .75, .6], 10); vx.onda(c, r, [1, .8, .45], .45); vx.decal(c, 'rachadura', r * .8, 3); vx.corte(yv(c, 1.2), [1, .85, .5], r * 1.6, Math.random() * 6, .18); vx.brilho(yv(c, 1.2), [1, .85, .5], 2.4); return true; }
    if (ev === 'dashFim') { if (d.blink) { vx.fumaca(c, 1.2, 3, [.25, .1, .35], .7); vx.magia(yv(c, 1), 4, [.75, .3, 1], .6, .5); } else { vx.poeira(c, r || 1.8, [.85, .75, .6], 8); vx.onda(c, r || 1.8, cor, .4); } return true; }
    if (ev === 'blink') { vx.fumaca(c, 1.2, 3, [.25, .1, .35], .7); vx.magia(yv(c, 1), 4, [.75, .3, 1], .6, .5); return true; }
    if (ev === 'zona') { if (d.visual === 'palmeira') { vx.decal(c, 'circulo_areia', r, d.dur || 4); vx.det(yv(c, 3), 'folha', 8, 2, .25, [.5, .85, .35], 2, 1.5); } return false; }
    if (ev === 'linha') { const dir = r; const o = c; for (let i = 0; i < 4; i++) { const p = o.clone().addScaledVector(dir, 1.2 + i * (d.comp - 1.2) / 3); vx.poeira(p, 1.6, [.85, .75, .6], 6); vx.decal(p, 'rachadura', 1.6, 3); } if (h === J()) K.tremer(.4); return true; }
    if (ev === 'armadilha') { vx.decal(c, 'garras', 1.2, .8); vx.poeira(c, .8); return false; }
    if (ev === 'armadilhaPega') { vx.corte(yv(c, 1), [1, .85, .6], 2, Math.random() * 6, .14); vx.decal(c, 'garras', 1.6, 2.5); vx.poeira(c, 1.2); return true; }
    return false; }

  // ================= atualização por quadro =================
  let acc = 0; const manas = []; // maná do céu no chão: { ms, p, t, dono }
  function cairMana(h) { const a = Math.random() * TAU, c = P(h).clone().add(vec(Math.cos(a) * 2.5, 0, Math.sin(a) * 2.5)); K.limitar(c); const ms = V() && V().pegarMalha('mana'); const o = { ms, p: c, t: T() + 25, dono: h, y: 6 }; manas.push(o); return o; }
  function pegarMana(o, a) { const h = o.dono; K.curarU(a, 60 + 8 * (h.nivel || 1), true, h); a.mana = Math.min(a.manaMax, a.mana + 30); marcaTxt(a, 'Maná do Céu!'); vx.estrelas(yv(P(a), 1.4), 5, [1, 1, .85], .5, .4); if (o.ms) V().soltarMalha(o.ms); o.t = 0; }
  function atualizar(dt) { if (!dt) return; const t = T(); acc += dt; const lento = acc >= .1; if (lento) acc = 0;
    for (let i = zonas.length - 1; i >= 0; i--) { const z = zonas[i]; if (!z) continue; if (t >= z.fim) { zonas.splice(i, 1); try { if (z.aoFim) z.aoFim(z); } catch (e) { console.error('[erro] zona fim', e && e.message, e && e.stack); } continue; } try { if (z.tick) z.tick(dt, z); } catch (e) { console.error('[erro] zona', e && e.message, e && e.stack); zonas.splice(zonas.indexOf(z), 1); } }
    for (const h of K.herois) { if (!h.vivo) { h._ult = null; continue; }
      const p = P(h); if (h._ult) { const dd = Math.hypot(p.x - h._ult.x, p.z - h._ult.z); if (dd < 4) h.distAndada = (h.distAndada || 0) + dd * (h.dash ? 2 : 1); } else h._ult = new THREE.Vector3(); h._ult.copy(p);
      switch (h.id) {
        case 'davi': if (h.pedras === undefined) h.pedras = 5; if (h.pedras < 5) { h.pedraT = (h.pedraT || 0) + dt; if (h.pedraT >= 6) { h.pedraT = 0; h.pedras++; } } else h.pedraT = 0; if (h.pedras > 5 && !(h.pedraExtraT > t)) h.pedras = 5; break;
        case 'sansao': { const k = Math.max(0, Math.min(1, (1 - h.hp / h.maxHp) / .75)); const b = h.buffs.find(x => x.nazireu); if (b) { b.v = .6 * k; b.t = .3; } else h.buffs.push({ tipo: 'as', v: .6 * k, t: .3, nazireu: true }); break; }
        case 'sarai': { const s = (h.distAndada || 0) - (h._peregr0 ?? (h._peregr0 = h.distAndada || 0)); h._peregr0 = h.distAndada || 0; const antes = h.peregr || 0; h.peregr = Math.min(1, antes + (s + (h.peregrSoma || 0)) / 12); h.peregrSoma = 0; if (antes < 1 && h.peregr >= 1) { marcaTxt(h, 'Peregrinação pronta'); vx.estrelas(yv(p, 2), 3, [1, .9, .6], .4, .3); } break; }
        case 'herodes': if (lento) { let n = 0; for (const u of K.herois) if (u.vivo && u.time !== h.time && K.visivelPara(u, h.time) && P(u).distanceTo(p) < 9) n++; h.paranoiaN = Math.min(4, n); h.buffs = h.buffs.filter(b => !b.paranoia); if (n) h.buffs.push({ tipo: 'ms', v: .03 * h.paranoiaN, t: .5, paranoia: true }); } if (h.bot && h.sinedrio && h.sinedrio.fim - t < .4) recast(h, 'r'); break;
        case 'jezabel': if (lento) { const fora = t - (h.combHeroiT || -99) > 5; if (fora && !h.camuflada) { h.camuflada = true; marcaTxt(h, 'Camuflada'); } if (!fora) h.camuflada = false; } if (h.camuflada) { const perto = K.herois.some(u => u.vivo && u.time !== h.time && P(u).distanceTo(p) < 4); if (!perto) h.invis = Math.max(h.invis, .15); } break;
        case 'balaao': if (lento) for (const u of K.herois) { if (!u.vivo || u.time === h.time) continue; const dd = P(u).distanceTo(p); const esc = u.invis > 0 || u.camuflada || u.disfarceAcabeT > t; if (esc && dd < 9) { u.invis = 0; u.camuflada = false; u.revelado = t + .5; u.revelaPara = h.time; if (!(u._jumentaT > t)) { u._jumentaT = t + 4; marcaTxt(u, 'A jumenta viu!'); } } else if (esc && dd < 12 && !(h._alertaT > t)) { h._alertaT = t + 3; marcaTxt(h, '!'); if (h === J()) K.aviso('! Inimigo invisível por perto', true); } } break;
        case 'ester': if (lento) for (const a of K.herois) { if (!a.vivo || a === h || a.time !== h.time) continue; const f = a.hp / a.maxHp; if (f > .3) { a._esterOk = true; continue; } if (a._esterOk !== false && P(a).distanceTo(p) < 10) { a._esterOk = false; h.esterProx = { u: a, t: t + 20 }; h.buffs.push({ tipo: 'ms', v: .3, t: 2 }); marcaTxt(h, 'Para um tempo como este!'); } } break;
        case 'moises': { h.manaT = (h.manaT ?? 20) - dt; if (h.manaT <= 0) { h.manaT = 45; if (manas.filter(o => o.dono === h && o.t > t).length < 2) cairMana(h); } break; }
        case 'jonatas': { const H = h.hab.e, d = h.def.hab.e; if (H.nv && H.sinalCargas !== undefined && H.sinalCargas < d.cargas) { H.sinalRec = (H.sinalRec || 0) + dt; if (H.sinalRec >= d.recarga[H.nv - 1]) { H.sinalRec = 0; H.sinalCargas++; } } if (H.sinalCargas === 0) H.cd = Math.max(H.cd, d.recarga[H.nv - 1] - (H.sinalRec || 0)); break; }
        case 'dalila': if (h.dalilaR2 && t > h.dalilaR2) { h.hab.r.cd = Math.max(0, (h.dalilaRcd || 0) - 10); h.dalilaR2 = 0; } break;
        case 'acabe': { const ativo = h.disfarceAcabeT > t; if (h._disf && !ativo && h.disfarceAcabeT) { h.acabeBonusT = t + 3; h.disfarceAcabeT = 0; } h._disf = ativo; if (h.acabeCarga) { const dt0 = t - h.acabeCarga.t0; if (dt0 > 2.2 || (h.bot && dt0 > (h._botSolta ?? (h._botSolta = .8 + Math.random() * .7)))) { h._botSolta = undefined; soltarFlecha(h); } else if (lento) vx.estrelas(K.posMao(h), 1, [1, .95, .8], .2, .25, .3); } break; }
        case 'golias2': if (h.lamiCarga) { const dt0 = t - h.lamiCarga.t0; if (h.bot && h.lamiAlvo && h.lamiAlvo.vivo) h.olharPara(P(h.lamiAlvo), dt, 10); if (dt0 > 1.9 || (h.bot && dt0 > (h._botSolta ?? (h._botSolta = .7 + Math.random() * .8)))) { h._botSolta = undefined; soltarHaste(h); } else if (lento) vx.poeira(p, .6 + dt0 * .5, [.7, 1, .5], 2, .5); } break;
        case 'hama': if (h.hamaDado) { const dt0 = t - h.hamaDado.t0; const face = faceDado(h.hamaDado); if (lento) vx.brilho(K.posMao(h), COR_FACE[face], .6, .1); if (dt0 > 2 || (h.bot && dt0 > (h._botSolta ?? (h._botSolta = .3 + Math.random() * .9)))) { h._botSolta = undefined; lancarDado(h); } } break;
        case 'daniel': { const L = h.leao; if (L && L.vivo && lento) { if (Math.random() < .3) vx.chamas(P(L), .4, 1, .7, .5, 'tocha'); const al = inimEst(h, P(L), 2.6); for (const u of al) if (!u.dots.some(x => x.leao)) u.dots.push({ dps: 20 + 3 * h.nivel + .1 * h.st.ap, t: 2, fonte: h, mag: true, queima: true, leao: true }); if (h.bot && !L.provoc) { const e = K.heroiInimigoProximo(h, 12); if (e && P(e).distanceTo(P(L)) < 9) L.provoc = { por: e, t: 3 }; } } break; }
      }
      if (h.saraiR && h.bot && h.saraiR.t > t && t > h.saraiR.t - 9.2) { const alvo = [...h.saraiR.marc].find(u => u.vivo && P(u).distanceTo(p) < 12); if (alvo && (t > h.saraiR.t - 6 || alvo.hp / alvo.maxHp < .4)) recast(h, 'r'); }
    }
    // maná do céu
    for (let i = manas.length - 1; i >= 0; i--) { const o = manas[i]; if (o.t <= t) { if (o.ms && o.ms.visible) V().soltarMalha(o.ms); manas.splice(i, 1); continue; } o.y = Math.max(.35, o.y - dt * 7); if (o.ms) { o.ms.position.set(o.p.x, o.y, o.p.z); o.ms.rotation.y += dt * 2; }
      if (o.y > .4) continue; const h = o.dono; const a = K.herois.find(x => x.vivo && x.time === h.time && P(x).distanceTo(o.p) < 1.4); if (a) { pegarMana(o, a); continue; }
      if (h.vivo && lento && !o.voando) { let al = null, pior = .7; for (const x of aliadosH(h, P(h), 6, false)) { const f = x.hp / x.maxHp; if (f < pior) { pior = f; al = x; } } if (al && P(h).distanceTo(o.p) < 8) { o.voando = true; const a0 = vec(o.p.x, .4, o.p.z); efeito(.4, (e) => { const k = Math.min(1, e.t / .4); if (o.ms) o.ms.position.lerpVectors(a0, yv(P(al), 1.2), k).y += Math.sin(k * Math.PI) * 1.5; if (k >= 1) { if (al.vivo) pegarMana(o, al); else o.t = 0; return false; } return true; }); } } }
    if (!lento) return;
    // brasas acesas (labareda pequena no corpo)
    for (const u of queimando) { if (!u.vivo || !(u.brasa && u.brasa.t > t) && !u.dots.some(x => x.brasa)) { queimando.delete(u); continue; } vx.chamas(yv(P(u), .2), .35, 1, .6 + .2 * brasas(u), .5, 'tocha'); }
    // fios do tear da Dalila
    for (const u of amarrados()) { const td = u.tearDalila; if (!u.vivo || td.t < t) { u.tearDalila = null; continue; } const L = P(u).distanceTo(td.pino); if (Math.random() < .5) { const k = Math.random(); vx.emit('det', yv(td.pino.clone().lerp(P(u), k), .5 + k * .7), { q0: V() ? V().D.fio_cabelo ?? 0 : 0, vida: .25, t0: .25, t1: .2, cor: [1, .75, .9] }); }
      if (L > 3 && !td.puxou) { td.puxou = true; const dv = td.pino.clone().sub(P(u)).setY(0); K.empurrar(u, dv, L - 1, .25); K.agendar(.25, () => K.enraizar(u, 1)); marcaTxt(u, 'Preso ao tear!'); } }
    // malditos: estase no fim se não foram curados
    for (const u of malditos) { const md = u.maldicao; if (!u.vivo || !md) { malditos.delete(u); continue; } if (md.t <= t) { if (!md.curada && md.atord) K.atordoar(u, md.atord); u.maldicao = null; malditos.delete(u); } }
    // rastreados do Ninrode: pegadas e velocidade dele rumo ao alvo
    for (const h of K.herois) { if (h.id !== 'ninrode' || !h.vivo || !h.ninrodeQ) continue; const q = h.ninrodeQ; if (q.t < t || !q.u.vivo) { h.ninrodeQ = null; continue; } if (Math.random() < .5) vx.decal(P(q.u), 'pegadas_leao_humano', .6, 2, [.8, .5, 1]); const b = h.buffs.find(x => x.rastro); if (b) b.t = .2; else h.buffs.push({ tipo: 'ms', v: .25, t: .2, rastro: true }); }
  }

  // ================= IA dos bots =================
  function ia(h, k, d, alvo, o, F) { const pos = P(h); const dI = alvo ? P(alvo).distanceTo(pos) : 99; const alc = d.alc || d.comp || d.raio || 6; const hpF = h.hp / h.maxHp;
    const comAliado = (a, f) => { h.kitAlvo = a; const r = f(); h.kitAlvo = null; return r; };
    const ferido = (r, lim = .65, eu = true) => { let b = null, pior = lim; for (const a of aliadosH(h, pos, r, eu)) { const f = a.hp / a.maxHp; if (f < pior && (a.combateT < 3 || a === h)) { pior = f; b = a; } } return b; };
    switch (d.ia) {
      case 'proj': case 'linha': case 'cone': case 'area': case 'alvo': case 'armadilha':
        if (h.id === 'herodes' && k === 'e' && hpF < .3) return false;
        if (dI < alc + .3) return F.lancarEm(h, k, alvo); return false;
      case 'alvoHeroi': if (dI < alc) return F.lancarEm(h, k, alvo); return false;
      case 'perto': if (dI < (d.alc || 3) + .4) { h.olharPara(P(alvo), 1, 1); return F.lancarEm(h, k, alvo); } return false;
      case 'dash': case 'dashAlvo': if (dI < (d.dist || 6) + 1.2 && hpF > .4 && !o.sobTorre) { const dir = dirDe(pos, P(alvo)); h.olharPara(P(alvo), 1, 1); h.ctrl.x = dir.x; h.ctrl.y = dir.z; h.ctrl.len = 1; return F.lancarEm(h, k, alvo); } return false;
      case 'recuo': if (dI < 4 || hpF < .35) return F.usarHab(h, k); return false;
      case 'global': if (h.id === 'acabe') { if (K.herois.some(u => u.vivo && u.time !== h.time && u.hp / u.maxHp < .35)) return F.usarHab(h, k); return false; } if (alvo && (alvo.hp / alvo.maxHp < .45 || dI < 14) && dI < 60) return F.lancarEm(h, k, alvo); return false;
      case 'self': { const r = d.raio || 0;
        if (h.id === 'acabe' && k === 'e') return (hpF < .4 && dI < 9) ? F.usarHab(h, k) : false;
        if (h.id === 'noe' && k === 'e') return dI < 9 ? F.usarHab(h, k) : false;
        if (h.id === 'dalila' && k === 'r') return dI < 8 ? F.usarHab(h, k) : false;
        if (h.id === 'sarai' && k === 'w') return (dI < 6 || hpF < .4) ? F.usarHab(h, k) : false;
        if (h.id === 'josue' && k === 'w') return dI < 6 ? F.usarHab(h, k) : false;
        if (h.id === 'golias2' && k === 'w') return dI < 5 ? F.usarHab(h, k) : false;
        if (h.id === 'debora' && k === 'e') return (dI < 8 || hpF < .5) ? F.usarHab(h, k) : false;
        if (h.id === 'golias2' && k === 'e') { if (dI < d.comp + .5) { h.lamiAlvo = alvo; h.olharPara(P(alvo), 1, 1); return F.usarHab(h, k); } return false; }
        if (r ? dI < r * .9 : dI < 7) { h.olharPara(P(alvo), 1, 1); return F.usarHab(h, k); } return false; }
      case 'aliado': { const a = h.id === 'moises' && k === 'e' ? (K.herois.find(x => x.vivo && x !== h && x.time === h.time && x.funcao === 'atirador' && P(x).distanceTo(pos) < alc && P(x).distanceTo(P(alvo)) < 9) || (dI < 6 ? h : null)) : h.id === 'ester' && k === 'r' ? ferido(alc, .45) : ferido(alc, h.id === 'daniel' ? .8 : .6);
        if (!a || (h.id === 'ester' && k === 'r' && !K.herois.some(e => e.vivo && e.time !== h.time && P(e).distanceTo(P(a)) < 6))) return false; return comAliado(a, () => F.usarHab(h, k)); }
      case 'alvoOuAliado': { const a = ferido(alc, .5); if (a && Math.random() < .5) return comAliado(a, () => F.usarHab(h, k)); if (dI < alc) return F.lancarEm(h, k, alvo); if (a) return comAliado(a, () => F.usarHab(h, k)); return false; }
      case 'aliadoCC': { const a = K.herois.find(x => x.vivo && x.time === h.time && P(x).distanceTo(pos) < alc && (K.controlado(x) || x.raiz > 0 || x.lento > .25 || x.silencio > 0)); if (a) return comAliado(a, () => F.usarHab(h, k)); const f = ferido(alc, .35); return f ? comAliado(f, () => F.usarHab(h, k)) : false; }
      case 'aliadoSalto': { const a = ferido(alc, .65, false); if (!a) return false; return comAliado(a, () => F.usarHab(h, k)); }
      case 'sinal': if (alvo && dI > 9 && dI < 28 && Math.random() < .25) return F.lancarEm(h, k, alvo); return false;
      case 'tropa': if (dI < 10 && tropaHama(h, d, null)) return F.usarHab(h, k); return false;
    }
    return false; }

  return { tem, pode, usar, recast, antesUsar, modHab, aoAcertarHab, modDano, aposDano, ataque, alcExtra, dashFim, dashTick, aoMorrer, vis, atualizar, ia, zonas, manas };
}
