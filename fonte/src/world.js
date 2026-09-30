import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SELVA_ON, SELVA_LARG, SELVA_SUL, distTrilha, distCampo, COVAS, naMuralha, bordaCova, MAPA_WR, MAPA_K, laneZ as laneZK, MAPA_C, MAPA_FOLGA, distLosango, distLateral, TORRES_LATERAIS, ROTA_TOPO, ROTA_BAIXO } from './selva_mapa.js';
export { MAPA_WR };

// ---------- utilidades ----------
export function rng(seed = 1) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const R = rng(7);
const lerp = THREE.MathUtils.lerp, clamp = THREE.MathUtils.clamp, smooth = THREE.MathUtils.smoothstep;

// Traçado da rota (lane): x de -70 a 70, com uma leve curva
export const LANE = MAPA_WR ? { x0: -95, x1: 97, largura: 3.8 } : { x0: -64, x1: 64, largura: 3.8 };
export const laneZ = laneZK; const K = MAPA_K;
// 0 = Luz (ouro), 1 = Trevas (roxo)
export const lado = (x) => smooth(x, -6, 16);

// Proporções inspiradas no Wild Rift (ver ESTUDO-WILDRIFT.md §4): mapa simétrico em torno de x = 1,
// centro → torre externa ≈ torre externa → interna (1 : 0,9), Núcleo logo atrás da interna, fonte atrás do Núcleo.
export const PROP_TORRE = { alcance: 10.5, altura: 9.0, esc: { luz: 1.0, trevas: .735 } };
export const POS = { torreLuz: new THREE.Vector3(-19, 0, 0), torreTrevas: new THREE.Vector3(21, 0, 0), baseLuz: new THREE.Vector3(-58, 0, 0), baseTrevas: new THREE.Vector3(60, 0, 0) };
POS.torreLuz.z = laneZ(POS.torreLuz.x) - 6.2; POS.torreTrevas.z = laneZ(POS.torreTrevas.x) - 6.2;
POS.baseLuz.z = laneZ(POS.baseLuz.x); POS.baseTrevas.z = laneZ(POS.baseTrevas.x);
// torres internas e núcleos
POS.torreLuz2 = new THREE.Vector3(-37, 0, laneZ(-37) - 6.2); POS.torreTrevas2 = new THREE.Vector3(39, 0, laneZ(39) - 6.2);
POS.nucleoLuz = new THREE.Vector3(-47, 0, laneZ(-47)); POS.nucleoTrevas = new THREE.Vector3(49, 0, laneZ(49));
if (MAPA_WR) { // espaçamento do WR no Meio: externa perto do rio, interna, torre da base (inibidor) e Núcleo
  const tz = (x) => laneZ(x) - 1.2; // em cima da estrada do Meio (como no WR); as tropas desviam
  // torres a 18 m uma da outra (alcance 10,5: os círculos não se tocam, como no WR); simetria em volta de x = 1
  const T3 = (x, v) => v.set(x, 0, tz(x));
  T3(-18, POS.torreLuz); T3(20, POS.torreTrevas); T3(-36, POS.torreLuz2); T3(38, POS.torreTrevas2);
  POS.torreLuz3 = T3(-54, new THREE.Vector3()); POS.torreTrevas3 = T3(56, new THREE.Vector3());
  T3(-68, POS.nucleoLuz); POS.nucleoLuz.z = laneZ(-68); T3(70, POS.nucleoTrevas); POS.nucleoTrevas.z = laneZ(70);
  POS.baseLuz.set(-83, 0, laneZ(-83)); POS.baseTrevas.set(85, 0, laneZ(85));
}
// distância à rota mais próxima (Meio + laterais) e relevo do mapa WR (plano dentro do losango, sobe fora dele)
export const distRota = (x, z) => MAPA_WR ? Math.min(Math.abs(z - laneZ(x)), distLateral(x, z)) : Math.abs(z - laneZ(x));
const rioWR = (x, z) => Math.abs(x - 1 - 2.2 * Math.sin(z * .09)); // rio: cruza o mapa na outra diagonal (x ≈ 1)

function canvasTex(w, h, draw, repeat = 1, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// ---------- texturas CC0 (ambientCG) carregadas antes de montar o mundo ----------
export const TEX = {};
export async function carregarTexturas(q) {
  const L = new THREE.TextureLoader();
  // estilo pintado à mão (combina com os modelos do Tripo): texturas repintadas e sem normal map no chão (o relevo vem pintado)
  const dir = q.pintado ? 'tex/pintado/' : 'tex/';
  const nomes = ['grama_d', 'terra_d', 'pedra_d', 'marmore_d', 'obsidiana_d', ...(q.baixa ? [] : q.pintado ? ['marmore_n', 'rocha_n'] : ['grama_n', 'terra_n', 'pedra_n', 'marmore_n', 'rocha_n'])];
  await Promise.all(nomes.map(async (n) => { try { const t = await L.loadAsync((n.endsWith('_d') ? dir : 'tex/') + n + '.jpg'); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = q.mobile ? 2 : 8; if (n.endsWith('_d')) t.colorSpace = THREE.SRGBColorSpace; TEX[n] = t; } catch (e) { console.warn('textura', n, e); } }));
}
function texRep(n, rx, ry = rx) { const t = TEX[n]; if (!t) return null; const c = t.clone(); c.repeat.set(rx, ry); c.needsUpdate = true; return c; }

// ---------- texturas procedurais ----------
function texGrama() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    const r = rng(3);
    for (let i = 0; i < 9000; i++) {
      const x = r() * w, y = r() * h, l = 90 + r() * 90 | 0, a = 0.25 + r() * 0.35;
      g.strokeStyle = `rgba(${l},${l},${l},${a})`; g.lineWidth = 1 + r() * 1.5;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - .5) * 5, y - 3 - r() * 7); g.stroke();
    }
    for (let i = 0; i < 60; i++) { const x = r() * w, y = r() * h, rr = 20 + r() * 60; const gr = g.createRadialGradient(x, y, 0, x, y, rr); const l = r() > .5 ? 255 : 0; gr.addColorStop(0, `rgba(${l},${l},${l},.10)`); gr.addColorStop(1, 'rgba(128,128,128,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
  }, 1);
}
const nMarmore = () => TEX.marmore_n ? { normalMap: texRep('marmore_n', 1.5), normalScale: new THREE.Vector2(.5, .5) } : {};
function matObs(o) { const m = new THREE.MeshStandardMaterial({ ...o, flatShading: true }); if (TEX.obsidiana_d) { m.map = texRep('obsidiana_d', 1); m.color.multiplyScalar(1.6); } if (TEX.rocha_n) { m.normalMap = texRep('rocha_n', 1); m.normalScale.set(.8, .8); } return m; }
function texMarmore() {
  if (TEX.marmore_d) return texRep('marmore_d', 1.5);
  return canvasTex(512, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#fbf7ee'); gr.addColorStop(1, '#ece3d2'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const r = rng(11);
    for (let k = 0; k < 14; k++) {
      let x = r() * w, y = 0; g.strokeStyle = `rgba(${150 + r() * 40 | 0},${130 + r() * 30 | 0},${110 + r() * 30 | 0},${0.18 + r() * 0.25})`; g.lineWidth = 0.6 + r() * 2.2;
      g.beginPath(); g.moveTo(x, y); while (y < h) { x += (r() - .5) * 28; y += 8 + r() * 18; g.lineTo(x, y); } g.stroke();
    }
    g.globalAlpha = .06; for (let i = 0; i < 3000; i++) { g.fillStyle = r() > .5 ? '#fff' : '#b9a88a'; g.fillRect(r() * w, r() * h, 2, 2); }
  }, 1);
}
function texRunas(cor, cor2) {
  return canvasTex(512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.translate(w / 2, h / 2);
    const ring = (r0, lw, a) => { g.strokeStyle = cor; g.globalAlpha = a; g.lineWidth = lw; g.beginPath(); g.arc(0, 0, r0, 0, Math.PI * 2); g.stroke(); };
    g.shadowColor = cor2; g.shadowBlur = 12;
    ring(240, 6, .9); ring(222, 2, .7); ring(150, 3, .6); ring(90, 2, .5);
    const r = rng(5); g.font = 'bold 26px serif'; g.fillStyle = cor; g.globalAlpha = .85; g.textAlign = 'center';
    const glyphs = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
    for (let i = 0; i < 24; i++) { g.save(); g.rotate(i / 24 * Math.PI * 2); g.fillText(glyphs[(r() * glyphs.length) | 0], 0, -180); g.restore(); }
    g.globalAlpha = .5; g.lineWidth = 2; for (let i = 0; i < 6; i++) { g.save(); g.rotate(i / 6 * Math.PI * 2); g.beginPath(); g.moveTo(0, -150); g.lineTo(130, 75); g.stroke(); g.restore(); }
  }, 1, true);
}
export function texBrilho(stops = [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,.55)'], [1, 'rgba(255,255,255,0)']]) {
  return canvasTex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); stops.forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, 1);
}

