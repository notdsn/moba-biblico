// Selva estilo Wild Rift: acampamentos, objetivos, bônus, IA de caçador e pings.
// Modelos Tripo sem esqueleto: animação por código (respiração, virar, investida, morte com encolher/sumir).
import * as THREE from 'three';
import { SELVA_ON, CAMPOS } from './selva_mapa.js';
export { SELVA_ON, CAMPOS };

// ---- números (Wild Rift, comprimido para partidas de 8–12 min; ≈ 0,6× dos tempos do WR) ----
// hp/dano relativos à tropa (480 hp, 22 dano) como no WR; crescem por minuto
const TIPOS = {
  sarca:    { nome: 'Sarça Ardente',   mod: 'sarca',  tam: 3.3, hp: 1650, dano: 44, cad: 1.4, arm: 20, rm: 15, ouro: 95, xp: 120, raio: 1.2, alc: 2.4, ico: 0 },
  rocha:    { nome: 'Rocha de Horebe', mod: 'rocha',  tam: 3.3, hp: 1700, dano: 40, cad: 1.4, arm: 24, rm: 12, ouro: 95, xp: 120, raio: 1.2, alc: 2.4, ico: 1 },
  loboG:    { nome: 'Lobo do Deserto', mod: 'lobo',   tam: 2.9, hp: 900,  dano: 34, cad: 1.2, arm: 12, rm: 8,  ouro: 55, xp: 70,  raio: .9,  alc: 1.8, ico: 2 },
  loboP:    { nome: 'Lobinho',         mod: 'lobo',   tam: 1.9, hp: 420,  dano: 14, cad: 1.1, arm: 8,  rm: 5,  ouro: 20, xp: 25,  raio: .6,  alc: 1.5, ico: 2, peq: true },
  gigG:     { nome: 'Gigante de Pedra', mod: 'gigante_pedra', tam: 3.1, hp: 1150, dano: 38, cad: 1.6, arm: 30, rm: 10, ouro: 60, xp: 75, raio: 1.1, alc: 2.2, ico: 3 },
  gigP:     { nome: 'Pedregulho',      mod: 'gigante_pedra', tam: 1.9, hp: 480, dano: 16, cad: 1.5, arm: 18, rm: 8, ouro: 22, xp: 25, raio: .7, alc: 1.6, ico: 3, peq: true },
  dragao:   { nome: 'Dragão',          mod: 'dragao', tam: 5.6, hp: 2700, dano: 70, cad: 1.6, arm: 30, rm: 30, ouro: 80, xp: 160, raio: 1.9, alc: 3.4, ico: 4, obj: true, area: 2.2 },
  beemote:  { nome: 'Beemote',         mod: 'beemote', tam: 4.4, hp: 3600, dano: 60, cad: 1.7, arm: 40, rm: 25, ouro: 150, xp: 200, raio: 1.7, alc: 3.0, ico: 5, obj: true },
  leviata:  { nome: 'Leviatã',         mod: 'leviata', tam: 8.2, hp: 6200, dano: 110, cad: 1.9, arm: 50, rm: 40, ouro: 150, xp: 260, raio: 2.6, alc: 4.4, ico: 6, obj: true, area: 3 },
};
// primeiro nascimento e renascimento (s): buffs WR 2:30 → 90 s; campos pequenos 2:15 → 80 s; Dragão 5:00 → 3:00; Arauto 8:00 → 4:30 (até 7:00); Barão 12:00 → 7:00
const TEMPOS = { sarca: [50, 90], rocha: [50, 90], lobos: [50, 80], gigantes: [50, 80], dragao: [240, 200], beemote: [300, 0], leviata: [600, 240] };
export const T_LEV = 600; // Leviatã aos 10:00 (o Beemote sai do poço)
export const BUFF_DUR = 75, LEV_DUR = 60, OLHO_DUR = 60, DRAG_MAX = 4, LEASH = 10;
const qs = new URLSearchParams(location.search);

let D = null; // dependências vindas do main.js
const monstros = []; const moldes = {}; let pronto = null;
export const selva = { dragoes: { luz: 0, trevas: 0 }, leviata: { luz: 0, trevas: 0 }, ordens: { luz: null, trevas: null }, marcas: [], monstros, ico: null };
const _v = new THREE.Vector3();

function sombraTex() { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); }
let geoSombra, matSombra, geoAnel, matAnel = {};

