import * as THREE from 'three';
import { texBrilho } from './world.js';

// Sistema de partículas em GPU (um draw call por sistema)
// célula 0 = brilho redondo de sempre; células 1..15 = atlas dos poderes (vfx/poderes.webp, 4x4): cada partícula escolhe
// a forma (fogo, folha, coração, gafanhoto, lasca…) e pode girar — tudo no mesmo draw call
export class Particulas {
  constructor(scene, max = 1200, aditivo = true) {
    this.max = max; this.n = 0;
    this.p = new Float32Array(max * 3); this.v = new Float32Array(max * 3); this.c = new Float32Array(max * 3);
    this.s = new Float32Array(max); this.a = new Float32Array(max); this.life = new Float32Array(max); this.ttl = new Float32Array(max); this.grav = new Float32Array(max); this.s0 = new Float32Array(max); this.s1 = new Float32Array(max); this.drag = new Float32Array(max);
    this.cel = new Float32Array(max); this.rot = new Float32Array(max); this.giro = new Float32Array(max); this._am = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.c, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.s, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.a, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('cel', new THREE.BufferAttribute(this.cel, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('rot', new THREE.BufferAttribute(this.rot, 1).setUsage(THREE.DynamicDrawUsage));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: aditivo ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { map: { value: texBrilho(aditivo ? undefined : [[0, 'rgba(255,255,255,.9)'], [.5, 'rgba(255,255,255,.45)'], [1, 'rgba(255,255,255,0)']]) }, atlas: { value: null }, uEsc: { value: 400 } },
      vertexShader: `uniform float uEsc; attribute float size; attribute float alpha; attribute float cel; attribute float rot; varying vec3 vC; varying float vA; varying float vCel; varying float vRot;
        void main(){ vC=color; vA=alpha; vCel=cel; vRot=rot; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=size*uEsc/-mv.z; gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform sampler2D map; uniform sampler2D atlas; varying vec3 vC; varying float vA; varying float vCel; varying float vRot;
        void main(){
          if (vCel < .5) { vec4 t=texture2D(map, gl_PointCoord); gl_FragColor=vec4(vC, t.a*vA); return; }
          vec2 q = gl_PointCoord - .5; float cs = cos(vRot), sn = sin(vRot); q = vec2(cs*q.x - sn*q.y, sn*q.x + cs*q.y) + .5;
          if (q.x < 0. || q.y < 0. || q.x > 1. || q.y > 1.) discard;
          q = clamp(q, .012, .988); float cx = mod(vCel, 4.), cy = floor(vCel / 4. + .01);
          vec4 t = texture2D(atlas, vec2((cx + q.x) * .25, 1. - (cy + q.y) * .25));
          gl_FragColor = vec4(vC * t.rgb, t.a * vA); }`,
      vertexColors: true
    });
    this.pts = new THREE.Points(g, m); this.pts.frustumCulled = false; this.pts.renderOrder = 10; scene.add(this.pts);
  }
  usarAtlas(tex) { this.pts.material.uniforms.atlas.value = tex; this.temAtlas = !!tex; }
  emit(x, y, z, o = {}) {
    if (this.n >= this.max) return; const i = this.n++;
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
    const sp = o.vel || [0, 0, 0]; this.v[i * 3] = sp[0]; this.v[i * 3 + 1] = sp[1]; this.v[i * 3 + 2] = sp[2];
    const c = o.cor || [1, 1, 1]; this.c[i * 3] = c[0]; this.c[i * 3 + 1] = c[1]; this.c[i * 3 + 2] = c[2];
    this.ttl[i] = o.vida || 1; this.life[i] = 0; this.s0[i] = o.t0 ?? 1; this.s1[i] = o.t1 ?? 0; this.grav[i] = o.grav || 0; this.drag[i] = o.drag ?? 1.5; this.a[i] = 1; this.s[i] = this.s0[i];
    this._am[i] = o.alpha ?? 1; this.cel[i] = this.temAtlas ? (o.cel || 0) : 0; this.rot[i] = o.rot ?? (o.giro ? Math.random() * 6.28 : 0); this.giro[i] = o.giro || 0;
  }
  update(dt) {
    let i = 0;
    while (i < this.n) {
      this.life[i] += dt; const k = this.life[i] / this.ttl[i];
      if (k >= 1) { this._swap(i, --this.n); continue; }
      const d = Math.exp(-this.drag[i] * dt);
      this.v[i * 3] *= d; this.v[i * 3 + 1] = this.v[i * 3 + 1] * d - this.grav[i] * dt; this.v[i * 3 + 2] *= d;
      this.p[i * 3] += this.v[i * 3] * dt; this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt; this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
      if (this.p[i * 3 + 1] < .05 && this.grav[i] > 0) { this.p[i * 3 + 1] = .05; this.v[i * 3 + 1] *= -.3; this.v[i * 3] *= .6; this.v[i * 3 + 2] *= .6; this.giro[i] *= .5; } // lascas quicam no chão
      this.rot[i] += this.giro[i] * dt;
      this.s[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * k; this.a[i] = this._am[i] * Math.min(1, (1 - k) * 2.5) * Math.min(1, k * 12 + .2);
      i++;
    }
    const g = this.pts.geometry; g.setDrawRange(0, this.n);
    for (const a of Particulas.ATTR) g.attributes[a].needsUpdate = true;
  }
  _swap(i, j) {
    const f3 = (arr) => { arr[i * 3] = arr[j * 3]; arr[i * 3 + 1] = arr[j * 3 + 1]; arr[i * 3 + 2] = arr[j * 3 + 2]; };
    f3(this.p); f3(this.v); f3(this.c);
    for (const arr of [this.s, this.a, this.life, this.ttl, this.grav, this.s0, this.s1, this.drag, this._am, this.cel, this.rot, this.giro]) arr[i] = arr[j];
  }
}
Particulas.ATTR = ['position', 'color', 'size', 'alpha', 'cel', 'rot'];

// Anel de impacto / onda de choque no chão
export class Aneis {
  constructor(scene) {
    this.scene = scene; this.lista = [];
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    const gr = g.createRadialGradient(128, 128, 60, 128, 128, 128); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.72, 'rgba(255,255,255,.15)'); gr.addColorStop(.9, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256); this.tex = new THREE.CanvasTexture(c); this.tex.colorSpace = THREE.SRGBColorSpace;
    this.geo = new THREE.PlaneGeometry(1, 1); this.geo.rotateX(-Math.PI / 2);
  }
  add(pos, cor, r0, r1, vida = .5, y = .12, op = 1) {
    if (this.max && this.lista.length >= this.max) { const v = this.lista.shift(); this.scene.remove(v.m); v.m.material.dispose(); } // celular: poucos anéis ao mesmo tempo (cada um é 1 draw call)
    const m = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ map: this.tex, color: cor, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: op }));
    m.position.set(pos.x, y, pos.z); m.renderOrder = 6; this.scene.add(m); this.lista.push({ m, r0, r1, vida, t: 0, op });
  }
  update(dt) {
    this.lista = this.lista.filter(a => { a.t += dt; const k = a.t / a.vida; if (k >= 1) { this.scene.remove(a.m); a.m.material.dispose(); return false; } const e = 1 - Math.pow(1 - k, 3); const r = a.r0 + (a.r1 - a.r0) * e; a.m.scale.set(r * 2, 1, r * 2); a.m.material.opacity = a.op * (1 - k); return true; });
  }
}