// ---------- chão ----------
function criarChao(scene, q) {
  const W = MAPA_WR ? 172 * K : 190, H = MAPA_WR ? 172 * K : 120, sx = MAPA_WR ? (q.mobile ? 150 : 230) : q.mobile ? 150 : 220, sz = MAPA_WR ? (q.mobile ? 150 : 230) : q.mobile ? 90 : 130;
  const geo = new THREE.PlaneGeometry(W, H, sx, sz); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, cols = new Float32Array(pos.count * 3), terras = new Float32Array(pos.count);
  const P = q.pintado; // paleta mais quente e saturada no estilo pintado
  const cLuzA = new THREE.Color(P ? '#a9b24a' : '#9dae43'), cLuzB = new THREE.Color(P ? '#d8bd5a' : '#c7b454');
  const cMeioA = new THREE.Color(P ? '#6e9a3a' : '#5d8f38'), cMeioB = new THREE.Color(P ? '#9ab84c' : '#79a347');
  const cTrevA = new THREE.Color(P ? '#46304f' : '#3a2d4a'), cTrevB = new THREE.Color(P ? '#6a3f6c' : '#57365c');
  const cTerraL = new THREE.Color(P ? '#a07446' : '#8a6a45'), cTerraT = new THREE.Color(P ? '#4a3040' : '#3a2a36');
  const c = new THREE.Color(), a = new THREE.Color(), b = new THREE.Color();
  const n2 = (x, z) => Math.sin(x * .21 + Math.sin(z * .13) * 2) * .5 + Math.sin(z * .27 + x * .07) * .5;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const t = lado(x), nn = n2(x, z) * .5 + .5, n3 = Math.sin(x * 1.3 + z * .7) * Math.sin(z * 1.1 - x * .4);
    // grama por lado
    const luzBlend = smooth(x, -40, -8);
    a.copy(cLuzA).lerp(cMeioA, luzBlend); b.copy(cLuzB).lerp(cMeioB, luzBlend);
    c.copy(a).lerp(b, nn);
    const trev = new THREE.Color().copy(cTrevA).lerp(cTrevB, nn);
    c.lerp(trev, t);
    // terra batida ao redor da rota
    const d = distRota(x, z);
    const terra = 1 - smooth(d, LANE.largura - .2, LANE.largura + 2.6 + n3 * .8);
    c.lerp(new THREE.Color().copy(cTerraL).lerp(cTerraT, t), terra * .85);
    let terraF = terra;
    if (SELVA_ON && d > LANE.largura) { // selva: trilhas de terra, clareiras nos acampamentos e poços do rio
      const dt = distTrilha(x, z), [dc, cp] = distCampo(x, z), poco = cp && !cp.lado;
      const tr = (1 - smooth(dt, 1.0, 2.5 + n3 * .6)) * .78, cl = (1 - smooth(dc, poco ? 5.5 : 3.2, poco ? 9 : 6.2 + n3)) * (poco ? .95 : .6);
      const k = Math.max(tr, cl); if (k > terra) { c.lerp(new THREE.Color().copy(cTerraL).lerp(cTerraT, t), k * .85); terraF = k; }
      if (poco && dc < 9) c.lerp(new THREE.Color(cp.tipo === 'dragao' ? '#2e1510' : '#0e3038'), (1 - smooth(dc, 4, 8)) * .75);
      if (cp && cp.tipo === 'sarca' && dc < 5) c.lerp(new THREE.Color('#4a2414'), (1 - smooth(dc, 1.5, 5)) * .5);
      c.multiplyScalar(lerp(1, .88, smooth(d, 7, 12) * (1 - k))); // mata mais fechada
      if (MAPA_WR) { const rv = rioWR(x, z); if (rv < 6 && d > LANE.largura + 1) c.lerp(new THREE.Color(P ? '#3f7a8a' : '#35707e'), (1 - smooth(rv, 2.5, 6)) * .7); } // rio raso
    }
    terras[i] = Math.min(1, terraF * 1.05);
    // escurecer bordas da rota (sombra das pedras) e o horizonte
    c.multiplyScalar(1 - .12 * smooth(d, LANE.largura + 2, LANE.largura + 3.5) * (1 - smooth(d, LANE.largura + 3.5, LANE.largura + 8)));
    c.multiplyScalar(MAPA_WR ? lerp(1, .6, smooth(distLosango(x, z), MAPA_C + 5, MAPA_C + 14)) : lerp(1, .78, smooth(Math.abs(z), 18, 45)));
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    // relevo suave fora da rota
    const h = MAPA_WR ? alturaWR(x, z, n2(x * 1.7, z * 1.3)) : (smooth(d, LANE.largura + 4, LANE.largura + 16) * (0.6 + n2(x * 1.7, z * 1.3) * .6) + smooth(Math.abs(z), 16, 40) * 2.5) * (SELVA_ON ? smooth(d, SELVA_LARG, SELVA_LARG + 8) : 1) + (SELVA_ON ? bordaCova(x, z) : 0);
    pos.setY(i, h * 0.9 - 0.02);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3)); geo.setAttribute('aTerra', new THREE.BufferAttribute(terras, 1)); geo.computeVertexNormals();
  let mat;
  if (TEX.grama_d && TEX.terra_d) {
    // grama e terra batida CC0 misturadas por vértice; as cores por vértice continuam dando o tom de cada lado
    const rx = W / 6, rz = H / 6;
    mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: texRep('grama_d', rx, rz), roughness: .93, metalness: 0 });
    if (TEX.grama_n) { mat.normalMap = texRep('grama_n', rx, rz); mat.normalScale.set(.7, .7); }
    mat.color.setScalar(.42);
    const terraT = texRep('terra_d', 1, 1);
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.mapTerra = { value: terraT };
      sh.vertexShader = 'attribute float aTerra;\nvarying float vTerra;\n' + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n  vTerra = aTerra;');
      sh.fragmentShader = 'uniform sampler2D mapTerra;\nvarying float vTerra;\n' + sh.fragmentShader.replace('#include <map_fragment>', `
        vec4 texG = texture2D(map, vMapUv); vec4 texT = texture2D(mapTerra, vMapUv * .62);
        float macro = texture2D(map, vMapUv * .071).g;
        vec4 sampledDiffuseColor = mix(texG, texT, vTerra); sampledDiffuseColor.rgb *= .8 + .45 * macro;
        diffuseColor *= sampledDiffuseColor;`);
    };
  } else { const tex = texGrama(); tex.repeat.set(W / 7, H / 7); mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: tex, roughness: .95, metalness: 0 }); }
  const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; scene.add(m);
  return m;
}

// Pedras do caminho (instanciadas)
function criarCaminho(scene, q) {
  const base = new THREE.CylinderGeometry(0.5, 0.56, 0.22, 7, 1); base.translate(0, 0.02, 0);
  // chanfro leve: achata a parte de cima com ruído
  const pa = base.attributes.position; for (let i = 0; i < pa.count; i++) { if (pa.getY(i) > .1) { pa.setY(i, pa.getY(i) + (Math.sin(i * 12.9) * .03)); pa.setX(i, pa.getX(i) * .9); pa.setZ(i, pa.getZ(i) * .9); } }
  base.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .82, metalness: 0, flatShading: true });
  if (TEX.pedra_d) { mat.map = texRep('pedra_d', 1); mat.color.setScalar(1.4); mat.flatShading = false; mat.roughness = .78; if (TEX.pedra_n) { mat.normalMap = texRep('pedra_n', 1); mat.normalScale.set(1.2, 1.2); } }
  const passo = q.mobile ? 1.0 : 0.9;
  const pts = [];
  for (let x = LANE.x0 - 6; x < LANE.x1 + 6; x += passo) {
    for (let w = -LANE.largura; w <= LANE.largura; w += passo) {
      const jx = (R() - .5) * passo * .5, jz = (R() - .5) * passo * .5;
      const edge = Math.abs(w) / LANE.largura; if (edge > .82 && R() < (edge - .82) * 4) continue;
      pts.push([x + jx, laneZ(x + jx) + w + jz]);
    }
  }
  if (MAPA_WR) { const pl = q.mobile ? 1.25 : 1.0; // estradas do topo e de baixo: mesmo estilo, passo um pouco maior no celular
    for (const rota of [ROTA_TOPO, ROTA_BAIXO]) for (let i = 0; i < rota.length - 1; i++) { const [ax, az] = rota[i], [bx, bz] = rota[i + 1]; const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L;
      for (let t = 0; t < L; t += pl) for (let w = -LANE.largura; w <= LANE.largura; w += pl) { const edge = Math.abs(w) / LANE.largura; if (edge > .82 && R() < (edge - .82) * 4) continue; const jx = (R() - .5) * pl * .5, jz = (R() - .5) * pl * .5; pts.push([ax + ux * t - uz * w + jx, az + uz * t + ux * w + jz]); } } }
  if (MAPA_WR) { // um InstancedMesh por trecho de 24 x 24: o que está fora da câmera nem é desenhado
    const grupos = new Map(); for (const pt of pts) { const k = Math.floor(pt[0] / 24) + ':' + Math.floor(pt[1] / 24); if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(pt); }
    const m4 = new THREE.Matrix4(), qv = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
    const pedraL = [new THREE.Color('#a8977a'), new THREE.Color('#8f7f64'), new THREE.Color('#b8a888'), new THREE.Color('#7d6e57')], pedraT = [new THREE.Color('#4b4052'), new THREE.Color('#3a3144'), new THREE.Color('#5a4a60'), new THREE.Color('#2e2836')];
    for (const lista of grupos.values()) { const inst = new THREE.InstancedMesh(base, mat, lista.length); inst.receiveShadow = true;
      lista.forEach(([x, z], i) => { const sc = passo * (0.78 + R() * .3); e.set((R() - .5) * .08, R() * Math.PI, (R() - .5) * .08); qv.setFromEuler(e); s.set(sc * (0.85 + R() * .3), 0.7 + R() * .6, sc * (0.85 + R() * .3)); p.set(x, -0.04 + R() * 0.03, z); m4.compose(p, qv, s); inst.setMatrixAt(i, m4); const t = lado(x); col.copy(pedraL[(R() * 4) | 0]).lerp(pedraT[(R() * 4) | 0], t); col.multiplyScalar(0.72 + R() * .22); inst.setColorAt(i, col); });
      inst.computeBoundingSphere(); scene.add(inst); }
    return null; }
  const inst = new THREE.InstancedMesh(base, mat, pts.length); inst.receiveShadow = true;
  const m4 = new THREE.Matrix4(), qv = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
  const pedraL = [new THREE.Color('#a8977a'), new THREE.Color('#8f7f64'), new THREE.Color('#b8a888'), new THREE.Color('#7d6e57')];
  const pedraT = [new THREE.Color('#4b4052'), new THREE.Color('#3a3144'), new THREE.Color('#5a4a60'), new THREE.Color('#2e2836')];
  pts.forEach(([x, z], i) => {
    const sc = passo * (0.78 + R() * .3);
    e.set((R() - .5) * .08, R() * Math.PI, (R() - .5) * .08); qv.setFromEuler(e); s.set(sc * (0.85 + R() * .3), 0.7 + R() * .6, sc * (0.85 + R() * .3)); p.set(x, -0.04 + R() * 0.03, z);
    m4.compose(p, qv, s); inst.setMatrixAt(i, m4);
    const t = lado(x); col.copy(pedraL[(R() * 4) | 0]).lerp(pedraT[(R() * 4) | 0], t); col.multiplyScalar(0.72 + R() * .22); inst.setColorAt(i, col);
  });
  scene.add(inst); return inst;
}