async function carregarMolde(n) {
  if (moldes[n]) return moldes[n];
  const lo = await D.carregar('selva/' + n + '_lod1').catch(() => null);
  const hi = D.Q.baixa ? null : await D.carregar('selva/' + n).catch(() => null);
  const base = (hi || lo).scene; const bb = new THREE.Box3().setFromObject(base); const sz = bb.getSize(new THREE.Vector3());
  const prep = (g) => { if (!g) return null; const s = g.scene; s.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; if (o.geometry.attributes.color && !o.material.map) o.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8, metalness: .05 }); } }); return s; };
  moldes[n] = { hi: prep(hi), lo: prep(lo), dim: Math.max(sz.x, sz.y, sz.z), alt: sz.y, cx: (bb.min.x + bb.max.x) / 2, cz: (bb.min.z + bb.max.z) / 2, y0: bb.min.y };
  return moldes[n];
}
function clonarMats(root, mats) { root.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); mats.push(o.material); } }); }
// ---- deformação por vértice (sem esqueleto): as partes saem da posição do vértice no modelo normalizado
// (cabeça = frente +z, cauda = trás, asas = |x| grande, pernas = y baixo); parâmetros por espécie
const ANIM = {
  lobo:          { br: 3.2, cab: 1, cau: 1, per: 1, asa: 0, ser: 0, cha: 0 },
  beemote:       { br: 2.2, cab: 1, cau: .6, per: 1, asa: 0, ser: 0, cha: 0 },
  gigante_pedra: { br: 1.6, cab: .6, cau: 0, per: .7, asa: 0, ser: 0, cha: 0, bip: 1 },
  rocha:         { br: 1.5, cab: .5, cau: 0, per: .6, asa: 0, ser: 0, cha: 0, bip: 1 },
  sarca:         { br: 2.6, cab: .5, cau: 0, per: .4, asa: 0, ser: 0, cha: 1, bip: 1 },
  dragao:        { br: 1.8, cab: 1, cau: 1, per: .5, asa: 1, ser: 0, cha: 0 },
  leviata:       { br: 1.2, cab: .6, cau: 0, per: 0, asa: 0, ser: 1, cha: 0 },
};
const VERT_DEF = `
uniform mat4 uN; uniform mat4 uNi; uniform float uT, uAtk, uMove, uHit, uPasso; uniform vec4 uA; uniform vec4 uB;
vec3 deformar(vec3 pos) {
  vec3 q = (uN * vec4(pos, 1.)).xyz; float t = uT;
  float cab = smoothstep(.12, .42, q.z) * uA.y, cau = smoothstep(-.18, -.46, q.z) * uA.z;
  float br = sin(t * uA.x) * .02; q.xz *= 1. + br * (1. - cab); q.y *= 1. + br * .6;
  // cabeça: balanço, preparo (puxa para trás) e bote (estica para a frente)
  q.y += cab * (sin(t * uA.x * 1.5) * .014 - uAtk * .03); q.z += cab * uAtk * .09; q.x += cab * sin(t * .7) * .012;
  // cauda
  q.x += cau * sin(t * 4.2 + q.z * 9.) * .055;
  // pernas: trote em diagonal (quadrúpede) ou passo alternado (bípede)
  float per = (1. - smoothstep(.06, .3, q.y)) * uA.w; float ph = uPasso + (q.x > 0. ? 3.1416 : 0.) + (q.z > 0. && uB.w < .5 ? 3.1416 : 0.);
  q.z += per * sin(ph) * .07 * uMove; q.y += per * max(0., cos(ph)) * .035 * uMove;
  // asas (Dragão)
  float asa = smoothstep(.16, .46, abs(q.x)) * smoothstep(.12, .3, q.y) * uB.x; q.y += asa * (sin(t * 4.6) * .26 + .04) * (abs(q.x) + .1); q.z -= asa * cos(t * 4.6) * .05;
  // corpo de serpente (Leviatã)
  q.x += uB.y * sin(q.z * 9. - t * 2.6) * .04 * (.4 + q.y); q.y += uB.y * sin(q.x * 7. - t * 2.1) * .025;
  // chamas (Sarça)
  q.x += uB.z * sin(q.y * 11. - t * 7.) * .025 * q.y; q.z += uB.z * cos(q.y * 9. - t * 6.) * .02 * q.y;
  // tranco ao levar golpe
  q.z -= uHit * .035; q.x += uHit * sin(t * 70.) * .01;
  return (uNi * vec4(q, 1.)).xyz;
}
`;
function aplicarDeform(root, mod, U) {
  const A = ANIM[mod] || ANIM.lobo; root.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(); const M = moldes[mod];
  const norm = new THREE.Matrix4().makeScale(1 / M.dim, 1 / M.dim, 1 / M.dim).multiply(new THREE.Matrix4().makeTranslation(-M.cx, -M.y0, -M.cz));
  root.traverse(o => { if (!o.isMesh) return; const N = norm.clone().multiply(inv.clone().multiply(o.matrixWorld)); const Ni = N.clone().invert();
    const u = { uN: { value: N }, uNi: { value: Ni }, uA: { value: new THREE.Vector4(A.br, A.cab, A.cau, A.per) }, uB: { value: new THREE.Vector4(A.asa, A.ser, A.cha, A.bip || 0) }, ...U };
    o.material.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, u); sh.vertexShader = VERT_DEF + sh.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = deformar(position);'); };
    o.material.customProgramCacheKey = () => 'selvaDef'; });
}

function criarMonstro(tipo, campo, dx = 0, dz = 0, time = 'neutro') {
  const T = TIPOS[tipo]; const M = moldes[T.mod];
  const obj = new THREE.Group(); const corpo = new THREE.Group(); obj.add(corpo);
  const k = T.tam / M.dim; const mats = [];
  const lod = new THREE.LOD(); const dist = D.Q.mobile ? (T.peq ? 0 : T.obj ? 30 : 25) : (T.peq ? 23 : 34);
  const U = { uT: { value: 0 }, uAtk: { value: 0 }, uMove: { value: 0 }, uHit: { value: 0 }, uPasso: { value: 0 } };
  const montar = (src) => { const g = src.clone(); g.scale.setScalar(k); g.position.set(-M.cx * k, -M.y0 * k, -M.cz * k); clonarMats(g, mats); aplicarDeform(g, T.mod, U); if (!D.Q.mobile && src === M.hi) g.traverse(o => { if (o.isMesh) o.castShadow = true; }); const w = new THREE.Group(); w.add(g); return w; };
  if (M.hi && dist > 0) { lod.addLevel(montar(M.hi), 0); if (M.lo) lod.addLevel(montar(M.lo), dist); } else lod.addLevel(montar(M.lo || M.hi), 0);
  corpo.add(lod);
  const sh = new THREE.Mesh(geoSombra, matSombra); sh.rotation.x = -Math.PI / 2; sh.position.y = .04; sh.scale.setScalar(T.raio * 2.4); obj.add(sh);
  const hx = campo.x + dx, hz = campo.z + dz;
  const m = { tipo: 'monstro', sub: tipo, T, time, nome: T.nome, campo, casa: new THREE.Vector3(hx, 0, hz), obj, corpo, modelo: obj, mats, vivo: false, hp: 1, maxHp: 1, raio: T.raio, st: { arm: T.arm, rm: T.rm },
    alturaBarra: T.alt || Math.min(6.5, T.tam * (T.mod === 'leviata' ? .62 : T.mod === 'dragao' ? .7 : .9)) + .4, flash: 0, estadoM: 'espera', fase: Math.random() * 6, atkCd: 0, investida: 0, morteT: 0, surgeT: 0, alvo: null,
    U, passo: 0, hitT: 0, mixer: { update() {} }, anim: {}, tocar() {}, atualizarFlash() {}, id: 'monstro_' + tipo };
  D.iniciarStatus(m);
  obj.position.copy(m.casa); obj.rotation.y = Math.atan2(-hx + 1, -hz) + (Math.random() - .5) * .6; obj.visible = false;
  D.scene.add(obj); D.unidades.push(m); D.criarBarra(m); m.barra.classList.add('neutro'); if (T.obj) m.barra.classList.add('grande'); if (T.peq) m.barra.classList.add('peq');
  monstros.push(m); return m;
}

