import * as THREE from 'three';
import { clone as skClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { laneZ } from './world.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const tmpV = new THREE.Vector3();
const NOMERGE = location.search.includes('nomerge');

// Prepara o modelo base (materiais, sombras) antes de clonar
export function prepararBase(gltf, tipo) {
  const root = gltf.scene;
  root.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
    const m = o.material;
    if (m && m.map) { m.map.anisotropy = 4; }
    if (m) { m.roughness = 0.72; m.metalness = 0.0; }
    if (tipo === 'sombra' && m && m.name === 'Glow') {
      o.material = new THREE.MeshStandardMaterial({ color: 0xff2030, emissive: 0xff1a2a, emissiveIntensity: 6, roughness: .4 }); o.material.userData.glow = true;
      o.castShadow = false;
    }
    if (tipo === 'guardiao' && m && m.name !== 'Glow') { m.metalness = 0.35; m.roughness = 0.45; }
    if (tipo === 'sombra' && m && m.name !== 'Glow') { m.roughness = 0.35; m.metalness = .25; }
  });
  // junta as partes com pele (skinned) que usam o mesmo material: menos draw calls no celular
  const grupos = new Map();
  root.traverse(o => { if (o.isSkinnedMesh) { const k = o.parent.uuid + o.material.uuid; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(o); } });
  for (const lista of grupos.values()) {
    if (lista.length < 2 || NOMERGE) continue;
    const attrs = Object.keys(lista[0].geometry.attributes).sort().join();
    if (!lista.every(m => Object.keys(m.geometry.attributes).sort().join() === attrs)) continue;
    // une os ossos de todas as partes e remapeia os índices de pele
    const ossos = [], inversas = [];
    const geos = lista.map(m => {
      // cada parte pode ter matrizes inversas diferentes (quantização): calcula a correção D
      let D = new THREE.Matrix4();
      const jRef = m.skeleton.bones.findIndex(b => ossos.includes(b));
      if (jRef >= 0) D = new THREE.Matrix4().copy(inversas[ossos.indexOf(m.skeleton.bones[jRef])]).invert().multiply(m.skeleton.boneInverses[jRef]);
      const Dinv = D.clone().invert();
      const map = m.skeleton.bones.map((b, i) => { let k = ossos.indexOf(b); if (k < 0) { k = ossos.length; ossos.push(b); inversas.push(m.skeleton.boneInverses[i].clone().multiply(Dinv)); } return k; });
      const g = m.geometry.clone(); const si = g.attributes.skinIndex;
      const arr = new Uint16Array(si.count * 4);
      for (let i = 0; i < si.count; i++) for (let c = 0; c < 4; c++) arr[i * 4 + c] = map[si.getComponent(i, c)] ?? 0;
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(arr, 4));
      if (g.attributes.skinWeight.normalized || g.attributes.skinWeight.array.constructor !== Float32Array) { const w = g.attributes.skinWeight; const fa = new Float32Array(w.count * 4); for (let i = 0; i < w.count; i++) for (let c = 0; c < 4; c++) fa[i * 4 + c] = w.getComponent(i, c); g.setAttribute('skinWeight', new THREE.BufferAttribute(fa, 4)); }
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'skinIndex', 'skinWeight'].includes(k)) g.deleteAttribute(k);
      ['position', 'normal', 'uv'].forEach(k => { const a = g.attributes[k]; if (a && (a.normalized || a.array.constructor !== Float32Array)) { const fa = new Float32Array(a.count * a.itemSize); for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) fa[i * a.itemSize + c] = a.getComponent(i, c); g.setAttribute(k, new THREE.BufferAttribute(fa, a.itemSize)); } });
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(D, m.bindMatrix));
      return g;
    });
    const g = mergeGeometries(geos, false); if (!g) continue;
    const a = lista[0]; const nm = new THREE.SkinnedMesh(g, a.material); nm.name = a.name + '_unido';
    nm.castShadow = true; nm.receiveShadow = true; nm.frustumCulled = false;
    a.parent.add(nm); nm.bind(new THREE.Skeleton(ossos, inversas), new THREE.Matrix4());
    lista.forEach(m => m.parent.remove(m));
  }
  return root;
}