// Coluna de luz (ultimate)
let GEO_COL = null;
export function colunaLuz(scene, pos, tempoU) {
  if (!GEO_COL) { GEO_COL = new THREE.CylinderGeometry(1.5, 2.3, 26, 32, 1, true); GEO_COL.translate(0, 13, 0); } const geo = GEO_COL;
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uT: tempoU, uK: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float uT; uniform float uK; varying vec2 vUv; void main(){ float s = sin(vUv.x*40.+uT*6.)*.5+.5; float f = pow(1.-vUv.y, 1.6); float a = f*(.25+.5*s)*(1.-uK)*.42; vec3 c = mix(vec3(1.,.5,.08), vec3(1.,.85,.45), f*f); gl_FragColor=vec4(c*1.1, a*.85); }` });
  const m = new THREE.Mesh(geo, mat); m.position.copy(pos); m.renderOrder = 7; scene.add(m); return m;
}

// Números de dano / textos flutuantes (HTML)
export class Textos {
  constructor(camera) { this.cam = camera; this.lista = []; this.root = document.getElementById('hud'); this.v = new THREE.Vector3(); this.pool = []; }
  // alvo: números no mesmo alvo em até 0,25 s se somam (menos poluição); no máx. 14 textos na tela
  add(pos, txt, cls = '', alvo = null) {
    const num = /^\d+!?$/.test(txt);
    if (alvo && num && cls !== 'crit') { const o = this.lista.find(x => x.alvo === alvo && x.cls === cls && x.t < .25 && x.num); if (o) { o.val += +txt; o.el.textContent = o.val; o.t = Math.min(o.t, .06); return; } }
    if (this.lista.length >= 14) { const i = this.lista.findIndex(x => x.cls !== 'crit' && x.cls !== 'ouro'); const o = this.lista.splice(i < 0 ? 0 : i, 1)[0]; o.el.remove(); }
    const el = document.createElement('div'); el.className = 'dano ' + cls; el.textContent = txt; this.root.appendChild(el);
    if (cls === 'ouro' || cls === 'ouroD') el.insertAdjacentHTML('afterbegin', '<span class="moedaT"></span>');
    this.lista.push({ el, p: pos.clone(), t: 0, dx: (Math.random() - .5) * 40, alvo, cls, num: num && cls !== 'crit', val: parseInt(txt) || 0, dur: cls === 'crit' ? 1.25 : cls === 'ouro' ? 1.3 : 1.1 });
  }
  update(dt, w, h) {
    this.lista = this.lista.filter(o => {
      o.t += dt; if (o.t > o.dur) { o.el.remove(); return false; }
      this.v.copy(o.p); this.v.y += 2.8 + o.t * (o.cls === 'ouro' ? 2.2 : 1.6); this.v.project(this.cam);
      const x = (this.v.x * .5 + .5) * w + o.dx * o.t, y = (-this.v.y * .5 + .5) * h - (o.cls === 'crit' ? Math.sin(Math.min(1, o.t / .22) * Math.PI) * 14 : 0);
      // crítico: nasce grande (1,4 → 1,75) e assenta em 1; normal: 0,6 → 1,4 → 1
      const s = o.cls === 'crit' ? (o.t < .08 ? 1.4 + o.t / .08 * .35 : Math.max(1, 1.75 - (o.t - .08) * 3.2)) : o.t < .12 ? 0.6 + o.t / .12 * .8 : 1.4 - Math.min(.4, (o.t - .12) * 1.2);
      o.el.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%) scale(${s})`; o.el.style.opacity = Math.min(1, (o.dur - o.t) * 3);
      return true;
    });
  }
}