export async function iniciarSelva(deps) {
  D = deps; if (!SELVA_ON) return;
  geoSombra = new THREE.PlaneGeometry(1, 1); matSombra = new THREE.MeshBasicMaterial({ map: sombraTex(), transparent: true, depthWrite: false });
  geoAnel = new THREE.RingGeometry(.95, 1.15, 28); geoAnel.rotateX(-Math.PI / 2);
  matAnel.verm = new THREE.MeshBasicMaterial({ color: 0xff5a20, transparent: true, opacity: .75, depthWrite: false }); matAnel.azul = new THREE.MeshBasicMaterial({ color: 0x40a0ff, transparent: true, opacity: .75, depthWrite: false });
  selva.ico = new Image(); selva.ico.src = 'ui/selva_icones.webp';
  pronto = (async () => {
    await Promise.all(['sarca', 'rocha', 'lobo', 'gigante_pedra', 'dragao', 'beemote', 'leviata'].map(carregarMolde));
    for (const c of CAMPOS) {
      const s = c.lado === 'luz' ? -1 : 1;
      if (c.tipo === 'sarca' || c.tipo === 'rocha') c.m = [criarMonstro(c.tipo, c)];
      else if (c.tipo === 'lobos') c.m = [criarMonstro('loboG', c), criarMonstro('loboP', c, 2.2 * s, -1.6), criarMonstro('loboP', c, -2.2 * s, -1.9)];
      else if (c.tipo === 'gigantes') c.m = [criarMonstro('gigG', c), criarMonstro('gigP', c, 2.4 * s, 1.4), criarMonstro('gigP', c, -2.3 * s, 1.6)];
      else if (c.tipo === 'dragao') c.m = [criarMonstro('dragao', c)];
      else { c.m = [criarMonstro('beemote', c), criarMonstro('leviata', c)]; }
      for (const m of c.m) m.nasceEm = TEMPOS[m.sub === 'beemote' ? 'beemote' : m.sub === 'leviata' ? 'leviata' : c.tipo][0];
    }
  })().catch(e => console.warn('[selva]', e));
  window.__selva = { pronto, selva, TIPOS, nascerTudo, invocarBeemote, ping };
  return pronto;
}

// ---- ciclo de vida ----
function nascer(m) {
  const min = D.estado.tempo / 60, k = 1 + min * .075, kd = 1 + min * .08;
  m.maxHp = m.hp = Math.round(m.T.hp * k); m.dano = m.T.dano * kd; m.vivo = true; m.estadoM = 'ocioso'; m.surgeT = .7; m.alvo = null; m.morteT = 0;
  m.obj.position.copy(m.casa); m.obj.visible = true; m.corpo.scale.setScalar(.01); for (const mt of m.mats) { mt.transparent = false; mt.opacity = 1; }
  m.lento = 0; m.dots.length = 0; m.hpAnt = m.hp; m.invulneravel = false;
  if (m.sub === 'dragao') anunciarObj('dragaoSurge'); else if (m.sub === 'beemote') anunciarObj('beemoteSurge'); else if (m.sub === 'leviata') anunciarObj('leviataSurge');
}
export function nascerTudo(t = D.estado.tempo) { for (const m of monstros) if (!m.vivo && m.modo !== 'arauto' && m.nasceEm != null && m.nasceEm <= t + 1e4) { if ((m.sub === 'beemote' && t >= T_LEV) || (m.sub === 'leviata' && t < T_LEV)) continue; nascer(m); m.surgeT = 0; m.corpo.scale.setScalar(1); } }
function anunciarObj(tipo, h) { if (D.anunciar) D.anunciar(tipo, h || null, null); }

