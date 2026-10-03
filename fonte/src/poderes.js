// Identidade visual (e sonora) própria de cada poder. Tudo com partículas do atlas (vfx/poderes.webp, 1 draw call por sistema),
// decalques e malhas em pool; 5 GLBs do Tripo (pedra da funda, lança de bronze, espada de luz, cetro do Faraó, cristal das trevas).
// main.js chama os ganchos abaixo; se um gancho devolve true, o visual genérico antigo não roda.
import * as THREE from 'three';
import { HEROIS } from './dados.js';

export const CEL = { BRILHO: 0, LUZ: 1, FOGO: 2, FAISCA: 3, FUMACA: 4, RAIO: 5, CURA: 6, ANEL: 7, CORACAO: 8, FOLHA: 9, GAFANHOTO: 10, LASCA: 11, ESPINHO: 12, NOTA: 13, RISCO: 14, CACO: 15 };
const K = CEL, rnd = (a = 1) => (Math.random() - .5) * 2 * a, TAU = Math.PI * 2;
// cores de cada herói (paleta própria, não compartilhada)
const COR = {
  ouro: [1, .82, .35], ouroClaro: [1, .95, .7], pedra: [.62, .58, .52], la: [1, .96, .88],
  osso: [1, .95, .82], rocha: [.55, .45, .35], leao: [1, .5, .12], terra: [.5, .38, .25],
  folha: [.45, 1, .4], folhaEsc: [.25, .7, .25], juizo: [.95, 1, .9], estrela: [.8, .92, 1],
  brasa: [1, .45, .08], barro: [.85, .45, .25], latao: [1, .8, .3], orvalho: [.7, .9, 1],
  bronze: [.85, .55, .25], poeira: [.55, .45, .32], furia: [1, .22, .12],
  serpente: [.35, 1, .4], areia: [.95, .8, .5], gafanhoto: [.45, .5, .18], treva: [.3, .12, .45],
  rosa: [1, .4, .8], rosaClaro: [1, .75, .92], roxo: [.7, .3, 1], veneno: [.55, 1, .25],
  ferro: [.7, .72, .78], ouroRei: [1, .75, .25], fornalha: [1, .38, .06],
};