// cor do lampejo ao levar dano: branco quente (físico), ouro (crítico), roxo (mágico), vermelho (você apanhando)
const FLASH = { base: [.16, .12, .1], fis: [.42, .36, .3], crit: [.7, .48, .12], mag: [.38, .16, .62], mal: [.6, .08, .06] };
export class Unidade {
  constructor(base, clips, o) {
    this.obj = new THREE.Group();
    this.modelo = skClone(base); this.obj.add(this.modelo);
    this.modelo.scale.setScalar(o.escala || 1);
    this.time = o.time; this.tipo = o.tipo; this.nome = o.nome || '';
    this.maxHp = o.hp || 400; this.hp = this.maxHp; this.vel = o.vel || 3.2; this.alcance = o.alcance || 1.8; this.dano = o.dano || 20; this.cadencia = o.cadencia || 1.1;
    this.raio = o.raio || .6; this.vivo = true; this.cd = Math.random() * .5; this.alvo = null; this.estado = 'idle'; this.morteT = 0; this.flash = 0;
    this.mixer = new THREE.AnimationMixer(this.modelo); this.acoes = {};
    for (const c of clips) this.acoes[c.name] = this.mixer.clipAction(c);
    this.anim = o.anim; this.atual = null;
    this.tocar(this.anim.idle, 0);
    this.mixer.addEventListener('finished', (e) => { if (this.onFim) this.onFim(e.action); });
    this.mats = []; this.modelo.traverse(m => { if (m.isMesh) { const o0 = m.material; m.material = o0.clone(); m.material.onBeforeCompile = o0.onBeforeCompile; m.material.customProgramCacheKey = o0.customProgramCacheKey; m.material.userData = o0.userData; this.mats.push(m.material); } });
    this.dir = new THREE.Vector3(o.time === 'luz' ? 1 : -1, 0, 0);
    this.obj.rotation.y = Math.atan2(this.dir.x, this.dir.z);
  }
  tocar(nome, fade = .18, vez = false, vel = 1) {
    const a = this.acoes[nome]; if (!a) return null;
    if (this.atual === a && !vez) { if (a.timeScale !== vel) a.timeScale += (vel - a.timeScale) * .25; return a; } // mesma ação: só acompanha a velocidade, sem reiniciar
    a.reset(); a.timeScale = vel; a.enabled = true;
    if (vez) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; } else a.setLoop(THREE.LoopRepeat, Infinity);
    if (this.atual && this.atual !== a) a.crossFadeFrom(this.atual, fade, false); else a.fadeIn(fade);
    a.play(); this.atual = a; return a;
  }
  olharPara(p, dt, k = 14) {
    const ang = Math.atan2(p.x - this.obj.position.x, p.z - this.obj.position.z);
    let d = ang - this.obj.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
    this.obj.rotation.y += d * Math.min(1, dt * k);
  }
  levarDano(v) {
    if (!this.vivo) return false; this.hp -= v; this.flash = .12;
    if (this.hp <= 0) { this.hp = 0; this.vivo = false; this.estado = 'morto'; this.morteT = 0; this.tocar(this.anim.morte, .1, true); return true; }
    return false;
  }
  atualizarFlash(dt) {
    if (this.flash > 0) { this.flash -= dt; const k = Math.max(0, this.flash / .15); const c = FLASH[this.flashCor] || FLASH.base; this.mats.forEach(m => { if (m.emissive && !m.userData.glow) { m.emissive.setRGB(k * c[0], k * c[1], k * c[2]); } }); if (this.flash <= 0) this.flashCor = null; }
  }
}