// Tufos de grama instanciados com vento
function criarTufos(scene, q, tempoU) {
  const blade = new THREE.ConeGeometry(0.07, 0.55, 3, 1); blade.translate(0, .27, 0);
  const g = new THREE.BufferGeometry();
  const parts = []; for (let k = 0; k < 5; k++) { const b = blade.clone(); b.rotateZ((Math.random() - .5) * .7); b.rotateY(k / 5 * Math.PI * 2); b.translate(Math.cos(k) * .09, 0, Math.sin(k) * .09); parts.push(b); }
  const merged = mergeGeos(parts);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .9 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uT = tempoU;
    sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 wp = instanceMatrix * vec4(0.,0.,0.,1.);
      float sway = sin(uT*1.8 + wp.x*.35 + wp.z*.2)*0.12*position.y;
      transformed.x += sway; transformed.z += sway*.5;`);
  };
  const N = q.baixa ? 700 : q.mobile ? 1000 : 3200; const inst = new THREE.InstancedMesh(merged, mat, N);
  const m4 = new THREE.Matrix4(), col = new THREE.Color(); let i = 0, guard = 0;
  while (i < N && guard++ < N * 10) {
    const x = (R() - .5) * (MAPA_WR ? 136 * K : 150), z = (R() - .5) * (MAPA_WR ? 136 * K : 60); const d = distRota(x, z); if (d < LANE.largura + 1.5 || (MAPA_WR && distLosango(x, z) > MAPA_C + MAPA_FOLGA)) continue;
    const s = 0.7 + R() * .9; m4.makeRotationY(R() * 6.28); m4.scale(new THREE.Vector3(s, s * (0.8 + R() * .6), s)); m4.setPosition(x, alturaChao(x, z) - .05, z); inst.setMatrixAt(i, m4);
    const t = lado(x); col.set(t > .5 ? '#6b4a7a' : (x < -25 ? '#c9c05a' : '#86b54c')).lerp(new THREE.Color(t > .5 ? '#9a3a6a' : '#e0d070'), R() * .4); inst.setColorAt(i, col); i++;
  }
  inst.count = i; inst.receiveShadow = true; scene.add(inst); return inst;
}
function alturaWR(x, z, n) { const dl = distLosango(x, z); return (smooth(dl, MAPA_C + MAPA_FOLGA + 1, MAPA_C + MAPA_FOLGA + 9) * (2.6 + n * .8) + bordaCova(x, z)); } // bruto: chão = h * .9 - .02
export function alturaChao(x, z) { if (MAPA_WR) { const n = Math.sin(x * 1.7 * .21 + Math.sin(z * 1.3 * .13) * 2) * .5 + Math.sin(z * 1.3 * .27 + x * 1.7 * .07) * .5; return alturaWR(x, z, n) * .9 - .02; } const d = Math.abs(z - laneZ(x)); const n2 = Math.sin(x * 1.7 * .21 + Math.sin(z * 1.3 * .13) * 2) * .5 + Math.sin(z * 1.3 * .27 + x * 1.7 * .07) * .5; return (smooth(d, LANE.largura + 4, LANE.largura + 16) * (0.6 + n2 * .6) + smooth(Math.abs(z), 16, 40) * 2.5) * (SELVA_ON ? smooth(d, SELVA_LARG, SELVA_LARG + 8) : 1) * .9 + (SELVA_ON ? bordaCova(x, z) * .9 : 0) - .02; }

export function mergeGeos(list) {
  let total = 0; list.forEach(g => { g = g.index ? g.toNonIndexed() : g; }); const nl = list.map(g => g.index ? g.toNonIndexed() : g);
  nl.forEach(g => total += g.attributes.position.count);
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3); let o = 0;
  nl.forEach(g => { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; });
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); return out;
}

// ---------- chamas (shader) ----------
export function materialChama(c1, c2, tempoU) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uT: tempoU, c1: { value: new THREE.Color(c1) }, c2: { value: new THREE.Color(c2) }, uI: { value: 2.2 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; vec4 mv = modelViewMatrix*vec4(0.,0.,0.,1.); vec2 sc=vec2(length(modelMatrix[0].xyz),length(modelMatrix[1].xyz)); mv.xy += position.xy*sc; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform float uT; uniform vec3 c1; uniform vec3 c2; uniform float uI; varying vec2 vUv;
      float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);} 
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);} 
      float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p*=2.03;a*=.5;}return v;}
      void main(){ vec2 uv=vUv; float y=uv.y; vec2 p=vec2((uv.x-.5)*2.2, y);
        float nn=fbm(vec2(p.x*2.5, y*3.0-uT*2.6)); 
        float w=(1.0-y)*0.95+0.05; float d=abs(p.x + (nn-.5)*0.6*y)/w; 
        float body=smoothstep(1.0,0.15,d)*smoothstep(1.0,0.35,y+nn*.35)*smoothstep(0.0,0.08,y);
        float core=smoothstep(.55,0.,d)*smoothstep(.75,.1,y+nn*.2);
        vec3 col=mix(c2,c1,core*core)*body*uI + c1*core*core*0.35*body;
        gl_FragColor=vec4(col, body);
      }`
  });
}

// ---------- torres ----------
function torreLuz(q, tempoU, anim) {
  const g = new THREE.Group();
  const mar = new THREE.MeshStandardMaterial({ map: texMarmore(), ...nMarmore(), color: 0xd9d2c4, roughness: .38, metalness: 0.0 });
  const ouro = new THREE.MeshStandardMaterial({ color: 0xffc857, roughness: .28, metalness: 1 });
  const steps = [[3.1, .45], [2.6, .4], [2.15, .35]]; let y = 0;
  steps.forEach(([r, h]) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r * .96, r, h, 8), mar); m.position.y = y + h / 2; y += h; m.castShadow = m.receiveShadow = true; g.add(m); const t = new THREE.Mesh(new THREE.TorusGeometry(r * .97, .05, 6, 8), ouro); t.rotation.x = Math.PI / 2; t.rotation.z = Math.PI / 8; t.position.y = y; g.add(t); });
  // coluna canelada
  const colG = new THREE.CylinderGeometry(0.95, 1.1, 3.8, 48, 8); const cp = colG.attributes.position;
  for (let i = 0; i < cp.count; i++) { const x = cp.getX(i), z = cp.getZ(i); const a = Math.atan2(z, x); const r = Math.hypot(x, z); if (r > .5) { const f = 1 - .06 * Math.pow(Math.abs(Math.cos(a * 8)), .6); cp.setX(i, x * f); cp.setZ(i, z * f); } }
  colG.computeVertexNormals();
  const col = new THREE.Mesh(colG, mar); col.position.y = y + 1.9; col.castShadow = true; g.add(col);
  const anel = (yy, r) => { const t = new THREE.Mesh(new THREE.TorusGeometry(r, .12, 10, 40), ouro); t.rotation.x = Math.PI / 2; t.position.y = yy; t.castShadow = true; g.add(t); };
  anel(y + .15, 1.12); anel(y + 3.65, 1.0);
  y += 3.8;
  // capitel
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.0, .7, 8), mar); cap.position.y = y + .35; cap.castShadow = true; g.add(cap); y += .7;
  // braseiro dourado
  const prof = []; for (let i = 0; i <= 10; i++) { const t = i / 10; prof.push(new THREE.Vector2(0.35 + Math.sin(t * Math.PI * .5) * 1.25, t * 1.1)); }
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(prof, 32), ouro); bowl.position.y = y; bowl.castShadow = true; g.add(bowl);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.6, .1, 8, 40), ouro); rim.rotation.x = Math.PI / 2; rim.position.y = y + 1.1; g.add(rim);
  // asas/lâminas decorativas
  for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.ConeGeometry(.22, 1.8, 4), ouro); const a = k / 4 * Math.PI * 2 + Math.PI / 4; b.position.set(Math.cos(a) * 1.55, y + .9, Math.sin(a) * 1.55); b.rotation.z = -Math.cos(a) * .5; b.rotation.x = Math.sin(a) * .5; g.add(b); }
  const fy = y + .9;
  // chama azul
  const chamaMat = materialChama('#a8f0ff', '#0a3cff', tempoU); chamaMat.uniforms.uI.value = 1.5;
  const quad = new THREE.PlaneGeometry(1, 1); quad.translate(0, .5, 0);
  const ch1 = new THREE.Mesh(quad, chamaMat); ch1.scale.set(2.0, 4.6, 1); ch1.position.y = fy; g.add(ch1);
  const mat2 = materialChama('#5ab8ff', '#1a1aff', tempoU); mat2.uniforms.uI.value = .9;
  const ch2 = new THREE.Mesh(quad, mat2); ch2.scale.set(3.4, 3.0, 1); ch2.position.y = fy - .1; g.add(ch2);
  ch1.renderOrder = ch2.renderOrder = 5;
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: texBrilho(), color: 0x4aa8ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .8 })); glow.scale.set(4.5, 4.5, 1); glow.position.y = fy + 1.2; glow.material.opacity = .3; g.add(glow);
  const luz = new THREE.PointLight(0x5ab0ff, 18, 18, 1.6); luz.position.y = fy + 1.5; g.add(luz);
  // anéis flutuantes
  const aneis = new THREE.Group(); aneis.position.y = fy + 1.4; g.add(aneis);
  for (let k = 0; k < 2; k++) { const t = new THREE.Mesh(new THREE.TorusGeometry(2.1 + k * .4, .05, 6, 64), new THREE.MeshStandardMaterial({ color: 0xffd98a, emissive: 0xffb940, emissiveIntensity: 1.1, metalness: 1, roughness: .3 })); t.rotation.x = Math.PI / 2 + (k ? .35 : -.25); aneis.add(t); }
  anim.push((dt, t) => { aneis.rotation.y += dt * .6; aneis.children[0].rotation.z += dt * .8; aneis.children[1].rotation.z -= dt * .5; aneis.position.y = fy + 1.4 + Math.sin(t * 1.6) * .15; luz.intensity = 16 + Math.sin(t * 9) * 2 + Math.sin(t * 23) * 1.5; });
  // círculo de runas no chão
  const runas = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: texRunas('#ffe29a', '#ffb940'), transparent: true, opacity: .35, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffd88a }));
  runas.rotation.x = -Math.PI / 2; runas.position.y = 0.06; g.add(runas);
  anim.push((dt) => { runas.rotation.z += dt * .12; });
  g.userData = { topo: fy + 1.5, raio: 2.6 };
  return g;
}