export function criarPoderes(C) {
  const { scene, camera } = C; const fx = () => C.fx(), fxD = () => C.fxD();
  const som = (n, p, v) => C.som(n, p, v);
  for (const [id, h] of Object.entries(HEROIS)) for (const [k, d] of Object.entries(h.hab)) d.fxId = id + '.' + k;
  // celular: ~60% das partículas e sprites gigantes limitados (menos sobreposição aditiva = menos custo de GPU)
  const QM = C.mobile ? .6 : 1, TMAX = C.baixa ? 5 : C.mobile ? 7 : 99;
  const lim = (o) => { if (o.t0 > TMAX || o.t1 > TMAX) { o = { ...o, t0: Math.min(o.t0, TMAX), t1: Math.min(o.t1 ?? 0, TMAX) }; } return o; };
  const P = (x, y, z, o) => { if (QM < 1 && !o.essencial && Math.random() > QM) return; fx().emit(x, y, z, lim(o)); }, D = (x, y, z, o) => { if (QM < 1 && !o.essencial && Math.random() > QM) return; fxD().emit(x, y, z, lim(o)); };
  // explosão radial de partículas de uma forma
  function explosao(c, n, o) {
    const s = o.s || 6, y = o.y ?? 1, em = o.normal ? D : P;
    for (let j = 0; j < n; j++) { const a = Math.random() * TAU, sp = s * (.35 + Math.random() * .65), vy = (o.vy ?? 3) * (o.vyFixo ? 1 : Math.random());
      em(c.x + Math.cos(a) * (o.r0 || .3), y + rnd(o.dy || 0), c.z + Math.sin(a) * (o.r0 || .3), { vel: [Math.cos(a) * sp, vy, Math.sin(a) * sp], cor: Array.isArray(o.cor[0]) ? o.cor[j % o.cor.length] : o.cor, vida: (o.vida || .6) * (.7 + Math.random() * .6), t0: o.t0 ?? .6, t1: o.t1 ?? 0, drag: o.drag ?? 2, grav: o.grav || 0, cel: o.cel || 0, giro: o.giro ? rnd(o.giro) : 0, alpha: o.alpha ?? 1, rot: o.alinhar ? -a : undefined }); }
  }
  // ângulo na tela de uma direção no mundo (para alinhar riscos/lanças ao movimento)
  const _a = new THREE.Vector3(), _b = new THREE.Vector3();
  function angTela(p, dir) { _a.copy(p).project(camera); _b.copy(p).add(dir).project(camera); return Math.atan2(_b.y - _a.y, (_b.x - _a.x) * camera.aspect); }
  // ---------- decalques no chão (pool, célula "anel de impacto" do Tripo) ----------
  const geoDecal = new THREE.PlaneGeometry(1, 1); { const uv = geoDecal.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, .75 + uv.getX(i) * .25, .5 + uv.getY(i) * .25); } geoDecal.rotateX(-Math.PI / 2);
  const decais = [];
  function decal(c, r, vida = 1.6, cor = [1, 1, 1], op = 1) {
    let m = decais.find(x => !x.visible);
    if (!m) { if (decais.length >= (C.mobile ? 6 : 10)) m = decais.reduce((a, b) => a.userData.t > b.userData.t ? a : b); else { m = new THREE.Mesh(geoDecal, new THREE.MeshBasicMaterial({ map: C.atlas(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); m.renderOrder = 5; scene.add(m); decais.push(m); } }
    m.visible = true; m.position.set(c.x, .1 + decais.indexOf(m) * .002, c.z); m.rotation.y = Math.random() * TAU; m.scale.set(r * 2.2, 1, r * 2.2); m.material.color.setRGB(...cor); m.material.opacity = op;
    m.userData.t = 0; m.userData.vida = vida; m.userData.op = op; m.userData.r = r;
  }
  // ---------- malhas do Tripo (pool) ----------
  const geos = {};
  function geoTripo(nome, compr, eixo) { // geometria assada: centralizada, comprimento `compr`, eixo longo apontando para +Z (projéteis)
    if (geos[nome] !== undefined) return geos[nome];
    const src = C.modelo(nome); if (!src) return (geos[nome] = null);
    let mesh = null; src.updateMatrixWorld(true); src.traverse(o => { if (o.isMesh && !mesh) mesh = o; }); if (!mesh) return (geos[nome] = null);
    const g = mesh.geometry.clone(); g.applyMatrix4(mesh.matrixWorld); if (eixo) g.applyMatrix4(eixo);
    g.computeBoundingBox(); const b = g.boundingBox, c = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3());
    g.translate(-c.x, -c.y, -c.z); const k = compr / Math.max(sz.x, sz.y, sz.z); g.scale(k, k, k);
    const mat = mesh.material.clone(); mat.metalness = Math.min(mat.metalness, .35); mat.roughness = Math.max(mat.roughness, .45); mat.emissive = new THREE.Color(0x221608); mat.envMapIntensity = .6;
    return (geos[nome] = { geo: g, mat });
  }
  const pools = {};
  function objeto(nome, compr, eixo, brilho) {
    const t = geoTripo(nome, compr, eixo); if (!t) return null; const l = pools[nome] || (pools[nome] = []);
    let o = l.find(x => !x.visible); if (!o) { o = new THREE.Mesh(t.geo, t.mat); o.castShadow = !C.mobile; if (brilho) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: C.texB, color: new THREE.Color(...brilho), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .8 })); sp.scale.setScalar(compr * 1.6); o.add(sp); } scene.add(o); l.push(o); }
    o.visible = true; o.scale.setScalar(1); o.rotation.set(0, 0, 0); return o;
  }
  const efeito = (vida, up) => C.efeitos.push({ t: 0, vida, up });
  // ---------- punho da estátua de Nabucodonosor (Dn 2: cabeça de ouro, pés de ferro) — procedural, 1 malha ----------
  let geoPunho = null; const matOuro = new THREE.MeshStandardMaterial({ color: 0xffc857, metalness: .8, roughness: .35, emissive: 0x3a2000 });
  function punho() {
    if (!geoPunho) { const parts = []; const box = (w, h, d, x, y, z) => { const b = new THREE.BoxGeometry(w, h, d); b.translate(x, y, z); parts.push(b); };
      box(1.6, 1.1, 1.3, 0, 0, 0); for (let i = 0; i < 4; i++) box(.36, .42, .5, -.6 + i * .4, -.62, .45); box(.4, .9, .45, .95, -.1, .3); const braco = new THREE.CylinderGeometry(.55, .7, 4, 8); braco.translate(0, 2.5, 0); parts.push(braco);
      const pos = [], idx = []; let off = 0; for (const p of parts) { const g = p.index ? p.toNonIndexed() : p; pos.push(g.attributes.position.array); off += g.attributes.position.count; }
      const arr = new Float32Array(pos.reduce((s, a) => s + a.length, 0)); let o = 0; for (const a of pos) { arr.set(a, o); o += a.length; }
      geoPunho = new THREE.BufferGeometry(); geoPunho.setAttribute('position', new THREE.BufferAttribute(arr, 3)); geoPunho.computeVertexNormals(); }
    const l = pools.punho || (pools.punho = []); let m = l.find(x => !x.visible); if (!m) { m = new THREE.Mesh(geoPunho, matOuro); m.castShadow = !C.mobile; scene.add(m); l.push(m); } m.visible = true; return m;
  }
  // ---------- cântaro de Gideão (procedural: torno de barro) ----------
  let geoJarra = null; const matBarro = new THREE.MeshStandardMaterial({ color: 0xb8683a, roughness: .85 });
  function jarra() {
    const t = objeto('tocha_gideao', 1.1, null, [1, .6, .2]); if (t) return t; // cântaro com a tocha (Tripo); procedural se faltar
    if (!geoJarra) { const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(.12 + Math.sin(t * Math.PI) * .32 + (t > .85 ? (t - .85) * .8 : 0), t * .9 - .45)); } geoJarra = new THREE.LatheGeometry(pts, 10); }
    const l = pools.jarra || (pools.jarra = []); let m = l.find(x => !x.visible); if (!m) { m = new THREE.Mesh(geoJarra, matBarro); scene.add(m); l.push(m); } m.visible = true; return m;
  }
  const EIXO = { // orientação de cada GLB para "ponta em +Z"
    lanca: null, pedra_funda: null,
    espada_luz: new THREE.Matrix4().makeRotationZ(Math.PI / 4), // lâmina em diagonal no modelo -> em pé, ponta para baixo (-Y)
    cetro_farao: null, cristal_trevas: null,
  };
  // ============ projéteis ============
  const PROJ = {
    'davi.q': () => { const t = geoTripo('pedra_funda', .75); return t && { geo: t.geo, mat: t.mat, giro: true, esc: 1 }; },
    'debora.q': null, 'jezabel.q': null,
  };
  function proj(d) { const f = PROJ[d.fxId]; return f ? f() : null; }
  const trilhas = {
    'davi.q': (p, dir, ang) => { P(p.x, p.y, p.z, { cel: K.RISCO, cor: COR.ouro, vida: .22, t0: 2.2, t1: 1.2, drag: 0, rot: ang }); if (Math.random() < .6) P(p.x + rnd(.2), p.y + rnd(.2), p.z + rnd(.2), { cel: K.FAISCA, cor: COR.ouroClaro, vida: .35, t0: .55, t1: 0, vel: [rnd(1), rnd(1), rnd(1)], giro: rnd(6) }); },
    'debora.q': (p, dir, ang) => { P(p.x, p.y, p.z, { cel: K.RISCO, cor: COR.juizo, vida: .2, t0: 2.4, t1: 1, drag: 0, rot: ang }); for (let j = 0; j < 2; j++) P(p.x + rnd(.4), p.y + rnd(.4), p.z + rnd(.4), { cel: K.FOLHA, cor: j ? COR.folha : COR.folhaEsc, vida: .7, t0: .5, t1: .2, vel: [rnd(1.5), .8, rnd(1.5)], giro: rnd(8), drag: 1 }); },
    'farao.q': (p, dir, ang, t) => { const s = Math.sin(t * 22) * .45; const px = -dir.z * s, pz = dir.x * s; P(p.x + px, p.y - .3, p.z + pz, { cor: t % .1 < .05 ? COR.serpente : COR.ouro, vida: .45, t0: .55, t1: .35, drag: 0 }); if (Math.random() < .3) D(p.x, .2, p.z, { cor: COR.areia, vida: .6, t0: .5, t1: 1, vel: [rnd(1), .6, rnd(1)], alpha: .5 }); },
    'jezabel.q': (p, dir, ang) => { P(p.x, p.y, p.z, { cel: K.RISCO, cor: COR.ouroRei, vida: .16, t0: 1.6, t1: .8, drag: 0, rot: ang }); if (Math.random() < .7) P(p.x + rnd(.3), p.y + rnd(.3), p.z + rnd(.3), { cel: K.ESPINHO, cor: Math.random() < .5 ? COR.ouroRei : COR.roxo, vida: .5, t0: .75, t1: .3, vel: [rnd(1), rnd(1), rnd(1)], giro: rnd(5) }); },
    'jezabel.w': (p, dir, ang, t) => { if (Math.random() < .8) P(p.x + rnd(.35), p.y + rnd(.35), p.z + rnd(.35), { cel: K.CORACAO, cor: Math.random() < .5 ? COR.rosa : COR.rosaClaro, vida: .7, t0: .8, t1: .35, vel: [rnd(.8), 1.2, rnd(.8)], giro: rnd(2), drag: 1 }); P(p.x, p.y, p.z, { cel: K.CORACAO, cor: COR.rosa, vida: .08, t0: 1.1, t1: 1.1, rot: 0 }); },
  };
  function trilha(d, p, dir, t) { const f = trilhas[d.fxId]; if (!f) return false; f(p, dir, dir._ang ?? (dir._ang = angTela(p, dir)), t); return true; }
  function lancou(d, h, de, dir) {
    switch (d.fxId) {
      case 'davi.q': som('funda', de); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; P(de.x + Math.cos(a) * .5, de.y, de.z + Math.sin(a) * .5, { cel: K.RISCO, cor: COR.ouro, vida: .18, t0: .8, t1: 0, rot: -a - Math.PI / 2 }); } break; // giro da funda
      case 'debora.q': som('vento', de); break;
      case 'farao.q': som('sibilo', de); cetroErguido(h, .7); break;
      case 'jezabel.q': som('lamina', de); break;
      case 'jezabel.w': som('encanto', de); break;
    }
  }
  function acerto(d, u, h) {
    const c = u.obj.position, y = 1.2;
    switch (d.fxId) {
      case 'davi.q': som('pedraRacha', c); decal(c, 1.1, 1.2, [1, .9, .6], .9); explosao(c, 10, { cel: K.LASCA, normal: true, cor: [COR.pedra, [.8, .75, .66]], s: 5, y, vy: 5, grav: 14, t0: .32, t1: .22, vida: .9, giro: 10, drag: .4 }); explosao(c, 8, { cel: K.FAISCA, cor: COR.ouro, s: 7, y, vy: 3, t0: .6, vida: .35 }); return true;
      case 'debora.q': P(c.x, y, c.z, { cel: K.CURA, cor: [1, 1, 1], vida: .45, t0: 2, t1: 3, giro: 6 }); explosao(c, 8, { cel: K.FOLHA, cor: [COR.folha, COR.folhaEsc], s: 4, y, vy: 2, t0: .45, t1: .2, vida: .8, giro: 8 }); return true;
      case 'farao.q': som('sibilo', c, .6); explosao(c, 10, { cor: [COR.serpente, COR.ouro], s: 4, y: .8, vy: 2, t0: .5, vida: .6 }); for (let j = 0; j < 5; j++) D(c.x + rnd(.6), .8, c.z + rnd(.6), { cel: K.FUMACA, cor: [.4, 1, .45], vida: 1, t0: .9, t1: 1.6, vel: [rnd(.5), .8, rnd(.5)], alpha: .45, giro: rnd(1) }); return true;
      case 'jezabel.q': som('veneno', c); for (let j = 0; j < 7; j++) D(c.x + rnd(.7), .6 + Math.random(), c.z + rnd(.7), { cel: K.FUMACA, cor: j % 2 ? [1, .85, .5] : [.8, .5, 1], vida: 1.2, t0: .9, t1: 1.8, vel: [rnd(.6), .5, rnd(.6)], alpha: .55, giro: rnd(1) }); explosao(c, 6, { cel: K.ESPINHO, cor: COR.ouroRei, s: 5, y, vy: 1, t0: .45, vida: .4, alinhar: true }); return true;
      case 'jezabel.w': som('encanto', c, .7); explosao(c, 14, { cel: K.CORACAO, cor: [COR.rosa, COR.rosaClaro], s: 4, y: 1.5, vy: 3, t0: .55, t1: .15, vida: .9, giro: 3, drag: 1.5 }); C.aneis.add(c, new THREE.Color(...COR.rosa), .3, 1.6, .5); return true;
    }
    return false;
  }
  // ============ áreas (impacto de habilidades de área, fim de dash, salto) ============
  const areas = {
    'davi.r': (c, r) => { som('coro', c); P(c.x, 5, c.z, { cel: K.LUZ, cor: [1, 1, 1], vida: 1.1, t0: 4, t1: 12, drag: 0 }); C.agendar(.8, () => { decal(c, r * .9, 2.4, [1, .85, .5]); P(c.x, 1.5, c.z, { cel: K.LUZ, cor: [1, 1, 1], vida: .6, t0: 9, t1: 14 }); explosao(c, 18, { cel: K.LASCA, normal: true, cor: [COR.pedra, COR.ouro], s: 9, y: .5, vy: 8, grav: 14, t0: .4, t1: .3, vida: 1.2, giro: 10, drag: .3 }); }); return true; },
    'sansao.q': (c, r, h) => { som('queixada', c); const f = C.frente(h), a0 = Math.atan2(f.z, f.x); for (let j = 0; j < 16; j++) { const a = a0 + (j / 15 - .5) * 2.4, rr = r * .7; P(c.x - f.x * 1.2 + Math.cos(a) * rr, 1.2, c.z - f.z * 1.2 + Math.sin(a) * rr, { cel: K.RISCO, cor: COR.osso, vida: .25, t0: 1.4, t1: .4, rot: angTela(c, new THREE.Vector3(-Math.sin(a), 0, Math.cos(a))), vel: [Math.cos(a) * 4, 0, Math.sin(a) * 4], drag: 4 }); }
      explosao(c, 12, { cel: K.LASCA, normal: true, cor: [COR.rocha, COR.pedra], s: 6, y: .4, vy: 5, grav: 14, t0: .3, t1: .2, vida: 1, giro: 9, drag: .4 }); C.tremer(.15); return true; },
    'sansao.e': (c, r) => { som('boom', c); decal(c, r * 1.1, 1.8, [1, .8, .55]); explosao(c, 16, { cel: K.LASCA, normal: true, cor: [COR.rocha, COR.pedra, [.7, .6, .45]], s: 7, y: .3, vy: 9, vyFixo: false, grav: 16, t0: .5, t1: .35, vida: 1.3, giro: 8, drag: .3 }); for (let j = 0; j < 14; j++) D(c.x + rnd(r), .4, c.z + rnd(r), { cor: COR.terra, vida: 1.1, t0: .9, t1: 2.2, vel: [rnd(2), 1.5, rnd(2)], alpha: .7 }); C.tremer(.35); return true; },
    'debora.r': (c, r, h, i) => { som('julgamento', c, i ? .6 : 1); for (let k = 0; k < 6; k++) P(c.x, 1 + k * 1.6, c.z, { cel: K.LUZ, cor: COR.juizo, vida: .55, t0: 3.2 - k * .3, t1: .5, drag: 0 }); C.agendar(.3, () => { C.aneis.add(c, new THREE.Color(...COR.estrela), .4, r, .5, .15); explosao(c, 14, { cel: K.FAISCA, cor: [COR.estrela, COR.juizo], s: 7, y: .6, vy: 5, t0: .7, vida: .6, giro: 4 }); explosao(c, 8, { cel: K.FOLHA, cor: COR.folha, s: 5, y: .6, vy: 3, t0: .45, vida: .9, giro: 8 }); C.tremer(.2); }); return true; },
    'gideao.q': (c, r) => { som('trombeta', c); for (let i = 0; i < 3; i++) C.agendar(i * .12, () => { C.aneis.add(c, new THREE.Color(...COR.latao), .6, r * (.6 + i * .2), .5, 1.2 + i * .15, .8); const n = 12; for (let j = 0; j < n; j++) { const a = (j + i * .5) / n * TAU; P(c.x + Math.cos(a) * 1, 1.4 + i * .3, c.z + Math.sin(a) * 1, { cel: K.NOTA, cor: i % 2 ? COR.latao : COR.brasa, vel: [Math.cos(a) * r * 2.2, .4, Math.sin(a) * r * 2.2], vida: .5, t0: .8, t1: .5, drag: 2.2, rot: angTela(c, new THREE.Vector3(Math.cos(a), 0, Math.sin(a))) }); } }); C.tremer(.12); return true; },
    'gideao.w': (c, r) => { som('cantaro', c); explosao(c, 14, { cel: K.CACO, normal: true, cor: [COR.barro, [.7, .35, .18]], s: 6, y: 1.2, vy: 6, grav: 15, t0: .42, t1: .3, vida: 1.1, giro: 12, drag: .4 }); for (let j = 0; j < 7; j++) P(c.x + rnd(r * .5), .6 + Math.random() * .6, c.z + rnd(r * .5), { cel: K.FOGO, cor: [1, 1, 1], vida: .8, t0: 1.6, t1: .4, vel: [rnd(1), 3, rnd(1)], drag: 1 }); explosao(c, 16, { cor: [COR.brasa, [1, .8, .3]], s: 4, y: 1, vy: 6, grav: -1, t0: .3, vida: 1, drag: 1 }); C.tremer(.12); return true; },
    'gideao.r': (c, r) => { som('espada', c); decal(c, r, 1.8, [1, .7, .35]); C.aneis.add(c, new THREE.Color(...COR.latao), .5, r * 1.1, .6, 1.3, .8); for (let j = 0; j < 14; j++) { const a = j / 14 * TAU; P(c.x, 1.5, c.z, { cel: K.NOTA, cor: COR.latao, vel: [Math.cos(a) * 9, .5, Math.sin(a) * 9], vida: .55, t0: .8, t1: .4, drag: 2, rot: angTela(c, new THREE.Vector3(Math.cos(a), 0, Math.sin(a))) }); } for (let j = 0; j < 6; j++) P(c.x + rnd(1.5), .8, c.z + rnd(1.5), { cel: K.FOGO, cor: [1, 1, 1], vida: .7, t0: 1.4, t1: .3, vel: [0, 3, 0] }); return true; },
    'golias.w': (c, r) => { som('grito', c); for (let i = 0; i < 3; i++) C.agendar(i * .12, () => C.aneis.add(c, new THREE.Color(...COR.furia), r * .3, r, .5, .12)); for (let j = 0; j < 16; j++) { const a = j / 16 * TAU; P(c.x + Math.cos(a) * 1.4, 2.4, c.z + Math.sin(a) * 1.4, { cel: K.RISCO, cor: j % 2 ? COR.furia : COR.bronze, vel: [Math.cos(a) * 7, 0, Math.sin(a) * 7], vida: .35, t0: 1.6, t1: .6, drag: 3, rot: angTela(c, new THREE.Vector3(Math.cos(a), 0, Math.sin(a))) }); } return true; },
    'golias.e': (c, r) => { som('pisao', c); decal(c, r * 1.2, 2.2, [1, .75, .5]); for (let j = 0; j < 26; j++) { const a = Math.random() * TAU, dd = r * (.6 + Math.random() * .5); D(c.x + Math.cos(a) * dd, .3, c.z + Math.sin(a) * dd, { cor: COR.poeira, vida: 1.2, t0: 1, t1: 2.4, vel: [Math.cos(a) * 3, 1.5 + Math.random() * 2, Math.sin(a) * 3], alpha: .8 }); } explosao(c, 12, { cel: K.LASCA, normal: true, cor: [COR.rocha, COR.bronze], s: 6, y: .3, vy: 7, grav: 15, t0: .4, t1: .3, vida: 1.1, giro: 8, drag: .3 }); C.tremer(.45); return true; },
    'golias.r': (c, r) => { som('terremoto', c); C.tremer(.7); decal(c, r * .8, 2.6, [1, .7, .45]); for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + Math.random() * .5, dd = r * .65; C.agendar(.1 + i * .08, () => decal({ x: c.x + Math.cos(a) * dd, z: c.z + Math.sin(a) * dd }, r * .45, 2.2, [1, .7, .45])); }
      for (let i = 0; i < 4; i++) C.agendar(i * .12, () => C.aneis.add(c, new THREE.Color(...COR.bronze), .6, r * (.5 + i * .18), .6, .12)); for (let j = 0; j < 36; j++) { const a = Math.random() * TAU, dd = Math.random() * r; D(c.x + Math.cos(a) * dd, .3, c.z + Math.sin(a) * dd, { cor: COR.poeira, vida: 1.5, t0: 1, t1: 2.6, vel: [0, 2 + Math.random() * 2, 0], alpha: .75 }); } explosao(c, 22, { cel: K.LASCA, normal: true, cor: [COR.rocha, COR.pedra, COR.bronze], s: 8, y: .3, vy: 10, grav: 16, t0: .55, t1: .35, vida: 1.5, giro: 7, drag: .3, r0: 1.5 }); return true; },
    'farao.e': (c, r) => { som('trevas', c); for (let j = 0; j < 7; j++) P(c.x + rnd(r * .6), .8 + Math.random() * 1.2, c.z + rnd(r * .6), { cel: K.FUMACA, cor: [1, 1, 1], vida: 1.6, t0: 2.6, t1: 3.4, vel: [rnd(.4), .3, rnd(.4)], alpha: .8, giro: rnd(.6), essencial: true }); /* camada aditiva roxa: lê sobre o chão escuro */ for (let i = 0; i < 3; i++) C.agendar(i * .15, () => C.aneis.add(c, new THREE.Color(.55, .2, .8), r * .4, r * 1.05, .6, .15)); for (let j = 0; j < 18; j++) { const a = j / 18 * TAU; D(c.x + Math.cos(a) * r * .9, .5 + Math.random() * .8, c.z + Math.sin(a) * r * .9, { cel: K.FUMACA, cor: [.14, .08, .2], vida: 1.9, t0: 2, t1: 3, vel: [-Math.cos(a) * .8, .4, -Math.sin(a) * .8], alpha: .95, giro: rnd(.8) }); }
      for (let j = 0; j < 12; j++) D(c.x + rnd(r * .6), .4 + Math.random() * 1.4, c.z + rnd(r * .6), { cel: K.FUMACA, cor: [.3, .2, .42], vida: 1.8, t0: 2.4, t1: 3.6, vel: [rnd(.8), .5, rnd(.8)], alpha: .9, giro: rnd(.8) }); for (let j = 0; j < 12; j++) D(c.x + rnd(r), .3, c.z + rnd(r), { cor: COR.areia, vida: 1.2, t0: .6, t1: 1.4, vel: [rnd(3), .5, rnd(3)], alpha: .6 }); C.aneis.add(c, new THREE.Color(...COR.treva), .3, r, .6); return true; },
    'farao.r': (c, r, h, i) => { const pr = PRAGAS[i % PRAGAS.length]; som('praga', c, .7); pr(c, r); return true; },
    'jezabel.e': (c, r) => { explosao(c, 10, { cel: K.ESPINHO, cor: [COR.roxo, COR.rosa], s: 7, y: 1.1, vy: 1, t0: .5, t1: .2, vida: .4, alinhar: true }); C.aneis.add(c, new THREE.Color(...COR.roxo), .3, r, .4); return true; },
    'nabuco.q': (c, r, h) => { som('metal', c); const f = C.frente(h), a0 = Math.atan2(f.z, f.x); C.aneis.add(c, new THREE.Color(...COR.ouroRei), .4, r, .35); for (let j = 0; j < 20; j++) { const a = a0 + (j / 19 - .5) * 1.8; P(c.x - f.x, 1.1, c.z - f.z, { cel: j % 3 ? K.RISCO : K.FAISCA, cor: j % 2 ? COR.ouroRei : COR.ferro, vel: [Math.cos(a) * 10, 0, Math.sin(a) * 10], vida: .32, t0: j % 3 ? 1.5 : .6, t1: .3, drag: 3, rot: angTela(c, new THREE.Vector3(Math.cos(a), 0, Math.sin(a))) }); } return true; },
    'nabuco.e': (c, r) => { // punho da estátua cai do céu
      const m = punho(); m.position.set(c.x, 9, c.z); m.rotation.set(Math.PI, Math.random() * TAU, 0); m.scale.setScalar(.9); let bateu = false;
      efeito(1.1, (e, dt) => { if (e.t < .22) m.position.y = 9 - (e.t / .22) * 8.2; else if (!bateu) { bateu = true; m.position.y = .8; som('punho', c); decal(c, r * 1.1, 2, [1, .85, .45]); for (let i = 0; i < 2; i++) C.agendar(i * .1, () => { C.aneis.add(c, new THREE.Color(...COR.ouroRei), .5, r * (1.1 + i * .3), .5, .14); C.aneis.add(c, new THREE.Color(...COR.ferro), .4, r * (.9 + i * .3), .45, .12, .7); }); explosao(c, 16, { cel: K.FAISCA, cor: [COR.ouroRei, COR.ferro], s: 9, y: .6, vy: 5, t0: .7, vida: .5, giro: 5 }); explosao(c, 10, { cel: K.LASCA, normal: true, cor: [COR.ferro, COR.ouroRei], s: 6, y: .4, vy: 7, grav: 15, t0: .35, t1: .25, vida: 1, giro: 9, drag: .3 }); C.tremer(.4); } else m.position.y = .8 - (e.t - .22) * 1.4; if (e.t >= e.vida) { m.visible = false; return false; } return true; });
      return true; },
  };
  // as dez pragas do Egito (Êx 7–12): cada impacto é uma praga diferente
  const cai = (c, r, n, o) => { for (let j = 0; j < n; j++) (o.normal ? D : P)(c.x + rnd(r * .6), 7 + Math.random() * 3, c.z + rnd(r * .6), { vel: [0, -20, 0], drag: 0, vida: .38, ...o, t0: (o.t0 || .4) * 1.6, t1: (o.t1 || .3) * 1.6 }); };
  const PRAGAS = [
    (c, r) => { cai(c, r, 10, { cor: [.75, .05, .05], t0: .35, t1: .3, cel: K.BRILHO }); C.agendar(.35, () => { decal(c, r * .7, 1.4, [.9, .1, .1], .8); explosao(c, 10, { cor: [.8, .05, .05], s: 4, y: .3, vy: 3, grav: 9, t0: .35, vida: .6 }); }); }, // sangue
    (c, r) => { explosao(c, 10, { normal: true, cor: [[.3, .6, .2], [.4, .7, .25]], s: 3, y: .3, vy: 6, grav: 14, t0: .45, t1: .4, vida: .9, cel: K.BRILHO }); }, // rãs
    (c, r) => { cai(c, r, 8, { normal: true, cor: [.2, .15, .1], t0: .2, t1: .2 }); C.agendar(.35, () => explosao(c, 16, { normal: true, cor: [.25, .2, .12], s: 5, y: .6, vy: 2, t0: .15, t1: .15, vida: .9 })); }, // piolhos
    (c, r) => { for (let j = 0; j < 12; j++) P(c.x + rnd(r * .5), .8 + Math.random() * 1.5, c.z + rnd(r * .5), { cel: K.GAFANHOTO, cor: [.3, .3, .3], vel: [rnd(5), rnd(1), rnd(5)], vida: .9, t0: .3, t1: .3, drag: 0 }); }, // moscas
    (c, r) => { for (let j = 0; j < 8; j++) D(c.x + rnd(r * .6), .5 + Math.random(), c.z + rnd(r * .6), { cel: K.FUMACA, cor: [.5, .8, .3], vida: 1.2, t0: .8, t1: 1.6, vel: [0, .6, 0], alpha: .6, giro: rnd(1) }); }, // peste
    (c, r) => { explosao(c, 12, { cel: K.FAISCA, cor: [[1, .6, .3], [.9, .4, .3]], s: 3, y: 1.2, vy: 2, t0: .5, vida: .7, giro: 3 }); }, // úlceras
    (c, r) => { cai(c, r, 10, { cel: K.LASCA, cor: [.85, .95, 1], t0: .35, t1: .3, giro: 6 }); C.agendar(.35, () => { explosao(c, 12, { cel: K.LASCA, normal: true, cor: [.85, .95, 1], s: 5, y: .3, vy: 5, grav: 14, t0: .25, t1: .2, vida: .8, giro: 10, drag: .3 }); P(c.x, 4, c.z, { cel: K.RAIO, cor: [1, 1, 1], vida: .25, t0: 5, t1: 6, rot: rnd(.4) }); }); }, // saraiva e raios
    (c, r) => { for (let j = 0; j < 16; j++) P(c.x + rnd(r * .6), .6 + Math.random() * 2, c.z + rnd(r * .6), { cel: K.GAFANHOTO, cor: COR.gafanhoto, vel: [rnd(6), rnd(1.5), rnd(6)], vida: .9, t0: .55, t1: .5, drag: 0, rot: rnd(3) }); }, // gafanhotos
    (c, r) => { for (let j = 0; j < 10; j++) D(c.x + rnd(r * .6), .5 + Math.random() * 1.5, c.z + rnd(r * .6), { cel: K.FUMACA, cor: [.25, .15, .35], vida: 1.5, t0: 1.4, t1: 2.2, vel: [0, .4, 0], alpha: .95, giro: rnd(.6) }); }, // trevas
    (c, r) => { P(c.x, 1.5, c.z, { cel: K.FUMACA, cor: [1, .2, .2], vida: .8, t0: 3, t1: 5 }); C.aneis.add(c, new THREE.Color(.9, .1, .1), .3, r, .5); }, // primogênitos
  ];
  function area(d, c, r, h, i = 0) { const f = d && areas[d.fxId]; return f ? f(c, r, h, i) !== false : false; }
  // ============ antes do golpe (anúncio/preparo) ============
  function inicio(d, h, alvo) {
    switch (d.fxId) {
      case 'gideao.w': { // o cântaro voa até o alvo girando e quebra
        const m = jarra(); const a = h.obj.position.clone().setY(1.6), b = alvo.clone(); const dur = Math.max(.2, (d.atraso || .45) - .05);
        efeito(dur, (e) => { const k = Math.min(1, e.t / dur); m.position.lerpVectors(a, b, k); m.position.y = 1.6 + Math.sin(k * Math.PI) * 2.2 - k * .6; m.rotation.x += .3; m.rotation.z += .2; if (Math.random() < .5) P(m.position.x, m.position.y + .4, m.position.z, { cel: K.FOGO, cor: [1, 1, 1], vida: .3, t0: .5, t1: 0, vel: [0, 1, 0] }); if (k >= 1) { m.visible = false; return false; } return true; });
        return; }
      case 'farao.r': case 'farao.w': cetroErguido(h, d.fxId === 'farao.r' ? 2.4 : 1); if (d.fxId === 'farao.w') som('zumbido', h.obj.position); return;
      case 'davi.r': return;
    }
  }
  function cetroErguido(h, dur) { const m = objeto('cetro_farao', 1.9, null, [.5, 1, .55]); if (!m) return; efeito(dur, (e) => { const p = h.obj.position; m.position.set(p.x, 3.4 * h.def.esc + Math.sin(e.t * 4) * .1, p.z); m.rotation.y += .05; m.scale.setScalar(Math.min(1, e.t * 5) * (e.t > dur - .2 ? (dur - e.t) * 5 : 1)); if (Math.random() < .4) P(p.x + rnd(.3), m.position.y + .7, p.z + rnd(.3), { cel: K.FAISCA, cor: COR.ouro, vida: .4, t0: .35, t1: 0, vel: [0, .5, 0] }); if (e.t >= e.vida) { m.visible = false; return false; } return true; }); }
  // ============ linhas ============
  function linhaIni(d, o, dir, h, t) {
    if (d.fxId !== 'golias.q') return false;
    // lança de bronze do Tripo arremessada ao longo da linha (1Sm 17:7)
    const m = objeto('lanca', 2.8, null, null); som('lancaPesada', o); if (!m) return true; const a = o.clone().setY(2.2);
    const voo = .22; C.agendar(Math.max(0, t - voo), () => efeito(voo + .5, (e) => { const k = Math.min(1, e.t / voo); m.position.copy(a).addScaledVector(dir, d.comp * k); m.position.y = 2.2 - k * 1.4; m.lookAt(m.position.x + dir.x, m.position.y - .3, m.position.z + dir.z); if (k < 1) D(m.position.x, m.position.y, m.position.z, { cor: COR.poeira, vida: .6, t0: .5, t1: 1.2, vel: [rnd(.5), .3, rnd(.5)], alpha: .6 }); if (e.t >= e.vida) { m.visible = false; return false; } return true; }));
    return true;
  }
  function linha(d, o, dir, comp, larg, h) {
    if (d.fxId === 'golias.q') { const f = o.clone().addScaledVector(dir, comp); decal(f, 1.6, 1.8, [1, .7, .45]); for (let j = 0; j < 18; j++) { const k = Math.random() * comp; D(o.x + dir.x * k + rnd(.6), .3, o.z + dir.z * k + rnd(.6), { cor: COR.poeira, vida: 1.1, t0: .8, t1: 1.8, vel: [rnd(1.5), 1.5, rnd(1.5)], alpha: .7 }); } explosao(f, 10, { cel: K.LASCA, normal: true, cor: [COR.rocha, COR.bronze], s: 5, y: .4, vy: 6, grav: 15, t0: .35, t1: .25, vida: 1, giro: 9, drag: .3 }); C.tremer(.25); return true; }
    if (d.fxId === 'sansao.r') { som('desmorona', o); for (let j = 0; j < 20; j++) { const k = Math.random() * comp, sd = rnd(larg / 2); explosao({ x: o.x + dir.x * k + dir.z * sd, z: o.z + dir.z * k - dir.x * sd }, 1, { cel: K.LASCA, normal: true, cor: [COR.rocha, COR.pedra, COR.osso], s: 3, y: .5, vy: 8, grav: 16, t0: .55, t1: .4, vida: 1.3, giro: 7, drag: .3 }); } for (let i = 0; i < 3; i++) decal(o.clone().addScaledVector(dir, comp * (.3 + i * .3)), larg * .6, 2.2, [1, .8, .55]);
      for (let j = 0; j < 40; j++) { const k = Math.random() * comp, sd = rnd(larg / 2); D(o.x + dir.x * k + dir.z * sd, .4, o.z + dir.z * k - dir.x * sd, { cor: [.55, .48, .4], vida: 1.3, t0: .9, t1: 2.2, vel: [rnd(1.5), 2 + Math.random() * 3, rnd(1.5)], alpha: .8 }); } C.tremer(.6); return true; } // decalques do pool no lugar das 4 rachaduras novas
    return false;
  }
  // ============ buffs ============
  function buff(d, h) {
    const p = h.obj.position;
    switch (d.fxId) {
      case 'davi.w': som('harpa', p); for (let j = 0; j < 16; j++) C.agendar(j * .07, () => { const a = j * .8; P(p.x + Math.cos(a) * 1.2, 1 + j * .12, p.z + Math.sin(a) * 1.2, { cel: K.NOTA, cor: j % 2 ? COR.ouro : COR.ouroClaro, vel: [-Math.sin(a) * 1.2, 1.4, Math.cos(a) * 1.2], vida: 1.1, t0: .6, t1: .35, drag: .5, rot: rnd(.3) }); }); P(p.x, 1.6, p.z, { cel: K.LUZ, cor: COR.ouroClaro, vida: .7, t0: 2.5, t1: 3.5 }); return true;
      case 'sansao.w': som('rugido', p); C.tremer(.18); P(p.x, 2.2, p.z, { cel: K.LUZ, cor: [1, .6, .2], vida: .7, t0: 3.5, t1: 6, giro: 1 }); for (let j = 0; j < 18; j++) { const a = j / 18 * TAU; D(p.x + Math.cos(a) * 1.2, .3, p.z + Math.sin(a) * 1.2, { cor: COR.terra, vel: [Math.cos(a) * 6, .8, Math.sin(a) * 6], vida: .9, t0: .8, t1: 1.8, drag: 2.5, alpha: .75 }); } for (let i = 0; i < 3; i++) C.agendar(i * .09, () => C.aneis.add(p, new THREE.Color(...COR.leao), .8, 3 + i * .6, .45, 1.2, .9)); for (let j = 0; j < 14; j++) { const a = j / 14 * TAU; P(p.x + Math.cos(a) * .7, 1.8, p.z + Math.sin(a) * .7, { cel: K.FOGO, cor: [1, .85, .7], vel: [Math.cos(a) * 6, 1.5, Math.sin(a) * 6], vida: .6, t0: 1.4, t1: .5, drag: 3 }); } return true; // juba de fogo
      case 'debora.e': { som('sino', p); const r = d.aliados || 6; for (let j = 0; j < 26; j++) { const a = j / 26 * TAU; P(p.x + Math.cos(a) * .8, .8 + (j % 3) * .4, p.z + Math.sin(a) * .8, { cel: K.FOLHA, cor: j % 2 ? COR.folha : [1, .9, .5], vel: [Math.cos(a) * r * .9 - Math.sin(a) * 3, .6, Math.sin(a) * r * .9 + Math.cos(a) * 3], vida: .9, t0: .55, t1: .3, drag: 1.4, giro: rnd(8) }); } for (const u of C.aliados(h, r)) P(u.obj.position.x, 1.4, u.obj.position.z, { cel: K.CURA, cor: [1, 1, 1], vida: .6, t0: 1.6, t1: 2.2, giro: 5 }); return true; }
      case 'gideao.e': som('orvalho', p); for (let j = 0; j < 26; j++) P(p.x + rnd(1.3), 3.5 + Math.random() * 2, p.z + rnd(1.3), { cor: COR.orvalho, vel: [0, -4, 0], vida: 1, t0: .22, t1: .18, drag: 0 }); for (let j = 0; j < 10; j++) { const a = j / 10 * TAU; D(p.x + Math.cos(a) * .9, .4, p.z + Math.sin(a) * .9, { cor: COR.la, vida: 1.1, t0: .8, t1: 1.4, vel: [Math.cos(a) * .6, .5, Math.sin(a) * .6], alpha: .7 }); } return true; // velo e orvalho
    }
    return false;
  }
  // ============ dash / blink / salto / marca / invocação / zonas ============
  function dash(h, d, p) {
    switch (d.fxId) {
      case 'davi.e': D(p.x, .4, p.z, { cor: COR.la, vida: .7, t0: .6, t1: 1.3, vel: [rnd(1), .8, rnd(1)], alpha: .7 }); P(p.x, 1, p.z, { cel: K.FAISCA, cor: COR.ouro, vida: .3, t0: .4, t1: 0 }); if (!h._somDash) { h._somDash = 1; som('pastor', p); } return true;
      case 'sansao.e': D(p.x, .3, p.z, { cor: COR.terra, vida: .6, t0: .6, t1: 1.4, vel: [rnd(1.5), 1, rnd(1.5)], alpha: .7 }); if (Math.random() < .5) P(p.x, 1.2, p.z, { cel: K.FOGO, cor: [1, .8, .6], vida: .25, t0: .6, t1: 0 }); return true;
      case 'nabuco.e': P(p.x, 1.2, p.z, { cel: Math.random() < .5 ? K.FAISCA : K.BRILHO, cor: Math.random() < .5 ? COR.ouroRei : COR.ferro, vida: .35, t0: .7, t1: 0, vel: [rnd(1), .5, rnd(1)] }); D(p.x, .3, p.z, { cor: COR.poeira, vida: .6, t0: .6, t1: 1.3, vel: [rnd(1), 1, rnd(1)], alpha: .6 }); if (!h._somDash) { h._somDash = 1; som('corneta', p, .7); } return true;
    }
    return false;
  }
  function blink(h, d, a, b) {
    if (d.fxId !== 'jezabel.e') return false; som('lamina', a, .6); som('encanto', b, .5);
    for (const p of [a, b]) { for (let j = 0; j < 7; j++) D(p.x + rnd(.6), .5 + Math.random() * 1.4, p.z + rnd(.6), { cel: K.FUMACA, cor: [.75, .5, .9], vida: .9, t0: 1, t1: 1.6, vel: [rnd(.8), .6, rnd(.8)], alpha: .85, giro: rnd(1) }); explosao(p, 6, { cel: K.CORACAO, cor: COR.rosa, s: 3, y: 1.4, vy: 2, t0: .4, t1: .1, vida: .7, giro: 3 }); }
    const n = 8; for (let j = 0; j < n; j++) { const k = j / n; P(a.x + (b.x - a.x) * k, 1.2, a.z + (b.z - a.z) * k, { cel: K.RISCO, cor: COR.roxo, vida: .25, t0: 1.6, t1: .5, rot: angTela(a, b.clone().sub(a)) }); }
    return true;
  }
  function dashFim(h, d) { h._somDash = 0; }
  function salto(d, h, c) {
    if (d.fxId !== 'gideao.r') return false;
    const m = objeto('espada_luz', 4.6, EIXO.espada_luz, [1, .85, .4]); if (m) m.material.emissive.setRGB(.35, .25, .08);
    if (m) efeito(1.2, (e) => { const k = Math.min(1, e.t / .18); m.position.set(c.x + .6, 2.1 + (1 - k) * 8, c.z + 1.5); m.rotation.y = .3; /* cravada à frente (lado da câmera): não some atrás do herói */ if (e.t > .9) m.scale.setScalar(Math.max(.01, (1.2 - e.t) / .3)); if (e.t >= e.vida) { m.visible = false; return false; } return true; });
    areas['gideao.r'](c, d.raio); C.tremer(.35); return true;
  }
  function marcaIni(d, h, alvo) { if (d.fxId !== 'jezabel.r') return null; som('veneno', alvo.obj.position, .6); const m = objeto('cristal_trevas', 1.3, null, [.8, .3, 1]); return { m }; }
  function marcaUp(st, alvo, e) { if (!st) return false; const p = alvo.obj.position; if (st.m) { st.m.position.set(p.x, 3.8 + Math.sin(e.t * 5) * .15, p.z); st.m.rotation.y += .06; }
    if (Math.random() < .5) { const a = e.t * 6 + Math.random(); P(p.x + Math.cos(a) * 1.2, 1 + Math.random() * 2, p.z + Math.sin(a) * 1.2, { cel: K.ESPINHO, cor: Math.random() < .5 ? COR.roxo : COR.veneno, vida: .5, t0: .45, t1: .2, vel: [-Math.sin(a) * 2, .5, Math.cos(a) * 2], rot: -a }); } return true; }
  function marcaFim(st, alvo) { if (!st) return false; if (st.m) st.m.visible = false; if (st.so) return true; const c = alvo.obj.position; som('gongo', c); P(c.x, 3.8, c.z, { cel: K.FUMACA, cor: [1, .7, 1], vida: .5, t0: 2, t1: 4 });
    explosao({ x: c.x, z: c.z }, 16, { cel: K.ESPINHO, cor: [COR.roxo, COR.veneno], s: 9, y: 1.2, vy: 1, t0: .6, t1: .3, vida: .5, alinhar: true, drag: 2 }); explosao({ x: c.x, z: c.z }, 10, { cel: K.LASCA, cor: [[.7, .35, 1]], s: 6, y: 3.8, vy: 2, grav: 10, t0: .35, vida: .7, giro: 8 });
    for (let j = 0; j < 12; j++) D(c.x + rnd(1.6), .4 + Math.random() * 1.6, c.z + rnd(1.6), { cel: K.FUMACA, cor: j % 2 ? [.5, 1, .3] : [.7, .4, 1], vida: 1.6, t0: 1.2, t1: 2.4, vel: [rnd(.6), .4, rnd(.6)], alpha: .7, giro: rnd(.8) }); C.aneis.add(c, new THREE.Color(...COR.roxo), .3, 2.6, .6); return true; }
  function invocar(d, h, p) { if (d.fxId !== 'nabuco.w') return false; if (!h._somInv || performance.now() - h._somInv > 500) { h._somInv = performance.now(); som('corneta', p); }
    P(p.x, 2, p.z, { cel: K.LUZ, cor: COR.ouroRei, vida: .6, t0: 3, t1: 4.5 }); for (let j = 0; j < 14; j++) P(p.x + rnd(.6), .3 + Math.random(), p.z + rnd(.6), { cel: K.FAISCA, cor: j % 2 ? COR.ouroRei : COR.ferro, vel: [rnd(1.5), 3 + Math.random() * 3, rnd(1.5)], vida: .8, t0: .55, t1: 0, giro: rnd(4) }); C.aneis.add(p, new THREE.Color(...COR.ouroRei), .3, 2, .6); return true; }
  const zonas = {
    'debora.w': (c, r, dt, t) => { if (Math.random() < dt * 14) { const a = Math.random() * TAU; P(c.x + Math.cos(a) * r * .8, 4 + Math.random(), c.z + Math.sin(a) * r * .8, { cel: K.FOLHA, cor: Math.random() < .5 ? COR.folha : COR.folhaEsc, vel: [-Math.sin(a) * 1.5, -1.6, Math.cos(a) * 1.5], vida: 2, t0: .45, t1: .4, drag: .2, giro: rnd(4) }); } if (t % .5 < dt) P(c.x, .25, c.z, { cel: K.CURA, cor: [1, 1, 1], vida: .9, t0: r * 1.6, t1: r * 2, giro: 2.5, alpha: .7 }); },
    'farao.w': (c, r, dt, t) => { const n = Math.random() < dt * 60 ? 3 : 0; for (let j = 0; j < n; j++) { const a = t * 3 + Math.random() * TAU, dd = Math.sqrt(Math.random()) * r; (j % 2 ? D : P)(c.x + Math.cos(a) * dd, .5 + Math.random() * 2, c.z + Math.sin(a) * dd, { cel: K.GAFANHOTO, cor: j % 2 ? [.28, .26, .08] : [.75, .8, .3], vel: [-Math.sin(a) * 7 + rnd(2), rnd(1.5), Math.cos(a) * 7 + rnd(2)], vida: .6, t0: .9, t1: .8, drag: 0, rot: -a }); } if (Math.random() < dt * 22) { const a = Math.random() * TAU; D(c.x + Math.cos(a) * r, .3, c.z + Math.sin(a) * r, { cor: COR.areia, vida: 1, t0: .7, t1: 1.6, vel: [-Math.sin(a) * 5, .6, Math.cos(a) * 5], alpha: .7 }); } if (t % .6 < dt) C.aneis.add(c, new THREE.Color(...COR.areia), r * .9, r * 1.02, .5, .1, .5); },
    'nabuco.r': (c, r, dt, t) => { const n = Math.random() < dt * 26 ? 1 : 0; for (let j = 0; j < n; j++) { const a = Math.random() * TAU; P(c.x + Math.cos(a) * r, .6, c.z + Math.sin(a) * r, { cel: K.FOGO, cor: [1, 1, 1], vel: [0, 3 + Math.random() * 2, 0], vida: .6, t0: 1.3, t1: .4, drag: .5 }); } if (Math.random() < dt * 20) { const a = Math.random() * TAU, dd = Math.random() * r; P(c.x + Math.cos(a) * dd, .3, c.z + Math.sin(a) * dd, { cor: COR.fornalha, vel: [0, 4, 0], vida: .7, t0: .25, t1: 0 }); } if (t % .9 < dt) C.aneis.add(c, new THREE.Color(...COR.fornalha), r * .95, r * 1.05, .5, .1, .6); },
  };
  function zona(d, c, r, dt, t) { const f = zonas[d.fxId]; if (!f) return false; f(c, r, dt, t); return true; }
  function zonaIni(d, c) { if (d.fxId === 'nabuco.r') som('fornalha', c); else if (d.fxId === 'debora.w') som('vento', c, .6); else if (d.fxId === 'farao.w') som('zumbido', c); }
  function atualizar(dt) { for (const m of decais) if (m.visible) { const u = m.userData; u.t += dt; const k = u.t / u.vida; if (k >= 1) { m.visible = false; continue; } m.material.opacity = u.op * Math.min(1, (1 - k) * 3) * Math.min(1, u.t * 12); const s = u.r * 2.2 * (.85 + .15 * Math.min(1, u.t * 8)); m.scale.set(s, 1, s); } }
  // aquece: cria as geometrias e compila (sem tranco no 1º uso)
  function preparar() { geoTripo('pedra_funda', .75); geoTripo('lanca', 2.8); geoTripo('espada_luz', 4.6, EIXO.espada_luz); geoTripo('cetro_farao', 1.9); geoTripo('cristal_trevas', 1.3); geoTripo('tocha_gideao', 1.1);
    // deixa 1 de cada no pool (escondido): aquecerShaders() do main compila os shaders deles no carregamento
    decal({ x: 0, z: 0 }, 1, .01); for (const [n, c, e] of [['pedra_funda', .75], ['lanca', 2.8], ['espada_luz', 4.6, EIXO.espada_luz], ['cetro_farao', 1.9], ['cristal_trevas', 1.3], ['tocha_gideao', 1.1]]) { const o = objeto(n, c, e, [1, 1, 1]); if (o) o.visible = false; } punho().visible = false; }
  return { proj, trilha, lancou, acerto, area, inicio, linhaIni, linha, buff, dash, dashFim, blink, salto, marcaIni, marcaUp, marcaFim, invocar, zona, zonaIni, atualizar, preparar };
}
