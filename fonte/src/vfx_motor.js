// Motor de VFX (lado do motor apenas; os assets reais vêm do Jarvys: packs CC0 em tripo_work/vfx/packs e malhas do Tripo).
// - Flipbooks com alfa OU fundo preto (aditivo), grade qualquer (C×R, quadros não quadrados), em laço ou uma vez, cor/tinta.
//   Cada sistema = 1 InstancedMesh de quads virados para a câmera (1 draw call; sem limite de gl_PointSize do celular).
// - Malhas reais de projétil (GLB) em pool, orientadas pela direção; rastros em fita; decalques no chão; clarão com 1 luz fixa.
// - Pools fixos + níveis de qualidade PC/celular/baixa (limites e taxa de emissão). Nada é criado/removido da cena durante a luta.
import * as THREE from 'three';

export const QUALIDADE = {
  pc: { mult: 1, taxa: 1, rastros: 16, decais: 20, malhas: 48, luz: true },
  mobile: { mult: .5, taxa: .6, rastros: 8, decais: 10, malhas: 24, luz: true },
  baixa: { mult: .3, taxa: .35, rastros: 4, decais: 6, malhas: 16, luz: false },
};
const TAU = Math.PI * 2;

export function carregarTextura(url) {
  return new THREE.TextureLoader().loadAsync(url).then(t => { t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; return t; });
}

