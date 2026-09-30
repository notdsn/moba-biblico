// Montagem dos personagens com proporções humanas (base CC0 Quaternius) + equipamento feito em código:
// - "cascas" (shells) geradas a partir da própria malha do corpo -> armaduras que deformam com a animação
// - peças rígidas presas aos ossos (ombreiras, elmo, escudo, espada, funda, capa)
// - pintura da roupa direto no atlas UV do corpo
import * as THREE from 'three';
import { clone as skClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const C = (h) => new THREE.Color(h);

// ---------- categorias de osso ----------
function cat(n) {
  if (/^spine|clavicle/.test(n)) return 'tronco';
  if (n === 'pelvis' || n === 'root') return 'quadril';
  if (/^thigh/.test(n)) return 'coxa';
  if (/^calf/.test(n)) return 'canela';
  if (/^foot|^ball/.test(n)) return 'pe';
  if (/^upperarm/.test(n)) return 'braco';
  if (/^lowerarm/.test(n)) return 'antebraco';
  if (/^hand|index|middle|ring|pinky|thumb/.test(n)) return 'mao';
  return 'cabeca';
}

// ---------- material do equipamento (metal/couro/tecido num único draw call) ----------
const GLSL_NOISE = `
float eqH(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float eqN(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(eqH(i),eqH(i+vec2(1,0)),f.x),mix(eqH(i+vec2(0,1)),eqH(i+vec2(1,1)),f.x),f.y);}
`;
export function materialEquip() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .6, metalness: 0 });
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aMat; attribute vec3 aP; varying vec4 vMat; varying vec3 vP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMat=aMat; vP=aP;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec4 vMat; varying vec3 vP;' + GLSL_NOISE)
      .replace('#include <color_fragment>', `#include <color_fragment>
      {
        float pat=vMat.z;
        if(pat>.5&&pat<1.5){ // lamelas (escamas) em fileiras
          vec2 cu=vec2(atan(vP.x,vP.z+.03)*.15+vP.x*.2, vP.y);
          float rh=.032, rw=.024; float row=floor(cu.y/rh); float uu=cu.x/rw+mod(row,2.)*.5;
          vec2 c=vec2(fract(uu),fract(cu.y/rh));
          float ed=min(min(c.x,1.-c.x)*2.2, c.y*4.);
          float s=smoothstep(0.,.3,ed);
          diffuseColor.rgb*= (.45+.6*s)*(.8+.35*c.y)*(.88+.24*eqH(vec2(floor(uu),row)));
        } else if(pat>1.5&&pat<2.5){ // tiras de couro verticais com rebites
          float a=atan(vP.x-sign(vP.x)*.1,vP.z)*3.2; float st=fract(a);
          float e=smoothstep(0.,.12,st)*smoothstep(1.,.88,st);
          diffuseColor.rgb*=(.35+.65*e)*(.8+.35*st);
          diffuseColor.rgb*=.9+.2*eqN(vec2(a*3.,vP.y*60.));
        } else if(pat>2.5&&pat<3.5){ // tecido
          diffuseColor.rgb*=.86+.22*eqN(vP.xy*160.+vP.z*90.);
        } else if(pat>3.5){ // metal martelado
          diffuseColor.rgb*=.9+.18*eqN(vP.xz*70.+vP.y*55.);
        }
      }`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vMat.y;')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vMat.x;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vMat.w;');
  };
  m.customProgramCacheKey = () => 'equip1';
  return m;
}

// tipos de material: [metalness, roughness, padrão, emissão]
const MT = {
  bronze: [.85, .38, 4, 0], lamela: [.85, .42, 1, 0], ouro: [1, .28, 4, 0], prata: [.85, .44, 4, 0], prataL: [.85, .46, 1, 0],
  couro: [0, .72, 3, 0], tiras: [0, .7, 2, 0], tecido: [0, .9, 3, 0], madeira: [0, .8, 3, 0], pedra: [0, .6, 0, 0],
  obsid: [.35, .25, 4, 0], brilho: [0, .5, 0, 2.2], brilhoF: [0, .5, 0, 5], corda: [0, .9, 3, 0],
};