// chamado por morrer() no main.js
export function monstroMorreu(m, fonte) {
  m.vivo = false; m.estadoM = 'morrendo'; m.morteT = 0; m.dots.length = 0;
  for (const mt of m.mats) { mt.transparent = true; }
  if (m.modo === 'arauto') { m.nasceEm = null; return; }
  const T = m.T; const r = TEMPOS[m.sub === 'beemote' ? 'beemote' : m.sub === 'leviata' ? 'leviata' : m.campo.tipo === 'lobos' || m.campo.tipo === 'gigantes' ? m.campo.tipo : m.sub][1];
  m.nasceEm = r ? D.estado.tempo + r : null;
  if (m.campo.m && m.campo.m.length > 1 && m.campo.tipo !== 'poco') { const vivos = m.campo.m.filter(x => x !== m && x.vivo); if (vivos.length) m.nasceEm = null; else for (const x of m.campo.m) x.nasceEm = D.estado.tempo + r; } // o campo volta inteiro
  let h = fonte && fonte.tipo === 'heroi' ? fonte : m.ultimoAgressor && m.ultimoAgressor.tipo === 'heroi' ? m.ultimoAgressor : null;
  if (!h) return;
  D.ganharOuro(h, T.ouro, m.obj.position); D.darXp(h, Math.round(T.xp * .75));
  for (const o of D.herois) if (o !== h && o.vivo && o.time === h.time && o.obj.position.distanceTo(m.obj.position) < 14) D.darXp(o, Math.round(T.xp * .35));
  if (h.stats) h.stats.monstros = (h.stats.monstros || 0) + 1;
  const t = D.estado.tempo;
  if (m.sub === 'sarca') darBuff(h, 'verm', t + BUFF_DUR);
  else if (m.sub === 'rocha') darBuff(h, 'azul', t + BUFF_DUR);
  else if (m.sub === 'dragao') { selva.dragoes[h.time] = Math.min(DRAG_MAX, selva.dragoes[h.time] + 1); for (const o of D.herois) if (o.time === h.time && o !== h) D.ganharOuro(o, T.ouro, o.obj.position, true); anunciarObj('dragao', h); feedObjetivo(h, T.ico); }
  else if (m.sub === 'beemote') { h.olhoBeemote = t + OLHO_DUR; anunciarObj('beemote', h); feedObjetivo(h, T.ico); if (h === D.jogador()) D.aviso('Olho do Beemote: toque no botão para invocá-lo contra uma torre'); }
  else if (m.sub === 'leviata') { selva.leviata[h.time] = t + LEV_DUR; for (const o of D.herois) if (o.time === h.time && o !== h) D.ganharOuro(o, T.ouro, o.obj.position, true); for (const u of D.unidades) if (u.vivo && u.tipo === 'minion' && u.time === h.time) fortalecer(u); anunciarObj('leviata', h); feedObjetivo(h, T.ico); }
  if (h.time && selva.ordens[h.time] && selva.ordens[h.time].alvoM === m) selva.ordens[h.time] = null;
}
function darBuff(h, tipo, ate) {
  h['buff_' + tipo] = ate; const k = 'anel_' + tipo;
  if (!h[k]) { h[k] = new THREE.Mesh(geoAnel, matAnel[tipo]); h[k].position.y = tipo === 'verm' ? .08 : .1; h[k].scale.setScalar(tipo === 'verm' ? 1.05 : 1.25); h.obj.add(h[k]); }
  h[k].visible = true; if (h === D.jogador()) D.aviso(tipo === 'verm' ? 'Sarça Ardente: ataques queimam e deixam lento' : 'Rocha de Horebe: mais mana e recargas mais rápidas');
}
export function fortalecer(u) { if (u.levi) return; u.levi = true; u.maxHp *= 1.45; u.hp *= 1.45; u.dano *= 1.5; u.vel *= 1.08; u.obj.scale.multiplyScalar(1.12); }

// ---- ganchos de combate ----
export function multDano(fonte) { return fonte && fonte.tipo === 'heroi' && selva.dragoes[fonte.time] ? 1 + .05 * selva.dragoes[fonte.time] : 1; }
export function aoAtacar(h, alvo) { // Sarça Ardente
  if (!(h.buff_verm > D.estado.tempo) || !alvo.vivo || alvo.tipo === 'torre' || alvo.tipo === 'nucleo') return;
  const q = alvo.dots.find(x => x.sarca && x.fonte === h); const dps = 6 + 2.2 * h.nivel;
  if (q) q.t = 3; else alvo.dots.push({ dps, t: 3, fonte: h, mag: true, sarca: true });
  D.aplicarLento(alvo, .1 + .01 * h.nivel, 1);
}
export function aoCriarMinion(u) { if (!u.invocado && selva.leviata[u.time] > D.estado.tempo) fortalecer(u); }

// ---- Beemote invocado (Arauto) ----
export function invocarBeemote(h) {
  if (!(h.olhoBeemote > D.estado.tempo) || !h.vivo) return false; h.olhoBeemote = 0;
  const ry = h.obj.rotation.y, p = { x: h.obj.position.x + Math.sin(ry) * 2.5, z: h.obj.position.z + Math.cos(ry) * 2.5 }; // solta à frente do herói (como no WR)
  const m = criarMonstro('beemote', { x: p.x, z: p.z, tipo: 'invocado' }, 0, 0, h.time);
  m.modo = 'arauto'; m.dono = h; m.barra.classList.remove('neutro'); nascer(m); m.maxHp = m.hp = 2600 + D.estado.tempo * 3; m.vidaT = 26; m.cargas = 1; m.T = { ...m.T, dano: 150 };
  m.vel = 5; if (h === D.jogador()) D.aviso('O Beemote avança contra a torre inimiga!');
  anunciarObj('beemoteInv', h); return true;
}
// alvo do Beemote invocado: a estrutura inimiga atacável mais perto pela distância real (mapa diagonal). Só as do Meio existem em D.estruturas
// (as torres das rotas laterais são só cenário). Trava no alvo escolhido enquanto ele estiver de pé.
function alvoArauto(m) { if (m.alvoE && m.alvoE.vivo && !D.protegida(m.alvoE)) return m.alvoE; let best = null, bd = 1e9; for (const e of D.estruturas) { if (!e.vivo || e.time === m.time || D.protegida(e) || (e.tipo !== 'torre' && e.tipo !== 'nucleo')) continue; const d = e.obj.position.distanceTo(m.obj.position); if (d < bd) { bd = d; best = e; } } m.alvoE = best; return best; }