function torreTrevas(q, tempoU, anim) {
  const g = new THREE.Group();
  const obs = matObs({ color: 0x1a1024, roughness: .16, metalness: .35 });
  const obs2 = matObs({ color: 0x2c1838, roughness: .25, metalness: .3 });
  const veio = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2340, emissiveIntensity: 2.2, roughness: .4 });
  const r = rng(21);
  // base de rochas
  for (let i = 0; i < 12; i++) { const s = .9 + r() * 1.1; const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), i % 3 ? obs : obs2); const a = r() * 6.28, d = 1.2 + r() * 1.6; m.position.set(Math.cos(a) * d, s * .35, Math.sin(a) * d); m.rotation.set(r() * 3, r() * 3, r() * 3); m.scale.y = .7; m.castShadow = m.receiveShadow = true; g.add(m); }
  // garras/espinhos
  const shard = (h, rad, x, z, lean, rotY, mat) => { const geo = new THREE.OctahedronGeometry(1, 0); geo.scale(rad, h, rad); geo.translate(0, h * .9, 0); const m = new THREE.Mesh(geo, mat); m.position.set(x, 0, z); m.rotation.set(0, rotY, 0); m.rotateZ(lean); m.castShadow = true; g.add(m); return m; };
  shard(4.6, 1.0, 0, 0, 0, 0, obs);
  for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; shard(3.2 + r() * 1.4, .55, Math.cos(a) * 1.3, Math.sin(a) * 1.3, .32, -a, k % 2 ? obs : obs2); }
  // veios vermelhos
  for (let k = 0; k < 7; k++) { const a = k / 7 * 6.28 + .3; const v = new THREE.Mesh(new THREE.BoxGeometry(.06, 2.4 + r() * 2, .06), veio); v.position.set(Math.cos(a) * .72, 3 + r(), Math.sin(a) * .72); v.rotation.set((r() - .5) * .4, 0, (r() - .5) * .4); g.add(v); }
  const topo = 9.6;
  // cristal vermelho flutuante
  const cg = new THREE.OctahedronGeometry(1, 0); cg.scale(.9, 1.9, .9);
  const cristal = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ color: 0xff2a44, emissive: 0xff1030, emissiveIntensity: 2.6, roughness: .1, metalness: .1, flatShading: true }));
  cristal.position.y = topo; g.add(cristal);
  const casca = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ color: 0xff3355, transparent: true, opacity: .18, blending: THREE.AdditiveBlending, depthWrite: false })); casca.scale.setScalar(1.35); cristal.add(casca);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: texBrilho(), color: 0xff2a50, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .85 })); glow.scale.set(4.5, 4.5, 1); glow.position.y = topo; glow.material.opacity = .5; g.add(glow);
  const luz = new THREE.PointLight(0xff2a50, 22, 20, 1.6); luz.position.y = topo; g.add(luz);
  if (!q.mobile) { const luz2 = new THREE.PointLight(0x9a3cff, 10, 12, 1.8); luz2.position.set(0, 1.5, 2.5); g.add(luz2); }
  // fragmentos orbitando
  const orb = new THREE.Group(); orb.position.y = topo; g.add(orb);
  for (let k = 0; k < 5; k++) { const f = new THREE.Mesh(new THREE.OctahedronGeometry(.25, 0), cristal.material); const a = k / 5 * 6.28; f.position.set(Math.cos(a) * 2, Math.sin(a * 2) * .4, Math.sin(a) * 2); f.scale.y = 1.8; orb.add(f); }
  cristal.userData.anim = true; anim.push((dt, t) => { cristal.rotation.y += dt * 1.1; cristal.position.y = topo + Math.sin(t * 2) * .25; orb.rotation.y -= dt * .9; luz.intensity = 20 + Math.sin(t * 7) * 3; });
  const runas = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 9.5), new THREE.MeshBasicMaterial({ map: texRunas('#ff4a7a', '#b0206a'), transparent: true, opacity: .6, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xff6a9a }));
  runas.rotation.x = -Math.PI / 2; runas.position.y = 0.06; g.add(runas);
  anim.push((dt) => { runas.rotation.z -= dt * .15; });
  g.userData = { topo, raio: 2.8 };
  return g;
}

// base (nexo) de cada lado — pano de fundo
// Núcleo (alvo final de cada lado)
function nucleoLuz(tempoU, anim, q) {
  const g = new THREE.Group();
  const mar = new THREE.MeshStandardMaterial({ map: texMarmore(), ...nMarmore(), color: 0xe6e0d4, roughness: .35 });
  const ouro = new THREE.MeshStandardMaterial({ color: 0xffc857, roughness: .28, metalness: 1 });
  for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(3.4 - i * .7, 3.6 - i * .7, .4, 8), mar); m.position.y = .2 + i * .4; m.castShadow = m.receiveShadow = true; g.add(m); const t = new THREE.Mesh(new THREE.TorusGeometry(3.45 - i * .7, .05, 5, 8), ouro); t.rotation.x = Math.PI / 2; t.rotation.z = Math.PI / 8; t.position.y = .4 + i * .4; g.add(t); }
  for (let k = 0; k < 4; k++) { const a = k / 4 * 6.28 + .78; const c = new THREE.Mesh(new THREE.CylinderGeometry(.28, .32, 3.2, 12), mar); c.position.set(Math.cos(a) * 2.5, 2.8, Math.sin(a) * 2.5); c.castShadow = true; g.add(c); const cap = new THREE.Mesh(new THREE.BoxGeometry(.8, .3, .8), ouro); cap.position.set(c.position.x, 4.5, c.position.z); g.add(cap); const b = new THREE.Mesh(new THREE.ConeGeometry(.2, .7, 4), ouro); b.position.set(c.position.x, 5, c.position.z); g.add(b); }
  const cg = new THREE.OctahedronGeometry(1.3, 0); cg.scale(1, 1.7, 1);
  const cr = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ color: 0xcff0ff, emissive: 0x4ab0ff, emissiveIntensity: 2.4, roughness: .1, flatShading: true })); cr.position.y = 4.4; g.add(cr);
  const aneis = new THREE.Group(); aneis.position.y = 4.4; g.add(aneis);
  for (let k = 0; k < 2; k++) { const t = new THREE.Mesh(new THREE.TorusGeometry(1.9 + k * .35, .06, 6, 48), new THREE.MeshStandardMaterial({ color: 0xffd98a, emissive: 0xffb940, emissiveIntensity: 1.1, metalness: 1, roughness: .3 })); t.rotation.x = Math.PI / 2 + (k ? .4 : -.3); aneis.add(t); }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: texBrilho(), color: 0x7ac8ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .6 })); glow.scale.set(8, 8, 1); glow.position.y = 4.4; g.add(glow);
  const runas = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshBasicMaterial({ map: texRunas('#bfe8ff', '#4ab0ff'), transparent: true, opacity: .45, depthWrite: false, blending: THREE.AdditiveBlending })); runas.rotation.x = -Math.PI / 2; runas.position.y = .05; g.add(runas);
  cr.userData.anim = true; anim.push((dt, t) => { cr.rotation.y += dt * .8; cr.position.y = 4.4 + Math.sin(t * 1.4) * .25; aneis.rotation.y += dt * .5; aneis.children[0].rotation.z += dt; runas.rotation.z += dt * .1; });
  g.userData = { topo: 4.4, raio: 3.2, cristal: cr };
  return g;
}
function nucleoTrevas(tempoU, anim, q) {
  const g = new THREE.Group(); const obs = matObs({ color: 0x1a1024, roughness: .18, metalness: .35 }); const r = rng(77);
  const veio = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2340, emissiveIntensity: 2.2, roughness: .4 });
  for (let i = 0; i < 10; i++) { const geo = new THREE.OctahedronGeometry(1, 0); const h = 2 + r() * 3.5; geo.scale(.5 + r() * .4, h, .5 + r() * .4); const m = new THREE.Mesh(geo, obs); const a = i / 10 * 6.28, d = 2.4 + r() * .6; m.position.set(Math.cos(a) * d, h * .45, Math.sin(a) * d); m.rotation.set(Math.sin(a) * .35, r() * 3, -Math.cos(a) * .35); m.castShadow = true; g.add(m); }
  const pd = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3, 1, 7), obs); pd.position.y = .5; pd.castShadow = pd.receiveShadow = true; g.add(pd);
  for (let k = 0; k < 7; k++) { const v = new THREE.Mesh(new THREE.BoxGeometry(.08, .9, .08), veio); const a = k / 7 * 6.28; v.position.set(Math.cos(a) * 2.5, .5, Math.sin(a) * 2.5); g.add(v); }
  const cg = new THREE.OctahedronGeometry(1.4, 0); cg.scale(1, 1.8, 1);
  const cr = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ color: 0xff2a44, emissive: 0xff1030, emissiveIntensity: 2.6, flatShading: true })); cr.position.y = 4.6; g.add(cr);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: texBrilho(), color: 0xff2050, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .6 })); glow.scale.set(8, 8, 1); glow.position.y = 4.6; g.add(glow);
  const orb = new THREE.Group(); orb.position.y = 4.6; g.add(orb);
  for (let k = 0; k < 6; k++) { const f = new THREE.Mesh(new THREE.OctahedronGeometry(.28, 0), cr.material); const a = k / 6 * 6.28; f.position.set(Math.cos(a) * 2.1, Math.sin(a * 2) * .4, Math.sin(a) * 2.1); f.scale.y = 1.8; orb.add(f); }
  const runas = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshBasicMaterial({ map: texRunas('#ff4a7a', '#b0206a'), transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending })); runas.rotation.x = -Math.PI / 2; runas.position.y = .05; g.add(runas);
  cr.userData.anim = true; anim.push((dt, t) => { cr.rotation.y -= dt * .9; cr.position.y = 4.6 + Math.sin(t * 1.7) * .25; orb.rotation.y += dt * .8; runas.rotation.z -= dt * .12; });
  g.userData = { topo: 4.6, raio: 3.2, cristal: cr };
  return g;
}
function baseLuz(tempoU, anim, q) {
  const g = new THREE.Group();
  const mar = new THREE.MeshStandardMaterial({ map: texMarmore(), ...nMarmore(), roughness: .6, color: 0xb8b0a4 });
  const ouro = new THREE.MeshStandardMaterial({ color: 0xffc857, roughness: .3, metalness: 1 });
  for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(7 - i * 1.6, 7.4 - i * 1.6, .16, 24), mar); m.position.y = .06 + i * .1; m.receiveShadow = m.castShadow = true; g.add(m); }
  for (let k = 0; k < 8; k++) { const a = k / 8 * 6.28; if (Math.sin(a) > -.3 || Math.cos(a) > .5) continue; const c = new THREE.Mesh(new THREE.CylinderGeometry(.4, .45, 3, 12), mar); c.position.set(Math.cos(a) * 6.2, 1.6, Math.sin(a) * 6.2); c.castShadow = true; g.add(c); const cap = new THREE.Mesh(new THREE.BoxGeometry(1.2, .4, 1.2), ouro); cap.position.set(c.position.x, 3.2, c.position.z); g.add(cap); }
  const cg = new THREE.OctahedronGeometry(1.1, 0); cg.scale(1, 1.6, 1);
  const cr = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ color: 0xbfe8ff, emissive: 0x4ab0ff, emissiveIntensity: 2.2, roughness: .1, flatShading: true })); cr.position.y = 5.2; g.add(cr);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: texBrilho(), color: 0x7ac8ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); glow.scale.set(6, 6, 1); glow.position.y = 5.2; g.add(glow);
  if (!q.mobile) { const l = new THREE.PointLight(0x8fd0ff, 25, 26, 1.5); l.position.y = 5; g.add(l); }
  cr.userData.anim = true; anim.push((dt, t) => { cr.rotation.y += dt * .7; cr.position.y = 5.2 + Math.sin(t * 1.3) * .3; });
  return g;
}
function baseTrevas(tempoU, anim, q) {
  const g = new THREE.Group(); const obs = matObs({ color: 0x1a1024, roughness: .18, metalness: .35 }); const r = rng(33);
  for (let i = 0; i < 16; i++) { const geo = new THREE.OctahedronGeometry(1, 0); const h = 3 + r() * 6; geo.scale(.8 + r() * .6, h, .8 + r() * .6); const m = new THREE.Mesh(geo, obs); const a = Math.PI + r() * 3.14, d = 2.5 + r() * 4.5; m.position.set(Math.cos(a) * d, h * .5, Math.sin(a) * d); m.rotation.set((r() - .5) * .6, r() * 3, (r() - .5) * .6); m.castShadow = true; g.add(m); }
  const cg = new THREE.OctahedronGeometry(1.8, 0); cg.scale(1, 1.7, 1);
  const cr = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ color: 0xff2a44, emissive: 0xff1030, emissiveIntensity: 2.4, flatShading: true })); cr.position.y = 7; g.add(cr);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: texBrilho(), color: 0xff2050, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); glow.scale.set(6, 6, 1); glow.position.y = 7; g.add(glow);
  if (!q.mobile) { const l = new THREE.PointLight(0xff2050, 28, 26, 1.5); l.position.y = 6; g.add(l); }
  cr.userData.anim = true; anim.push((dt, t) => { cr.rotation.y -= dt * .8; cr.position.y = 7 + Math.sin(t * 1.5) * .3; });
  return g;
}