// ---------- sistema de flipbook instanciado ----------
const GEO_QUAD = new THREE.PlaneGeometry(1, 1);
export class SistemaFlip {
  // o: { cols, rows, quadros (padrão cols*rows), aditivo, fps (laço) ou uma vez pela vida, max, ancora: 'centro'|'base', base (fração da célula abaixo da origem, do manifest), suave }
  constructor(scene, tex, o = {}) {
    const cols = o.cols || 1, rows = o.rows || 1; this.N = o.quadros || cols * rows; this.fps = o.fps || 0; this.estatico = !!o.estatico; this.max = o.max || 64; this.n = 0;
    const M = this.max, A = (k) => new Float32Array(M * k);
    this.pos = A(3); this.vel = A(3); this.tam = A(2); this.cor = A(4); this.q = A(1); this.rot = A(1);
    this.vida = A(1); this.ttl = A(1); this.s0 = A(1); this.s1 = A(1); this.a0 = A(1); this.grav = A(1); this.drag = A(1); this.giro = A(1); this.q0 = A(1); this.asp = A(1);
    const g = new THREE.InstancedBufferGeometry(); g.index = GEO_QUAD.index; g.setAttribute('position', GEO_QUAD.attributes.position); g.setAttribute('uv', GEO_QUAD.attributes.uv);
    const ia = (n, arr, k) => { const at = new THREE.InstancedBufferAttribute(arr, k); at.setUsage(THREE.DynamicDrawUsage); g.setAttribute(n, at); return at; };
    this.at = { iPos: ia('iPos', this.pos, 3), iTam: ia('iTam', this.tam, 2), iCor: ia('iCor', this.cor, 4), iQ: ia('iQ', this.q, 1), iRot: ia('iRot', this.rot, 1) };
    g.instanceCount = 0;
    // modo de mistura (manifest do Jarvys): 'pre' = alfa pré-multiplicado (ONE, ONE_MINUS_SRC_ALPHA), 'add' = aditivo (fundo preto), 'normal' = alfa reto
    const modo = o.modo || (o.aditivo ? 'add' : 'normal');
    const bl = modo === 'pre' ? { blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor } : modo === 'add' ? { blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor } : { blending: THREE.NormalBlending };
    const cel = o.celula ? new THREE.Vector2(o.celula, o.celula) : new THREE.Vector2(1 / cols, 1 / rows);
    const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, ...bl,
      uniforms: { map: { value: tex }, uGrade: { value: new THREE.Vector2(cols, rows) }, uCel: { value: cel }, uBase: { value: o.ancora === 'base' ? .5 - (o.base || 0) : 0 }, uChao: { value: o.chao ? 1 : 0 }, uPre: { value: modo === 'normal' ? 0 : 1 } },
      vertexShader: `attribute vec3 iPos; attribute vec2 iTam; attribute vec4 iCor; attribute float iQ; attribute float iRot; uniform vec2 uGrade; uniform vec2 uCel; uniform float uBase; uniform float uChao;
        varying vec2 vUv; varying vec4 vCor;
        void main(){ vec2 c = position.xy + vec2(0., uBase); float cs = cos(iRot), sn = sin(iRot); c = vec2(cs*c.x - sn*c.y, sn*c.x + cs*c.y) * iTam;
          vec4 mv; if (uChao > .5) mv = modelViewMatrix * vec4(iPos + vec3(c.x, 0., -c.y), 1.); else { mv = modelViewMatrix * vec4(iPos, 1.); mv.xy += c; } gl_Position = projectionMatrix * mv;
          float f = floor(iQ + .5); float cx = mod(f, uGrade.x), cy = floor(f / uGrade.x); vUv = vec2((cx + uv.x) * uCel.x, 1. - (cy + 1. - uv.y) * uCel.y); vCor = iCor; }`,
      fragmentShader: `uniform sampler2D map; uniform float uPre; varying vec2 vUv; varying vec4 vCor; void main(){ vec4 t = texture2D(map, vUv);
        if (uPre > .5) gl_FragColor = vec4(t.rgb * vCor.rgb * vCor.a, t.a * vCor.a); else gl_FragColor = vec4(t.rgb * vCor.rgb, t.a * vCor.a); if (max(gl_FragColor.a, max(gl_FragColor.r, gl_FragColor.g)) < .003) discard; }` });
    this.malha = new THREE.Mesh(g, mat); this.malha.frustumCulled = false; this.malha.renderOrder = o.ordem ?? 11; scene.add(this.malha);
    this.aspPadrao = o.asp || 1; this.quadros = o.quadros || this.N;
  }
  // e: { vel:[x,y,z], vida, t0, t1 (tamanho), asp (largura/altura), cor:[r,g,b], alpha, grav, drag, rot, giro, q0 (quadro inicial; -1 = aleatório) }
  emit(x, y, z, e = {}) { if (this.n >= this.max) return -1; const i = this.n++;
    this.pos.set([x, y, z], i * 3); this.vel.set(e.vel || [0, 0, 0], i * 3); const c = e.cor || [1, 1, 1]; this.cor.set([c[0], c[1], c[2], 0], i * 4);
    this.vida[i] = 0; this.ttl[i] = e.vida || 1; this.s0[i] = e.t0 ?? 1; this.s1[i] = e.t1 ?? this.s0[i]; this.a0[i] = e.alpha ?? 1; this.grav[i] = e.grav || 0; this.drag[i] = e.drag ?? 0;
    this.rot[i] = e.rot ?? 0; this.giro[i] = e.giro || 0; this.q0[i] = e.q0 === -1 ? Math.floor(Math.random() * this.N) : (e.q0 || 0); this.asp[i] = e.asp || this.aspPadrao; this.q[i] = this.q0[i]; return i; }
  update(dt) { let i = 0;
    while (i < this.n) { this.vida[i] += dt; const k = this.vida[i] / this.ttl[i]; if (k >= 1) { this._troca(i, --this.n); continue; }
      const j = i * 3, d = this.drag[i] ? Math.exp(-this.drag[i] * dt) : 1; this.vel[j] *= d; this.vel[j + 1] = this.vel[j + 1] * d - this.grav[i] * dt; this.vel[j + 2] *= d;
      this.pos[j] += this.vel[j] * dt; this.pos[j + 1] += this.vel[j + 1] * dt; this.pos[j + 2] += this.vel[j + 2] * dt; this.rot[i] += this.giro[i] * dt;
      const s = this.s0[i] + (this.s1[i] - this.s0[i]) * k; this.tam[i * 2] = s * this.asp[i]; this.tam[i * 2 + 1] = s;
      this.q[i] = this.estatico ? this.q0[i] : this.fps ? (this.q0[i] + this.vida[i] * this.fps) % this.N : Math.min(this.N - 1, this.q0[i] + k * (this.N - this.q0[i]));
      this.cor[i * 4 + 3] = this.a0[i] * Math.min(1, k * 12) * Math.min(1, (1 - k) * 4); i++; }
    this.malha.geometry.instanceCount = this.n; for (const a of Object.values(this.at)) { a.needsUpdate = true; a.clearUpdateRanges && a.clearUpdateRanges(); a.addUpdateRange && a.addUpdateRange(0, this.n * a.itemSize); } }
  _troca(i, j) { const c = (arr, k) => { for (let m = 0; m < k; m++) arr[i * k + m] = arr[j * k + m]; };
    c(this.pos, 3); c(this.vel, 3); c(this.tam, 2); c(this.cor, 4); for (const a of [this.q, this.rot, this.vida, this.ttl, this.s0, this.s1, this.a0, this.grav, this.drag, this.giro, this.q0, this.asp]) a[i] = a[j]; }
}

