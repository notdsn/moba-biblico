// VFX dos kits novos (Parte C): motor vfx_motor.js + VFX realistas do Jarvys (public/vfx/realista/, lidos pelo manifest.json)
// + malhas reais (models/vfx/flecha.glb, GLBs do Tripo e alguns objetos procedurais baratos). Nada de esfera/orbe genérico:
// flecha é flecha, fogo é fogo (flipbook), pedra é pedra, água é água.
// Tudo em pool e registrado antes da partida (aquecerShaders compila e envia as texturas); 0 luzes novas além da 1 do motor.
// Assets novos = só trocar os arquivos + manifest.json (grade, quadros, fps, mistura, aspecto e células vêm de lá).
import * as THREE from 'three';
import { criarMotorVFX } from './vfx_motor.js';

const TAU = Math.PI * 2, rnd = (a = 1) => (Math.random() - .5) * 2 * a;

// sistemas de partícula -> arquivo do manifest. h = heróis que precisam (carregado só se estiverem na partida); sem h = sempre.
// alias: se o sistema não foi carregado (herói fora da partida / nível sem a variante), emite no substituto.
const SIS = {
  fogo: { f: 'fx_fogo_8x8', max: 140, ancora: 'base', h: ['elias', 'debora', 'daniel', 'farao', 'gideao', 'nabuco'] },
  bola: { f: 'fx_fogo_bola_8x8', max: 50, h: ['elias', 'debora'] },
  chao: { f: 'fx_fogo_chao_8x8', max: 60, ancora: 'base', h: ['elias', 'nabuco'] },
  fornalha: { f: 'fx_fogo_fornalha_8x8', max: 36, ancora: 'base', h: ['nabuco', 'golias', 'golias2', 'elias'] },
  tingivel: { f: 'fx_fogo_tingivel_8x8', max: 60, ancora: 'base', h: ['moises', 'gideao', 'herodes', 'balaao'] },
  tocha: { f: 'fx_fogo_tocha_8x8', max: 40, ancora: 'base', h: ['gideao', 'elias'] },
  expl: { f: 'fx_explosao_5x5', max: 16 },
  explP: { f: 'fx_explosao_8x8', max: 24 },
  fumaca: { f: 'fx_fumaca_8x8', max: 110 },
  densa: { f: 'fx_fumaca_densa_8x8', max: 90 },
  poeira: { f: 'fx_poeira_8x8', max: 90 },
  agua: { f: 'fx_agua_respingo_8x8', max: 40, ancora: 'base', h: ['moises', 'davi', 'farao', 'noe'] },
  raio: { f: 'fx_raio_1x8', max: 16, h: ['debora', 'davi'] },
  det: { f: 'fx_detritos_4x4', max: 420 },
  brasas: { f: 'fx_brasas_8x8', max: 30 },
  flash: { f: 'fx_flash', max: 40 },
  onda: { f: 'fx_onda_choque_8x8', max: 16, chao: true },
};
const ALIAS = { bola: 'fogo', chao: 'fogo', fornalha: 'fogo', tocha: 'fogo', tingivel: 'fogo', fogo: 'explP', agua: 'poeira', raio: 'flash' };