// ---------- props do Tripo (estáticos, sem rig) ----------
// cada modelo é 1 malha + 1 material (PBR com metal 1 + mapa): base normalizada (centro em x/z, pé em y = 0)
const _geoT = new Map(); let _sombraProps = true; // celular: só os heróis projetam sombra de verdade
function geoTripo(src) {
  if (_geoT.has(src)) return _geoT.get(src);
  src.updateMatrixWorld(true); let m = null; src.traverse(o => { if (!m && o.isMesh) m = o; });
  const g = m.geometry.clone(); g.applyMatrix4(m.matrixWorld); g.computeBoundingBox(); const b = g.boundingBox;
  g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2); g.computeBoundingBox(); g.computeBoundingSphere();
  let mat;
  if (g.attributes.color) mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8, metalness: 0 });
  else { mat = m.material.clone(); mat.side = THREE.FrontSide; mat.metalness = Math.min(mat.metalness, .6); mat.envMapIntensity = .7; if (mat.normalMap) mat.normalScale.set(.8, .8); if (mat.map) mat.map.anisotropy = 4; }
  const r = { geo: g, mat, alt: b.max.y - b.min.y, larg: Math.max(b.max.x - b.min.x, b.max.z - b.min.z) }; _geoT.set(src, r); return r;
}
// uma peça grande (torre, Núcleo, fonte): dentro de um grupo marcado "ruina" (achata quando a estrutura cai)
function malhaTripo(src, { altura, largura, cor }) {
  const t = geoTripo(src); const k = altura ? altura / t.alt : largura / t.larg;
  let mat = t.mat; if (cor) { mat = t.mat.clone(); mat.color.set(cor); }
  const mesh = new THREE.Mesh(t.geo, mat); mesh.scale.setScalar(k); mesh.castShadow = _sombraProps; mesh.receiveShadow = true;
  const w = new THREE.Group(); w.add(mesh); w.userData.ruina = true; w.userData.alt = t.alt * k; w.userData.larg = t.larg * k; return w;
}
// muitas cópias (árvores, pedras, colunas): InstancedMesh por trecho do mapa (o trecho fora da câmera é descartado inteiro),
// cor por instância (tom da Luz / das Trevas). Opcional: LOD com cor nos vértices para trechos longe da câmera e
// "sombra barata" (a malha LOD desenhada só no mapa de sombras).
function instanciar(scene, src, lista, { trecho = 26, sombra = true, lod = null, distLOD = 22, distMax = 1e9, lod2 = null, distLOD2 = 1e9, altoSoFundo = false } = {}) {
  const t = geoTripo(src), tl = lod ? geoTripo(lod) : null, tl2 = lod2 ? geoTripo(lod2) : null; const grupos = new Map();
  for (const it of lista) { const k = MAPA_WR ? Math.floor(it.x / trecho) + ':' + Math.floor(it.z / trecho) : Math.floor(it.x / trecho) + (it.z > laneZ(it.x) ? ':n' : ':s'); /* lado de perto da câmera separado: sai da tela inteiro */ if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(it); }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sv = new THREE.Vector3(), c = new THREE.Color(), Y = new THREE.Vector3(0, 1, 0);
  const matSombra = tl ? new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }) : null;
  const fazer = (tt, itens, mat) => { const im = new THREE.InstancedMesh(tt.geo, mat, itens.length);
    itens.forEach((it, i) => { m4.compose(v.set(it.x, it.y, it.z), q.setFromAxisAngle(Y, it.ry), sv.setScalar(it.alt / t.alt)); im.setMatrixAt(i, m4); im.setColorAt(i, c.set(it.cor || '#ffffff')); });
    im.computeBoundingSphere(); im.receiveShadow = true; im.castShadow = false; scene.add(im); return im; };
  const pedacos = [];
  for (const itens of grupos.values()) {
    const hi = fazer(t, itens, t.mat); const cx = itens.reduce((a, b) => a + b.x, 0) / itens.length, cz = itens.reduce((a, b) => a + b.z, 0) / itens.length;
    const p = { hi, lo: null, centro: new THREE.Vector3(cx, 0, cz), perto: itens[0].z > laneZ(itens[0].x) };
    if (tl) { if (tl2) { p.lo2 = fazer(tl2, itens, tl2.mat); p.lo2.visible = false; } p.lo = fazer(tl, itens, tl.mat); p.lo.visible = false; p.lo.castShadow = sombra; if (sombra) { p.ps = fazer(tl, itens, matSombra); p.ps.castShadow = true; p.ps.receiveShadow = false; p.ps.renderOrder = -1; } }
    else hi.castShadow = sombra;
    pedacos.push(p);
  }
  // troca de nível pela distância em x da câmera ao centro do trecho (a sombra barata só existe junto do nível alto)
  const atualizar = (cam) => { for (const p of pedacos) { const d = MAPA_WR ? Math.max(Math.abs(cam.x - p.centro.x), Math.abs(cam.z - p.centro.z)) : Math.abs(cam.x - p.centro.x); if (MAPA_WR) p.perto = (p.centro.x - cam.x) * .707 - (p.centro.z - cam.z) * .707 < -8; /* atrás do foco = borda de baixo da tela */ if (globalThis.__semCull) { p.hi.visible = true; if (p.lo) p.lo.visible = false; if (p.lo2) p.lo2.visible = false; continue; } const fora = d > distMax + trecho / 2; /* além disso a névoa já esconde: nem desenha */
    if (!tl) { p.hi.visible = !fora; continue; } const longe = d > distLOD + trecho / 2 || (altoSoFundo && p.perto), muito = !!p.lo2 && d > distLOD2 + trecho / 2; p.hi.visible = !longe && !fora; p.lo.visible = longe && !muito && !fora; if (p.lo2) p.lo2.visible = muito && !fora; if (p.ps) p.ps.visible = !longe; } };
  return { pedacos, atualizar, n: lista.length };
}
function torreLuzTripo(q, tempoU, anim, src) {
  const g = new THREE.Group(); const w = malhaTripo(src, { largura: 6.8 }); g.add(w); const fy = w.userData.alt + .05;
  // chama azul sobre o santuário (o modelo é baixo e largo: a chama completa a silhueta de ~9 m)
  const quad = new THREE.PlaneGeometry(1, 1); quad.translate(0, .5, 0);
  const m1 = materialChama('#a8f0ff', '#0a3cff', tempoU); m1.uniforms.uI.value = 1.4; const ch1 = new THREE.Mesh(quad, m1); ch1.scale.set(1.5, 3.1, 1); ch1.position.y = fy; g.add(ch1);
  const m2 = materialChama('#5ab8ff', '#1a1aff', tempoU); m2.uniforms.uI.value = .85; const ch2 = new THREE.Mesh(quad, m2); ch2.scale.set(2.5, 2.0, 1); ch2.position.y = fy - .1; g.add(ch2); ch1.renderOrder = ch2.renderOrder = 5;
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: texBrilho(), color: 0x4aa8ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .3 })); glow.scale.set(4, 4, 1); glow.position.y = fy + 1; g.add(glow);
  const luz = new THREE.PointLight(0x5ab0ff, 16, 18, 1.6); luz.position.y = fy + 1.2; g.add(luz);
  const aneis = new THREE.Group(); aneis.position.y = fy + 1.1; g.add(aneis);
  for (let k = 0; k < 2; k++) { const t = new THREE.Mesh(new THREE.TorusGeometry(1.5 + k * .35, .05, 6, 48), new THREE.MeshStandardMaterial({ color: 0xffd98a, emissive: 0xffb940, emissiveIntensity: 1.1, metalness: 1, roughness: .3 })); t.rotation.x = Math.PI / 2 + (k ? .35 : -.25); aneis.add(t); }
  anim.push((dt, t) => { aneis.rotation.y += dt * .6; aneis.children[0].rotation.z += dt * .8; aneis.children[1].rotation.z -= dt * .5; aneis.position.y = fy + 1.1 + Math.sin(t * 1.6) * .15; luz.intensity = 15 + Math.sin(t * 9) * 2; });
  const runas = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: texRunas('#ffe29a', '#ffb940'), transparent: true, opacity: .3, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffd88a }));
  runas.rotation.x = -Math.PI / 2; runas.position.y = .06; g.add(runas); anim.push((dt) => { runas.rotation.z += dt * .12; });
  g.userData = { topo: fy + 1.2, raio: 2.6 }; return g;
}
function torreTrevasTripo(q, tempoU, anim, src) {
  const g = new THREE.Group(); const w = malhaTripo(src, { altura: PROP_TORRE.altura / PROP_TORRE.esc.trevas }); g.add(w); const h = w.userData.alt;
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: texBrilho(), color: 0xff2a50, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .5 })); glow.scale.set(5, 5, 1); glow.position.y = h * .93; g.add(glow);
  const luz = new THREE.PointLight(0xff2a50, 22, 20, 1.6); luz.position.y = h * .9; g.add(luz);
  if (!q.mobile) { const luz2 = new THREE.PointLight(0x9a3cff, 10, 12, 1.8); luz2.position.set(0, 1.5, 2.5); g.add(luz2); }
  anim.push((dt, t) => { luz.intensity = 20 + Math.sin(t * 7) * 3; glow.material.opacity = .42 + Math.sin(t * 3) * .1; });
  const runas = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 9.5), new THREE.MeshBasicMaterial({ map: texRunas('#ff4a7a', '#b0206a'), transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xff6a9a }));
  runas.rotation.x = -Math.PI / 2; runas.position.y = .06; g.add(runas); anim.push((dt) => { runas.rotation.z -= dt * .15; });
  g.userData = { topo: h * .78, raio: 2.8 }; return g; // topo ≈ o da torre antiga: a barra de vida não sai da tela
}
function nucleoTripo(src, time, anim) {
  const g = new THREE.Group(); const w = malhaTripo(src, { largura: 7.4 }); g.add(w); const h = w.userData.alt; const luz = time === 'luz';
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: texBrilho(), color: luz ? 0x7ac8ff : 0xff2050, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .45 })); glow.scale.set(6, 6, 1); glow.position.set(0, h * .5, .6); g.add(glow);
  const runas = new THREE.Mesh(new THREE.PlaneGeometry(10.5, 10.5), new THREE.MeshBasicMaterial({ map: luz ? texRunas('#bfe8ff', '#4ab0ff') : texRunas('#ff4a7a', '#b0206a'), transparent: true, opacity: .45, depthWrite: false, blending: THREE.AdditiveBlending }));
  runas.rotation.x = -Math.PI / 2; runas.position.y = .05; g.add(runas);
  anim.push((dt, t) => { runas.rotation.z += dt * (luz ? .1 : -.12); glow.material.opacity = .38 + Math.sin(t * 2.2) * .1; });
  g.userData = { topo: h * .55, raio: 3.2, barraY: h + 1.1 }; return g;
}
function baseTripo(src, time, anim, q) {
  const g = new THREE.Group(); const luz = time === 'luz';
  const w = malhaTripo(src, { largura: 8.6, cor: luz ? null : '#62526e' }); g.add(w); const h = w.userData.alt;
  if (!luz) w.traverse(o => { if (o.isMesh) { o.material.emissive = new THREE.Color(.035, 0, .03); } });
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: texBrilho(), color: luz ? 0x7ac8ff : 0xff2050, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .55 })); glow.scale.set(6, 6, 1); glow.position.y = h + 1; g.add(glow);
  if (!q.mobile) { const l = new THREE.PointLight(luz ? 0x8fd0ff : 0xff2050, 25, 26, 1.5); l.position.y = h + 1.5; g.add(l); }
  const disco = new THREE.Mesh(new THREE.PlaneGeometry(17, 17), new THREE.MeshBasicMaterial({ map: luz ? texRunas('#bfe8ff', '#4ab0ff') : texRunas('#ff4a7a', '#b0206a'), transparent: true, opacity: .35, depthWrite: false, blending: THREE.AdditiveBlending }));
  disco.rotation.x = -Math.PI / 2; disco.position.y = .05; g.add(disco); anim.push((dt, t) => { disco.rotation.z += dt * .05; glow.material.opacity = .5 + Math.sin(t * 1.4) * .1; });
  return g;
}