// ---- atualização por quadro ----
let tBuff = 0;
export function atualizarSelva(dt, camAlvo) {
  if (!SELVA_ON || !D) return; const t = D.estado.tempo;
  // bônus dos heróis
  tBuff += dt; const passo = tBuff > .25; if (passo) { const dtb = tBuff; tBuff = 0;
    for (const h of D.herois) {
      if (h.anel_verm) h.anel_verm.visible = h.vivo && h.buff_verm > t; if (h.anel_azul) h.anel_azul.visible = h.vivo && h.buff_azul > t;
      if (!h.vivo) { // quem mata o herói rouba os bônus (como no WR)
        const k = h.ultimoAgressor; if (h.buff_verm > t || h.buff_azul > t) { if (k && k.tipo === 'heroi' && k.time !== h.time) { if (h.buff_verm > t) darBuff(k, 'verm', t + BUFF_DUR); if (h.buff_azul > t) darBuff(k, 'azul', t + BUFF_DUR); } h.buff_verm = h.buff_azul = 0; } continue; }
      if (h.buff_azul > t) { h.mana = Math.min(h.manaMax, h.mana + (3 + h.manaMax * .01) * dtb); for (const k of ['q', 'w', 'e', 'r']) if (h.hab[k].cd > 0) h.hab[k].cd = Math.max(0, h.hab[k].cd - dtb * .18); }
    }
    for (const u of D.unidades) if (u.levi && u.vivo && !(selva.leviata[u.time] > t) && u.tipo === 'minion') { /* o bônus fica na tropa até morrer */ }
  }
  for (const m of monstros) atualizarMonstro(m, dt, t, camAlvo);
  for (let i = monstros.length - 1; i >= 0; i--) if (monstros[i].remover) monstros.splice(i, 1);
  for (let i = selva.marcas.length - 1; i >= 0; i--) if (t > selva.marcas[i].ate) selva.marcas.splice(i, 1);
  for (const tm of ['luz', 'trevas']) { const o = selva.ordens[tm]; if (o && t > o.ate) selva.ordens[tm] = null; }
  if ((selva._ia = (selva._ia || 0) + dt) > 3) { selva._ia = 0; iaTime(); }
}

function heroiValido(h, m) { return h && h.vivo && !(h.invis > 0) && h.obj.position.distanceTo(m.casa) < LEASH + 4; }
function atualizarMonstro(m, dt, t, camAlvo) {
  const o = m.obj, p = o.position;
  if (m.estadoM === 'espera') { if (m.nasceEm != null && t >= m.nasceEm && !(m.sub === 'beemote' && t >= T_LEV) && !(m.sub === 'leviata' && t < T_LEV)) nascer(m); else if (m.sub === 'beemote' && t >= T_LEV) m.nasceEm = null; return; }
  if (m.estadoM === 'morrendo') {
    m.morteT += dt; const k = Math.min(1, m.morteT / .9);
    m.corpo.scale.setScalar(1 - k * .75); m.corpo.position.y = -k * .4; m.corpo.rotation.z = k * .35; for (const mt of m.mats) mt.opacity = 1 - k;
    if (k >= 1) { o.visible = false; m.corpo.rotation.z = 0; m.corpo.position.y = 0; m.estadoM = 'espera'; if (m.modo === 'arauto') m.remover = true; }
    return;
  }
  // imune a medo/encanto/empurrão/arremesso (como monstros épicos); sofre lentidão e atordoamento
  m.medo = m.encanto = m.provoc = m.empurrao = null; m.vooT = 0; m.raiz = 0;
  D.atualizarStatus(m, dt); if (!m.vivo) return;
  m.fase += dt; m.atkCd -= dt; if (m.flash > 0) m.flash -= dt;
  const longe = Math.abs(p.x - camAlvo.x) > 30 || Math.abs(p.z - camAlvo.z) > 26;
  // agressão: quem bateu
  if (m.hp < (m.hpAnt ?? m.hp) && m.ultimoAgressor && m.ultimoAgressor.tipo === 'heroi' && m.estadoM !== 'volta') {
    if (m.estadoM === 'ocioso' || !heroiValido(m.alvo, m)) m.alvo = m.ultimoAgressor; m.estadoM = 'luta'; m.lutaT = t;
    if (m.campo.m) for (const x of m.campo.m) if (x !== m && x.vivo && x.estadoM === 'ocioso') { x.estadoM = 'luta'; x.alvo = m.ultimoAgressor; x.lutaT = t; }
  }
  m.hpAnt = m.hp;
  let mv = 0;
  if (m.modo === 'arauto') {
    m.vidaT -= dt; if (m.vidaT <= 0) { m.hp = 0; monstroMorreu(m, null); return; }
    const e = alvoArauto(m); if (e) { const d = e.obj.position.distanceTo(p) - e.raio; virar(m, e.obj.position, dt);
      if (d > 2.2) { mv = mover(m, e.obj.position, m.vel * (1 - m.lento), dt); }
      else if (m.atkCd <= 0) { m.investida = .5; m.atkCd = m.cargas > 0 ? 1.8 : 1.6; const dano = m.cargas > 0 ? e.maxHp * .3 : m.T.dano; m.cargas--; setTimeout(() => { if (m.vivo && e.vivo) D.danificar(m, e, dano); }, 250); } }
  } else if (m.estadoM === 'ocioso') {
    if (m.hp < m.maxHp) m.hp = Math.min(m.maxHp, m.hp + m.maxHp * .05 * dt);
  } else if (m.estadoM === 'luta') {
    if (!heroiValido(m.alvo, m)) { const n = D.herois.find(h => heroiValido(h, m) && h.ultimoAlvoMonstroT && t - h.ultimoAlvoMonstroT < 3); m.alvo = n || null; }
    if (!m.alvo || p.distanceTo(m.casa) > LEASH || t - Math.max(m.lutaT || 0, m.alvo.agrediuMonstroT || 0) > 7) { m.estadoM = 'volta'; m.alvo = null; m.invulneravel = true; }
    else { const a = m.alvo, ap = a.obj.position; const d = ap.distanceTo(p) - a.raio; virar(m, ap, dt);
      if (d > m.T.alc) mv = mover(m, ap, (m.T.obj ? 3.2 : 3.9) * (1 - m.lento), dt);
      else if (m.atkCd <= 0 && !(m.atord > 0)) { m.atkCd = m.T.cad; m.investida = .55; const dano = m.dano; setTimeout(() => { if (!m.vivo || !a.vivo) return;
        if (m.T.area) { for (const h of D.herois) if (h.vivo && h.obj.position.distanceTo(ap) < m.T.area) D.danificar(m, h, dano); } else D.danificar(m, a, dano); }, 260); }
      if (m.lutaT && a.agrediuMonstroT > m.lutaT) m.lutaT = a.agrediuMonstroT; }
  } else if (m.estadoM === 'volta') {
    m.hp = Math.min(m.maxHp, m.hp + m.maxHp * .25 * dt); virar(m, m.casa, dt);
    if (p.distanceTo(m.casa) < .4) { m.estadoM = 'ocioso'; m.invulneravel = false; m.hp = m.maxHp; m.dots.length = 0; } else mv = mover(m, m.casa, 6, dt);
  }
  if (longe && m.surgeT <= 0 && m.investida <= 0) return; // animação só perto da câmera
  // animação por código
  const c = m.corpo; let sc = 1; const U = m.U;
  if (m.surgeT > 0) { m.surgeT -= dt; sc = 1 - Math.max(0, m.surgeT) / .7; sc = sc * sc * (3 - 2 * sc); }
  const resp = Math.sin(m.fase * (m.T.obj ? 1.6 : 2.4));
  const voa = m.sub === 'dragao' || m.sub === 'leviata';
  c.position.y = (voa ? .35 + resp * .25 : Math.abs(Math.sin(m.fase * 7)) * .12 * mv);
  c.scale.set(sc * (1 - resp * .012), sc * (1 + resp * .025), sc * (1 - resp * .012));
  let incl = mv ? .06 : 0, avanco = 0, atk = 0;
  if (m.investida > 0) { m.investida -= dt; const k = 1 - m.investida / .55; // preparo (recua e ergue), bote, recuo
    const f = k < .4 ? -Math.sin(k / .4 * Math.PI / 2) * .6 : k < .6 ? -.6 + (k - .4) / .2 * 1.6 : 1 - (k - .6) / .4 * 1.1; atk = f; avanco = Math.max(-.3, f) * m.T.tam * .1; incl += f * .12; }
  // andar: quique com achata-estica; voltar ao campo é trote (mais rápido)
  const vel = mv ? (m.estadoM === 'volta' ? 1.6 : 1) : 0; m.movK = (m.movK || 0) + (vel - (m.movK || 0)) * Math.min(1, dt * 8);
  m.passo += dt * (6 + 5 * vel) * (m.T.peq ? 1.3 : m.T.obj ? .7 : 1); const quique = Math.sin(m.passo * 2) * m.movK;
  if (!voa) { c.position.y += Math.abs(Math.sin(m.passo)) * .1 * m.movK * (m.T.tam / 2.5); c.scale.y *= 1 + quique * .045; c.scale.x *= 1 - quique * .022; c.scale.z *= 1 - quique * .022; }
  // tranco ao levar golpe
  if (m.flash > .1 && m.hitT <= 0) m.hitT = .22; if (m.hitT > 0) m.hitT -= dt; const hit = Math.max(0, m.hitT / .22); incl -= hit * .1;
  c.position.z = avanco - hit * .12; c.rotation.x = incl;
  U.uT.value = m.fase; U.uAtk.value = atk; U.uMove.value = m.movK; U.uHit.value = hit; U.uPasso.value = m.passo;
  const fl = m.flash > .06 ? .1 : 0; if (fl !== m._fl) { m._fl = fl; for (const mt of m.mats) { if (mt.emissive) { mt.emissive.setRGB(fl, fl * .85, fl * .7); mt.emissiveIntensity = 1; } } } // lampejo curto e fraco (o tranco é a reação principal)
}
function mover(m, alvo, vel, dt) { _v.subVectors(alvo, m.obj.position).setY(0); const L = _v.length(); if (L < .05) return 0; const st = Math.min(L, vel * dt); m.obj.position.addScaledVector(_v, st / L); return 1; }
function virar(m, alvo, dt) { const a = Math.atan2(alvo.x - m.obj.position.x, alvo.z - m.obj.position.z); let d = a - m.obj.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); m.obj.rotation.y += d * Math.min(1, dt * 6); }