export async function criarVfxKits(C) {
  const { scene, camera, renderer } = C; const mobile = !!C.mobile, baixa = !!C.baixa;
  const M = criarMotorVFX(scene, camera, { qualidade: baixa ? 'baixa' : mobile ? 'mobile' : 'pc' });
  const raiz = (C.base || '') + 'vfx/realista/';
  const man = await (await fetch(raiz + 'manifest.json')).json();
  const tier = baixa ? 'baixa' : mobile ? 'celular' : 'pc';
  const usarKtx = !!(C.ktx2 && (mobile || baixa || C.ktxPC)); // celular: KTX2 (~1 byte/px na GPU); PC: WebP (qualidade cheia)
  const porNome = Object.fromEntries(man.files.map(f => [f.file, f]));
  const texs = [], cache = {};
  // escolhe a variante do nível (baixa sem a variante -> celular; celular sem -> nada, ex.: normais só PC)
  function variante(f) { const v = f.variants; if (v[tier]) return { v, t: tier }; if (tier === 'baixa' && v.celular) return { v, t: 'celular' }; if (tier === 'pc') return null; return null; }
  async function carregar(nome) {
    if (cache[nome]) return cache[nome]; const f = porNome[nome]; if (!f) { console.warn('[vfx] fora do manifest:', nome); return null; }
    const e = variante(f); if (!e) return null; const v = e.v[e.t];
    const cs = f.colorSpace === 'srgb' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    let tex = null;
    if (usarKtx && v.ktx2) { try { tex = await C.ktx2.loadAsync(raiz + v.ktx2); } catch (err) { console.warn('[vfx] KTX2 falhou, usando WebP:', v.ktx2, err && err.message); tex = null; } }
    if (!tex) { tex = await new THREE.TextureLoader().loadAsync(raiz + v.webp); tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter; }
    tex.colorSpace = cs; tex.premultiplyAlpha = false; tex.magFilter = THREE.LinearFilter; tex.needsUpdate = true;
    const grid = v.grid || f.grid, frames = v.frames || f.frames;
    const celula = !v.grid && f.cell_uv ? (e.t === 'pc' ? f.cell_uv : (f.cell_uv_celular || f.cell_uv)) : 0;
    const bl = String(f.blending), modo = bl.startsWith('additive (premult') || bl.startsWith('premult') ? 'pre' : bl.startsWith('additive') ? 'add' : 'normal';
    texs.push(tex); return (cache[nome] = { tex, f, grid, frames, celula, modo, nivel: e.t });
  }
  async function registrarSis(n) {
    const d = SIS[n]; if (M.temFlip && M.temFlip(n)) return; const a = await carregar(d.f); if (!a) return; const f = a.f;
    const pb = f.playback; const estatico = pb === 'static' || pb === 'variation' || pb === 'scroll';
    M.registrarFlip(n, a.tex, { cols: a.grid.cols, rows: a.grid.rows, quadros: a.frames, celula: a.celula, modo: a.modo, fps: pb === 'loop' ? f.fps : 0, estatico, asp: f.frame_aspect || 1, ancora: d.ancora, base: d.ancora === 'base' ? origemBase(f) : 0, chao: d.chao, max: d.max });
  }
  // origem (pé) do efeito dentro da célula, em fração da altura a partir de baixo: campo do manifest (origin_y / base_y) ou a nota ("~16% from the bottom")
  function origemBase(f) { const v = f.origin_y ?? f.base_y ?? f.origem_y; if (typeof v === 'number') return v > 1 ? v / 100 : v; const m = /(\d+(?:\.\d+)?)\s*%\s*from the bottom/i.exec(f.note || ''); return m ? +m[1] / 100 : 0; }
  // água em malha (T5/T6 do manifest): fx_agua_faixa (tileável, rola em V) em colunas/faixas e fx_agua_onda (frente de onda, espelhável) em quadros
  const AG = { faixa: null, onda: null, pool: { faixa: [], onda: [] }, anims: [], ok: false };
  const H_AGUA = ['moises', 'noe'];
  const geoCol = new THREE.CylinderGeometry(.42, .6, 1, 20, 1, true); geoCol.translate(0, .5, 0);
  const geoPl = new THREE.PlaneGeometry(1, 1); geoPl.translate(0, .5, 0);
  function matAgua(a, borda) { return new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    uniforms: { map: { value: a.tex }, uRep: { value: new THREE.Vector2(1, 1) }, uOff: { value: new THREE.Vector2() }, uA: { value: 1 }, uCor: { value: new THREE.Color(1, 1, 1) }, uEsp: { value: 0 }, uBorda: { value: borda ? 1 : 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform sampler2D map; uniform vec2 uRep; uniform vec2 uOff; uniform float uA; uniform vec3 uCor; uniform float uEsp; uniform float uBorda; varying vec2 vUv;
      void main(){ vec2 uv = vUv; if (uEsp > .5) uv.x = 1. - uv.x; vec4 t = texture2D(map, uv * uRep + uOff); float k = uA; if (uBorda > .5) k *= smoothstep(0., .12, vUv.y) * smoothstep(1., .72, vUv.y);
        gl_FragColor = vec4(t.rgb * uCor * k, t.a * k); if (gl_FragColor.a < .004) discard; }` }); }
  async function carregarAgua() { if (AG.ok) return; AG.ok = true; const [fa, on] = await Promise.all([carregar('fx_agua_faixa'), carregar('fx_agua_onda')]);
    if (fa) { fa.tex.wrapS = fa.tex.wrapT = THREE.RepeatWrapping; fa.tex.needsUpdate = true; } AG.faixa = fa; AG.onda = on; }
  function pegarAgua(tipo, geo) { const a = AG[tipo]; if (!a) return null; const pool = AG.pool[tipo]; let m = pool.find(x => !x.visible && x.geometry === geo); if (!m) { if (pool.length >= (baixa ? 4 : mobile ? 6 : 10)) return null; m = new THREE.Mesh(geo, matAgua(a, tipo === 'faixa')); m.frustumCulled = false; m.renderOrder = 12; scene.add(m); pool.push(m); }
    const u = m.material.uniforms; u.uA.value = 1; u.uEsp.value = 0; u.uOff.value.set(0, 0); u.uRep.value.set(1, 1); u.uCor.value.setRGB(1, 1, 1); m.visible = true; m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1); return m; }
  const animar = (m, vida, up) => { AG.anims.push({ m, t: 0, vida, up }); };
  const carregados = new Set(); let malhasProntas = false;
  async function carregarSistemas(ids) { const quer = Object.keys(SIS).filter(n => !carregados.has(n) && (!SIS[n].h || (ids === '*' || SIS[n].h.some(h => ids.includes(h))))); quer.forEach(n => carregados.add(n)); const agua = ids === '*' || (Array.isArray(ids) && ids.some(h => H_AGUA.includes(h))); await Promise.all([...quer.map(registrarSis), agua ? carregarAgua() : null, malhasProntas ? malhasManifest(ids) : null]); }
  await carregarSistemas([]);
  // atlas de decais (straight alpha, normal) + emissivo; rastros 1x6 (1 faixa por tipo). Clones compartilham a mesma textura na GPU.
  const celulas = (a, nomes) => { const o = {}; if (!a) return o; const { cols, rows } = a.grid; nomes.forEach((n, i) => { const t = a.tex.clone(); t.repeat.set(1 / cols, 1 / rows); t.offset.set((i % cols) / cols, (rows - 1 - Math.floor(i / cols)) / rows); o[n] = t; }); return o; };
  const aDec = await carregar('fx_decais_4x4'), aDecE = await carregar('fx_decais_4x4_emissivo'), aRas = await carregar('fx_rastros_1x6');
  const DEC = celulas(aDec, aDec ? aDec.f.cells : []), DECE = celulas(aDecE, aDec ? aDec.f.cells : []);
  const RAS = celulas(aRas, aRas ? aRas.f.rows : []); Object.values(RAS).forEach(t => { t.wrapS = THREE.RepeatWrapping; });
  M.registrarRastro(RAS.ar || null);
  const D = Object.fromEntries((porNome.fx_detritos_4x4?.cells || []).map((n, i) => [n, i]));
  const sisOk = (n) => { let k = n, g = 0; while (k && !(M.temFlip && M.temFlip(k)) && g++ < 4) k = ALIAS[k]; return k; };
  const E = (s, p, o, ess) => M.emitir(sisOk(s), p, o, ess);
  const _p = new THREE.Vector3();
  const P = (x, y, z) => _p.set(x, y, z);
  // cortes em arco (fita de rastro percorrendo um arco): espadas, garras, queixada
  const cortes = [];

  // ---------------- primitivas ----------------
  const V = {
    M, D,
    // labaredas (fx_fogo_8x8 por padrão; sis = 'tocha' | 'chao' | 'fornalha' | 'tingivel' para os fogos de cada herói)
    chamas(c, r = 1, n = 6, s = 1.4, vida = .9, sis = 'fogo', cor = [1, 1, 1]) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * r; E(sis, P(c.x + Math.cos(a) * d, (c.y || 0) + .02, c.z + Math.sin(a) * d), { vida: vida * (.75 + Math.random() * .5), t0: s * (.7 + Math.random() * .5), t1: s * .9, vel: [0, .25, 0], q0: -1, cor, alpha: .95 }); } },
    // bola de fogo (núcleo do projétil): fx_fogo_bola aditivo, girando
    bolaFogo(p, s = 1.1, vida = .28) { E('bola', p, { vida, t0: s, t1: s * .6, q0: -1, rot: Math.random() * TAU, giro: rnd(3) }, true); },
    explosao(c, s = 3, fogo = true, cor) { E('expl', P(c.x, (c.y ?? 0) + s * .3, c.z), { vida: .85, t0: s * .8, t1: s * 1.2, cor: cor || [1, 1, 1], rot: Math.random() * TAU }, true); if (fogo) E('brasas', P(c.x, (c.y ?? 0) + s * .3, c.z), { vida: .7, t0: s * .7, t1: s * 1.1, rot: Math.random() * TAU }); },
    explosaoP(c, s = 1.6, cor) { E('explP', P(c.x, (c.y ?? 0) + s * .3, c.z), { vida: .6, t0: s * .8, t1: s * 1.1, cor: cor || [1, 1, 1], rot: Math.random() * TAU }, true); },
    fumaca(c, s = 1.5, n = 4, cor = [.35, .32, .3], alpha = .6, sobe = 1) { for (let i = 0; i < n; i++) E('fumaca', P(c.x + rnd(s * .3), (c.y ?? 0) + .4 + Math.random() * .4, c.z + rnd(s * .3)), { vida: 1.3 + Math.random() * .6, t0: s * .6, t1: s * 1.4, q0: -1, vel: [rnd(.4), sobe * (.6 + Math.random() * .6), rnd(.4)], cor, alpha, rot: Math.random() * TAU, giro: rnd(.6), drag: .6 }); },
    // poeira de impacto no chão: anel de nuvens que se abre (fx_poeira, tingida)
    poeira(c, r = 2, cor = [.85, .75, .6], n = 8, alpha = .8) { for (let i = 0; i < n; i++) { const a = i / n * TAU + rnd(.2), sp = r * (1.2 + Math.random()); E('poeira', P(c.x + Math.cos(a) * r * .3, .3, c.z + Math.sin(a) * r * .3), { vel: [Math.cos(a) * sp, .4 + Math.random() * .5, Math.sin(a) * sp], drag: 2.6, vida: 1 + Math.random() * .4, t0: r * .55, t1: r * 1.05, cor, alpha, rot: Math.random() * TAU, giro: rnd(.5) }); } },
    // detritos do atlas (brasa, faisca_alongada, gota, espuma, lasca_pedra, caco_barro, folha, petala, espinho, pena_preta, pena_branca, gafanhoto, granizo, fio_cabelo, cinza_papel, runa)
    detritos(c, cel, n = 8, s = 4, t = .3, cor = [1, 1, 1], grav = 9, vida = .8, y) { const q = D[cel] ?? 0; for (let i = 0; i < n; i++) { const a = Math.random() * TAU, sp = s * (.3 + Math.random() * .7); E('det', P(c.x, y ?? (c.y || 1.2), c.z), { q0: q, vel: [Math.cos(a) * sp, Math.random() * s * .6 + (grav ? s * .3 : 0), Math.sin(a) * sp], grav, drag: 1.2, vida: vida * (.6 + Math.random() * .8), t0: t, t1: t * .6, cor, rot: Math.random() * TAU, giro: rnd(6) }); } },
    faiscas(c, n = 10, cor = [1, .75, .35], s = 6, y, vida = .45, t = .35) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, sp = s * (.3 + Math.random() * .7); E('det', P(c.x, y ?? (c.y || 1.2), c.z), { q0: Math.random() < .5 ? D.faisca_alongada : D.brasa, vel: [Math.cos(a) * sp, Math.random() * s * .6, Math.sin(a) * sp], grav: 9, drag: 1.5, vida: vida * (.6 + Math.random() * .8), t0: t, t1: 0, cor, rot: a }); } },
    brasas(c, s = 2) { E('brasas', P(c.x, (c.y ?? 0) + s * .4, c.z), { vida: .8, t0: s * .8, t1: s * 1.2, rot: Math.random() * TAU }, true); },
    // clarão de impacto (fx_flash: núcleo + raios, rotação aleatória)
    brilho(c, cor = [1, .85, .5], s = 2, vida = .12) { E('flash', c, { vida, t0: s * .7, t1: s, cor, rot: Math.random() * TAU }, true); },
    estrelas(c, n = 6, cor = [1, .9, .5], r = .8, s = .5, vida = .7) { for (let i = 0; i < n; i++) E('flash', P(c.x + rnd(r), (c.y || 1) + rnd(r), c.z + rnd(r)), { vida: vida * (.6 + Math.random() * .6), t0: s, t1: 0, cor, vel: [rnd(1), .8 + Math.random(), rnd(1)], rot: Math.random() * TAU, giro: rnd(4) }); },
    magia(c, n = 6, cor = [.7, .5, 1], r = .6, s = .7) { for (let i = 0; i < n; i++) E(i % 2 ? 'flash' : 'det', P(c.x + rnd(r), (c.y || 1) + rnd(r), c.z + rnd(r)), { q0: D.runa, vida: .5 + Math.random() * .4, t0: s, t1: s * .2, cor, vel: [rnd(.6), .6 + Math.random(), rnd(.6)], rot: Math.random() * TAU, giro: rnd(3) }); },
    // corte: fita de rastro (faixa 'ar') varrendo um arco de ~150° na frente (ang = direção em radianos no plano XZ)
    corte(c, cor = [1, .95, .8], s = 2.4, ang = 0, vida = .18, faixa = 'ar') { const r = M.pegarRastro(); if (!r) { V.brilho(c, cor, s * .6); return; } r.iniciar({ cor, larg: s * .14, dur: vida * .8, tex: RAS[faixa] }); cortes.push({ r, c: { x: c.x, y: c.y ?? 1.1, z: c.z }, R: s * .5, ang, t: 0, vida }); },
    simbolo(c, cor = [.6, 1, .4], s = 1.2, vida = 1) { E('det', c, { q0: D.runa, vida, t0: s, t1: s * 1.2, cor, vel: [0, .6, 0], rot: 0, giro: 1 }, true); },
    // relâmpago (fx_raio_1x8: variação sorteada, aditivo azul-branco), vertical com a base em c
    raio(c, h = 3, cor = [.75, .85, 1], vida = .16) { E('raio', P(c.x, (c.y || 0) + h * .5, c.z), { q0: -1, vida, t0: h, t1: h, asp: .5, cor, rot: rnd(.15) }, true); },
    // água: coroa de respingo (fx_agua_respingo, base no chão) + gotas do atlas; tingir de vermelho para o sangue do Faraó
    agua(c, s = 1.4, n = 3, sobe = 3, cor = [1, 1, 1]) { for (let i = 0; i < n; i++) E('agua', P(c.x + rnd(s * .3), (c.y ?? 0), c.z + rnd(s * .3)), { vida: .85 + Math.random() * .3, t0: s * 1.2, t1: s * 1.4, cor, rot: rnd(.15) }, i === 0); V.detritos(P(c.x, (c.y ?? 0) + .3, c.z), 'gota', n * 3, sobe, .14, cor, 14, .7); },
    // coluna/jato d'água (Moisés Q)
    jatoAgua(c, h = 4, r = 1.6, vida = 1.1) { V.colunaAgua(c, h, r, vida); for (let i = 0; i < 3; i++) E('agua', P(c.x + rnd(r * .3), i ? h * (.35 + .25 * i) : 0, c.z + rnd(r * .3)), { vida: .8 + Math.random() * .3, t0: r * (i ? 1.3 : 1.8), t1: r * 2.1, rot: rnd(.2) }, true); V.agua(c, r, 2, 6); },
    // coluna d'água (fx_agua_faixa rolando em V num cilindro aberto): sobe rápido, segura e desaba
    colunaAgua(c, h = 4, r = 1.6, vida = 1.1) { const m = pegarAgua('faixa', geoCol); if (!m) return; m.position.set(c.x, 0, c.z); m.material.uniforms.uRep.value.set(2, h / (r * 1.6)); m.material.uniforms.uCor.value.setRGB(.85, .95, 1);
      animar(m, vida, (m, t, k, dt) => { const sub = Math.min(1, t / .16), cai = k > .7 ? 1 - (k - .7) / .3 : 1; m.scale.set(r * (1 + .25 * (1 - cai)), h * sub * (.35 + .65 * cai), r * (1 + .25 * (1 - cai))); const u = m.material.uniforms; u.uOff.value.y -= dt * 2.2; u.uOff.value.x += dt * .15; u.uA.value = Math.min(1, cai * 1.4); }); },
    // faixa d'água vertical (frente da onda do Moisés R): plano largura L x altura A, rolando; devolve a malha para o chamador mover
    faixaAgua(c, ang, L = 4, A = 1.6, vida = 1.5, seguir) { const m = pegarAgua('faixa', geoPl); if (!m) return null; m.position.set(c.x, c.y ?? 0, c.z); m.rotation.y = ang; m.material.uniforms.uRep.value.set(L / 2.4, A / 2.4);
      animar(m, vida, (m, t, k, dt) => { const u = m.material.uniforms; u.uOff.value.y -= dt * 1.8; const s = Math.min(1, t / .2); m.scale.set(L, A * s * (k > .8 ? (1 - k) / .2 : 1), 1); u.uA.value = k > .8 ? (1 - k) / .2 : 1; if (seguir) seguir(m, t, k); }); return m; },
    // frente de onda (fx_agua_onda: vista lateral, quebra para a direita; esp = espelha U). Quadro vertical no ângulo ang (ou virado para a câmera se ang == null)
    frenteOnda(c, ang, L = 4, A = 3, vida = 1.2, esp = false, seguir, cor) { const m = pegarAgua('onda', geoPl); if (!m) { V.agua(c, A * .5, 2, 4); return null; } m.position.set(c.x, c.y ?? 0, c.z); if (cor) m.material.uniforms.uCor.value.setRGB(cor[0], cor[1], cor[2]);
      animar(m, vida, (m, t, k) => { if (ang == null) { m.rotation.y = Math.atan2(camera.position.x - m.position.x, camera.position.z - m.position.z); } else m.rotation.y = ang;
        // esp: true/false = quebra para -X/+X local; {x,z} = quebra nessa direção do mundo. Corrige pelo lado de onde a câmera vê o quadro (DoubleSide espelha por trás)
        { const ry = m.rotation.y, rx = Math.cos(ry), rz = -Math.sin(ry), nx = Math.sin(ry), nz = Math.cos(ry); let dirX = typeof esp === 'object' && esp ? (esp.x * rx + esp.z * rz) < 0 : !!esp; if ((camera.position.x - m.position.x) * nx + (camera.position.z - m.position.z) * nz < 0) dirX = !dirX; m.material.uniforms.uEsp.value = dirX ? 1 : 0; } const s = .35 + .65 * Math.min(1, t / (vida * .35)); m.scale.set(L * (.7 + .3 * s), A * s, 1); m.material.uniforms.uA.value = Math.min(1, t * 8) * (k > .7 ? (1 - k) / .3 : 1); if (seguir) seguir(m, t, k); }); return m; },
    temAgua: () => !!(AG.faixa || AG.onda),
    // nuvem/fumaça densa tingida (gafanhotos, trevas, areia, névoa)
    nevoa(c, r = 2, n = 4, cor = [.5, .45, .35], alpha = .55, s = 2, vida = 1.4) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * r; E('densa', P(c.x + Math.cos(a) * d, .5 + Math.random() * .8, c.z + Math.sin(a) * d), { vida: vida * (.7 + Math.random() * .6), t0: s * .7, t1: s, q0: -1, cor, alpha, vel: [rnd(.4), .2, rnd(.4)], rot: Math.random() * TAU, giro: rnd(.5) }); } },
    // decais (atlas 4x4 do manifest: queimado, rachadura, rachadura_lava, chao_molhado, pegadas_leao_humano, garras, buraco_pedra, mancha_escura,
    // circulo_areia, marcas_rodas, laco_corda, runas_cuneiformes, mene_tequel, estrela_gravada, sulco_serpente, borda_aviso)
    // marcas no chão: somem com o fim do golpe (máx. 1,4 s, fade ~0,5 s) e menos opacas; só zonas reais (zona=true) duram a zona inteira
    decal(c, cel, r = 2, vida = 3, cor = [1, 1, 1], op = .9, r0, zona = false) { const t = DEC[cel]; if (!t) return; if (!zona) vida = Math.min(vida, 1.4); op *= zona ? .8 : .62; M.decal(c, { tex: t, r0: r0 ?? r * .85, r1: r, vida, cor, op }); if (DECE[cel] && (cel === 'rachadura_lava' || cel === 'mene_tequel')) M.decal(c, { tex: DECE[cel], r0: r0 ?? r * .85, r1: r, vida, cor: [1, .8, .5], aditivo: true, op: 1 }); },
    queimado(c, r = 2, vida = 3) { V.decal(c, 'queimado', r, vida, [1, 1, 1], .9); },
    rachadura(c, r = 2, vida = 2.5) { V.decal(c, 'rachadura', r, vida, [1, 1, 1], .85); },
    // onda de choque deitada no chão (fx_onda_choque flipbook, tingida)
    onda(c, r = 3, cor = [1, .9, .75], vida = .5) { E('onda', P(c.x, .08, c.z), { vida, t0: r * 1.2, t1: r * 2.2, cor, rot: Math.random() * TAU }, true); },
    marcaChao(c, r = 2, cor = [1, .4, .2], vida = 1) { V.decal(c, 'borda_aviso', r, vida, cor, .9, r); },
    clarao(c, cor = [1, .7, .4], i = 5, d = .25) { M.clarao(c, cor, i, d); },
    // fogo completo de impacto (explosão + labaredas + fumaça + brasas + chão queimado + onda + clarão)
    impactoFogo(c, r = 2.5) { V.explosao(c, r * 1.1, true); V.chamas(c, r * .6, Math.round(4 + r), 1.1 + r * .3); V.fumaca(c, r, 3, [.22, .2, .18], .6); V.faiscas(c, 12, [1, .6, .2], 7, 1); V.decal(c, 'queimado', r, 4); V.onda(c, r * .8, [1, .7, .4], .45); V.clarao(c, [1, .55, .2], 7, .35); },
    impactoPedra(c, r = 1.5, cor = [.85, .75, .6]) { V.poeira(c, r, cor, 6, .75); V.decal(c, 'buraco_pedra', r * .7, 2.2); V.detritos(c, 'lasca_pedra', 6, 4, .22, [1, 1, 1], 14, .8, c.y || 1); for (let i = 0; i < 4; i++) { const m = pegarMalha('lasca'); if (!m) break; voar(m, c, 4 + Math.random() * 3, .9); } },
    carregarHerois: (ids) => carregarSistemas(ids),
  };

  // ---------------- malhas reais ----------------
  const base = {}; // nome -> { obj (Object3D modelo), pool: [] }
  const MAXM = baixa ? 10 : mobile ? 16 : 28;
  // assa uma malha GLB: centraliza, eixo longo -> +Z, comprimento L; ponta (lado mais fino) para +Z
  function assar(src, L, { eixo = 'auto', ponta = true, mat } = {}) {
    if (!src) return null; let mesh = null; src.updateMatrixWorld(true); src.traverse(o => { if (o.isMesh && !mesh) mesh = o; }); if (!mesh) return null;
    const g = mesh.geometry.clone(); g.applyMatrix4(mesh.matrixWorld); g.computeBoundingBox(); let b = g.boundingBox; const sz = b.getSize(new THREE.Vector3());
    const ax = eixo !== 'auto' ? eixo : sz.x >= sz.y && sz.x >= sz.z ? 'x' : sz.y >= sz.z ? 'y' : 'z';
    if (ax === 'x') g.rotateY(-Math.PI / 2); else if (ax === 'y') g.rotateX(Math.PI / 2);
    g.computeBoundingBox(); b = g.boundingBox; const c = b.getCenter(new THREE.Vector3()); g.translate(-c.x, -c.y, -c.z); const s = b.getSize(new THREE.Vector3()); const k = L / Math.max(s.x, s.y, s.z); g.scale(k, k, k);
    if (ponta) { // lado mais fino em +Z (ponta da flecha/lança)
      const pa = g.attributes.position; let wA = 0, wB = 0; const z0 = -L / 2, z1 = L / 2, f = L * .06;
      for (let i = 0; i < pa.count; i++) { const z = pa.getZ(i), r = Math.hypot(pa.getX(i), pa.getY(i)); if (z < z0 + f) wA = Math.max(wA, r); else if (z > z1 - f) wB = Math.max(wB, r); }
      if (wB > wA) g.rotateY(Math.PI);
    }
    let mt = mat; if (!mt) { mt = mesh.material.clone(); mt.metalness = Math.min(mt.metalness ?? 0, .4); mt.roughness = Math.max(mt.roughness ?? 1, .45); mt.envMapIntensity = .6; }
    const m = new THREE.Mesh(g, mt); return m;
  }
  function registrar(nome, obj, esc = 1) { if (!obj) return; obj.traverse(o => { o.castShadow = false; o.receiveShadow = false; }); base[nome] = { obj, esc, pool: [] }; const m = pegarMalha(nome); if (m) m.visible = false; }
  function pegarMalha(nome) { const b = base[nome]; if (!b) return null; let m = b.pool.find(x => !x.visible); if (!m) { if (b.pool.length >= MAXM) return null; m = b.obj.clone(true); scene.add(m); b.pool.push(m); } m.visible = true; m.scale.setScalar(b.esc); m.rotation.set(0, 0, 0); m.userData.nome = nome; return m; }
  const soltarMalha = (m) => { if (m) m.visible = false; };
  const temMalha = (n) => !!base[n];
  // peça solta que voa em arco e some (lascas de pedra, cacos do cântaro)
  const voando = [];
  function voar(m, c, sp, vida) { const a = Math.random() * TAU; m.position.set(c.x, (c.y || 1) + .2, c.z); m.scale.setScalar(base[m.userData.nome].esc * (.6 + Math.random() * .7)); voando.push({ m, v: new THREE.Vector3(Math.cos(a) * sp * .6, 3 + Math.random() * 3, Math.sin(a) * sp * .6), r: new THREE.Vector3(rnd(10), rnd(10), rnd(10)), t: 0, vida }); }

  // ---- GLBs ----
  const flechaG = C.flecha ? assar(C.flecha.scene, 1.15) : null;
  if (flechaG) { registrar('flecha', flechaG); const v = flechaG.clone(); registrar('virote', v, .62); }
  const md = (n) => C.modelo && C.modelo(n);
  const pedra = assar(md('pedra_funda'), .5, { ponta: false }); if (pedra) registrar('pedra', pedra);
  const pedraG = pedra ? pedra.clone() : null; if (pedraG) registrar('pedraG', pedraG, 1.9);
  const lanca = assar(md('lanca'), 2.2); if (lanca) registrar('lanca', lanca);
  if (lanca) { const l2 = lanca.clone(); l2.material = lanca.material.clone(); l2.material.emissive = new THREE.Color(.45, .7, 1); l2.material.emissiveIntensity = 1.2; registrar('lancaLuz', l2, .8); }
  const cristal = assar(md('cristal_trevas'), .9); if (cristal) registrar('cristal', cristal);
  const cetro = assar(md('cetro_farao'), 1.8); if (cetro) registrar('cetro', cetro);
  const tocha = assar(md('tocha_gideao'), .9, { ponta: false }); if (tocha) registrar('cantaro', tocha);

  // ---- procedurais (1 geometria + 1 material cada, criados agora) ----
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: .75, ...o });
  const juntar = (gs) => { const ps = []; const ns = []; const cs = []; for (const [g, cor] of gs) { const n = g.index ? g.toNonIndexed() : g; n.computeVertexNormals(); ps.push(n.attributes.position.array); ns.push(n.attributes.normal.array); const c = new Float32Array(n.attributes.position.count * 3); for (let i = 0; i < c.length; i += 3) c.set(cor, i); cs.push(c); }
    const cat = (a) => { const r = new Float32Array(a.reduce((s, x) => s + x.length, 0)); let o = 0; for (const x of a) { r.set(x, o); o += x.length; } return r; };
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(cat(ps), 3)); g.setAttribute('normal', new THREE.BufferAttribute(cat(ns), 3)); g.setAttribute('color', new THREE.BufferAttribute(cat(cs), 3)); return g; };
  const matVC = std({ vertexColors: true, roughness: .7 });
  const T = (g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z); return g; };
  // lasca de pedra (impactos)
  registrar('lasca', new THREE.Mesh(new THREE.DodecahedronGeometry(.12, 0), std({ color: 0x8a7c68, flatShading: true, roughness: .95 })));
  // queixada de jumento (Sansão Q): arco de osso com dentes
  { const curva = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, -.7), new THREE.Vector3(0, .5, 0), new THREE.Vector3(0, 0, .7)); const gs = [[new THREE.TubeGeometry(curva, 10, .11, 6), [.93, .88, .75]]];
    for (let i = 0; i < 6; i++) { const t = .2 + i * .12, p = curva.getPoint(t); gs.push([T(new THREE.ConeGeometry(.05, .16, 4), p.x, p.y - .12, p.z, Math.PI), [1, .97, .9]]); } registrar('queixada', new THREE.Mesh(juntar(gs), matVC)); }
  // serpente (Faraó Q/ataque, Moisés W): tubo ondulado verde com ventre claro e cabeça
  { const pts = []; for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push(new THREE.Vector3(Math.sin(t * TAU * 1.2) * .16, 0, -.8 + t * 1.6)); } const cv = new THREE.CatmullRomCurve3(pts);
    const g = new THREE.TubeGeometry(cv, 24, .075, 6); const pa = g.attributes.position; for (let i = 0; i < pa.count; i++) { const z = pa.getZ(i), k = Math.min(1, (z + .8) / .35); pa.setX(i, pa.getX(i) * (.4 + .6 * k)); pa.setY(i, pa.getY(i) * (.4 + .6 * k)); }
    registrar('serpente', new THREE.Mesh(juntar([[g, [.25, .55, .18]], [T(new THREE.SphereGeometry(.11, 6, 4), Math.sin(TAU * 1.2) * .16, .02, .84, 0, 0, 0).scale(1, .7, 1.4), [.3, .6, .2]]]), matVC)); }
  // carta selada (Jezabel Q): pergaminho com selo vermelho
  registrar('carta', new THREE.Mesh(juntar([[new THREE.BoxGeometry(.5, .02, .36), [.95, .88, .7]], [T(new THREE.CylinderGeometry(.07, .07, .03, 8), 0, .02, 0), [.75, .08, .08]]]), matVC));
  // dado (Hamã Q): faces ouro/vermelho/azul
  { const g = new THREE.BoxGeometry(.4, .4, .4).toNonIndexed(); const cs = new Float32Array(g.attributes.position.count * 3); const F = [[1, .78, .2], [.85, .12, .1], [.2, .4, 1], [1, .78, .2], [.85, .12, .1], [.2, .4, 1]]; for (let f = 0; f < 6; f++) for (let v = 0; v < 6; v++) cs.set(F[f], (f * 6 + v) * 3); g.setAttribute('color', new THREE.BufferAttribute(cs, 3)); registrar('dado', new THREE.Mesh(g, std({ vertexColors: true, roughness: .4, metalness: .3 }))); }
  // corvo (Noé Q): corpo + asas + bico
  registrar('corvo', new THREE.Mesh(juntar([[T(new THREE.ConeGeometry(.16, .7, 5), 0, 0, 0, Math.PI / 2), [.08, .08, .1]], [T(new THREE.BoxGeometry(1.1, .03, .28), 0, .05, -.05, 0, 0, .12), [.06, .06, .08]], [T(new THREE.ConeGeometry(.05, .18, 4), 0, 0, .43, Math.PI / 2), [.55, .45, .2]]]), matVC));
  // pomba (Noé, Ester, Débora): igual ao corvo, branca
  registrar('pomba', new THREE.Mesh(juntar([[T(new THREE.ConeGeometry(.14, .6, 5), 0, 0, 0, Math.PI / 2), [.97, .97, .95]], [T(new THREE.BoxGeometry(.9, .03, .25), 0, .05, -.05), [1, 1, 1]], [T(new THREE.ConeGeometry(.04, .14, 4), 0, 0, .36, Math.PI / 2), [1, .6, .3]]]), matVC));
  // adaga curva (Sarai Q bumerangue)
  registrar('adaga', new THREE.Mesh(juntar([[T(new THREE.BoxGeometry(.08, .03, .6), 0, 0, .2), [.85, .87, .9]], [T(new THREE.BoxGeometry(.25, .05, .05), 0, 0, -.12), [.8, .6, .2]], [T(new THREE.CylinderGeometry(.03, .03, .22, 6), 0, 0, -.25, Math.PI / 2), [.4, .25, .12]]]), std({ vertexColors: true, metalness: .6, roughness: .35 })));
  // tábua de argila/pergaminho (Daniel ataque), anel de sinete (Ester ataque)
  registrar('pergaminho', new THREE.Mesh(juntar([[T(new THREE.CylinderGeometry(.07, .07, .45, 8), 0, 0, 0, 0, 0, Math.PI / 2), [.95, .85, .6]], [T(new THREE.CylinderGeometry(.09, .09, .05, 8), .24, 0, 0, 0, 0, Math.PI / 2), [.6, .4, .2]], [T(new THREE.CylinderGeometry(.09, .09, .05, 8), -.24, 0, 0, 0, 0, Math.PI / 2), [.6, .4, .2]]]), matVC));
  registrar('anel', new THREE.Mesh(new THREE.TorusGeometry(.16, .05, 6, 12), std({ color: 0xffcc55, metalness: .85, roughness: .25, emissive: 0x442200 })));
  // osso/estaca (Gideão ataque não usa); rede de caça (Ninrode W)
  registrar('rede', new THREE.Mesh(new THREE.TorusGeometry(1, .03, 4, 16), std({ color: 0x8a6a40, roughness: 1 })));
  // coluna de templo (Sansão R): cilindro com capitel
  registrar('coluna', new THREE.Mesh(juntar([[new THREE.CylinderGeometry(.42, .48, 4.2, 8), [.86, .8, .7]], [T(new THREE.BoxGeometry(1.1, .3, 1.1), 0, 2.2, 0), [.8, .74, .64]], [T(new THREE.BoxGeometry(1.1, .3, 1.1), 0, -2.2, 0), [.8, .74, .64]]]), std({ vertexColors: true, flatShading: true, roughness: .9 })));
  // portões de Gaza (Sansão E)
  registrar('portao', new THREE.Mesh(juntar([[new THREE.BoxGeometry(2.4, 2.6, .25), [.45, .3, .16]], [T(new THREE.BoxGeometry(2.5, .16, .3), 0, .7, 0), [.3, .3, .32]], [T(new THREE.BoxGeometry(2.5, .16, .3), 0, -.7, 0), [.3, .3, .32]]]), std({ vertexColors: true, roughness: .9 })));
  // arca pequena (Josué E): baú dourado com varais
  registrar('arca', new THREE.Mesh(juntar([[new THREE.BoxGeometry(1.2, .7, .75), [1, .78, .3]], [T(new THREE.BoxGeometry(1.25, .1, .8), 0, .4, 0), [1, .85, .4]], [T(new THREE.CylinderGeometry(.04, .04, 2.2, 6), 0, -.15, .45, 0, 0, Math.PI / 2), [.5, .35, .15]], [T(new THREE.CylinderGeometry(.04, .04, 2.2, 6), 0, -.15, -.45, 0, 0, Math.PI / 2), [.5, .35, .15]], [T(new THREE.BoxGeometry(.3, .3, .1), -.35, .6, 0), [1, .9, .5]], [T(new THREE.BoxGeometry(.3, .3, .1), .35, .6, 0), [1, .9, .5]]]), std({ vertexColors: true, metalness: .7, roughness: .35, emissive: 0x332000 })));
  // muralha de Jericó (Josué R): bloco de pedra
  registrar('muro', new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.2, .7), std({ color: 0xb09a78, flatShading: true, roughness: .95 })));
  // porta da arca (Noé E) e costelas da arca (Noé R)
  registrar('porta', new THREE.Mesh(juntar([[new THREE.BoxGeometry(1.8, 2.2, .18), [.5, .34, .18]], [T(new THREE.BoxGeometry(1.9, .12, .22), 0, .6, 0), [.35, .24, .12]], [T(new THREE.BoxGeometry(1.9, .12, .22), 0, -.6, 0), [.35, .24, .12]]]), std({ vertexColors: true, roughness: .9 })));
  registrar('costela', new THREE.Mesh(new THREE.TorusGeometry(1, .14, 5, 12, Math.PI), std({ color: 0x6b4a28, roughness: .95, flatShading: true })));
  // jarra de maná (Moisés P) e maná: flocos claros (malha leve)
  registrar('mana', new THREE.Mesh(juntar([[new THREE.IcosahedronGeometry(.16, 0), [1, .98, .88]], [T(new THREE.IcosahedronGeometry(.12, 0), .2, -.04, .1), [1, .96, .85]], [T(new THREE.IcosahedronGeometry(.1, 0), -.16, -.05, -.12), [1, .97, .9]]]), std({ vertexColors: true, emissive: 0x554433, roughness: .6, flatShading: true })));
  // mão de pedra (Nabuco W): punho
  registrar('mao', new THREE.Mesh(juntar([[new THREE.BoxGeometry(1.2, .8, 1), [.75, .68, .55]], [T(new THREE.BoxGeometry(1.2, .3, .35), 0, -.5, .45), [.7, .63, .5]], [T(new THREE.BoxGeometry(.3, .6, .3), .7, 0, .3), [.7, .63, .5]]]), std({ vertexColors: true, flatShading: true, roughness: .9 })));

  // ---- malhas do manifest (Jarvys: public/models/vfx/*.glb, lista manifest.meshes) ----
  // Cada entrada substitui a malha procedural do mesmo slot; sem o arquivo, fica o procedural/flipbook (troca drop-in).
  // slot: campo "slot" da entrada ou deduzido do nome do arquivo. L = comprimento em metros; ponta = lado fino em +Z.
  const SLOTS_MALHA = {
    flecha: { L: 1.15, extra: [['virote', .62]] }, pedra: { L: .5, ponta: false, extra: [['pedraG', 1.9]] }, pedra_funda: { slot: 'pedra', L: .5, ponta: false, extra: [['pedraG', 1.9]] },
    queixada: { h: ['sansao', 'golias2'], L: .9, ponta: false }, cantaro: { h: ['gideao'], L: .9, ponta: false }, cacos: { h: ['gideao'], slot: 'lasca', L: .25, ponta: false }, cacos_cantaro: { h: ['gideao'], slot: 'cacos', L: .3, ponta: false }, /* antes caía no slot 'lasca' (lascas de pedra de TODOS os heróis) */
    serpente: { h: ['moises', 'farao'], L: 1.1, extra: [['serpente_bronze', 1, 'bronze']] }, leao: { h: ['daniel'], L: 2.2, ponta: false }, carro: { h: ['elias', 'acabe'], L: 3, ponta: false }, carro_fogo: { h: ['elias'], slot: 'carro', L: 3.2, ponta: false, fogo: true }, arca: { h: ['noe'], slot: 'arca_noe', L: 1, ponta: false }, arca_alianca: { h: ['josue'], slot: 'arca', L: 1.3, ponta: false }, coluna_escombros: { h: ['sansao', 'josue'], slot: 'coluna', L: 4.6, ponta: false, eixo: 'y' },
    coluna: { h: ['sansao', 'josue'], L: 4.6, ponta: false, eixo: 'y' }, pomba: { h: ['noe', 'jonatas'], L: .7 }, adaga: { h: ['sarai'], L: .7 }, lanca: { L: 2.2 }, corvo: { h: ['noe'], L: .8 }, carta: { h: ['jezabel'], L: .5, ponta: false }, rede: { h: ['ninrode'], L: 2, ponta: false },
    ave: { h: ['noe'], slot: 'corvo', L: .8, extra: [['pomba', .9]] }, coluna_pedra: { h: ['sansao', 'josue'], slot: 'coluna', L: 4.6, ponta: false, eixo: 'y' }, bloco_muralha: { h: ['josue'], slot: 'muro', L: 2.2, ponta: false }, porta_madeira: { h: ['sansao', 'noe'], slot: 'porta', L: 2.2, ponta: false },
    adaga_vidro: { h: ['dalila'], slot: 'adaga_vidro', L: .7 } /* só a Dalila (Navalha); a Sarai segue com a adaga dela */, costelas_arca: { h: ['noe'], slot: 'costela', L: 2, ponta: false }, carta_selada: { h: ['jezabel'], slot: 'carta', L: .5, ponta: false }, anel_sinete: { h: ['ester'], slot: 'anel', L: .35, ponta: false }, dado: { h: ['hama'], L: .4, ponta: false },
    costela: { h: ['noe'], L: 2, ponta: false }, porta: { h: ['sansao', 'noe'], L: 2.2, ponta: false }, muro: { h: ['josue'], L: 2.2, ponta: false }, mao: { h: ['nabuco'], L: 1.4, ponta: false }, pergaminho: { h: ['daniel'], L: .5, ponta: false }, anel: { h: ['ester'], L: .35, ponta: false },
  };
  const malhasOk = [], malhasFeitas = new Set();
  // ids = heróis da partida ('*' = todos): só baixa as malhas de quem joga (h); sem h = sempre
  async function malhasManifest(ids) {
    const lista = Array.isArray(man.meshes) ? man.meshes : []; if (!C.glb) return malhasOk;
    const feitos = malhasOk;
    await Promise.all(lista.map(async (e) => {
      const arq = String(e.file || ''); const stem = (arq.split('/').pop() || '').replace(/\.glb$/i, '').toLowerCase();
      const cfg = SLOTS_MALHA[e.slot] || SLOTS_MALHA[stem]; if (!cfg || malhasFeitas.has(arq)) return;
      if (cfg.h && ids !== '*' && !(Array.isArray(ids) && cfg.h.some(h => ids.includes(h)))) return;
      malhasFeitas.add(arq);
      const slot = e.slot || cfg.slot || stem;
      if (slot === 'flecha' && C.flecha) { feitos.push(slot); return; } // já carregada pelo main
      try {
        const g = await C.glb((C.base || '') + arq); const m = assar(g.scene, e.comprimento || cfg.L, { ponta: cfg.ponta !== false, eixo: cfg.eixo || 'auto' }); if (!m) return;
        const tingir = (o, tipo) => { o.traverse(x => { if (!x.isMesh) return; x.material = [].concat(x.material).map(mt => { const t = mt.clone();
            if (tipo === 'bronze') { t.color = new THREE.Color(1.05, .72, .38); if ('metalness' in t) { t.metalness = .65; t.roughness = .38; } }
            if (tipo === 'fogo' && t.emissive) { t.emissive = new THREE.Color(1, .42, .1); t.emissiveIntensity = .8; if (t.map) t.emissiveMap = t.map; }
            return t; }); if (x.material.length === 1) x.material = x.material[0]; }); return o; };
        if (cfg.fogo) tingir(m, 'fogo');
        trocarMalha(slot, m, e.escala || 1); for (const [n, esc, tinta] of cfg.extra || []) trocarMalha(n, tinta ? tingir(m.clone(), tinta) : m.clone(), esc); feitos.push(slot);
      } catch (err) { console.warn('[vfx] malha do manifest falhou (fica o procedural):', arq, err && err.message); }
    }));
    return feitos;
  }
  function trocarMalha(nome, obj, esc) { const b = base[nome]; if (b) for (const m of b.pool) { scene.remove(m); } delete base[nome]; registrar(nome, obj, esc); }
  await malhasManifest([]); malhasProntas = true;

  // ---------------- trilhas por tipo de projétil ----------------
  const TR = {
    flecha: { rastro: { cor: [1, 1, 1], larg: .06, dur: .14, faixa: 'ar' } },
    virote: { rastro: { cor: [1, .9, .7], larg: .05, dur: .12, faixa: 'ar' } },
    pedra: { rastro: { cor: [1, .95, .85], larg: .1, dur: .12, faixa: 'poeira' }, emite: (p) => { if (Math.random() < .3) E('poeira', p, { vida: .45, t0: .3, t1: .6, alpha: .5, rot: Math.random() * TAU }); } },
    pedraOuro: { rastro: { cor: [1, .85, .45], larg: .14, dur: .16, faixa: 'ar' }, emite: (p) => { E('det', p, { q0: D.faisca_alongada, vida: .3, t0: .25, t1: 0, cor: [1, .8, .35], vel: [rnd(1), rnd(1), rnd(1)] }); } },
    fogo: { rastro: { cor: [1, 1, 1], larg: .28, dur: .2, faixa: 'fogo' }, emite: (p) => { V.bolaFogo(p, .9, .22); if (Math.random() < .5) E('fogo', P(p.x + rnd(.15), p.y - .25, p.z + rnd(.15)), { vida: .35, t0: .55, t1: .25, q0: -1, vel: [0, 1.2, 0] }); if (Math.random() < .25) E('fumaca', p, { vida: .8, t0: .3, t1: .8, q0: -1, cor: [.2, .18, .16], alpha: .45, vel: [0, .8, 0] }); if (Math.random() < .4) E('det', p, { q0: D.brasa, vida: .5, t0: .12, t1: 0, cor: [1, .7, .3], vel: [rnd(1.5), .5 + Math.random(), rnd(1.5)], grav: 3 }); } },
    fogoP: { rastro: { cor: [1, 1, 1], larg: .14, dur: .12, faixa: 'fogo' }, emite: (p) => { V.bolaFogo(p, .55, .18); } },
    agua: { rastro: { cor: [1, 1, 1], larg: .18, dur: .18, faixa: 'agua' }, emite: (p) => { if (Math.random() < .5) E('det', p, { q0: D.gota, vida: .45, t0: .14, t1: .08, cor: [.8, .92, 1], vel: [rnd(1), .5, rnd(1)], grav: 9 }); if (Math.random() < .3) E('det', p, { q0: D.espuma, vida: .35, t0: .3, t1: .15, rot: Math.random() * TAU }); } },
    luz: { rastro: { cor: [.8, .9, 1], larg: .14, dur: .16, faixa: 'ar' }, emite: (p) => { E('flash', p, { vida: .25, t0: .4, t1: 0, cor: [.75, .9, 1], rot: Math.random() * TAU, giro: rnd(4) }); } },
    ouro: { rastro: { cor: [1, .85, .45], larg: .1, dur: .14, faixa: 'ar' }, emite: (p) => { if (Math.random() < .6) E('flash', p, { vida: .25, t0: .3, t1: 0, cor: [1, .85, .4], rot: Math.random() * TAU }); } },
    veneno: { rastro: { cor: [.5, 1, .45], larg: .12, dur: .16, faixa: 'sombra' }, emite: (p) => { if (Math.random() < .4) E('fumaca', p, { vida: .7, t0: .25, t1: .6, q0: -1, cor: [.35, .8, .25], alpha: .45, vel: [0, .4, 0] }); } },
    maldicao: { rastro: { cor: [.6, 1, .4], larg: .14, dur: .2, faixa: 'sombra' }, emite: (p) => { E('fumaca', p, { vida: .6, t0: .35, t1: .7, q0: -1, cor: [.25, .45, .15], alpha: .6, vel: [0, .3, 0], rot: Math.random() * TAU }); if (Math.random() < .3) E('det', p, { q0: D.runa, vida: .5, t0: .4, t1: .2, cor: [.6, 1, .35] }); } },
    trevas: { rastro: { cor: [.7, .45, 1], larg: .14, dur: .18, faixa: 'sombra' }, emite: (p) => { E('fumaca', p, { vida: .6, t0: .3, t1: .7, q0: -1, cor: [.15, .06, .22], alpha: .7, vel: [0, .2, 0], rot: Math.random() * TAU }); if (Math.random() < .3) E('det', p, { q0: D.runa, vida: .35, t0: .3, t1: 0, cor: [.7, .35, 1] }); } },
    rosa: { rastro: { cor: [1, .5, .85], larg: .1, dur: .18, faixa: 'ar' }, emite: (p) => { if (Math.random() < .5) E('det', p, { q0: D.petala, vida: .6, t0: .2, t1: .1, cor: [1, .6, .85], vel: [rnd(.5), .6, rnd(.5)], giro: rnd(5) }); } },
    sombra: { rastro: { cor: [1, 1, 1], larg: .3, dur: .2, faixa: 'sombra' }, emite: (p) => { E('fumaca', p, { vida: .5, t0: .5, t1: .9, q0: -1, cor: [.08, .04, .1], alpha: .75, rot: Math.random() * TAU }); } },
    corda: { rastro: { cor: [1, 1, 1], larg: .05, dur: .3, faixa: 'fio_corda' } },
    osso: { rastro: { cor: [1, .95, .85], larg: .08, dur: .12, faixa: 'ar' } },
    seco: { rastro: null },
  };
  for (const t of Object.values(TR)) if (t.rastro && t.rastro.faixa) t.rastro.tex = RAS[t.rastro.faixa] || null;
  // projétil visual: { malha?, trilha } (para main.lancar); devolve objeto aceito por main
  function projVis(tipo, malhaN) { const tr = TR[tipo] || TR.seco; const m = malhaN ? pegarMalha(malhaN) : null; let r = null; if (tr.rastro) { r = M.pegarRastro ? M.pegarRastro() : null; } return { m, tr, r }; }

  // ---------------- atualização + aquecimento ----------------
  function atualizar(dt) { M.atualizar(dt); const ag = M.agora();
    for (let i = AG.anims.length - 1; i >= 0; i--) { const x = AG.anims[i]; x.t += dt; const k = x.t / x.vida; if (k >= 1 || !x.m.visible) { x.m.visible = false; AG.anims.splice(i, 1); continue; } x.up(x.m, x.t, k, dt); }
    for (let i = cortes.length - 1; i >= 0; i--) { const k = cortes[i]; k.t += dt; const f = Math.min(1, k.t / k.vida), a = k.ang - 1.3 + 2.6 * f; k.r.seguir(P(k.c.x + Math.cos(a) * k.R, k.c.y + Math.sin(f * Math.PI) * .15, k.c.z + Math.sin(a) * k.R), ag); if (f >= 1) { k.r.solto = true; cortes.splice(i, 1); } }
    for (let i = voando.length - 1; i >= 0; i--) { const v = voando[i]; v.t += dt; v.v.y -= 14 * dt; v.m.position.addScaledVector(v.v, dt); v.m.rotation.x += v.r.x * dt; v.m.rotation.y += v.r.y * dt; if (v.m.position.y < .05) { v.m.position.y = .05; v.v.multiplyScalar(.3); v.v.y = Math.abs(v.v.y) * .3; } if (v.t > v.vida) { v.m.visible = false; voando.splice(i, 1); } } }
  function preparar() { for (const t of texs) { try { renderer.initTexture(t); } catch (e) { } }
    // compila os shaders da água em malha (1 de cada) antes da partida
    const tmp = []; for (const b of Object.values(base)) { const m = b.pool.find(x => !x.visible); if (m) { m.visible = true; m.position.set(0, -50, 0); tmp.push(m); } } if (AG.faixa) tmp.push(pegarAgua('faixa', geoCol), pegarAgua('faixa', geoPl)); if (AG.onda) tmp.push(pegarAgua('onda', geoPl)); if (tmp.length) { try { renderer.compile(scene, camera); } catch (e) { } } for (const m of tmp) if (m) m.visible = false; }
  return Object.assign(V, { atualizar, preparar, pegarMalha, soltarMalha, temMalha, TR, voar, texs, RAS, DEC, manifest: man, nivel: tier, ktx: usarKtx, malhas: malhasOk, stats: () => M.stats() });
}