// ---------- montagem ----------
// junta as peças estáticas (mesmo material) de uma torre/Núcleo/fonte num só draw call.
// Mantém separadas as partes "altas" (acima de limiar) para a ruína continuar escondendo o topo quando a torre cai.
export function juntarPartes(g, limiar) {
  const baldes = new Map();
  for (const c of [...g.children]) {
    if (!c.isMesh || c.isInstancedMesh || c.isSkinnedMesh || c.userData.anim || !c.material || !c.material.isMeshStandardMaterial) continue;
    const alto = c.position.y > limiar; const k = c.material.uuid + '|' + alto + '|' + c.castShadow + '|' + c.receiveShadow;
    if (!baldes.has(k)) baldes.set(k, { mat: c.material, alto, sombra: c.castShadow, recebe: c.receiveShadow, lista: [] }); baldes.get(k).lista.push(c);
  }
  let antes = 0, depois = 0;
  for (const b of baldes.values()) {
    antes += b.lista.length; if (b.lista.length < 2) { depois += b.lista.length; continue; }
    const semIndice = b.lista.some(c => !c.geometry.index);
    const geos = b.lista.map(c => { c.updateMatrix(); let geo = semIndice && c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone(); for (const a of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(a)) geo.deleteAttribute(a); if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2)); geo.applyMatrix4(c.matrix); return geo; });
    const geo = mergeGeometries(geos, false); if (!geo) { depois += b.lista.length; continue; }
    const y0 = b.alto ? limiar + .01 : 0; geo.translate(0, -y0, 0); geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, b.mat); m.position.y = y0; m.castShadow = b.sombra; m.receiveShadow = b.recebe; m.name = 'junto';
    b.lista.forEach(c => { g.remove(c); c.geometry.dispose(); }); g.add(m); depois++;
  }
  g.userData.juntas = [antes, depois];
}