// ---- feed / anúncios ----
function feedLinha(html, mal) { const el = document.getElementById('feed'); if (!el) return null; const d = document.createElement('div'); d.className = 'lin ' + (mal ? 'mal' : 'bom'); d.innerHTML = html; el.prepend(d); while (el.children.length > 4) el.lastChild.remove(); setTimeout(() => d.classList.add('sai'), 5500); setTimeout(() => d.remove(), 6200); return d; }
function feedObjetivo(h, ico) {
  const al = h.time === D.jogadorTime(); const d = feedLinha(`<canvas width="48" height="48" class="${al ? 'al' : 'in'}"></canvas><i>›</i><canvas width="48" height="48" class="obj"></canvas>`, !al); if (!d) return;
  const cs = d.querySelectorAll('canvas'); const img = D.retratos[h.id]; if (img) cs[0].getContext('2d').drawImage(img, 0, 0, 48, 48); if (selva.ico.complete) cs[1].getContext('2d').drawImage(selva.ico, ico * 64, 0, 64, 64, 0, 0, 48, 48);
}
export function feedFala(h, txt) { const al = h.time === D.jogadorTime(); const d = feedLinha(`<canvas width="48" height="48" class="${al ? 'al' : 'in'}"></canvas><span class="fala"><b>${h.def.nome}:</b> ${txt}</span>`, !al); if (d) { const img = D.retratos[h.id]; if (img) d.querySelector('canvas').getContext('2d').drawImage(img, 0, 0, 48, 48); d.classList.add('txt'); } }