// ---------- rastro em fita (textura qualquer, ex.: Kenney trace_0x) ----------
export class Rastro {
  constructor(scene, tex, pontos = 16) { this.N = pontos; this.hist = []; this.ativo = false; this.solto = false; this.larg = .2; this.dur = .2;
    const g = new THREE.BufferGeometry(); this.p = new Float32Array(pontos * 6); const uv = new Float32Array(pontos * 4); const idx = [];
    for (let i = 0; i < pontos; i++) { const u = i / (pontos - 1); uv.set([u, 0, u, 1], i * 4); if (i < pontos - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    g.setAttribute('position', new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
    this.mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.m = new THREE.Mesh(g, this.mat); this.m.frustumCulled = false; this.m.visible = false; this.m.renderOrder = 9; scene.add(this.m); }
  iniciar({ cor = [1, 1, 1], larg = .2, dur = .2, aditivo = true, tex = null } = {}) { this.hist.length = 0; this.ativo = true; this.solto = false; this.larg = larg; this.dur = dur; this.mat.color.setRGB(...cor); if (tex) { this.mat.map = tex; this.mat.blending = THREE.CustomBlending; this.mat.blendSrc = THREE.OneFactor; this.mat.blendDst = THREE.OneMinusSrcAlphaFactor; } else this.mat.blending = aditivo ? THREE.AdditiveBlending : THREE.NormalBlending; this.m.visible = true; }
  seguir(p, t) { this.hist.unshift({ x: p.x, y: p.y, z: p.z, t }); if (this.hist.length > this.N) this.hist.length = this.N; }
  update(t, cam) { if (!this.ativo) return; while (this.hist.length && t - this.hist[this.hist.length - 1].t > this.dur) this.hist.pop();
    if (this.solto && this.hist.length < 2) { this.ativo = false; this.m.visible = false; return; }
    const H = this.hist, n = H.length, tg = new THREE.Vector3(), ol = new THREE.Vector3(), la = new THREE.Vector3();
    for (let i = 0; i < this.N; i++) { const a = H[Math.min(i, n - 1)], b = H[Math.min(i + 1, n - 1)]; if (!a) break; tg.set(a.x - b.x, a.y - b.y, a.z - b.z); if (tg.lengthSq() < 1e-8) tg.set(1, 0, 0);
      ol.set(cam.position.x - a.x, cam.position.y - a.y, cam.position.z - a.z); la.crossVectors(tg, ol).normalize(); const w = i >= n ? 0 : this.larg * (1 - i / this.N);
      this.p.set([a.x + la.x * w, a.y + la.y * w, a.z + la.z * w, a.x - la.x * w, a.y - la.y * w, a.z - la.z * w], i * 6); }
    this.m.geometry.attributes.position.needsUpdate = true; }
}

// ---------- motor ----------
export function criarMotorVFX(scene, camera, { qualidade = 'pc' } = {}) {
  const Q = QUALIDADE[qualidade] || QUALIDADE.pc; let agora = 0;
  const flips = {}, texRastro = {}, malhasBase = {}, ativos = [];
  // flipbooks: registrar uma vez por partida (antes da luta) → sem compilação de shader no meio da luta
  function registrarFlip(nome, tex, o = {}) { flips[nome] = new SistemaFlip(scene, tex, { ...o, max: Math.max(4, Math.round((o.max || 64) * Q.mult)) }); return flips[nome]; }
  function emitir(nome, p, e = {}, essencial = false) { const s = flips[nome]; if (!s) return -1; if (!essencial && Q.taxa < 1 && Math.random() > Q.taxa) return -1; return s.emit(p.x, p.y, p.z, e); }
  function rajada(nome, p, n, gerar) { const k = Math.max(1, Math.round(n * Q.taxa)); for (let i = 0; i < k; i++) emitir(nome, p, gerar(i, k), true); }
  // rastros
  let rastros = []; function registrarRastro(tex) { rastros = Array.from({ length: Q.rastros }, () => new Rastro(scene, tex)); }
  const pegarRastro = () => rastros.find(r => !r.ativo) || null;
  // decalques
  const geoChao = new THREE.PlaneGeometry(1, 1); geoChao.rotateX(-Math.PI / 2);
  const decais = Array.from({ length: Q.decais }, (_, i) => { const m = new THREE.Mesh(geoChao, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 - i * .05 })); m.visible = false; m.renderOrder = 5; scene.add(m); return { m, livre: true }; });
  let decIdx = 0;
  // d: { tex, r0, r1, vida, cor, aditivo, op, giro }
  function decal(p, d) { let x = decais.find(z => z.livre); if (!x) { x = decais[decIdx++ % decais.length]; } x.livre = false; Object.assign(x, { t: 0, vida: d.vida || 1, r0: d.r0 ?? 1, r1: d.r1 ?? d.r0 ?? 1, op: d.op ?? 1 });
    const mt = x.m.material; if (mt.map !== d.tex) { mt.map = d.tex; mt.needsUpdate = true; } const ad = !!d.aditivo; if ((mt.blending === THREE.AdditiveBlending) !== ad) { mt.blending = ad ? THREE.AdditiveBlending : THREE.NormalBlending; mt.needsUpdate = true; }
    mt.color.setRGB(...(d.cor || [1, 1, 1])); x.m.position.set(p.x, .03, p.z); x.m.rotation.y = d.giro ?? Math.random() * TAU; x.m.scale.setScalar(x.r0 * 2); x.m.visible = true; }
  // malhas reais de projétil (GLB do Tripo): pool por nome, geometria e material compartilhados
  function registrarMalha(nome, objeto3d, { escala = 1, frente = 'z' } = {}) { malhasBase[nome] = { obj: objeto3d, escala, frente, pool: [] }; }
  function pegarMalha(nome) { const b = malhasBase[nome]; if (!b) return null; let m = b.pool.find(x => !x.visible); if (!m) { if (b.pool.length >= Q.malhas) return null; m = b.obj.clone(true); m.traverse(o => { o.castShadow = false; }); m.scale.setScalar(b.escala); scene.add(m); b.pool.push(m); } m.visible = true; return m; }
  // clarão: uma PointLight sempre na cena (intensidade 0 parada) — adicionar/remover luzes recompila todos os materiais
  const luz = new THREE.PointLight(0xffffff, 0, 9, 2); luz.position.set(0, -50, 0); scene.add(luz); let luzI = 0, luzT = 0, luzD = .2;
  function clarao(p, cor, intens = 6, dur = .2) { if (!Q.luz) return; luz.position.set(p.x, p.y + .8, p.z); luz.color.setRGB(...cor); luzI = intens; luzT = 0; luzD = dur; }
  // projétil: { de, ate (ponto) | alvo (Object3D seguido), vel, malha, giro, arco, rastro:{cor,larg,dur}, emissores:[{flip, taxa (por s), e:(p,dir)=>opts}], aoAcertar(p,dir) }
  const _d = new THREE.Vector3(), _a = new THREE.Vector3();
  function projetil(o) { const p = o.de.clone(); const m = o.malha ? pegarMalha(o.malha) : null; const r = o.rastro ? pegarRastro() : null; if (r) r.iniciar(o.rastro);
    const acc = (o.emissores || []).map(() => 0); let dist = 0; const base = o.de.clone(); const tot = o.ate ? o.de.distanceTo(o.ate) : 0;
    const e = { upd(dt) { const alvoP = o.alvo ? _a.copy(o.alvo.position).setY(o.alvo.position.y + (o.alturaAlvo ?? 1.2)) : o.ate; _d.subVectors(alvoP, p); const L = _d.length(); const passo = o.vel * dt; _d.normalize();
        let fim = L <= passo + .05; if (fim) p.copy(alvoP); else p.addScaledVector(_d, passo); dist += passo; if (o.arco && tot) { const k = Math.min(1, dist / tot); p.y = base.y + (alvoP.y - base.y) * k + Math.sin(k * Math.PI) * o.arco; }
        if (m) { m.position.copy(p); m.lookAt(p.x + _d.x, p.y + _d.y, p.z + _d.z); if (o.giro) m.rotateZ(o.giro * dist); }
        if (r) r.seguir(p, agora); (o.emissores || []).forEach((em, i) => { acc[i] += dt * em.taxa * Q.taxa; if (!(acc[i] < 64)) acc[i] = 64; while (acc[i] >= 1) { acc[i] -= 1; emitir(em.flip, p, em.e(p, _d), true); } });
        if (fim) { if (m) m.visible = false; if (r) r.solto = true; if (o.aoAcertar) o.aoAcertar(p.clone(), _d.clone()); return false; } return true; } };
    ativos.push(e); return e; }
  function atualizar(dt) { agora += dt; for (let i = ativos.length - 1; i >= 0; i--) { let ok = false; try { ok = ativos[i].upd(dt); } catch (e) { console.error('[erro] vfx projetil', e && e.message); } if (!ok) ativos.splice(i, 1); }
    for (const s of Object.values(flips)) s.update(dt); for (const r of rastros) r.update(agora, camera);
    for (const x of decais) { if (x.livre) continue; x.t += dt; const k = x.t / x.vida; if (k >= 1) { x.livre = true; x.m.visible = false; continue; } const e = 1 - Math.pow(1 - Math.min(1, k * 3), 3); x.m.scale.setScalar((x.r0 + (x.r1 - x.r0) * e) * 2); x.m.material.opacity = x.op * Math.min(1, (1 - k) * 3); }
    if (luzI > 0) { luzT += dt; const k = luzT / luzD; luz.intensity = k >= 1 ? 0 : luzI * (1 - k) * (1 - k); if (k >= 1) luzI = 0; } }
  function stats() { return { particulas: Object.fromEntries(Object.entries(flips).map(([k, s]) => [k, s.n + '/' + s.max])), rastros: rastros.filter(r => r.ativo).length, decais: decais.filter(d => !d.livre).length, projeteis: ativos.length, qualidade }; }
  return { registrarFlip, temFlip: (n) => !!flips[n], emitir, rajada, registrarRastro, pegarRastro: () => pegarRastro(), agora: () => agora, decal, registrarMalha, pegarMalha, clarao, projetil, atualizar, stats, Q };
}