export function criarMundo(scene, modelos, q, tempoU) {
  const anim = [];
  criarChao(scene, q); criarCaminho(scene, q); criarTufos(scene, q, tempoU);

  // torres externas e internas do mesmo tamanho (como no WR), ~3,2x a altura de um herói (2,8)
  const TP = modelos.tripo || null; _sombraProps = !q.mobile; // props do Tripo (?modelos=antigos: sem eles)
  const torre = (fab, pos, time) => { const t = TP ? (time === 'luz' ? torreLuzTripo(q, tempoU, anim, TP.torre_luz) : torreTrevasTripo(q, tempoU, anim, TP.torre_trevas)) : fab(q, tempoU, anim); const k = PROP_TORRE.esc[time]; t.position.copy(pos); t.scale.setScalar(k); t.userData.topo *= k; t.userData.raio = (time === 'luz' ? 3.1 : 3.4) * k; scene.add(t); return t; };
  const tL = torre(torreLuz, POS.torreLuz, 'luz'), tT = torre(torreTrevas, POS.torreTrevas, 'trevas');
  const tL2 = torre(torreLuz, POS.torreLuz2, 'luz'), tT2 = torre(torreTrevas, POS.torreTrevas2, 'trevas');
  let tL3 = null, tT3 = null;
  if (MAPA_WR) { tL3 = torre(torreLuz, POS.torreLuz3, 'luz'); tT3 = torre(torreTrevas, POS.torreTrevas3, 'trevas');
    for (const t of [tL3, tT3]) { const ls = []; t.traverse(o => { if (o.isPointLight) ls.push(o); }); ls.forEach(l => l.parent.remove(l)); } }
  for (const t of [tL, tT, tL2, tT2, tL3, tT3]) if (t) juntarPartes(t, 2.2);
  const nL = TP ? nucleoTripo(TP.nucleo_luz, 'luz', anim) : nucleoLuz(tempoU, anim, q); nL.position.copy(POS.nucleoLuz); scene.add(nL);
  const nT = TP ? nucleoTripo(TP.nucleo_trevas, 'trevas', anim) : nucleoTrevas(tempoU, anim, q); nT.position.copy(POS.nucleoTrevas); scene.add(nT);
  // Núcleos do Tripo ficam de frente (+Z) para a câmera, como as torres
  const bL = TP ? baseTripo(TP.fonte, 'luz', anim, q) : baseLuz(tempoU, anim, q); bL.position.copy(POS.baseLuz); scene.add(bL);
  const bT = TP ? baseTripo(TP.fonte, 'trevas', anim, q) : baseTrevas(tempoU, anim, q); bT.position.copy(POS.baseTrevas); scene.add(bT);
  juntarPartes(nL, 1.5); juntarPartes(nT, 1.5); juntarPartes(bL, 1e9); juntarPartes(bT, 1e9);

  // vegetação e rochas (modelos KayKit)
  const estatico = new THREE.Group();
  const colocar = (nome, x, z, s, ry = R() * 6.28, sombra = true) => {
    const src = modelos[nome]; if (!src) return; const o = src.clone(true); o.position.set(x, alturaChao(x, z) - .05, z); o.scale.setScalar(s); o.rotation.y = ry;
    o.traverse(m => { if (m.isMesh) { m.castShadow = sombra; m.receiveShadow = true; } }); estatico.add(o); return o;
  };
  const r = rng(99);
  const brilhoTex = texBrilho();
  // cache de materiais recoloridos: mesmo material + mesma cor = um único material (permite juntar as malhas)
  const matCor = new Map();
  const recolorir = (o, cor) => o.traverse(m => { if (!m.isMesh) return; const k = m.material.uuid + cor; if (!matCor.has(k)) { const c = m.material.clone(); c.color.set(cor); matCor.set(k, c); } m.material = matCor.get(k); });
  const arvores = [], pedras = [], colunas = [];
  // muralha de floresta de cada lado da rota
  if (MAPA_WR) { const rb = rng(55); // borda do mapa: 2 anéis de árvores em volta do losango
    for (let k = 0; k < 2; k++) { const dl = MAPA_C + MAPA_FOLGA + 2.5 + k * 5; const n = Math.round(4 * dl * 1.414 / (TP ? 4.2 : 3.2));
      for (let i = 0; i < n; i++) { const a = i / n * 4, lado4 = Math.floor(a), f = a - lado4; const cs = [[1 - dl, 0], [1, -dl], [1 + dl, 0], [1, dl], [1 - dl, 0]]; const [ax, az] = cs[lado4], [bx, bz] = cs[lado4 + 1];
        const x = ax + (bx - ax) * f + (rb() - .5) * 2, z = az + (bz - az) * f + (rb() - .5) * 2; if (Math.hypot(x - POS.baseLuz.x, z - POS.baseLuz.z) < 13 || Math.hypot(x - POS.baseTrevas.x, z - POS.baseTrevas.z) < 13) continue; const t = lado(x);
        if (TP) arvores.push({ x, y: alturaChao(x, z) - .1, z, alt: 7 + rb() * 2.6, ry: rb() * 6.28, cor: t < .45 ? '#f4ffe8' : '#9a78b8' });
        else { const o = colocar(t < .45 ? 'trees_B_large' : 'tree_dead_large', x, z, t < .45 ? 4.4 + rb() : 1.4 + rb() * .4); if (o && t >= .45) recolorir(o, '#6a4a80'); } } } }
  for (let x = -75; x < 78 && !MAPA_WR; x += 3.2) {
    const t = lado(x);
    for (const sgn of [-1, 1]) {
      const zc = laneZ(x);
      for (let k = 0; k < (sgn < 0 ? 3 : 2); k++) {
        const z = zc + sgn * (SELVA_ON ? (sgn > 0 ? SELVA_LARG + 7 : SELVA_LARG + 2.5) + k * 4.5 + r() * 3 : LANE.largura + (sgn > 0 ? 9 : 6.5) + k * 4.5 + r() * 3);
        if (Math.abs(x - POS.torreLuz.x) < 5 && sgn < 0 && k === 0) continue;
        if (Math.abs(x - POS.torreTrevas.x) < 5 && sgn < 0 && k === 0) continue;
        if ((Math.abs(x - POS.torreLuz2.x) < 5 || Math.abs(x - POS.torreTrevas2.x) < 5) && sgn < 0 && k === 0) continue;
        if (TP) { // árvore do Tripo: maior que as antigas, então menos cópias (2 fileiras de cada lado, 3 de cada 4 colunas)
          if (k > 1 || Math.round((x + 75) / 3.2) % 4 === 3) continue; const xx = x + r() * 2, alt = 7 + r() * 2.6;
          const cor = t < .45 ? ['#ffffff', '#f4ffe8', '#fff4dc'][(r() * 3) | 0] : ['#9a78b8', '#8a6aa0', '#a07aa0'][(r() * 3) | 0];
          arvores.push({ x: xx, y: alturaChao(xx, z) - .1, z, alt, ry: r() * 6.28, cor }); continue;
        }
        if (t < .45) {
          const opts = x < -28 ? ['tree_pine_yellow_large', 'trees_B_large', 'tree_pine_yellow_large', 'trees_A_medium'] : ['trees_B_large', 'trees_B_medium', 'trees_A_medium', 'tree_pine_yellow_large'];
          const n = opts[(r() * opts.length) | 0]; const sc = n.startsWith('tree_pine') ? 0.9 + r() * .4 : 4.2 + r() * 1.6; colocar(n, x + r() * 2, z, sc);
        } else {
          const opts = ['tree_dead_large', 'tree_dead_medium', 'tree_pine_orange_medium', 'tree_dead_large'];
          const n = opts[(r() * opts.length) | 0]; const o = colocar(n, x + r() * 2, z, (n.includes('pine') ? .9 : 1.3) + r() * .5);
          if (o && n.includes('pine')) recolorir(o, '#7a4a8a');
        }
      }
    }
  }
  // rochas espalhadas
  for (let i = 0; i < 70; i++) {
    if (TP && i % 3 === 2) { r(); r(); r(); r(); continue; } // pedra do Tripo é maior: 2/3 das pedras
    const x = (r() - .5) * 140, sgn = r() > .5 ? 1 : -1, z = laneZ(x) + sgn * (LANE.largura + 1 + r() * 6);
    const n = ['rock_single_A', 'rock_single_B', 'rock_single_C', 'rock_single_D', 'rock_single_E'][(r() * 5) | 0];
    if (TP) { pedras.push({ x, y: alturaChao(x, z) - .08, z, alt: .9 + r() * 1.5, ry: r() * 6.28, cor: lado(x) > .5 ? '#8a78a8' : '#ffffff' }); continue; }
    const o = colocar(n, x, z, 2.2 + r() * 3.2);
    if (o) recolorir(o, lado(x) > .5 ? '#5a4a70' : '#a89478');
  }
  // selva: bosques e pedras entre as trilhas (as trilhas, clareiras e poços ficam livres)
  const perto = (x, z, r) => [POS.torreLuz, POS.torreTrevas, POS.torreLuz2, POS.torreTrevas2, POS.torreLuz3, POS.torreTrevas3, POS.baseLuz, POS.baseTrevas].some(p => p && Math.hypot(x - p.x, z - p.z) < (p === POS.baseLuz || p === POS.baseTrevas ? 14 : r)) || TORRES_LATERAIS.some(([tx, tz]) => Math.hypot(x - tx, z - tz) < r);
  if (SELVA_ON) { const rs = rng(31); const ZL = MAPA_WR ? MAPA_C : SELVA_LARG - 1;
    const PX = MAPA_WR ? 3.7 : 4.6, PZ = MAPA_WR ? 3.6 : 4.4; // mapa WR: mata mais fechada (paredes de mata entre as trilhas)
    for (let x = -58 * K; x <= 60 * K; x += PX) for (let zz = -ZL; zz <= (MAPA_WR ? MAPA_C : SELVA_SUL - 1); zz += PZ) {
      const xx = x + (rs() - .5) * 2.4, z = (MAPA_WR ? 0 : laneZ(xx)) + zz + (rs() - .5) * 2.2, d = MAPA_WR ? distRota(xx, z) : Math.abs(zz), q = rs(), q2 = rs();
      if (d < LANE.largura + 5 || distTrilha(xx, z) < 4.2 || distCampo(xx, z)[0] < (distCampo(xx, z)[1].lado ? 7.5 : 10.5) || Math.abs(xx - 1) > 56 * K) continue;
      if (MAPA_WR && (distLosango(xx, z) > MAPA_C - 5 || rioWR(xx, z) < 5 || perto(xx, z, 6.5))) continue;
      if (q < .3) { if (TP) pedras.push({ x: xx, y: alturaChao(xx, z) - .08, z, alt: 1 + q2 * 1.6, ry: q2 * 6.28, cor: lado(xx) > .5 ? '#8a78a8' : '#ffffff' }); else { const o = colocar('rock_single_B', xx, z, 2.4 + q2 * 2); if (o) recolorir(o, lado(xx) > .5 ? '#5a4a70' : '#a89478'); } continue; }
      if (q > .78 || (zz > 0 && !MAPA_WR)) { if (zz > 0 && q < .5 && TP) pedras.push({ x: xx, y: alturaChao(xx, z) - .08, z, alt: .8 + q2 * 1.2, ry: q2 * 6.28, cor: lado(xx) > .5 ? '#8a78a8' : '#ffffff' }); continue; } const t = lado(xx);
      if (TP) arvores.push({ x: xx, y: alturaChao(xx, z) - .1, z, alt: 5.2 + q2 * 2.4, ry: q2 * 6.28, cor: t < .45 ? '#f4ffe8' : '#9a78b8' });
      else { const o = colocar(t < .45 ? 'trees_B_medium' : 'trees_A_medium', xx, z, 4 + q2 * 2); if (o && t >= .45) recolorir(o, '#6a4a80'); }
    }
  }
  if (SELVA_ON) criarCovas(scene, q, anim, TP, pedras, colocar, recolorir);
  // detalhes: Luz — estandartes, lanternas; Trevas — pilares quebrados, lanternas roxas
  [[-24, 1], [-9, 1], [-26, -1], [-40, 1]].forEach(([x, s]) => { const z = laneZ(x) + s * (LANE.largura + .9); const o = colocar('lantern_standing', x, z, 1.1, 0); if (o) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: brilhoTex, color: 0xffb850, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .75 })); sp.scale.setScalar(2.2); sp.position.set(x, .75, z); scene.add(sp); const ch = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.MeshBasicMaterial({ map: brilhoTex, color: 0x6a4a18, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); ch.rotation.x = -Math.PI / 2; ch.position.set(x, .08, z); scene.add(ch); } });
  [[14, -1], [30, -1], [33, 1], [6, -1]].forEach(([x, s]) => { const z = laneZ(x) + s * (LANE.largura + 1.6); const pil = r() > .5; if (TP) { colunas.push({ x, y: alturaChao(x, z) - .05, z, alt: 3.2 + r() * .6, ry: r() * 6.28, cor: '#b8a8c8' }); return; } const o = colocar(pil ? 'pillar' : 'fence_broken', x, z, .7 + r() * .3); if (o) o.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.color.set('#4a3a5a'); } }); });
  [[12, -1], [28, 1]].forEach(([x, s]) => { const z = laneZ(x) + s * (LANE.largura + 1.2); const o = colocar('post_lantern', x, z, 1, s > 0 ? Math.PI : 0); if (o) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: brilhoTex, color: 0xb040ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .8 })); sp.scale.setScalar(2.4); sp.position.set(x, 2.6, z + (s > 0 ? -1.1 : 1.1)); scene.add(sp); } });
  colocar('arch', 30, laneZ(30), 1.3, Math.PI / 2);

  // junta a vegetação estática em poucos draw calls (por material e por trecho do mapa)
  estatico.updateMatrixWorld(true);
  const baldes = new Map();
  estatico.traverse(m => {
    if (!m.isMesh) return; const wp = new THREE.Vector3(); m.getWorldPosition(wp);
    let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); g.applyMatrix4(m.matrixWorld);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    const sig = Object.keys(g.attributes).sort().join(',');
    const key = m.material.uuid + '|' + Math.floor(wp.x / 26) + '|' + sig + '|' + m.castShadow;
    if (!baldes.has(key)) baldes.set(key, { mat: m.material, geos: [], sombra: m.castShadow }); baldes.get(key).geos.push(g);
  });
  for (const b of baldes.values()) { const g = mergeGeometries(b.geos, false); if (!g) continue; g.computeBoundingSphere(); const mm = new THREE.Mesh(g, b.mat); mm.castShadow = b.sombra; mm.receiveShadow = true; scene.add(mm); }

  // props do Tripo instanciados (colunas também ao redor da fonte da Luz, como as antigas)
  let lodProps = null;
  if (TP) {
    for (let k = 0; k < 8; k++) { const a = k / 8 * 6.28; if (Math.sin(a) > -.3 || Math.cos(a) > .5) continue; const x = POS.baseLuz.x + Math.cos(a) * 6.8, z = POS.baseLuz.z + Math.sin(a) * 6.8; colunas.push({ x, y: 0, z, alt: 3.4, ry: a, cor: '#ffffff' }); }
    const iA = instanciar(scene, TP.arvore, arvores, { trecho: 16, sombra: !q.mobile, lod: TP.arvore_lod1, distLOD: q.baixa ? -99 : q.mobile ? 3 : 18, distMax: q.mobile ? (MAPA_WR ? 38 : 40) : 60, lod2: TP.arvore_lod2, distLOD2: q.mobile ? 18 : 34, altoSoFundo: q.mobile }); // celular: o lado de perto da câmera quase só aparece na borda de baixo
    const iP = instanciar(scene, TP.pedra, pedras, { trecho: 16, sombra: !q.mobile, lod: TP.pedra_lod1, distLOD: q.baixa ? -99 : q.mobile ? 3 : 18, distMax: q.mobile ? (MAPA_WR ? 34 : 34) : 60, altoSoFundo: q.mobile });
    const iC = instanciar(scene, TP.coluna, colunas, { trecho: 60, sombra: !q.mobile });
    let iTL = null, iTT = null;
    if (MAPA_WR && TORRES_LATERAIS.length) { const gl = geoTripo(TP.torre_luz), altL = gl.alt * (6.8 / gl.larg) * PROP_TORRE.esc.luz;
      const cor = (t) => t === 'luz' ? '#8c8c90' : '#6a6070'; // apagadas: desligadas por enquanto (ROTAS_LATERAIS)
      iTL = instanciar(scene, TP.torre_luz, TORRES_LATERAIS.filter(t => t[2] === 'luz').map(([x, z, t]) => ({ x, y: alturaChao(x, z), z, alt: altL, ry: 0, cor: cor(t) })), { trecho: 30, sombra: false, distMax: q.mobile ? 36 : 70 });
      iTT = instanciar(scene, TP.torre_trevas, TORRES_LATERAIS.filter(t => t[2] === 'trevas').map(([x, z, t]) => ({ x, y: alturaChao(x, z), z, alt: PROP_TORRE.altura, ry: 0, cor: cor(t) })), { trecho: 30, sombra: false, distMax: q.mobile ? 36 : 70 }); }
    lodProps = (cam) => { iA.atualizar(cam); iP.atualizar(cam); iC.atualizar(cam); if (iTL) { iTL.atualizar(cam); iTT.atualizar(cam); } };
    console.log('[tripo] props instanciados: árvores', iA.n, 'em', iA.pedacos.length, 'trechos; pedras', iP.n, '; colunas', iC.n);
  }
  // névoa roxa rasteira das Trevas
  const nevTex = texBrilho([[0, 'rgba(255,255,255,.9)'], [1, 'rgba(255,255,255,0)']]);
  const nevMat = new THREE.MeshBasicMaterial({ map: nevTex, color: 0x6a2a8a, transparent: true, opacity: .35, depthWrite: false, blending: THREE.AdditiveBlending });
  // 18 manchas de névoa + 12 de brilho: InstancedMesh (2 draw calls em vez de 30)
  const planoChao = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const nevs = new THREE.InstancedMesh(planoChao, nevMat, 18); const nevD = [];
  for (let i = 0; i < 18; i++) { const x = 12 + r() * 50, z = laneZ(x) + (r() - .5) * 22; nevD.push({ x, y: .4 + r() * .6, z, s: 8 + r() * 10, a: 0 }); }
  const solMat = nevMat.clone(); solMat.color.set(0x8a6a20); solMat.opacity = .22;
  const sols = new THREE.InstancedMesh(planoChao, solMat, 12); const mI = new THREE.Matrix4(), qI = new THREE.Quaternion(), eixoY = new THREE.Vector3(0, 1, 0), vI = new THREE.Vector3(), sI = new THREE.Vector3();
  for (let i = 0; i < 12; i++) { const x = (-60 + r() * 45) * K, z = laneZ(x) + (r() - .5) * 20, sc = 8 + r() * 10; mI.compose(vI.set(x, .3, z), qI.identity(), sI.set(sc, 1, sc)); sols.setMatrixAt(i, mI); }
  const posNev = () => { nevD.forEach((d, i) => { mI.compose(vI.set(d.x, d.y, d.z), qI.setFromAxisAngle(eixoY, d.a), sI.set(d.s, 1, d.s)); nevs.setMatrixAt(i, mI); }); nevs.instanceMatrix.needsUpdate = true; };
  posNev(); nevs.frustumCulled = sols.frustumCulled = false; scene.add(nevs, sols);
  let nevT = 0; anim.push((dt) => { nevT += dt; if (nevT < .1) return; nevD.forEach((d, i) => { d.a += nevT * .05 * (i % 2 ? 1 : -1); }); nevT = 0; posNev(); });

  return { anim, lodProps, torreLuz: tL, torreTrevas: tT, torreLuz2: tL2, torreTrevas2: tT2, torreLuz3: tL3, torreTrevas3: tT3, nucleoLuz: nL, nucleoTrevas: nT, fonteLuz: bL, fonteTrevas: bT };
}