// ---- pings (roda de comandos) ----
export const PINGS = { dragao: 'Vamos no Dragão', leviata: 'Vamos no Leviatã', recuar: 'Recuar', ajuda: 'Me ajuda' };
const RESP = { dragao: 'Indo para o Dragão!', leviata: 'Vamos pegar o Leviatã!', recuar: 'Certo, recuando.', ajuda: 'Estou indo te ajudar!' };
const POCO = () => CAMPOS.find(c => c.tipo === 'poco'), DRAG = () => CAMPOS.find(c => c.tipo === 'dragao');
export function ping(h, tipo) {
  const t = D.estado.tempo; const pos = tipo === 'dragao' ? new THREE.Vector3(DRAG().x, 0, DRAG().z) : tipo === 'leviata' ? new THREE.Vector3(POCO().x, 0, POCO().z) : h.obj.position.clone();
  selva.ordens[h.time] = { tipo, pos, por: h, ate: t + (tipo === 'recuar' ? 8 : 25) };
  if (h.time === D.jogadorTime()) selva.marcas.push({ tipo, pos, ate: t + 6, t0: t });
  feedFala(h, PINGS[tipo] + (tipo === 'ajuda' ? '!' : '!')); D.som('ping', null, .6);
  for (const o of D.herois) if (o !== h && o.bot && o.time === h.time && o.vivo) setTimeout(() => { if (o.vivo) feedFala(o, RESP[tipo]); }, 700);
}
function iaTime() { // bots se agrupam para objetivos por conta própria (o time do jogador segue os pings dele)
  const t = D.estado.tempo;
  for (const tm of ['luz', 'trevas']) {
    const hs = D.herois.filter(h => h.time === tm); if (!hs.length || hs.some(h => !h.bot) || selva.ordens[tm]) continue;
    const vivos = hs.filter(h => h.vivo && h.hp > h.maxHp * .55); if (vivos.length < hs.length) continue; const nv = vivos.reduce((s, h) => s + h.nivel, 0) / vivos.length;
    const dr = monstros.find(m => m.sub === 'dragao' && m.vivo), lv = monstros.find(m => m.sub === 'leviata' && m.vivo);
    const tipo = lv && nv >= 9 && Math.random() < .5 ? 'leviata' : dr && nv >= 5 && Math.random() < .4 ? 'dragao' : null;
    if (tipo) { const h = hs[0]; selva.ordens[tm] = { tipo, pos: (tipo === 'dragao' ? dr : lv).casa.clone(), por: h, ate: t + 25, auto: true }; if (Math.random() < .5) feedFala(h, PINGS[tipo] + '!'); }
  }
}

