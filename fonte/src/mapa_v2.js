// Mapa bíblico v2 (prévia, só com ?mapa=v2): templos, muralhas e portão de Jerusalém, oliveiras e palmeiras do Jarvys.
// Portão destrutível: substitui a torre da base; muralha em volta da fonte + Núcleo; quando o portão cai, a muralha INTEIRA desaba (base aberta por todos os lados).
import * as THREE from 'three';
import { ROTA_TOPO, ROTA_BAIXO } from './selva_mapa.js';
const BASE = 'models/mapa_biblico/';
const ALT = { templo_luz: 15, templo_trevas: 15, portao_jerusalem: 9, muralha_reta: 5.5, oliveira: 6, palmeira: 9, tenda: 3.6, poco_pedra: 2.2, rochas_deserto: 2.8, jarro_barro: 1.1 };
export const MURO_N = 18, MURO_ABRE = 1; // segmentos da muralha; segmentos vizinhos do portão que caem com ele (de cada lado)
// geometria da muralha de uma base: círculo que envolve fonte e Núcleo, portão voltado para o mapa
export function layoutBase(base, nuc) {
  const f = new THREE.Vector3(nuc.x - base.x, 0, nuc.z - base.z); const dist = f.length(); f.normalize();
  const centro = base.clone().addScaledVector(f, dist * .5); const R = dist * .5 + 7.5;
  const ang = Math.atan2(f.x, f.z), passo = Math.PI * 2 / MURO_N;
  // portas laterais: o trecho de muralha virado para a estrada do Barão e para a do Dragão (aliados passam; para o inimigo é muralha até cair)
  const portas = {}; for (const [nome, pl] of [['barao', ROTA_TOPO], ['dragao', ROTA_BAIXO]]) { const lista = Math.hypot(pl[0][0] - centro.x, pl[0][1] - centro.z) < Math.hypot(pl[pl.length - 1][0] - centro.x, pl[pl.length - 1][1] - centro.z) ? pl : [...pl].reverse();
    let q = null; for (let k = 0; k < lista.length - 1 && !q; k++) { const [ax, az] = lista[k], [bx, bz] = lista[k + 1]; for (let t = 0; t <= 1; t += .02) { const x = ax + (bx - ax) * t, z = az + (bz - az) * t; if (Math.hypot(x - centro.x, z - centro.z) > R + 3) { q = [x, z]; break; } } }
    let da = Math.atan2(q[0] - centro.x, q[1] - centro.z) - ang; da = Math.atan2(Math.sin(da), Math.cos(da)); let i = Math.round(da / passo); if (i === 0) i = da < 0 ? -1 : 1; i = (i + MURO_N) % MURO_N;
    portas[nome] = { i, a: ang + i * passo }; }
  const meiaPortao = passo * .5 * 1.45; // portão do Meio mais largo (antes 1,05): tropas e heróis travavam na saída
  const aberturas = [{ a: ang, meia: meiaPortao }, ...Object.values(portas).map(p => ({ a: p.a, meia: passo * .5 * .78 }))];
  return { f, centro, R, ang, portao: centro.clone().addScaledVector(f, R), meiaAbertura: meiaPortao, portas, aberturas };
}
// celular: só a cor (sem mapa normal e de metal/rugosidade): menos memória de textura e menos amostras no shader.
// No iPhone, com a memória de textura estourada, os props do mapa (os últimos a subir) eram desenhados pretos.
function magro(mt) { if (!mt) return; for (const k of ['normalMap', 'metalnessMap', 'roughnessMap', 'aoMap']) { const t = mt[k]; if (t && t !== mt.map) { t.dispose(); if (t.image && t.image.close) t.image.close(); } mt[k] = null; } mt.metalness = 0; mt.roughness = .85; paraCanvas(mt.map); mt.needsUpdate = true; }
// o mapa de cor passa de ImageBitmap para canvas (o mesmo caminho das texturas dos heróis, que aparecem certas no iPhone)
function paraCanvas(t) { const im = t && t.image; if (!im || !im.width || im.tagName === 'CANVAS' || t.userData.canvas) return; const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height; cv.getContext('2d').drawImage(im, 0, 0); if (im.close) im.close(); t.image = cv; t.userData.canvas = true; t.needsUpdate = true; }
export async function mapaV2(scene, loader, POS, MAPA_C, portoes, tapa = null) {
  const lod = matchMedia('(pointer:coarse)').matches ? '_lod1' : '';
  const carregar = (n) => new Promise((ok) => loader.load(BASE + n + lod + '.glb', (g) => ok(g.scene), undefined, () => ok(null)));
  const nomes = Object.keys(ALT); const M = {};
  (await Promise.all(nomes.map(carregar))).forEach((m, i) => { if (!m) return; const b = new THREE.Box3().setFromObject(m); const s = ALT[nomes[i]] / Math.max(.01, b.max.y - b.min.y); m.scale.setScalar(s); m.position.y = -b.min.y * s; m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (lod) magro(o.material); } }); const g = new THREE.Group(); g.add(m); M[nomes[i]] = g; });
  const g = new THREE.Group(); g.name = 'mapaV2'; scene.add(g);
  let ESC_PORTA = 1; if (M.portao_jerusalem && M.muralha_reta) { const bp = new THREE.Box3().setFromObject(M.portao_jerusalem), bm = new THREE.Box3().setFromObject(M.muralha_reta); window.__medidasV2 = { portao: bp.getSize(new THREE.Vector3()).toArray().map(v => +v.toFixed(2)), muro: bm.getSize(new THREE.Vector3()).toArray().map(v => +v.toFixed(2)) }; }
  const ALTO = { oliveira: [6, 3], palmeira: [9, 2.5], tenda: [3.6, 2.5], rochas_deserto: [2.8, 1.5], poco_pedra: [2.2, 1.5], jarro_barro: [1.1, .5] }; let tirados = 0;
  const por = (n, x, z, rot = 0, esc = 1, pai = g) => { if (!M[n]) return null; if (tapa && ALTO[n] && tapa(x, z, ALTO[n][0] * esc, ALTO[n][1] * esc)) { tirados++; return null; } const o = M[n].clone(); o.position.set(x, 0, z); o.rotation.y = rot; o.scale.setScalar(esc); pai.add(o); return o; };
  const muros = {};
  for (const [time, base, nuc, tem] of [['luz', POS.baseLuz, POS.nucleoLuz, 'templo_luz'], ['trevas', POS.baseTrevas, POS.nucleoTrevas, 'templo_trevas']]) {
    const L = layoutBase(base, nuc);
    por(tem, base.x - L.f.x * 11, base.z - L.f.z * 11, L.ang); // templo atrás da fonte
    muros[time] = [];
    const passo = Math.PI * 2 / MURO_N;
    const LM = M.muralha_reta ? new THREE.Box3().setFromObject(M.muralha_reta).getSize(new THREE.Vector3()).x : 22; const compM = 2 * L.R * Math.sin(passo / 2) * 1.22 / LM; // escala x: trecho com 1,22x o arco
    const portaI = new Set(Object.values(L.portas).map(p => p.i));
    for (let i = 0; i < MURO_N; i++) { if (i === 0) continue; // i = 0 é o portão
      let a = L.ang + i * passo; const meioT = compM * LM / 2 / L.R; // meio comprimento do trecho, em ângulo
      if (i === 1) a = L.ang + L.meiaAbertura + meioT; else if (i === MURO_N - 1) a = L.ang - L.meiaAbertura - meioT; // os vizinhos do portão do Meio (mais largo) encostam na borda da passagem
      if (portaI.has(i)) { muros[time].push(barreira(a, passo * .5 * 2 * L.R * .8)); continue; } // porta lateral: vão na muralha
      const o = por('muralha_reta', L.centro.x + Math.sin(a) * L.R, L.centro.z + Math.cos(a) * L.R, a, .8); if (o) { o.userData.muro = true; o.scale.x = compM; /* cada trecho do tamanho do seu arco (o modelo inteiro tem ~18 m e tapava as aberturas) */ o.userData.vizinho = Math.min(i, MURO_N - i) <= MURO_ABRE; muros[time].push(o); } }
    // vão (portão do Meio e portas laterais): véu da cor do time — aliado passa, inimigo bate na muralha até ela cair
    function barreira(a, larg) { const cor = time === 'luz' ? 0x7fd0ff : 0xd070ff; const m = new THREE.Mesh(new THREE.PlaneGeometry(larg, 3.2), new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: .16, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })); m.position.set(L.centro.x + Math.sin(a) * L.R, 1.6, L.centro.z + Math.cos(a) * L.R); m.rotation.y = a; m.renderOrder = 2; g.add(m); return m; }
    muros[time].push(barreira(L.ang, 2 * L.R * Math.sin(L.meiaAbertura)));
  }
  // desempenho (iPhone): os trechos de muralha de cada base viram UM InstancedMesh por submalha (antes: 1 draw call por trecho,
  // mais 1 por trecho no mapa de sombra). Cada trecho continua existindo como "proxy" (fora da cena) para a animação da queda.
  for (const time of Object.keys(muros)) { const pecas = muros[time].filter(o => o.userData.muro); if (!pecas.length) continue;
    const tpl = M.muralha_reta; tpl.updateMatrixWorld(true); const subs = []; tpl.traverse(m => { if (m.isMesh) subs.push(m); });
    const ims = subs.map(m => { const geo = m.geometry.clone(); geo.applyMatrix4(m.matrixWorld); const im = new THREE.InstancedMesh(geo, m.material, pecas.length); im.castShadow = true; im.receiveShadow = true; g.add(im); return im; });
    pecas.forEach((o, idx) => { o.updateMatrixWorld(true); for (const im of ims) im.setMatrixAt(idx, o.matrixWorld); g.remove(o); o.userData.inst = ims.map(im => [im, idx]); });
    for (const im of ims) { im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); } }
  // vegetação e props: oliveiras na Luz, palmeiras no Jordão e nas Trevas, tendas de Israel atrás da muralha da Luz, poços de pedra nas margens, rochas do deserto nas bordas
  let sem = 7; const rnd = () => { sem = (sem * 16807) % 2147483647; return sem / 2147483647; };
  for (let i = 0; i < 26; i++) { const x = -70 + rnd() * 140, lim = MAPA_C - Math.abs(x) * .55; const z = (rnd() < .5 ? -1 : 1) * (lim - 4 - rnd() * 6); por(x < 0 ? 'oliveira' : 'palmeira', x, z, rnd() * 6.28, .8 + rnd() * .4); }
  for (let i = 0; i < 8; i++) { const z = (i % 2 ? 1 : -1) * (14 + i * 4); por('palmeira', 1 + (rnd() - .5) * 8 + (rnd() < .5 ? -6 : 6), z, rnd() * 6.28, .9 + rnd() * .3); }
  { const L = layoutBase(POS.baseLuz, POS.nucleoLuz); for (let i = 0; i < 6; i++) { const a = L.ang + Math.PI + (i - 2.5) * .32; const r = L.R + 6 + (i % 2) * 3; por('tenda', L.centro.x + Math.sin(a) * r, L.centro.z + Math.cos(a) * r, a + Math.PI, 1 + rnd() * .2); } }
  for (const [x, z] of [[-9, 22], [11, -24], [-7, -46], [9, 48]]) { por('poco_pedra', x, z, rnd() * 6.28, 1); for (let k = 0; k < 3; k++) { const a = rnd() * 6.28; por('jarro_barro', x + Math.sin(a) * 2.6, z + Math.cos(a) * 2.6, rnd() * 6.28, .8 + rnd() * .5); } } // jarros de barro junto aos poços
  { const L = layoutBase(POS.baseLuz, POS.nucleoLuz); for (let i = 0; i < 5; i++) { const a = L.ang + Math.PI + (i - 2) * .4 + .16; const r = L.R + 7.5; por('jarro_barro', L.centro.x + Math.sin(a) * r, L.centro.z + Math.cos(a) * r, rnd() * 6.28, .8 + rnd() * .4); } } // e entre as tendas
  for (let i = 0; i < 16; i++) { const x = -75 + rnd() * 150, lim = MAPA_C - Math.abs(x) * .55; const z = (rnd() < .5 ? -1 : 1) * (lim - 2 - rnd() * 4); por('rochas_deserto', x, z, rnd() * 6.28, .8 + rnd() * .8); }
  // entulho pré-montado (um InstancedMesh, já compilado no carregamento escondido embaixo do chão): troca na hora da queda
  const geo = new THREE.DodecahedronGeometry(.9, 0); const mat = new THREE.MeshStandardMaterial({ color: 0xb8a888, roughness: .95, flatShading: true });
  const entulho = new THREE.InstancedMesh(geo, mat, 2 * (8 + 4 * (MURO_N - 1))); entulho.frustumCulled = false; entulho.castShadow = false; entulho.receiveShadow = true;
  const m4 = new THREE.Matrix4(); for (let i = 0; i < entulho.count; i++) { m4.makeTranslation(0, -60, 0); entulho.setMatrixAt(i, m4); } scene.add(entulho);
  if (tirados) console.log('[mapa v2] props tirados da frente das rotas:', tirados);
  window.__portaoV2 = { muros, entulho, usado: 0 };
  return g;
}
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
function sincronizar(o) { const L = o.userData.inst; if (!L) return; o.updateMatrix(); for (const [im, i] of L) { im.setMatrixAt(i, o.visible ? o.matrix : ZERO); im.instanceMatrix.needsUpdate = true; } }
// queda do portão: afunda e inclina portão + a muralha toda (tween de transform, sem física), poeira curta e entulho estático
export function derrubarPortao(time, e, POS, fx, agendar, efeitos) {
  const S = window.__portaoV2; const base = time === 'luz' ? POS.baseLuz : POS.baseTrevas, nuc = time === 'luz' ? POS.nucleoLuz : POS.nucleoTrevas; const L = layoutBase(base, nuc);
  // a muralha INTEIRA cai junto: onda que sai do portão e dá a volta (atraso por ângulo), tween de transform, sem física
  const pecas = [e.obj, ...(S ? S.muros[time] : [])];
  const ang = (o) => { let a = Math.atan2(o.position.x - L.centro.x, o.position.z - L.centro.z) - L.ang; a = Math.atan2(Math.sin(a), Math.cos(a)); return Math.abs(a) / Math.PI; };
  const ini = pecas.map(o => ({ o, d: o === e.obj ? 0 : ang(o) * .9, y: o.position.y, rx: o.rotation.x, rz: o.rotation.z, sy: o.scale.y, tx: (Math.random() - .5) * .5, tz: (Math.random() - .5) * .5 }));
  efeitos.push({ t: 0, vida: 2.05, up: (ef) => { for (const p of ini) { if (!p.o.visible) continue; const k = Math.max(0, Math.min(1, (ef.t - p.d) / 1.0)), q = k * k; p.o.position.y = p.y - q * 4.5; p.o.rotation.x = p.rx + p.tx * q; p.o.rotation.z = p.rz + p.tz * q; p.o.scale.y = p.sy * (1 - .45 * q); if (k >= 1) p.o.visible = false; sincronizar(p.o); } return ef.t < ef.vida; } });
  // poeira: poucas partículas do sistema já existente (sem material novo), com o mesmo atraso da onda
  for (const p of ini) { const w = new THREE.Vector3(); p.o.getWorldPosition(w); agendar(p.d + .1, () => { for (let j = 0; j < (p.o === e.obj ? 14 : 5); j++) fx.emit(w.x + (Math.random() - .5) * 5, .4 + Math.random() * 2, w.z + (Math.random() - .5) * 5, { vel: [(Math.random() - .5) * 3, 1 + Math.random() * 2, (Math.random() - .5) * 3], cor: [.62, .55, .44], vida: 1.4 + Math.random() * .6, t0: 1.6, t1: 2.6, alpha: .55, drag: 1.2 }); }); }
  // entulho: reposiciona instâncias já existentes (1 draw call, nenhum shader novo)
  // entulho: reposiciona instâncias já existentes (1 draw call, nenhum shader novo), 4 pedras por trecho conforme a onda chega nele
  if (S) { const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), v = new THREE.Vector3();
    for (const p of ini) agendar(p.d + .9, () => { const n = p.o === e.obj ? 8 : 4; for (let i = 0; i < n; i++) { p.o.getWorldPosition(v); v.x += (Math.random() - .5) * 4; v.z += (Math.random() - .5) * 4; q.setFromEuler(new THREE.Euler(Math.random() * 3, Math.random() * 3, Math.random() * 3)); const s = .6 + Math.random() * .9; sc.set(s, s * .7, s); v.y = s * .2; m4.compose(v, q, sc); S.entulho.setMatrixAt(S.usado++ % S.entulho.count, m4); } S.entulho.instanceMatrix.needsUpdate = true; p.o.userData.caiu = true; }); }
}