// ---------- covas da selva (Dragão, Leviatã/Beemote, Sarça, Rocha): muralha de pedra + efeitos leves (planos aditivos, sem luzes) ----------
function criarCovas(scene, q, anim, TP, pedras, colocar, recolorir) {
  const r = rng(77); const brilho = texBrilho();
  const plano = (x, z, y, tam, cor, op) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(tam, tam), new THREE.MeshBasicMaterial({ map: brilho, color: cor, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending })); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.renderOrder = 2; scene.add(m); return m; };
  const brasas = new THREE.MeshBasicMaterial({ map: brilho, color: 0xff6a20, transparent: true, opacity: .8, depthWrite: false, blending: THREE.AdditiveBlending });
  const gBrasa = new THREE.PlaneGeometry(1, 1); gBrasa.rotateX(-Math.PI / 2);
  const nBrasas = []; const pulsos = [];
  for (const cv of COVAS) {
    const t = cv.c.tipo, esc = t === 'dragao' ? '#d8a890' : t === 'poco' ? '#a8c4d0' : t === 'sarca' ? '#e8c0a0' : '#c8d8f0';
    // muralha: pedras ao redor (só onde não há entrada)
    const passo = cv.poco ? .34 : .5;
    for (let a = -Math.PI; a < Math.PI; a += passo) { if (!naMuralha(cv, a)) continue; const rr = cv.r + .9 + r() * .8, x = cv.x + Math.cos(a) * rr, z = cv.z + Math.sin(a) * rr; const alt = ((cv.poco ? 2.1 : 1.2) + r() * (cv.poco ? 1.3 : .7)) * (Math.sin(a) > .3 ? .55 : 1); // lado da câmera mais baixo
      if (TP) pedras.push({ x, y: alturaChao(x, z) - .15, z, alt, ry: r() * 6.28, cor: esc }); else { const o = colocar('rock_single_C', x, z, alt * 1.4); if (o) recolorir(o, esc); } }
    if (t === 'dragao') { // brasas e rocha queimada
      pulsos.push([plano(cv.x, cv.z, .05, cv.r * 2.2, 0xff5018, .2), .2]);
      for (let i = 0; i < 14; i++) { const a = r() * 6.28, d = 1.5 + r() * (cv.r - 2); nBrasas.push([cv.x + Math.cos(a) * d, cv.z + Math.sin(a) * d, .5 + r() * .9, r() * 6]); }
    } else if (t === 'poco') { // água escura com brilho verde-azulado
      const agua = new THREE.Mesh(new THREE.CircleGeometry(cv.r - .5, q.mobile ? 28 : 44), new THREE.MeshStandardMaterial({ color: 0x0a2530, roughness: .1, metalness: .5, emissive: 0x0a5a60, emissiveIntensity: .35, transparent: true, opacity: .86, depthWrite: false }));
      agua.rotation.x = -Math.PI / 2; agua.position.set(cv.x, .045, cv.z); agua.renderOrder = 1; scene.add(agua);
      pulsos.push([plano(cv.x, cv.z, .07, cv.r * 2.6, 0x20e0d0, .28), .28]); pulsos.push([agua.material, .35, true]);
    } else if (t === 'sarca') { // clareira da sarça que arde sem se consumir
      pulsos.push([plano(cv.x, cv.z, .05, 6.5, 0xff7a20, .3), .3]);
      for (let i = 0; i < 7; i++) { const a = r() * 6.28, d = 1.2 + r() * 2.6; nBrasas.push([cv.x + Math.cos(a) * d, cv.z + Math.sin(a) * d, .4 + r() * .6, r() * 6]); }
    } else if (t === 'rocha') { // fonte na rocha (Êx 17): poça de água clara no lado de fora
      const dz = cv.z > 0 ? 1 : -1, px = cv.x, pz = cv.z + dz * 2.6;
      const poca = new THREE.Mesh(new THREE.CircleGeometry(1.7, 24), new THREE.MeshStandardMaterial({ color: 0x3a8ab8, roughness: .08, metalness: .3, emissive: 0x1a5a90, emissiveIntensity: .4, transparent: true, opacity: .85, depthWrite: false }));
      poca.rotation.x = -Math.PI / 2; poca.position.set(px, .05, pz); poca.renderOrder = 1; scene.add(poca);
      pulsos.push([plano(px, pz, .07, 5, 0x50b0ff, .3), .3]);
    }
  }
  // brasas: uma única malha instanciada
  const inst = new THREE.InstancedMesh(gBrasa, brasas, nBrasas.length); const m4 = new THREE.Matrix4(), v = new THREE.Vector3(), qq = new THREE.Quaternion(), sc = new THREE.Vector3();
  const pos = (tt) => { nBrasas.forEach(([x, z, s0, f], i) => { const k = .75 + .25 * Math.sin(tt * 3.1 + f); m4.compose(v.set(x, .06, z), qq, sc.set(s0 * k, 1, s0 * k)); inst.setMatrixAt(i, m4); }); inst.instanceMatrix.needsUpdate = true; };
  pos(0); inst.renderOrder = 2; scene.add(inst);
  let acc = 0; anim.push((dt, tt) => { acc += dt; if (acc < (q.mobile ? .1 : .05)) return; acc = 0; pos(tt);
    for (const [m, op, emi] of pulsos) { const k = .8 + .2 * Math.sin(tt * 1.7 + op * 10); if (emi) m.emissiveIntensity = op * k; else m.material.opacity = op * k; } });
}