// ---- IA de herói (caçador, meio, pings, disputa de objetivos) ----
function alvoVivo(sub) { return monstros.find(m => m.sub === sub && m.vivo && m.estadoM !== 'morrendo'); }
function lutarMonstro(h, m, dt) {
  h.forcarAlvo = m; const d = m.obj.position.distanceTo(h.obj.position) - m.raio;
  if (d > h.alcance) D.mover2(h, m.obj.position); else { D.atacar(h); for (const k of ['q', 'w', 'e']) { const H = h.hab[k], dd = h.def.hab[k]; if (H.nv && H.cd <= 0 && h.mana > h.manaMax * .45 && ['proj', 'linha', 'area', 'zona'].includes(dd.tipo) && Math.random() < dt * 1.5) { D.usarHab(h, k); break; } } }
  h.ultimoAlvoMonstroT = D.estado.tempo;
}
export function botSelva(h, dt, c) {
  if (!SELVA_ON || !D) return false; const t = D.estado.tempo, pos = h.obj.position;
  // disputa: inimigo batendo no Dragão/Leviatã perto → vai contestar
  const cac = h.funcao === 'selva' ? h : D.herois.find(x => x !== h && x.time === h.time && x.funcao === 'selva' && x.vivo);
  const cacPerto = (m) => cac && cac !== h && cac.obj.position.distanceTo(m.casa) < 14;
  for (const sub of ['dragao', 'leviata']) { const m = alvoVivo(sub); if (!m || m.estadoM !== 'luta' || !m.alvo || m.alvo.time === h.time) continue; if (h.funcao === 'meio' && cac && !cacPerto(m)) continue; if (pos.distanceTo(m.casa) < 34 && c.hpF > .5) { if (c.inim && c.dInim < 9) return false; D.mover2(h, m.casa); return true; } }
  const o = selva.ordens[h.time];
  const segue = o && (o.por !== h || o.auto) && (h.funcao !== 'meio' || !o.por.bot || !cac || (o.tipo !== 'dragao' && o.tipo !== 'leviata') || cacPerto(alvoVivo(o.tipo) || { casa: o.pos }));
  if (segue) {
    if (o.tipo === 'recuar') { const tr = D.estruturas.filter(e => e.vivo && e.time === h.time && e.tipo === 'torre').sort((a, b) => Math.abs(a.obj.position.x - pos.x) - Math.abs(b.obj.position.x - pos.x))[0]; D.mover2(h, tr ? tr.obj.position : D.FONTE[h.time]); return true; }
    if (o.tipo === 'ajuda') { const p = o.por.vivo ? o.por.obj.position : o.pos; if (pos.distanceTo(p) > 5) { D.mover2(h, p); return true; } return false; }
    const m = alvoVivo(o.tipo); if (m && c.hpF > .35) { if (c.inim && c.dInim < 8) return false; if (pos.distanceTo(m.casa) > 7 || o.por.obj.position.distanceTo(m.casa) < 9 || o.auto) { if (pos.distanceTo(m.casa) > m.T.alc + 4) { D.mover2(h, m.casa); return true; } lutarMonstro(h, m, dt); return true; } }
  }
  if (h.funcao === 'selva') {
    // emboscada: inimigo do meio com pouca vida
    for (const e of D.herois) { if (!e.vivo || e.time === h.time || e.invis > 0) continue; const d = e.obj.position.distanceTo(pos); if (e.hp < e.maxHp * .45 && d < 30 && c.hpF > .5 && !torreInimigaPerto(h, e.obj.position)) { h.forcarAlvo = e; if (d > h.alcance + e.raio) D.mover2(h, e.obj.position); else D.atacar(h); if (!h._gank || t - h._gank > 20) { h._gank = t; if (h.time === D.jogadorTime() && h.bot) feedFala(h, 'Emboscada no meio!'); } return true; } }
    const m = campoMaisPerto(h, true); if (m) { if (m.estadoM !== 'luta' && pos.distanceTo(m.obj.position) > m.T.alc + 3) D.mover2(h, m.obj.position); else lutarMonstro(h, m, dt); return true; }
    if (t < 60) { const c0 = CAMPOS.find(k => k.tipo === 'rocha' && k.lado === h.time); D.mover2(h, new THREE.Vector3(c0.x + (h.time === 'luz' ? 3 : -3), 0, c0.z + (c0.z < 0 ? 2 : -2))); return true; }
    return false;
  }
  // meio: caça um pouco quando não há pressão na rota (e só no próprio lado se o time tem caçador)
  if (h.selvaCd > t) return false; const temCacador = D.herois.some(x => x.time === h.time && x !== h && x.funcao === 'selva');
  if (temCacador) { // meio com caçador: fica na rota; só sai quando a onda está empurrada (nenhuma tropa inimiga perto, aliadas perto da torre inimiga)
    const empurrada = !D.unidades.some(u => u.vivo && u.tipo === 'minion' && u.time !== h.time && Math.abs(u.obj.position.x - pos.x) < 26) && D.unidades.some(u => u.vivo && u.tipo === 'minion' && u.time === h.time && torreInimigaPerto(h, u.obj.position));
    if (!empurrada && !(h.jgAlvo && h.jgAlvo.vivo && h.jgAlvo.alvo === h)) { h.jgAlvo = null; return false; }
  }
  if (h.nivel < 3 || c.hpF < .55 || (c.inim && c.dInim < 16) || D.unidades.some(u => u.vivo && u.tipo === 'minion' && u.time !== h.time && u.obj.position.distanceTo(pos) < 14)) { if (h.jgAlvo && h.jgAlvo.vivo && h.jgAlvo.estadoM === 'luta' && h.jgAlvo.alvo === h) { lutarMonstro(h, h.jgAlvo, dt); return true; } h.jgAlvo = null; return false; }
  const m = h.jgAlvo && h.jgAlvo.vivo ? h.jgAlvo : campoMaisPerto(h, false, temCacador ? 16 : 22);
  if (!m) { h.selvaCd = t + 6; return false; }
  h.jgAlvo = m; if (m.estadoM !== 'luta' && pos.distanceTo(m.obj.position) > m.T.alc + 3) D.mover2(h, m.obj.position); else lutarMonstro(h, m, dt);
  return true;
}
function torreInimigaPerto(h, p) { return D.estruturas.some(e => e.vivo && e.tipo === 'torre' && e.time !== h.time && e.obj.position.distanceTo(p) < 11); }
function campoMaisPerto(h, cacador, max = 60) {
  let best = null, bd = max; const pos = h.obj.position, lado = h.time;
  for (const m of monstros) { if (!m.vivo || m.estadoM === 'morrendo' || m.modo === 'arauto') continue; if (m.T.obj) { if (!cacador) continue; if (m.sub === 'dragao' && h.nivel < 5) continue; if (m.sub !== 'dragao' && h.nivel < (m.sub === 'leviata' ? 9 : 6)) continue; }
    if (m.campo.lado && m.campo.lado !== lado && !cacador) continue;
    const d = m.obj.position.distanceTo(pos) + (m.campo.lado && m.campo.lado !== lado ? 12 : 0) + (m.T.peq ? 2 : 0); if (d < bd) { bd = d; best = m; } }
  return best;
}
export function botUsarOlho(h) { if (!(h.olhoBeemote > D.estado.tempo) || !h.vivo) return; const p = h.obj.position; const tr = D.estruturas.find(e => e.vivo && e.tipo === 'torre' && e.time !== h.time && !D.protegida(e) && e.obj.position.distanceTo(p) < 16); if (tr) { h.obj.rotation.y = Math.atan2(tr.obj.position.x - p.x, tr.obj.position.z - p.z); invocarBeemote(h); } } // bot: solta perto da torre inimiga, virado para ela

// ---- minimapa ----
export function desenharSelvaMM(g, mmPos) {
  if (!SELVA_ON || !selva.ico || !selva.ico.complete) return; const t = D.estado.tempo;
  for (const c of CAMPOS) { if (!c.m) continue; const m = c.m.find(x => x.vivo) || (c.tipo === 'poco' ? (t < T_LEV ? c.m[0] : c.m[1]) : c.m[0]); const vivo = m.vivo; const r = m.T.obj ? 10 : 7.5; const [x, y] = mmPos(c.x, c.z);
    g.globalAlpha = vivo ? 1 : .35; g.drawImage(selva.ico, m.T.ico * 64, 0, 64, 64, x - r, y - r, r * 2, r * 2);
    if (!vivo && m.nasceEm != null && m.nasceEm - t < 60 && m.nasceEm > t) { g.globalAlpha = 1; g.fillStyle = '#fff'; g.font = 'bold 10px sans-serif'; g.textAlign = 'center'; g.fillText(Math.ceil(m.nasceEm - t), x, y + 4); } }
  g.globalAlpha = 1;
  for (const mk of selva.marcas) { const [x, y] = mmPos(mk.pos.x, mk.pos.z); const k = ((t - mk.t0) % 1); g.strokeStyle = mk.tipo === 'recuar' ? '#ff5050' : mk.tipo === 'ajuda' ? '#ffd040' : '#6fd0ff'; g.lineWidth = 2.5; g.globalAlpha = 1 - k * .7; g.beginPath(); g.arc(x, y, 7 + k * 10, 0, 7); g.stroke(); g.globalAlpha = 1; g.fillStyle = g.strokeStyle; g.font = 'bold 13px sans-serif'; g.textAlign = 'center'; g.fillText(mk.tipo === 'recuar' ? '✕' : mk.tipo === 'ajuda' ? '!' : '⚑', x, y + 5); }
}