// ---------- construtor ----------
class Montador {
  constructor(body) {
    this.body = body; this.bones = body.skeleton.bones;
    this.bi = Object.fromEntries(this.bones.map((b, i) => [b.name, i]));
    this.bp = Object.fromEntries(this.bones.map(b => [b.name, new THREE.Vector3().setFromMatrixPosition(b.matrixWorld)]));
    this.partes = [];
    // mapeamento de marcos (corpo masculino de referência -> este corpo), usado no corpo feminino
    const bp = this.bp, top = 1.81 * bp.Head.y / 1.6;
    this.fem = Math.abs(bp.Head.y - 1.6) > .02;
    this._my = [[0, 0], [.086, bp.foot_l.y], [.542, bp.calf_l.y], [.949, bp.pelvis.y], [.971, bp.thigh_l.y], [1.072, bp.spine_01.y], [1.311, bp.spine_03.y], [1.52, bp.neck_01.y], [1.6, bp.Head.y], [1.81, top], [3, top + 1.19]];
    this._mx = [[0, 0], [.212, bp.upperarm_l.x], [.463, bp.lowerarm_l.x], [.706, bp.hand_l.x], [1.2, bp.hand_l.x + .494]];
    // posições de repouso (espaço do mundo) de cada vértice
    const g = body.geometry, n = g.attributes.position.count, v = new THREE.Vector3();
    this.P = new Float32Array(n * 3); this.dom = new Int32Array(n);
    for (let i = 0; i < n; i++) { body.getVertexPosition(i, v); v.applyMatrix4(body.matrixWorld); v.toArray(this.P, i * 3); }
    const si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
    for (let i = 0; i < n; i++) { let bw = -1, bj = 0; for (let c = 0; c < 4; c++) { const w = sw.getComponent(i, c); if (w > bw) { bw = w; bj = si.getComponent(i, c); } } this.dom[i] = bj; }
    // solda por posição -> normais contínuas para as cascas
    const key = (i) => `${Math.round(this.P[i * 3] * 4000)},${Math.round(this.P[i * 3 + 1] * 4000)},${Math.round(this.P[i * 3 + 2] * 4000)}`;
    const mapa = new Map(); this.uid = new Int32Array(n); this.rep = [];
    for (let i = 0; i < n; i++) { const k = key(i); let u = mapa.get(k); if (u === undefined) { u = this.rep.length; mapa.set(k, u); this.rep.push(i); } this.uid[i] = u; }
    // normais suaves no espaço de repouso
    const idx = g.index.array; const N = new Float32Array(this.rep.length * 3);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), cr = new THREE.Vector3();
    for (let t = 0; t < idx.length; t += 3) {
      const [i0, i1, i2] = [idx[t], idx[t + 1], idx[t + 2]];
      a.fromArray(this.P, i0 * 3); b.fromArray(this.P, i1 * 3); c.fromArray(this.P, i2 * 3);
      cr.subVectors(c, b).cross(a.clone().sub(b));
      for (const i of [i0, i1, i2]) { const u = this.uid[i]; N[u * 3] += cr.x; N[u * 3 + 1] += cr.y; N[u * 3 + 2] += cr.z; }
    }
    for (let u = 0; u < this.rep.length; u++) { v.fromArray(N, u * 3).normalize(); v.toArray(N, u * 3); }
    this.N = N; this.idx = idx;
    this.si = si; this.sw = sw;
  }
  _map(tab, v) { if (!this.fem) return v; const sg = v < 0 ? -1 : 1; v = Math.abs(v); for (let k = 1; k < tab.length; k++) if (v <= tab[k][0] || k === tab.length - 1) { const [a0, b0] = tab[k - 1], [a1, b1] = tab[k]; return sg * (b0 + (v - a0) / (a1 - a0) * (b1 - b0)); } return sg * v; }
  Y(v) { return this._map(this._my, v); }
  AX(v) { return this._map(this._mx, v); }
  catV(i) { return cat(this.bones[this.dom[i]].name); }
  dbg() { const r = {}; const t = this.tris((c, b) => { r[b] = r[b] || [0, 9, -9]; r[b][0]++; r[b][1] = Math.min(r[b][1], c.y); r[b][2] = Math.max(r[b][2], c.y); return false; }); console.log('CATS', JSON.stringify(r)); }
  // triângulos do corpo que satisfazem o predicado (centro + categoria majoritária)
  tris(pred) {
    const out = []; const idx = this.idx; const c = new THREE.Vector3();
    for (let t = 0; t < idx.length; t += 3) {
      c.set(0, 0, 0); const cats = {};
      for (let k = 0; k < 3; k++) { const i = idx[t + k]; c.x += this.P[i * 3] / 3; c.y += this.P[i * 3 + 1] / 3; c.z += this.P[i * 3 + 2] / 3; const ct = this.catV(i); cats[ct] = (cats[ct] || 0) + 1; }
      let best = null, bn = 0; for (const k in cats) if (cats[k] > bn) { bn = cats[k]; best = k; }
      if (pred(c, best)) out.push(t);
    }
    return out;
  }
  // casca: cópia deslocada da pele, recortada por planos (bainhas retas), com friso opcional
  // pred(c, cat): filtro por categoria no centro do triângulo; corte: [{eixo:'y'|'ax'|'z', min, max}]
  casca(pred, off, cor, mt, borda = null, corte = []) {
    const f = (P, e) => e === 'y' ? P[1] : e === 'ax' ? Math.abs(P[0]) : e === 'z' ? P[2] : e === 'd' ? P[1] - .62 * P[0] : P[1];
    const col = C(cor); const vmap = new Map();
    const pos = [], nrm = [], aP = [], sIdx = [], sW = [], cut = [], ind = [];
    const addV = (key, P, N, sk, isCut) => {
      let k = vmap.get(key); if (k !== undefined) return k;
      k = pos.length / 3; vmap.set(key, k);
      const n = new THREE.Vector3(...N).normalize();
      pos.push(P[0] + n.x * off, P[1] + n.y * off, P[2] + n.z * off); aP.push(...P); nrm.push(n.x, n.y, n.z);
      const ent = [...sk.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4); let tot = 0; ent.forEach(e => tot += e[1]);
      for (let c2 = 0; c2 < 4; c2++) { sIdx.push(ent[c2] ? ent[c2][0] : 0); sW.push(ent[c2] ? ent[c2][1] / tot : 0); }
      cut.push(isCut ? 1 : 0); return k;
    };
    const vert = (i) => { const u = this.uid[i], r = this.rep[u]; const sk = new Map(); for (let c2 = 0; c2 < 4; c2++) { const w = this.sw.getComponent(r, c2); if (w > 0) sk.set(this.si.getComponent(r, c2), w); } return { key: 'u' + u, P: [this.P[r * 3], this.P[r * 3 + 1], this.P[r * 3 + 2]], N: [this.N[u * 3], this.N[u * 3 + 1], this.N[u * 3 + 2]], sk, cut: false }; };
    const inter = (A, B, t, tag) => { const sk = new Map(); for (const [j, w] of A.sk) sk.set(j, (sk.get(j) || 0) + w * (1 - t)); for (const [j, w] of B.sk) sk.set(j, (sk.get(j) || 0) + w * t);
      const k2 = A.key < B.key ? A.key + '|' + B.key : B.key + '|' + A.key;
      return { key: k2 + tag, P: A.P.map((x, d) => x + (B.P[d] - x) * t), N: A.N.map((x, d) => x + (B.N[d] - x) * t), sk, cut: true }; };
    const clip = (poly, e, lim, sgn, tag) => { // mantém sgn*(f-lim) >= 0
      const out = [];
      for (let q = 0; q < poly.length; q++) {
        const A = poly[q], B = poly[(q + 1) % poly.length];
        const da = sgn * (f(A.P, e) - lim), db = sgn * (f(B.P, e) - lim);
        if (da >= 0) out.push(A);
        if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); out.push(inter(A, B, t, tag)); }
      }
      return out;
    };
    if (this.fem) corte = corte.map(c2 => { const mp = c2.eixo === 'ax' ? (v) => this.AX(v) : c2.eixo === 'z' ? (v) => v : (v) => this.Y(v); return { eixo: c2.eixo, min: c2.min === undefined ? undefined : mp(c2.min), max: c2.max === undefined ? undefined : mp(c2.max) }; });
    for (const t of this.tris(pred)) {
      let poly = [vert(this.idx[t]), vert(this.idx[t + 1]), vert(this.idx[t + 2])];
      corte.forEach((c2, ci) => { if (poly.length && c2.min !== undefined) poly = clip(poly, c2.eixo, c2.min, 1, '#' + ci + 'a'); if (poly.length && c2.max !== undefined) poly = clip(poly, c2.eixo, c2.max, -1, '#' + ci + 'b'); });
      if (poly.length < 3) continue;
      const ks = poly.map(v => addV(v.key, v.P, v.N, v.sk, v.cut));
      for (let q = 1; q < ks.length - 1; q++) if (ks[0] !== ks[q] && ks[q] !== ks[q + 1] && ks[0] !== ks[q + 1]) ind.push(ks[0], ks[q], ks[q + 1]);
    }
    if (!ind.length) return;
    const arestas = new Map();
    for (let q = 0; q < ind.length; q += 3) for (let e = 0; e < 3; e++) { const a = ind[q + e], b = ind[q + (e + 1) % 3]; const k = a < b ? a + '_' + b : b + '_' + a; const o = arestas.get(k); if (o) o.n++; else arestas.set(k, { a, b, c: ind[q + (e + 2) % 3], n: 1 }); }
    const nv = pos.length / 3;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(ind); g.computeVertexNormals();
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(nv).fill(0).flatMap(() => [col.r, col.g, col.b]), 3));
    g.setAttribute('aMat', new THREE.Float32BufferAttribute(new Array(nv).fill(0).flatMap(() => MT[mt]), 4)); g.setAttribute('aP', new THREE.Float32BufferAttribute(aP, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(sIdx, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sW, 4));
    this.partes.push(g.toNonIndexed());
    if (borda) { const so = borda.todas ? null : cut; for (const [k, e] of arestas) if (so && !(so[e.a] && so[e.b])) arestas.delete(k); this.friso(g, arestas, borda); }
  }
  // friso (borda dourada) nas arestas abertas de uma casca
  friso(g, arestas, { cor, mt = 'ouro', w = .016, h = .01 }) {
    const P = g.attributes.position, Nn = g.attributes.normal, S = g.attributes.skinIndex, W = g.attributes.skinWeight;
    const pos = [], nor = [], sI = [], sW = [], aP = []; const col = C(cor);
    const pa = new THREE.Vector3(), pb = new THREE.Vector3(), pc = new THREE.Vector3(), na = new THREE.Vector3(), nb = new THREE.Vector3(), dir = new THREE.Vector3(), inw = new THREE.Vector3();
    const push = (p, n, vi) => { pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z); aP.push(p.x, p.y, p.z); for (let c = 0; c < 4; c++) { sI.push(S.getComponent(vi, c)); sW.push(W.getComponent(vi, c)); } };
    for (const e of arestas.values()) {
      if (e.n !== 1) continue;
      pa.fromBufferAttribute(P, e.a); pb.fromBufferAttribute(P, e.b); pc.fromBufferAttribute(P, e.c);
      na.fromBufferAttribute(Nn, e.a); nb.fromBufferAttribute(Nn, e.b);
      dir.subVectors(pb, pa).normalize(); inw.subVectors(pc, pa); inw.addScaledVector(dir, -inw.dot(dir)).normalize();
      const a0 = pa.clone().addScaledVector(na, -h * .6), b0 = pb.clone().addScaledVector(nb, -h * .6);
      const a1 = pa.clone().addScaledVector(na, h), b1 = pb.clone().addScaledVector(nb, h);
      const a2 = a1.clone().addScaledVector(inw, w), b2 = b1.clone().addScaledVector(inw, w);
      const out = inw.clone().negate();
      // lábio (espessura) e faixa
      if (!this.baixo) for (const [p, n, vi] of [[a0, out, e.a], [b0, out, e.b], [b1, out, e.b], [a0, out, e.a], [b1, out, e.b], [a1, out, e.a]]) push(p, n, vi);
      for (const [p, n, vi] of [[a1, na, e.a], [b1, nb, e.b], [b2, nb, e.b], [a1, na, e.a], [b2, nb, e.b], [a2, na, e.a]]) push(p, n, vi);
    }
    if (!pos.length) return;
    const f = new THREE.BufferGeometry(); const n = pos.length / 3;
    f.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); f.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    f.setAttribute('color', new THREE.Float32BufferAttribute(new Array(n).fill(0).flatMap(() => [col.r, col.g, col.b]), 3));
    f.setAttribute('aMat', new THREE.Float32BufferAttribute(new Array(n).fill(0).flatMap(() => MT[mt]), 4)); f.setAttribute('aP', new THREE.Float32BufferAttribute(aP, 3));
    f.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(sI, 4)); f.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sW, 4));
    this.partes.push(f);
  }
  // peça rígida (geometria já no espaço do mundo em repouso); ossos: nome ou função(p)->[[nome,peso],...]
  peca(geo, osso, cor, mt) {
    let g = geo.index ? geo.toNonIndexed() : geo; g.deleteAttribute('uv'); if (g.attributes.uv1) g.deleteAttribute('uv1');
    if (!g.attributes.normal) g.computeVertexNormals();
    const n = g.attributes.position.count, col = C(cor);
    const sI = new Uint16Array(n * 4), sW = new Float32Array(n * 4), cols = new Float32Array(n * 3), mats = new Float32Array(n * 4);
    const p = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      p.fromBufferAttribute(g.attributes.position, i);
      const ws = typeof osso === 'function' ? osso(p) : [[osso, 1]];
      ws.forEach(([nm, w], c) => { sI[i * 4 + c] = this.bi[nm]; sW[i * 4 + c] = w; });
      col.toArray(cols, i * 3); mats.set(MT[mt], i * 4);
    }
    g.setAttribute('skinIndex', new THREE.BufferAttribute(sI, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sW, 4));
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.setAttribute('aMat', new THREE.BufferAttribute(mats, 4));
    g.setAttribute('aP', g.attributes.position.clone());
    this.partes.push(g);
  }
  finalizar(mat) {
    const g = mergeGeometries(this.partes.map(p => { for (const k of Object.keys(p.attributes)) if (!['position', 'normal', 'color', 'aMat', 'aP', 'skinIndex', 'skinWeight'].includes(k)) p.deleteAttribute(k); return p; }), false);
    const m = new THREE.SkinnedMesh(g, mat); m.name = 'equipamento'; if (window.__dbg) console.log('EQ', this.partes.map(p => p.attributes.position.count / 3).join(','), g.attributes.position.count / 3);
    m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
    this.body.parent.add(m); m.updateMatrixWorld(true);
    m.bind(new THREE.Skeleton(this.bones, this.bones.map(b => b.matrixWorld.clone().invert())), m.matrixWorld.clone());
    return m;
  }
}