// Acessórios do Davi: funda (na mão direita) e cajado de pastor (nas costas)
export function vestirDavi(u) {
  const madeira = new THREE.MeshStandardMaterial({ color: 0x7a4f2a, roughness: .7 });
  const couro = new THREE.MeshStandardMaterial({ color: 0x5a3a1e, roughness: .8 });
  const corda = new THREE.MeshStandardMaterial({ color: 0xd8c08a, roughness: .9 });
  let maoD, peito, mao2;
  u.modelo.traverse(o => { if (o.name === 'handslot.r') maoD = o; if (o.name === 'chest') peito = o; if (o.name === 'Throwable') o.visible = false; });
  // cajado com gancho
  const curva = new THREE.CurvePath();
  curva.add(new THREE.LineCurve3(new THREE.Vector3(0, -1.1, 0), new THREE.Vector3(0, 1.0, 0)));
  curva.add(new THREE.CubicBezierCurve3(new THREE.Vector3(0, 1.0, 0), new THREE.Vector3(0, 1.45, 0), new THREE.Vector3(.42, 1.45, 0), new THREE.Vector3(.42, 1.1, 0)));
  const caj = new THREE.Mesh(new THREE.TubeGeometry(curva, 40, .045, 6, false), madeira); caj.castShadow = true;
  const cajG = new THREE.Group(); cajG.add(caj); cajG.position.set(0.05, 0.1, -0.32); cajG.rotation.set(0.1, 0, -0.55); if (peito) peito.add(cajG);
  // funda: bolsa de couro + cordas
  if (maoD) {
    const f = new THREE.Group();
    const bolsa = new THREE.Mesh(new THREE.SphereGeometry(.09, 10, 8), couro); bolsa.scale.set(1.2, .6, 1); bolsa.position.set(0, -.42, .02); f.add(bolsa);
    const pedra = new THREE.Mesh(new THREE.DodecahedronGeometry(.06, 0), new THREE.MeshStandardMaterial({ color: 0xb8b0a0, roughness: .6 })); pedra.position.copy(bolsa.position); pedra.position.y += .03; f.add(pedra);
    for (const dx of [-.07, .07]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .42, 4), corda); c.position.set(dx * .5, -.21, .01); c.rotation.z = dx * 0.35; f.add(c); }
    f.position.set(0, -.02, .02); maoD.add(f); u.funda = f;
  }
  // anel de herói sob os pés
  return u;
}

// Marcador de seleção (anel azul do seu campeão, estilo MOBA)
export function anelHeroi() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.translate(128, 128); g.strokeStyle = '#7fd0ff'; g.shadowColor = '#3aa0ff'; g.shadowBlur = 14; g.lineWidth = 7; g.beginPath(); g.arc(0, 0, 100, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 3; g.globalAlpha = .7; g.beginPath(); g.arc(0, 0, 84, 0, Math.PI * 2); g.stroke();
  g.globalAlpha = 1; g.fillStyle = '#bfe8ff'; g.beginPath(); g.moveTo(0, -122); g.lineTo(-12, -104); g.lineTo(12, -104); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.rotation.x = -Math.PI / 2; m.position.y = .08; m.renderOrder = 4; return m;
}

// Aura sombria das Sombras (sprite escuro + brilho vermelho)
const texOlho = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.2, 'rgba(255,120,120,.9)'); gr.addColorStop(1, 'rgba(255,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
export function olhosSombra(u) {
  let cab; u.modelo.traverse(o => { if (o.name === 'head') cab = o; });
  if (!cab) return;
  const mat = new THREE.SpriteMaterial({ map: texOlho, color: 0xff2a3a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  for (const dx of [-.14, .14]) { const s = new THREE.Sprite(mat); s.scale.set(.42, .42, 1); s.position.set(dx, .42, .38); s.renderOrder = 8; cab.add(s); }
}
export function auraSombra(tex) {
  const g = new THREE.Group();
  const s = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ map: tex, color: 0x8a1a5a, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.rotation.x = -Math.PI / 2; s.position.y = .07; g.add(s); return g;
}

export { tmpV };
