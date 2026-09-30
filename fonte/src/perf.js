// Desempenho: contador de FPS, sombras "blob" instanciadas, texturas grandes reduzidas no carregamento,
// suporte a KTX2 e ganchos de LOD / culling para os modelos novos (Tripo, ~10k polígonos e texturas 4K).
import * as THREE from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';

// ---------- KTX2 (texturas comprimidas na GPU) ----------
export function configurarKTX2(loader, renderer) {
  const k = new KTX2Loader().setTranscoderPath(import.meta.env.BASE_URL + 'basis/').detectSupport(renderer);
  loader.setKTX2Loader(k); return k;
}

// ---------- texturas: no máximo 1024 px (4K do Tripo -> 1024) ----------
// KTX2/compressas não são tocadas (já vêm no tamanho certo pelo tools/comprimir_modelo.mjs).
export function reduzirTexturas(root, max = 1024, renderer = null) {
  const vistas = new Set(); let n = 0;
  root.traverse(o => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m) continue;
      for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap']) {
        const t = m[k]; if (!t || vistas.has(t) || t.isCompressedTexture || !t.image) continue; vistas.add(t);
        const im = t.image, w = im.width, h = im.height; if (!w || Math.max(w, h) <= max) continue;
        const s = max / Math.max(w, h); const cv = document.createElement('canvas'); cv.width = Math.round(w * s); cv.height = Math.round(h * s);
        cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); if (im.close) im.close();
        t.image = cv; t.needsUpdate = true; n++;
      }
      if (renderer && m.map) m.map.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    }
  });
  return n;
}

// ---------- LOD para personagens com esqueleto ----------
// registrarLOD(base, [{ dist: 0, obj: altaPoli }, { dist: 18, obj: baixaPoli }]): ambos compartilham o mesmo esqueleto
// (mesmos nomes de ossos), então a mesma AnimationMixer anima os dois; só um fica visível por vez.
export function juntarLOD(base, lodCena, dist = 18) {
  const ossos = {}; base.traverse(o => { if (o.isBone) ossos[o.name] = o; });
  base.traverse(o => { if (o.isMesh) o.userData.lod = 0; });
  const add = [];
  lodCena.traverse(o => { if (!o.isSkinnedMesh) return; const bs = o.skeleton.bones.map(b => ossos[b.name]); if (bs.some(b => !b)) { console.warn('[lod] ossos diferentes, LOD ignorado'); return; }
    // LOD com cor nos vértices (tools/comprimir_modelo.mjs --lod): material simples, sem texturas; senão usa o material do modelo principal
    let mat = o.material; if (o.geometry.attributes.color) mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .78, metalness: .05, name: 'lod1_cores' }); else { let m0 = null; base.traverse(x => { if (!m0 && x.isSkinnedMesh) m0 = x.material; }); if (m0) mat = m0; }
    const m = new THREE.SkinnedMesh(o.geometry, mat); m.userData.lod = 1; m.castShadow = false; m.receiveShadow = true; m.visible = false; add.push([m, new THREE.Skeleton(bs, o.skeleton.boneInverses.map(x => x.clone())), o.bindMatrix.clone()]); });
  const pai = [...Object.values(ossos)][0]?.parent || base;
  for (const [m, sk, bm] of add) { pai.add(m); m.bind(sk, bm); }
  if (add.length) base.userData.lod = [{ nivel: 0, dist: 0 }, { nivel: 1, dist }];
  return add.length;
}
export function aplicarLOD(u, camPos) {
  const niveis = u.modelo.userData.lod; if (!niveis) return;
  const d = u.obj.position.distanceTo(camPos); let esc = niveis[0];
  for (const n of niveis) if (d >= n.dist) esc = n; u.lodNivel = esc.nivel;
  for (const n of niveis) { const on = n === esc; if (!n.nos) { n.nos = []; u.modelo.traverse(o => { if (o.isMesh && o.userData.lod === n.nivel) n.nos.push(o); }); } for (const o of n.nos) o.visible = on; }
}

// ---------- culling de personagens com pele (SkinnedMesh) ----------
// a esfera do modelo em pose de repouso é aumentada para cobrir ataques/braços abertos; assim o three.js
// deixa de desenhar (e de projetar sombra) quem está fora da câmera
export function ativarCulling(base, folga = 1.45) {
  base.updateMatrixWorld(true);
  base.traverse(o => { if (o.isSkinnedMesh) { o.computeBoundingSphere(); o.boundingSphere.radius *= folga; o.frustumCulled = true; } });
}
const _fr = new THREE.Frustum(), _m4 = new THREE.Matrix4(), _sp = new THREE.Sphere();
export function atualizarFrustum(camera) { _m4.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); _fr.setFromProjectionMatrix(_m4); }
export function naTela(pos, raio = 2.5) { _sp.center.set(pos.x, pos.y + 1.2, pos.z); _sp.radius = raio; return _fr.intersectsSphere(_sp); }

// ---------- sombras "blob" (uma InstancedMesh = 1 draw call para todas as tropas) ----------
export class SombrasBlob {
  constructor(scene, max = 64) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,.62)'); gr.addColorStop(.55, 'rgba(0,0,0,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.m = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, color: 0xffffff }), max);
    this.m.frustumCulled = false; this.m.renderOrder = 1; this.m.count = 0; this.max = max; scene.add(this.m);
    this._q = new THREE.Quaternion(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3(); this._mt = new THREE.Matrix4();
  }
  atualizar(lista) {
    let i = 0;
    for (const u of lista) { if (i >= this.max) break; if (!u.obj.visible || u.remover) continue; const r = (u.raio || .7) * 2.1 * (u.vivo ? 1 : Math.max(0, 1 - u.morteT)); if (r <= .01) continue;
      this._mt.compose(this._v.set(u.obj.position.x, .05, u.obj.position.z), this._q, this._s.set(r, 1, r)); this.m.setMatrixAt(i++, this._mt); }
    this.m.count = i; this.m.instanceMatrix.needsUpdate = true;
  }
}

// ---------- contador de FPS detalhado ----------
export class ContadorFPS {
  constructor(renderer) {
    this.r = renderer; this.el = document.createElement('div'); this.el.id = 'fpsPainel'; document.body.appendChild(this.el);
    this.t = 0; this.n = 0; this.ms = []; this.on = false;
  }
  mostrar(on) { this.on = on; this.el.style.display = on ? 'block' : 'none'; }
  quadro(dt, msCpu, info, extra) {
    if (!this.on) return; this.t += dt; this.n++; this.ms.push(msCpu); if (this.t < .5) return;
    const fps = this.n / this.t; const s = [...this.ms].sort((a, b) => a - b); const p95 = s[Math.floor(s.length * .95)] || 0;
    this.el.innerHTML = `<b style="color:${fps >= 55 ? '#8f8' : fps >= 40 ? '#fd6' : '#f77'}">${fps.toFixed(0)} FPS</b> · ${(1000 * this.t / this.n).toFixed(1)} ms<br>CPU ${s[s.length >> 1].toFixed(1)} ms (p95 ${p95.toFixed(1)})<br>draw calls ${info.calls} · ${(info.triangles / 1000).toFixed(0)}k tri<br>${extra}`;
    this.t = 0; this.n = 0; this.ms.length = 0;
  }
}