// ---------- pintura do atlas do corpo ----------
function tileRuido(cor, forca = .22) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.fillStyle = cor; g.fillRect(0, 0, 64, 64);
  const d = g.getImageData(0, 0, 64, 64);
  for (let i = 0; i < d.data.length; i += 4) { const k = 1 - forca / 2 + Math.random() * forca; d.data[i] *= k; d.data[i + 1] *= k; d.data[i + 2] *= k; }
  g.putImageData(d, 0, 0); return c;
}
function pintar(mont, mapa, regras, { multiplicar = false } = {}) {
  const img = mapa.image; const W = img.width, H = img.height;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  g.drawImage(img, 0, 0, W, H);
  const uv = mont.body.geometry.attributes.uv; const idx = mont.idx;
  const pats = new Map(); const pat = (cor) => { if (!pats.has(cor)) pats.set(cor, g.createPattern(tileRuido(cor), 'repeat')); return pats.get(cor); };
  const c = new THREE.Vector3();
  if (multiplicar) g.globalCompositeOperation = 'multiply';
  for (let t = 0; t < idx.length; t += 3) {
    c.set(0, 0, 0); const cats = {};
    for (let k = 0; k < 3; k++) { const i = idx[t + k]; c.x += mont.P[i * 3] / 3; c.y += mont.P[i * 3 + 1] / 3; c.z += mont.P[i * 3 + 2] / 3; const ct = mont.catV(i); cats[ct] = (cats[ct] || 0) + 1; }
    let best = null, bn = 0; for (const k in cats) if (cats[k] > bn) { bn = cats[k]; best = k; }
    let cor = null; for (const [pred, cc] of regras) if (pred(c, best)) { cor = cc; break; }
    if (!cor) continue;
    g.beginPath();
    for (let k = 0; k < 3; k++) { const i = idx[t + k]; const x = uv.getX(i) * W, y = uv.getY(i) * H; k ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.closePath(); g.fillStyle = multiplicar ? cor : pat(cor); g.strokeStyle = g.fillStyle; g.lineWidth = 2; g.fill(); g.stroke();
  }
  const tx = new THREE.CanvasTexture(cv); tx.flipY = mapa.flipY; tx.colorSpace = mapa.colorSpace; tx.anisotropy = 4; tx.wrapS = mapa.wrapS; tx.wrapT = mapa.wrapT;
  return tx;
}

// ---------- geometrias auxiliares ----------
function capa(m, { y0 = 1.47, y1 = .55, ...o }) { return capaR(m, { y0: m.Y(y0), y1: m.Y(y1), ...o }); }
function capaR(m, { y0 = 1.47, y1 = .55, larg0 = .2, larg1 = .34, z0 = -.13, recuo = .2, cor, rasgada = false }) {
  const segX = 10, segY = 14; const pos = [], ind = [];
  for (let j = 0; j <= segY; j++) {
    const t = j / segY; const y = y0 + (y1 - y0) * t; const lw = larg0 + (larg1 - larg0) * Math.sqrt(t);
    for (let i = 0; i <= segX; i++) {
      const s = i / segX * 2 - 1; let yy = y;
      if (rasgada && j === segY) yy += (i % 2 ? .09 : -.02) + Math.sin(i * 2.3) * .03;
      pos.push(s * lw, yy, z0 - recuo * t * t - (1 - s * s) * .05 - .02 * Math.sin(i * 1.7) * t);
    }
  }
  for (let j = 0; j < segY; j++) for (let i = 0; i < segX; i++) { const a = j * (segX + 1) + i, b = a + 1, c = a + segX + 1, d = c + 1; ind.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(ind); g.computeVertexNormals();
  // frente e verso
  const g2 = g.clone(); const ii = g2.index.array; for (let k = 0; k < ii.length; k += 3) { const t = ii[k]; ii[k] = ii[k + 1]; ii[k + 1] = t; }
  const P2 = g2.attributes.position; for (let k = 0; k < P2.count; k++) P2.setZ(k, P2.getZ(k) + .006); g2.computeVertexNormals();
  const w = (p) => { const t = THREE.MathUtils.clamp((y0 - p.y) / (y0 - y1), 0, 1); const k = Math.min(1, t * 1.5) * .85; return [['spine_03', 1 - k], ['pelvis', k]]; };
  m.peca(g, w, cor, 'tecido'); m.peca(g2, w, cor, 'tecido');
  return g;
}
function ombreira(m, lado, { cor, mt = 'bronze', cor2, camadas = 3, r = .115 }) {
  const b = m.bp['upperarm_' + lado]; const sx = lado === 'l' ? 1 : -1;
  for (let k = 0; k < camadas; k++) {
    const g = new THREE.SphereGeometry(r - k * .01, 16, 6, 0, Math.PI * 2, 0, Math.PI * .36);
    g.scale(1.0, .5, .95); g.rotateZ(-sx * (0.25 + k * .38)); g.translate(b.x + sx * (.035 + k * .05), b.y + .01 - k * .028, b.z + .005);
    m.peca(g, k === 0 ? 'clavicle_' + lado : 'upperarm_' + lado, k === camadas - 1 && cor2 ? cor2 : cor, mt);
    const rr = (r - k * .01) * Math.sin(Math.PI * .36); const aro = new THREE.TorusGeometry(rr, .0075, 5, 24); aro.rotateX(Math.PI / 2); aro.scale(1, 1, .95);
    aro.translate(0, (r - k * .01) * Math.cos(Math.PI * .36) * .5, 0); aro.rotateZ(-sx * (0.25 + k * .38)); aro.translate(b.x + sx * (.035 + k * .05), b.y + .01 - k * .028, b.z + .005);
    m.peca(aro, k === 0 ? 'clavicle_' + lado : 'upperarm_' + lado, cor2 || '#e6b85a', 'ouro');
  }
}

let _texOlho;
function texOlho() { if (_texOlho) return _texOlho; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,110,110,.9)'); gr.addColorStop(1, 'rgba(255,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); _texOlho = new THREE.CanvasTexture(c); _texOlho.colorSpace = THREE.SRGBColorSpace; return _texOlho; }
export const VARIANTES = {};
export { capa, ombreira, pintar, texOlho, MT, V, C, GLSL_NOISE };
// ---------- variantes ----------
export function montarVariante(gltf, tipo, opts = {}) {
  const base = skClone(gltf.scene); base.updateMatrixWorld(true);
  let body, olhos, sobr;
  base.traverse(o => { if (o.isSkinnedMesh) { if (/Superhero/i.test(o.material.name)) body = o; else if (/Eye/.test(o.material.name)) olhos = o; else sobr = o; } });
  const m = new Montador(body); m.baixo = tipo !== 'davi'; const bp = m.bp; if (window.__dbg) m.dbg();
  const eq = materialEquip();
  body.material = body.material.clone(); body.material.roughness = .62;
  const yCint = .985, yOmbro = 1.47;
  const tronco = (c, b) => b === 'tronco' || (b === 'quadril' && c.y > m.Y(.96));
  const ctx = { body, olhos, sobr, bp, tronco, cabelos: [] };
  if (VARIANTES[tipo]) { m.baixo = false; VARIANTES[tipo](m, ctx); }

  if (tipo === 'davi') {
    const TUN = '#8f3b24', TUN2 = '#b8894e', COURO = '#4a2c16', BOTA = '#3b2414', BR = '#b67a3c', OURO = '#e6b85a', CAPA = '#7d1a18';
    body.material.map = pintar(m, body.material.map, [
      [(c, b) => b === 'braco' && Math.abs(c.x) < .36, TUN],
      [(c, b) => tronco(c, b), TUN],
      [(c, b) => (b === 'quadril' || b === 'coxa') && c.y > .64, TUN2],
      [(c, b) => b === 'pe' || (b === 'canela' && c.y < .2), COURO],
    ]);
    if (body.material.normalMap) body.material.normalScale.set(.8, .8);
    const T = ['tronco', 'quadril', 'braco', 'coxa'];
    // túnica (tecido) com bainhas retas
    const BT = { cor: '#5e2416', mt: 'tecido', w: .006, h: .004 };
    m.casca((c, b) => b === 'tronco' || b === 'braco', .006, TUN, 'tecido', BT, [{ eixo: 'y', min: 1.4, max: 1.5 }, { eixo: 'ax', max: .35 }]);
    m.casca((c, b) => b === 'coxa' || b === 'quadril', .006, TUN, 'tecido', BT, [{ eixo: 'y', min: .6, max: .72 }]);
    // couraça lamelar de bronze
    m.casca((c, b) => tronco(c, b), .026, BR, 'lamela', { cor: OURO }, [{ eixo: 'y', min: .975, max: 1.445 }, { eixo: 'ax', max: .2 }]);
    // cinto largo
    m.casca((c, b) => b === 'tronco' || b === 'quadril', .036, COURO, 'couro', { cor: OURO, w: .01 }, [{ eixo: 'y', min: .905, max: .985 }]);
    // saiote de tiras de couro (ptéruges)
    m.casca((c, b) => b === 'quadril' || b === 'coxa', .03, '#6b4424', 'tiras', { cor: BR, mt: 'bronze', w: .014 }, [{ eixo: 'y', min: .69, max: .915 }]);
    // braçadeiras
    m.casca((c, b) => b === 'antebraco' || b === 'mao', .015, COURO, 'couro', { cor: OURO, w: .012 }, [{ eixo: 'ax', min: .5, max: .685 }]);
    // grevas de bronze (frente da canela)
    m.casca((c, b) => b === 'canela', .015, BR, 'bronze', { cor: OURO, w: .012 }, [{ eixo: 'y', min: .21, max: .5 }, { eixo: 'z', min: -.075 }]);
    // botas de couro
    m.casca((c, b) => b === 'pe' || b === 'canela', .011, BOTA, 'couro', { cor: '#2a180c', mt: 'couro', w: .012 }, [{ eixo: 'y', max: .215 }]);
    ombreira(m, 'l', { cor: BR, cor2: OURO }); ombreira(m, 'r', { cor: BR, cor2: OURO });
    // fivela
    { const f = new THREE.CylinderGeometry(.036, .036, .014, 16); f.rotateX(Math.PI / 2); f.translate(0, .945, .145); m.peca(f, 'pelvis', OURO, 'ouro'); }
    // tiara de ouro
    { const t = new THREE.TorusGeometry(.108, .008, 6, 32); t.rotateX(Math.PI / 2 - .25); t.scale(1, 1, 1.12); t.translate(0, 1.742, -.005); m.peca(t, 'Head', OURO, 'ouro'); }
    capa(m, { cor: CAPA });
    // broches da capa
    for (const s of [-1, 1]) { const b = new THREE.SphereGeometry(.028, 12, 8); b.translate(s * .15, 1.46, .02); m.peca(b, 'spine_03', OURO, 'ouro'); }
    // escudo redondo nas costas
    { const e = new THREE.CylinderGeometry(.24, .24, .025, 28); e.rotateX(Math.PI / 2); e.rotateZ(.3); e.translate(.02, 1.2, -.23); m.peca(e, 'spine_03', '#6d4a2c', 'madeira');
      const a = new THREE.TorusGeometry(.24, .016, 6, 32); a.translate(.02, 1.2, -.245); m.peca(a, 'spine_03', BR, 'bronze');
      const bo = new THREE.SphereGeometry(.07, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2); bo.rotateX(-Math.PI / 2); bo.translate(.02, 1.2, -.245); m.peca(bo, 'spine_03', OURO, 'ouro'); }
    // espada curta na cintura (lado esquerdo)
    { const bain = new THREE.CylinderGeometry(.03, .02, .5, 8); bain.scale(1, 1, .45); bain.rotateZ(-.35); bain.rotateX(.25); bain.translate(.2, .78, -.02); m.peca(bain, 'pelvis', '#4a2c16', 'couro');
      const pu = new THREE.CylinderGeometry(.016, .016, .14, 8); pu.rotateZ(-.35); pu.rotateX(.25); pu.translate(.115, 1.0, .045); m.peca(pu, 'pelvis', '#3a2412', 'couro');
      const gu = new THREE.BoxGeometry(.13, .025, .04); gu.rotateZ(-.35); gu.translate(.13, .955, .035); m.peca(gu, 'pelvis', OURO, 'ouro'); }
    // funda na mão direita: duas cordas saindo além dos dedos, bolsa de couro e pedra
    { const h = bp.hand_r; const x0 = h.x - .1, x1 = h.x - .5;
      for (const dz of [-.022, .022]) { const c = new THREE.CylinderGeometry(.007, .007, x0 - x1, 5); c.rotateZ(Math.PI / 2); c.translate((x0 + x1) / 2, h.y - .01, h.z + dz * .6); m.peca(c, 'hand_r', '#e6d2a0', 'corda'); }
      const nó = new THREE.SphereGeometry(.018, 8, 6); nó.translate(x0 + .02, h.y - .01, h.z); m.peca(nó, 'hand_r', '#c9ac70', 'corda');
      const bo = new THREE.SphereGeometry(.055, 12, 8); bo.scale(1.35, .6, 1.1); bo.translate(x1 - .035, h.y - .01, h.z); m.peca(bo, 'hand_r', '#6a4222', 'couro');
      const pe = new THREE.DodecahedronGeometry(.036, 0); pe.translate(x1 - .035, h.y + .012, h.z); m.peca(pe, 'hand_r', '#d6cfbf', 'pedra'); }
    // talabarte (correia diagonal) com rebites
    m.casca((c, b) => tronco(c, b), .034, '#3e2412', 'couro', { cor: OURO, w: .006, h: .004 }, [{ eixo: 'y', min: .99, max: 1.44 }, { eixo: 'd', min: 1.19, max: 1.245 }, { eixo: 'ax', max: .2 }]);
    // medalhão de ouro no peito (leão de Judá estilizado: disco + raios)
    { const cz = .158, cy = 1.3;
      const d = new THREE.CylinderGeometry(.052, .052, .012, 24); d.rotateX(Math.PI / 2); d.translate(-.06, cy, cz); m.peca(d, 'spine_03', OURO, 'ouro');
      const d2 = new THREE.CylinderGeometry(.03, .034, .016, 16); d2.rotateX(Math.PI / 2); d2.translate(-.06, cy, cz + .01); m.peca(d2, 'spine_03', '#b3261e', 'pedra');
      for (let k = 0; k < 10; k++) { const r = new THREE.ConeGeometry(.01, .035, 4); r.translate(0, .066, 0); r.rotateZ(k * Math.PI / 5); r.translate(-.06, cy, cz + .002); m.peca(r, 'spine_03', OURO, 'ouro'); } }
    // rebites no cinto
    for (let k = -3; k <= 3; k++) { if (!k) continue; const a2 = k * .32; const r = new THREE.SphereGeometry(.011, 6, 4); r.translate(Math.sin(a2) * .16, .945, Math.cos(a2) * .15 - .005); m.peca(r, 'pelvis', OURO, 'ouro'); }
    // joelheiras
    for (const sd of ['l', 'r']) { const k = bp['calf_' + sd]; const j = new THREE.SphereGeometry(.058, 14, 8, 0, Math.PI * 2, 0, Math.PI * .5); j.rotateX(Math.PI / 2); j.scale(1, 1.15, .7); j.translate(k.x, k.y - .01, k.z + .06); m.peca(j, 'calf_' + sd, BR, 'bronze');
      const t = new THREE.TorusGeometry(.056, .007, 5, 20); t.scale(1, 1.15, 1); t.translate(k.x, k.y - .01, k.z + .062); m.peca(t, 'calf_' + sd, OURO, 'ouro'); }
    // bolsa de pedras no cinto (lado direito)
    { const bo = new THREE.SphereGeometry(.06, 12, 8); bo.scale(1, 1.1, .7); bo.translate(-.19, .86, .06); m.peca(bo, 'pelvis', '#7a5230', 'couro'); }
  }

  if (tipo === 'guardiao') {
    const AZ = '#274a9c', PR = '#9ea6b4', OURO = '#e0b24e', COURO = '#35241a';
    body.material.map = pintar(m, body.material.map, [
      [(c, b) => b === 'braco' && Math.abs(c.x) < .4, AZ],
      [(c, b) => tronco(c, b) || b === 'quadril' || (b === 'coxa' && c.y > .6), AZ],
      [(c, b) => b === 'pe' || b === 'canela', COURO],
      [(c, b) => b === 'antebraco' || b === 'mao', '#5a4030'],
    ]);
    body.material.normalMap = null;
    const T = ['tronco', 'quadril', 'braco', 'coxa'];
    m.casca((c, b) => b === 'tronco' || b === 'braco', .006, AZ, 'tecido', null, [{ eixo: 'y', min: 1.42, max: 1.5 }, { eixo: 'ax', max: .36 }]);
    m.casca((c, b) => b === 'coxa' || b === 'quadril', .006, AZ, 'tecido', null, [{ eixo: 'y', min: .58, max: .7 }]);
    m.casca((c, b) => tronco(c, b), .032, PR, 'prata', { cor: OURO }, [{ eixo: 'y', min: .93, max: 1.455 }, { eixo: 'ax', max: .2 }]);
    m.casca((c, b) => b === 'tronco' || b === 'quadril', .04, COURO, 'couro', { cor: OURO, w: .01 }, [{ eixo: 'y', min: .88, max: .94 }]);
    m.casca((c, b) => b === 'quadril' || b === 'coxa', .032, '#243a7a', 'tiras', { cor: OURO, mt: 'ouro', w: .012 }, [{ eixo: 'y', min: .67, max: .895 }]);
    m.casca((c, b) => b === 'antebraco' || b === 'mao', .016, PR, 'prata', { cor: OURO, w: .012 }, [{ eixo: 'ax', min: .46, max: .685 }]);
    m.casca((c, b) => b === 'braco', .012, '#8c94a2', 'prataL', null, [{ eixo: 'ax', min: .2, max: .4 }]);
    m.casca((c, b) => b === 'canela', .017, PR, 'prata', { cor: OURO, w: .012 }, [{ eixo: 'y', min: .17, max: .52 }]);
    m.casca((c, b) => b === 'pe' || b === 'canela', .008, COURO, 'couro', { cor: '#20140a', mt: 'couro', w: .01 }, [{ eixo: 'y', max: .175 }]);
    ombreira(m, 'l', { cor: PR, mt: 'prata', cor2: OURO, r: .125 }); ombreira(m, 'r', { cor: PR, mt: 'prata', cor2: OURO, r: .125 });
    // elmo com crista
    { const hc = V(0, 1.7, -.01);
      const d = new THREE.SphereGeometry(.142, 16, 8, 0, Math.PI * 2, 0, Math.PI * .56); d.scale(1, 1.05, 1.12); d.translate(hc.x, hc.y, hc.z); m.peca(d, 'Head', PR, 'prata');
      const ab = new THREE.TorusGeometry(.14, .012, 6, 32); ab.rotateX(Math.PI / 2); ab.scale(1, 1, 1.12); ab.translate(hc.x, hc.y - .02, hc.z); m.peca(ab, 'Head', OURO, 'ouro');
      for (const s of [-1, 1]) { const b = new THREE.BoxGeometry(.02, .1, .09); b.translate(s * .125, 1.63, .04); m.peca(b, 'Head', PR, 'prata'); }
      const na = new THREE.BoxGeometry(.018, .07, .012); na.translate(0, 1.67, .16); m.peca(na, 'Head', OURO, 'ouro');
      const cr = new THREE.TorusGeometry(.15, .03, 6, 20, Math.PI); cr.rotateY(Math.PI / 2); cr.scale(1, 1.05, 1.1); cr.translate(0, 1.72, -.01); m.peca(cr, 'Head', '#2d5ad0', 'tecido');
      const cr2 = new THREE.TorusGeometry(.148, .01, 5, 20, Math.PI); cr2.rotateY(Math.PI / 2); cr2.scale(1, 1.05, 1.1); cr2.translate(0, 1.716, -.01); m.peca(cr2, 'Head', OURO, 'ouro'); }
    capa(m, { cor: '#1f3f8f', y1: .72, larg1: .3, recuo: .15 });
    { const cz = .168, cy = 1.29; const d = new THREE.CylinderGeometry(.05, .05, .012, 24); d.rotateX(Math.PI / 2); d.translate(0, cy, cz); m.peca(d, 'spine_03', OURO, 'ouro');
      for (let k = 0; k < 12; k++) { const r = new THREE.ConeGeometry(.011, .04, 4); r.translate(0, .07, 0); r.rotateZ(k * Math.PI / 6); r.translate(0, cy, cz); m.peca(r, 'spine_03', OURO, 'ouro'); } }
    for (const sd of ['l', 'r']) { const k = bp['calf_' + sd]; const j = new THREE.SphereGeometry(.062, 14, 8, 0, Math.PI * 2, 0, Math.PI * .5); j.rotateX(Math.PI / 2); j.scale(1, 1.15, .7); j.translate(k.x, k.y - .01, k.z + .065); m.peca(j, 'calf_' + sd, PR, 'prata'); }
    // escudo no antebraço esquerdo
    { const a = m.bp.lowerarm_l, h = m.bp.hand_l; const cx = (a.x + h.x) / 2 + .02;
      const e = new THREE.CylinderGeometry(.3, .3, .03, 28); e.scale(1, 1, 1.15); e.translate(cx, a.y - .08, a.z + .01); m.peca(e, 'lowerarm_l', AZ, 'couro');
      const ar = new THREE.TorusGeometry(.3, .018, 6, 32); ar.rotateX(Math.PI / 2); ar.scale(1, 1.15, 1); ar.translate(cx, a.y - .098, a.z + .01); m.peca(ar, 'lowerarm_l', OURO, 'ouro');
      for (const sy of [-1, 1]) { const yy = a.y - .08 + sy * .018;
        const bo = new THREE.SphereGeometry(.07, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2); if (sy < 0) bo.rotateX(Math.PI); bo.translate(cx, yy, a.z + .01); m.peca(bo, 'lowerarm_l', OURO, 'ouro');
        const an = new THREE.TorusGeometry(.17, .012, 5, 28); an.rotateX(Math.PI / 2); an.scale(1, 1.15, 1); an.translate(cx, yy, a.z + .01); m.peca(an, 'lowerarm_l', OURO, 'ouro');
        for (let k = 0; k < 8; k++) { const r = new THREE.BoxGeometry(.02, .008, .1); r.translate(0, 0, .23); r.rotateY(k * Math.PI / 4); r.scale(1, 1, 1.0); r.translate(cx, yy, a.z + .01); m.peca(r, 'lowerarm_l', OURO, 'ouro'); } } }
    // espada na mão direita (lâmina para a frente em pose T)
    { const h = m.bp.hand_r; const x = h.x - .07;
      const l = new THREE.BoxGeometry(.012, .05, .7); l.translate(x, h.y, h.z + .42); m.peca(l, 'hand_r', '#e4e8ee', 'prata');
      const gu = new THREE.BoxGeometry(.03, .16, .03); gu.translate(x, h.y, h.z + .07); m.peca(gu, 'hand_r', OURO, 'ouro');
      const pu = new THREE.CylinderGeometry(.018, .018, .14, 8); pu.rotateX(Math.PI / 2); pu.translate(x, h.y, h.z); m.peca(pu, 'hand_r', COURO, 'couro'); }
  }

  if (tipo === 'sombra' || tipo === 'bruto') {
    const bruto = tipo === 'bruto';
    body.material.map = pintar(m, body.material.map, [[() => true, bruto ? '#3a2436' : '#2c2034']], { multiplicar: true });
    body.material.normalMap = null; body.material.roughness = .45; body.material.metalness = .2;
    // veias vermelhas brilhantes (ruído no espaço de repouso)
    const g = body.geometry = body.geometry.clone(); g.setAttribute('aP', new THREE.BufferAttribute(m.P.slice(), 3));
    body.material.onBeforeCompile = (s) => {
      s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aP; varying vec3 vP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvP=aP;');
      s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vP;' + GLSL_NOISE)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { float n=eqN(vP.xy*18.+vP.z*9.)*.6+eqN(vP.yz*40.+vP.x*20.)*.4; float v=1.-smoothstep(.0,.035,abs(n-.5)); totalEmissiveRadiance+=vec3(1.,.1,.12)*v*1.4*smoothstep(.55,1.45,vP.y); }`);
    };
    body.material.customProgramCacheKey = () => 'sombra-corpo';
    // carapaças de obsidiana
    const RB = { cor: '#ff2a3a', mt: 'brilho', w: .008, h: .006 };
    m.casca((c, b) => tronco(c, b), .026, '#161018', 'obsid', RB, [{ eixo: 'y', min: 1.08, max: 1.44 }, { eixo: 'z', min: -.01 }, { eixo: 'ax', max: .19 }]);
    m.casca((c, b) => b === 'antebraco' || b === 'mao', .018, '#161018', 'obsid', RB, [{ eixo: 'ax', min: .5, max: .68 }]);
    m.casca((c, b) => b === 'canela', .018, '#161018', 'obsid', RB, [{ eixo: 'y', min: .2, max: .5 }, { eixo: 'z', min: -.04 }]);
    // chifres
    for (const s of [-1, 1]) {
      const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(V(s * (.07 + .09 * t), 1.77 + .16 * t - .06 * t * t, -.02 - .12 * t * t)); }
      const tub = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, .028, 6, false);
      const P = tub.attributes.position; // afina a ponta
      for (let i = 0; i < P.count; i++) { const k = Math.floor(i / 7) / 10; const cen = pts[Math.min(8, Math.round(k * 8))]; P.setXYZ(i, cen.x + (P.getX(i) - cen.x) * (1 - k * .9), cen.y + (P.getY(i) - cen.y) * (1 - k * .9), cen.z + (P.getZ(i) - cen.z) * (1 - k * .9)); }
      tub.computeVertexNormals(); m.peca(tub, 'Head', '#1a1216', 'obsid');
    }
    // espinhos nos ombros
    for (const s of [-1, 1]) for (let k = 0; k < (bruto ? 4 : 3); k++) {
      const e = new THREE.ConeGeometry(.035 - k * .004, .2 - k * .03, 5); e.rotateZ(-s * (.5 + k * .35)); e.rotateX(-.3 + k * .2); e.translate(s * (.17 + k * .05), 1.5 - k * .02, -.03 - k * .01); m.peca(e, k < 1 ? 'clavicle_' + (s > 0 ? 'l' : 'r') : 'upperarm_' + (s > 0 ? 'l' : 'r'), '#1c1418', 'obsid');
    }
    // garras
    for (const s of ['l', 'r']) { const h = m.bp['hand_' + s]; const sx = s === 'l' ? 1 : -1; for (let k = 0; k < 3; k++) { const e = new THREE.ConeGeometry(.012, .1, 4); e.rotateZ(-sx * Math.PI / 2); e.translate(h.x + sx * .17, h.y - .01, h.z + (k - 1) * .025); m.peca(e, 'hand_' + s, '#e8d6d0', 'pedra'); } }
    // manto esfarrapado
    capa(m, { cor: bruto ? '#2a1024' : '#241430', y1: .45, larg0: .22, larg1: .42, recuo: .12, rasgada: true });
    // olhos brilhantes
    if (olhos) { olhos.material = new THREE.MeshBasicMaterial({ color: 0xff3040 }); olhos.material.userData.glow = true; }
    { const cab = m.bones[m.bi.Head]; const sm = new THREE.SpriteMaterial({ map: texOlho(), color: 0xff2a3a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
      for (const s2 of [-1, 1]) { const sp = new THREE.Sprite(sm); sp.scale.set(.2, .2, 1); sp.position.set(s2 * .032, 1.70, .12); sp.renderOrder = 8; sp.userData.olho = true; cab.attach(sp); } }
    if (sobr) sobr.visible = false;
  }

  // cabelo (preso ao osso da cabeça)
  if (opts.cabelo && tipo === 'davi') {
    let hm; opts.cabelo.scene.traverse(o => { if (o.isSkinnedMesh) hm = o; });
    if (hm) {
      const byName = Object.fromEntries(m.bones.map(b => [b.name, b]));
      const nh = new THREE.SkinnedMesh(hm.geometry, hm.material.clone()); nh.name = 'cabelo';
      nh.material.color.set(opts.corCabelo || '#8a4a2a'); nh.castShadow = true; nh.frustumCulled = false;
      body.parent.add(nh); nh.bind(new THREE.Skeleton(hm.skeleton.bones.map(b => byName[b.name]), hm.skeleton.boneInverses), hm.bindMatrix.clone());
    }
  }
  for (const [nome, cor] of ctx.cabelos) {
    const gl = opts.cabelos && opts.cabelos[nome]; if (!gl) continue;
    let hm; gl.scene.traverse(o => { if (o.isSkinnedMesh) hm = o; });
    const byName = Object.fromEntries(m.bones.map(b => [b.name, b]));
    const nh = new THREE.SkinnedMesh(hm.geometry, hm.material.clone()); nh.name = 'cabelo_' + nome;
    nh.material.color.set(cor); nh.castShadow = true; nh.frustumCulled = false;
    // corpo feminino: cabeça em outra altura/escala -> ajusta a bind matrix
    const k = window.__kcab || ctx.escCabelo || 1;
    body.parent.add(nh); nh.bind(new THREE.Skeleton(hm.skeleton.bones.map(b => byName[b.name]), hm.skeleton.boneInverses.map(ib => new THREE.Matrix4().makeScale(k, k, k).multiply(ib))), hm.bindMatrix.clone());
  }
  if (ctx.corSobr && sobr) { sobr.material = sobr.material.clone(); sobr.material.color.set(ctx.corSobr); }
  else if (sobr && sobr.visible) { sobr.material = sobr.material.clone(); sobr.material.color.set('#3a2214'); }
  const eqm = m.finalizar(eq);
  // esfera envolvente calculada uma vez (pose T) -> permite descartar personagens fora da tela
  base.updateMatrixWorld(true);
  base.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = !opts.semCorte; if (o.isSkinnedMesh) { o.computeBoundingSphere(); o.boundingSphere.radius *= 1.3; } } });
  base.userData.tipo = tipo;
  return base;
}
