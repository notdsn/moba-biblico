// Mapa bíblico v2 (prévia, só com ?mapa=v2): templos, muralhas e portão de Jerusalém, oliveiras e palmeiras do Jarvys.
// Portão destrutível: substitui a torre da base; muralha em volta da fonte + Núcleo; quando o portão cai, a muralha INTEIRA desaba (base aberta por todos os lados).
import * as THREE from 'three';
const BASE = 'models/mapa_biblico/';
const ALT = { templo_luz: 15, templo_trevas: 15, portao_jerusalem: 9, muralha_reta: 5.5, oliveira: 6, palmeira: 9, tenda: 3.6, poco_pedra: 2.2, rochas_deserto: 2.8, jarro_barro: 1.1 };
export const MURO_N = 18, MURO_ABRE = 1; // segmentos da muralha; segmentos vizinhos do portão que caem com ele (de cada lado)
// geometria da muralha de uma base: círculo que envolve fonte e Núcleo, portão voltado para o mapa
export function layoutBase(base, nuc) {
  const f = new THREE.Vector3(nuc.x - base.x, 0, nuc.z - base.z); const dist = f.length(); f.normalize();
  const centro = base.clone().addScaledVector(f, dist * .5); const R = dist * .5 + 7.5;
  return { f, centro, R, ang: Math.atan2(f.x, f.z), portao: centro.clone().addScaledVector(f, R), meiaAbertura: Math.PI / MURO_N * 1.05 };
}
// celular: só a cor (sem mapa normal e de metal/rugosidade): menos memória de textura e menos amostras no shader.
// No iPhone, com a memória de textura estourada, os props do mapa (os últimos a subir) eram desenhados pretos.
function magro(mt) { if (!mt) return; for (const k of ['normalMap', 'metalnessMap', 'roughnessMap', 'aoMap']) { const t = mt[k]; if (t && t !== mt.map) { t.dispose(); if (t.image && t.image.close) t.image.close(); } mt[k] = null; } mt.metalness = 0; mt.roughness = .85; mt.needsUpdate = true; }
export async function mapaV2(scene, loader, POS, MAPA_C, portoes) {
  const lod = matchMedia('(pointer:coarse)').matches ? '_lod1' : '';
  const carregar = (n) => new Promise((ok) => loader.load(BASE + n + lod + '.glb', (g) => ok(g.scene), undefined, () => ok(null)));
  const nomes = Object.keys(ALT); const M = {};
  (await Promise.all(nomes.map(carregar))).forEach((m, i) => { if (!m) return; const b = new THREE.Box3().setFromObject(m); const s = ALT[nomes[i]] / Math.max(.01, b.max.y - b.min.y); m.scale.setScalar(s); m.position.y = -b.min.y * s; m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (lod) magro(o.material); } }); const g = new THREE.Group(); g.add(m); M[nomes[i]] = g; });
  const g = new THREE.Group(); g.name = 'mapaV2'; scene.add(g);
  const por = (n, x, z, rot = 0, esc = 1, pai = g) => { if (!M[n]) return null; const o = M[n].clone(); o.position.set(x, 0, z); o.rotation.y = rot; o.scale.setScalar(esc); pai.add(o); return o; };
  const muros = {};
  for (const [time, base, nuc, tem] of [['luz', POS.baseLuz, POS.nucleoLuz, 'templo_luz'], ['trevas', POS.baseTrevas, POS.nucleoTrevas, 'templo_trevas']]) {
    const L = layoutBase(base, nuc);
    por(tem, base.x - L.f.x * 11, base.z - L.f.z * 11, L.ang); // templo atrás da fonte
    muros[time] = [];
    for (let i = 0; i < MURO_N; i++) { const a = L.ang + i / MURO_N * Math.PI * 2; if (i === 0) continue; // i = 0 é o portão
      const o = por('muralha_reta', L.centro.x + Math.sin(a) * L.R, L.centro.z + Math.cos(a) * L.R, a, .8); if (o) { o.userData.vizinho = Math.min(i, MURO_N - i) <= MURO_ABRE; muros[time].push(o); } }
    const pg = portoes && portoes[time]; if (pg && M.portao_jerusalem) { const o = M.portao_jerusalem.clone(); o.scale.setScalar(.85); pg.add(o); pg.rotation.y = L.ang; }
  }
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
  window.__portaoV2 = { muros, entulho, usado: 0 };
  return g;
}
// queda do portão: afunda e inclina portão + a muralha toda (tween de transform, sem física), poeira curta e entulho estático
export function derrubarPortao(time, e, POS, fx, agendar, efeitos) {
  const S = window.__portaoV2; const base = time === 'luz' ? POS.baseLuz : POS.baseTrevas, nuc = time === 'luz' ? POS.nucleoLuz : POS.nucleoTrevas; const L = layoutBase(base, nuc);
  // a muralha INTEIRA cai junto: onda que sai do portão e dá a volta (atraso por ângulo), tween de transform, sem física
  const pecas = [e.obj, ...(S ? S.muros[time] : [])];
  const ang = (o) => { let a = Math.atan2(o.position.x - L.centro.x, o.position.z - L.centro.z) - L.ang; a = Math.atan2(Math.sin(a), Math.cos(a)); return Math.abs(a) / Math.PI; };
  const ini = pecas.map(o => ({ o, d: o === e.obj ? 0 : ang(o) * .9, y: o.position.y, rx: o.rotation.x, rz: o.rotation.z, sy: o.scale.y, tx: (Math.random() - .5) * .5, tz: (Math.random() - .5) * .5 }));
  efeitos.push({ t: 0, vida: 2.05, up: (ef) => { for (const p of ini) { if (!p.o.visible) continue; const k = Math.max(0, Math.min(1, (ef.t - p.d) / 1.0)), q = k * k; p.o.position.y = p.y - q * 4.5; p.o.rotation.x = p.rx + p.tx * q; p.o.rotation.z = p.rz + p.tz * q; p.o.scale.y = p.sy * (1 - .45 * q); if (k >= 1) p.o.visible = false; } return ef.t < ef.vida; } });
  // poeira: poucas partículas do sistema já existente (sem material novo), com o mesmo atraso da onda
  for (const p of ini) { const w = new THREE.Vector3(); p.o.getWorldPosition(w); agendar(p.d + .1, () => { for (let j = 0; j < (p.o === e.obj ? 14 : 5); j++) fx.emit(w.x + (Math.random() - .5) * 5, .4 + Math.random() * 2, w.z + (Math.random() - .5) * 5, { vel: [(Math.random() - .5) * 3, 1 + Math.random() * 2, (Math.random() - .5) * 3], cor: [.62, .55, .44], vida: 1.4 + Math.random() * .6, t0: 1.6, t1: 2.6, alpha: .55, drag: 1.2 }); }); }
  // entulho: reposiciona instâncias já existentes (1 draw call, nenhum shader novo)
  // entulho: reposiciona instâncias já existentes (1 draw call, nenhum shader novo), 4 pedras por trecho conforme a onda chega nele
  if (S) { const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), v = new THREE.Vector3();
    for (const p of ini) agendar(p.d + .9, () => { const n = p.o === e.obj ? 8 : 4; for (let i = 0; i < n; i++) { p.o.getWorldPosition(v); v.x += (Math.random() - .5) * 4; v.z += (Math.random() - .5) * 4; q.setFromEuler(new THREE.Euler(Math.random() * 3, Math.random() * 3, Math.random() * 3)); const s = .6 + Math.random() * .9; sc.set(s, s * .7, s); v.y = s * .2; m4.compose(v, q, sc); S.entulho.setMatrixAt(S.usado++ % S.entulho.count, m4); } S.entulho.instanceMatrix.needsUpdate = true; p.o.userData.caiu = true; }); }
}
