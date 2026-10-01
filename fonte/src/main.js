import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import './style.css';
import { criarMundo, carregarTexturas, POS, laneZ, LANE, texBrilho, PROP_TORRE } from './world.js';
import { SELVA_ON, SELVA_LARG, SELVA_SUL, empurrarCova, desvioCova, MAPA_WR, MAPA_C, MAPA_FOLGA, ROTA_TOPO, ROTA_BAIXO, TORRES_LATERAIS, POCO_XZ, DRAG_XZ } from './selva_mapa.js';
import { iniciarSelva, atualizarSelva, monstroMorreu, multDano, aoAtacar, aoCriarMinion, botSelva, botUsarOlho, desenharSelvaMM, invocarBeemote, ping, PINGS, selva as SELVA, nascerTudo } from './selva.js';
import { Unidade, anelHeroi, auraSombra } from './units.js';
import { montarVariante } from './equip.js';
import { VISUAL, CABELOS } from './herois3d.js';
import { HEROIS, LUZ, TREVAS, ITENS, svg, custoEfetivo, fmtSt, CATS , FUNCOES, crescimento } from './dados.js';
import { Particulas, Aneis, colunaLuz, Textos } from './vfx.js';
import { criarPoderes } from './poderes.js';
import { som, destravarSom, ouvinteSom, somLigado, estadoSom } from './som.js';
import { perfil, salvarPerfil, statsHeroi, VESTES, vesteDe, vesteLiberada, vesteEquipada, equipar, progressoVeste, conferirVestes, pontuacao, nota, medalhas, NARRADOR, VERSOS, DICAS, sortear, nivelConta, XP_CONTA, nomeJogador, mudarNome, resetarPerfil, xpPartida } from './perfil.js';
import { configurarKTX2, reduzirTexturas, juntarLOD, ativarCulling, atualizarFrustum, naTela, aplicarLOD, SombrasBlob, ContadorFPS } from './perf.js';

// ================= parâmetros =================
const P = new URLSearchParams(location.search);
const MODO2 = SELVA_ON && P.get('modo') !== '1v1'; // 2v2 com selva: partidas de ~15 min (torres e XP em proporção WR)
const HPE = MODO2 ? 2.9 : 1, OURO_K = MODO2 ? .85 : 1;
const CAPTURA = P.has('cap');            // modo de captura determinística (headless)
const CENA = P.get('cena') || '';        // cenários prontos para prints: sel, luta, loja, vitoria, video
const AUTO = P.has('auto');                // piloto automático (o seu herói também joga sozinho)
const DAVI_GROK = P.get('davi') === 'grok'; // modelo alternativo do Davi feito no Grok Build (para comparar)
const ANEIS_TODOS = P.has('aneis');         // depuração/prints: mostra o alcance de todas as torres
const MEDIR = P.has('medir');
// dificuldade do Computador: ?dif=facil|normal|dificil (ou Configurações)
const DIFS = { facil: { nome: 'Fácil', limiar: .25, reflexo: 2.5, poke: .6, abate: 1.25, margem: 400, clarao: false }, normal: { nome: 'Normal', limiar: -.04, reflexo: 6, poke: 1.5, abate: .9, margem: 150, clarao: true }, dificil: { nome: 'Difícil', limiar: -.1, reflexo: 9, poke: 2.2, abate: .85, margem: 50, clarao: true } };
let DIF_ID = DIFS[P.get('dif')] ? P.get('dif') : (DIFS[localStorage.getItem('mobaDif')] ? localStorage.getItem('mobaDif') : 'normal'); let DIF = DIFS[DIF_ID];
// configurações do aparelho (menu da engrenagem)
const CFG = { joyFixo: localStorage.getItem('mobaJoyFixo') === '1', tremor: localStorage.getItem('mobaTremor') !== '0' };
const TRIPO = P.get('modelos') !== 'antigos';   // modelos novos do Tripo (heróis da Luz); ?modelos=antigos volta aos Quaternius
const TRIPO_IDS = ['davi', 'sansao', 'debora', 'gideao', 'golias', 'farao', 'jezabel', 'nabuco']; // heróis + vilões
const TRIPO_MINIONS = ['guardiao', 'sombra'];
const PROPS_TRIPO = ['torre_luz', 'torre_trevas', 'nucleo_luz', 'nucleo_trevas', 'fonte', 'arvore', 'arvore_lod1', 'arvore_lod2', 'pedra', 'pedra_lod1', 'coluna'];               // medição de desempenho headless: usa as mesmas otimizações do celular
const mobile = matchMedia('(pointer:coarse)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent);
// limite de resolução: no celular no máximo 1,3x e ~750 mil pixels renderizados (iPhone 11: 1165×538)
const prMax = () => mobile ? Math.min(devicePixelRatio, 1.3, Math.sqrt(7.5e5 / Math.max(1, innerWidth * innerHeight))) : Math.min(devicePixelRatio, 2);
const Q = { mobile, sombra: mobile ? 1024 : 2048, pr: CAPTURA ? 1 : Math.max(1, prMax()) };
// Android de entrada (Mali-G52/Adreno 6xx, 3-4 GB): resolução 1x e sombra menor desde o início (não depende só do ajuste dinâmico)
const ANDROID_FRACO = /Android/i.test(navigator.userAgent) && ((navigator.deviceMemory || 8) <= 4 || (navigator.hardwareConcurrency || 8) <= 4);
if (ANDROID_FRACO && !CAPTURA) { Q.pr = 1; Q.sombra = 512; }
if (P.get('q') === 'baixa') { Q.mobile = true; Q.baixa = true; Q.sombra = 1024; Q.pr = 1; }
Q.pintado = P.get('modelos') !== 'antigos' && P.get('estilo') !== 'antigo'; // estilo pintado à mão (combina com o Tripo)
// url absoluta: dentro de uma variável CSS, url() relativa seria resolvida a partir do .css em assets/ (dava 404 no Pages)
function urlAbs(c) { return new URL(import.meta.env.BASE_URL + c, location.href).href; }
if (Q.pintado) { const r = document.documentElement; r.classList.add('pintado'); const B = urlAbs(''); r.style.setProperty('--tMadeira', `url(${B}ui/madeira.webp)`); r.style.setProperty('--tPerg', `url(${B}ui/pergaminho.webp)`); }

// ================= renderer =================
const canvas = document.getElementById('cena');
// sem WebGL2 (Android muito antigo / driver bloqueado): mensagem clara em vez de tela preta
let renderer; try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: CAPTURA }); }
catch (e) { const t = document.getElementById('progTxt'); if (t) t.innerHTML = 'Este aparelho/navegador não liberou o WebGL 2.<br>Atualize o Chrome e ative a "aceleração por hardware".'; throw e; }
// Mali/Adreno sem render target de ponto flutuante: usa 8 bits (o bloom fica um pouco mais "duro", mas funciona)
const RT_FLOAT = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
renderer.setPixelRatio(Q.pr);
renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
// celular: mapa de sombra único de 1024 px, redesenhado em quadros alternados (a 60 FPS o atraso de 16 ms não aparece)
if (!P.has('dev')) renderer.debug.checkShaderErrors = false; // checar erros força o navegador a esperar o link do shader (tranco)
const SOMBRA_ALTERNADA = Q.mobile && (!CAPTURA || MEDIR); if (SOMBRA_ALTERNADA) renderer.shadowMap.autoUpdate = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.info.autoReset = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#2a2436');
scene.fog = new THREE.Fog('#3b3346', 34, 78);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.45;

const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.8, 190);
const ESC_HEROI = 1.55, ESC_TROPA = 1.26;
// câmera estilo Wild Rift: mais de cima (57°) e um pouco mais longe (vê mais da rota), herói no centro; ?camera=antiga volta à de 48°
const CAM_ANTIGA = P.get('camera') === 'antiga';
const CAM_ANG = 57, CAM_DIST = 26, CAM_DZ = 1.1; // Edson: +33% de distância (enquadramento WR/LoL: vê mais da rota)
// antes: CAM_DIST = 19.6; // WR: sem números oficiais; calibrado por proporção (alcance do Blitz ≈ 85% da meia-tela; herói ≈ 12% da altura da tela, um pouco abaixo do centro)
const CAM_OFF = CAM_ANTIGA ? new THREE.Vector3(0, 12.8, 11.4) : new THREE.Vector3(0, CAM_DIST * Math.sin(CAM_ANG * Math.PI / 180), CAM_DIST * Math.cos(CAM_ANG * Math.PI / 180));
// mapa WR: câmera girada -45° em y — na tela o Meio vira a diagonal (Luz embaixo/esquerda, Trevas em cima/direita), o rio a outra diagonal
const CAM_GIRO = MAPA_WR ? -Math.PI / 4 : 0, EIXO_Y = new THREE.Vector3(0, 1, 0); CAM_OFF.applyAxisAngle(EIXO_Y, CAM_GIRO);
const CAM_FRENTE = new THREE.Vector3(0, 0, -1).applyAxisAngle(EIXO_Y, CAM_GIRO);
// direção da tela (x = direita, y = baixo) -> mundo (x, z)
const telaMundo = (x, y) => MAPA_WR ? [.7071 * (x - y), .7071 * (x + y)] : [x, y];
const mundoTela = (x, z) => MAPA_WR ? [.7071 * (x + z), .7071 * (z - x)] : [x, z];

const hemi = new THREE.HemisphereLight(Q.pintado ? '#fff0cc' : '#ffe9c4', Q.pintado ? '#5a4046' : '#4a3a4c', Q.pintado ? 1.3 : 1.15); scene.add(hemi);
const sol = new THREE.DirectionalLight(Q.pintado ? '#ffe4bc' : '#fff0d2', Q.pintado ? 2.2 : 2.35);
sol.castShadow = true; sol.shadow.mapSize.set(Q.sombra, Q.sombra);
const sc = sol.shadow.camera; sc.left = -24; sc.right = 24; sc.top = 18; sc.bottom = -18; sc.near = 1; sc.far = 80;
sol.shadow.bias = -0.0004; sol.shadow.normalBias = 0.03; sol.shadow.radius = Q.baixa ? 1.5 : 4;
scene.add(sol); scene.add(sol.target);
// luz do ultimate criada uma vez só (intensidade 0): adicionar luz em plena luta recompila TODOS os materiais iluminados
const luzUlt = new THREE.PointLight(0xffd070, 0, 18, 1.5); luzUlt.position.set(0, -50, 0); scene.add(luzUlt); let luzUltN = 0;
const SOL_OFF = new THREE.Vector3(-14, 30, 12); if (MAPA_WR) SOL_OFF.applyAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 4);
const rim = new THREE.DirectionalLight(Q.pintado ? '#b8c8ff' : '#9ec4ff', Q.pintado ? 0.6 : 0.9); rim.position.set(10, 12, -20); scene.add(rim);

const rt = new THREE.WebGLRenderTarget(1, 1, { type: RT_FLOAT ? THREE.HalfFloatType : THREE.UnsignedByteType, samples: Q.baixa ? 0 : Q.mobile ? 2 : 4 });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), Q.pintado ? 0.55 : 0.7, Q.pintado ? 0.45 : 0.5, 2.0);
// NaN/infinito num pixel (sombra, normal degenerada) vira a TELA INTEIRA preta quando o bloom espalha o borrão: limpa na entrada do bloom
bloom.materialHighPassFilter.fragmentShader = bloom.materialHighPassFilter.fragmentShader.replace('vec4 texel = texture2D( tDiffuse, vUv );', 'vec4 texel = texture2D( tDiffuse, vUv ); if (any(isnan(texel)) || any(isinf(texel))) texel = vec4(0.); texel = clamp(texel, 0., 64.);'); bloom.materialHighPassFilter.needsUpdate = true;
composer.addPass(bloom); if (Q.mobile) bloom.enabled = false; // celular: sem bloom (o pós mais caro); os brilhos já são aditivos
composer.addPass(new OutputPass());
const grade = new ShaderPass({ uniforms: { tDiffuse: { value: null }, uCinza: { value: 0 }, uSat: { value: Q.pintado ? 1.1 : 1.18 }, uVig: { value: .38 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uCinza; uniform float uSat; uniform float uVig; varying vec2 vUv;
    void main(){ vec4 c=texture2D(tDiffuse,vUv); if (any(isnan(c)) || any(isinf(c))) c = vec4(0., 0., 0., 1.); c.rgb = clamp(c.rgb, 0., 64.); float l=dot(c.rgb,vec3(.299,.587,.114)); c.rgb=mix(vec3(l),c.rgb,uSat);
      c.rgb = (c.rgb-.5)*1.06+.5; vec2 d=vUv-.5; d.x*=1.6; float v=1.-uVig*smoothstep(.25,.95,length(d)); c.rgb*=v; c.rgb = mix(c.rgb, vec3(dot(c.rgb, vec3(.299,.587,.114))) * .8, uCinza); gl_FragColor=c; }` });
composer.addPass(grade);
// antisserrilhado extra (bordas de grama, partículas e shaders) — desligado no modo ?q=baixa
const smaa = Q.baixa || Q.mobile ? null : new SMAAPass(); if (smaa) composer.addPass(smaa);

let W = innerWidth, H = innerHeight;
function redimensionar() {
  W = innerWidth; H = innerHeight;
  renderer.setSize(W, H, false); composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(W, H);
  bloom.resolution.set(W * renderer.getPixelRatio() / 2, H * renderer.getPixelRatio() / 2);
  camera.aspect = W / H; camera.fov = W / H < 1.7 ? 44 : 38; camera.updateProjectionMatrix();
  const esc = renderer.getDrawingBufferSize(new THREE.Vector2()).y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  [fx, fxD].forEach(s => s && (s.pts.material.uniforms.uEsc.value = esc));
}
addEventListener('resize', redimensionar);

// ================= carregamento =================
const tempoU = { value: 0 };
const man = new THREE.LoadingManager();
const progBarra = document.getElementById('progBarra'), progTxt = document.getElementById('progTxt');
man.onProgress = (u, a, b) => { progBarra.style.width = (a / b * 100).toFixed(0) + '%'; };
// tela de carregamento: versículos e dicas se alternando
{ const vt = document.getElementById('carVerso'); if (vt) { const troca = () => { vt.innerHTML = `<b>${sortear(VERSOS)}</b><p>Dica: ${sortear(DICAS.geral)}</p>`; }; troca(); const iv = setInterval(() => { if (document.getElementById('carregando').classList.contains('fora')) clearInterval(iv); else troca(); }, 3500); } }
const loader = new GLTFLoader(man); loader.setMeshoptDecoder(MeshoptDecoder); configurarKTX2(loader, renderer);
const NOMES_PROPS = ['tree_single_A', 'tree_single_B', 'trees_A_medium', 'trees_B_medium', 'trees_B_large', 'tree_pine_yellow_large', 'tree_pine_orange_medium', 'tree_dead_large', 'tree_dead_medium', 'rock_single_A', 'rock_single_B', 'rock_single_C', 'rock_single_D', 'rock_single_E', 'lantern_standing', 'pillar', 'fence_broken', 'post_lantern', 'arch'];
const carregar = (n) => new Promise((res, rej) => loader.load('models/' + n + '.glb', res, undefined, rej));
const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.round(n).toLocaleString('pt-BR');
const esperar = (ms) => new Promise(r => setTimeout(r, ms));

let fx, fxD, aneis, textos, mundo, clips, blobs = null;
const BASES = {};
const unidades = []; const estruturas = []; const herois = [];
let jogador = null, bot = null, aliado = null, cacador = null; let selvaIni = null;
const estado = { luz: 0, trevas: 0, tempo: 0, fim: null, iniciado: false };

const suportaWebp = () => new Promise(r => { const i = new Image(); i.onload = () => r(i.width === 1); i.onerror = () => r(false); i.src = 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA'; });
async function iniciar() {
  if (TRIPO && !(await suportaWebp())) { const u = new URL(location.href); u.searchParams.set('modelos', 'antigos'); location.replace(u.toString()); return; }
  const [heroiG, heroiF, soldadoG, ...cabs] = await Promise.all(['heroi', 'heroi_f', 'soldado', ...CABELOS.map(c => 'cabelo_' + c)].map(carregar));
  const cabelos = Object.fromEntries(CABELOS.map((c, i) => [c, cabs[i]]));
  progTxt.textContent = 'Montando heróis e vilões…'; await esperar(10);
  clips = heroiG.animations;
  for (const id of [...LUZ, ...TREVAS]) { BASES[id] = { cena: montarVariante(VISUAL[id].corpo === 'f' ? heroiF : heroiG, id, { cabelo: cabelos.simpleparted, cabelos }), clips }; }
  if (TRIPO) {
    progTxt.textContent = 'Carregando os heróis (Tripo)…';
    const ids = TRIPO_IDS.filter(id => !(id === 'davi' && DAVI_GROK));
    const gs = await Promise.all(ids.map(id => carregar('tripo/' + id).catch(e => { console.warn('[tripo] falhou', id, e && e.message); return null; })));
    const lods = await Promise.all(ids.map(id => carregar('tripo/' + id + '_lod1').catch(() => null)));
    ids.forEach((id, i) => { const g = gs[i]; if (!g) return; const r = montarTripo(g, BASES[id].cena, id); if (lods[i]) juntarLOD(r.cena, lods[i].scene, Q.mobile ? 22 : 30); BASES[id] = { cena: r.cena, clips: aliasTripo(g.animations, clips, HEROIS[id], r.escMundo, r.hips), tripo: true }; });
  }
  if (DAVI_GROK) { progTxt.textContent = 'Carregando o Davi (Grok Build)…'; const g = await carregar('davi_grok'); BASES.davi = { cena: montarGrok(g, BASES.davi.cena), clips: aliasGrok(g.animations, clips), grok: true };
    // gancho de LOD: se existir models/davi_grok_lod1.glb (gerado por tools/comprimir_modelo.mjs --lod), usa de longe
    const lod = await carregar('davi_grok_lod1').catch((e) => { console.log('[lod] sem LOD:', e && e.message); return null; }); if (lod) { reduzirTexturas(lod.scene, 512); console.log('[lod] davi_grok_lod1', juntarLOD(BASES.davi.cena, lod.scene, 28)); } }
  BASES.guardiao = { cena: montarVariante(soldadoG, 'guardiao'), clips };
  BASES.sombra = { cena: montarVariante(soldadoG, 'sombra'), clips };
  BASES.sombra_guerreiro = { cena: montarVariante(soldadoG, 'bruto'), clips };
  if (TRIPO) {
    // tropas do Tripo: malha leve (~5-6k tri, textura 512), LOD1 com cor nos vértices (~2k tri) bem mais perto que nos heróis
    progTxt.textContent = 'Carregando as tropas (Tripo)…';
    const gs = await Promise.all(TRIPO_MINIONS.map(id => carregar('tripo/' + id).catch(e => { console.warn('[tripo] falhou', id, e && e.message); return null; })));
    const lods = await Promise.all(TRIPO_MINIONS.map(id => carregar('tripo/' + id + '_lod1').catch(() => null)));
    TRIPO_MINIONS.forEach((id, i) => { const g = gs[i]; if (!g) return;
      const r = montarTripo(g, BASES[id].cena, id, ESC_TROPA); if (lods[i]) juntarLOD(r.cena, lods[i].scene, Q.mobile ? 16.5 : 25);
      const A = ANIM_TROPA[id]; BASES[id] = { cena: r.cena, clips: aliasTripo(g.animations, clips, { anim: A, base: { vel: A.vel } }, r.escMundo, r.hips), tripo: true };
      if (id === 'sombra') { // o "bruto" das Trevas usa o mesmo modelo, maior e mais avermelhado, com o golpe mais pesado
        const cb = skClone(r.cena); const lista = []; cb.traverse(o => { if (o.isSkinnedMesh) lista.push(o); });
        for (const o of lista) { o.material = o.material.clone(); o.material.color.setRGB(1.25, .62, .55); o.material.emissive = new THREE.Color(.05, 0, .008); }
        BASES.sombra_guerreiro = { cena: cb, clips: aliasTripo(g.animations, clips, { anim: ANIM_TROPA.bruto, base: { vel: 3.1 } }, r.escMundo * 1.14, r.hips), tripo: true };
      } }); }
  // desempenho: culling dos personagens (esfera folgada) e, no celular, tropas sem sombra real (usam sombra "blob")
  for (const b of Object.values(BASES)) ativarCulling(b.cena);
  if (Q.mobile) for (const k of ['guardiao', 'sombra', 'sombra_guerreiro']) BASES[k].cena.traverse(o => { if (o.isMesh) o.castShadow = false; });
  progTxt.textContent = 'Montando o campo de batalha…'; await esperar(10);
  const props = await Promise.all(NOMES_PROPS.map(carregar));
  const modelos = {};
  if (TRIPO) { // props do Tripo (torres, Núcleos, fonte, árvore, pedra, coluna): ver world.js "props do Tripo"
    const tp = await Promise.all(PROPS_TRIPO.map(n => carregar('tripo/props/' + n).catch(e => { console.warn('[tripo] prop falhou', n, e && e.message); return null; })));
    if (tp.every(Boolean)) modelos.tripo = Object.fromEntries(PROPS_TRIPO.map((n, i) => [n, tp[i].scene]));
    if (modelos.tripo && modelos.tripo.coluna && PODERES_NOVOS) colunaDoTemplo(modelos.tripo.coluna);
    if (modelos.tripo && Q.mobile) for (const c of Object.values(modelos.tripo)) reduzirTexturas(c, 512, renderer); // celular: props com textura de 512
  }
  NOMES_PROPS.forEach((n, i) => { modelos[n] = props[i].scene; props[i].scene.traverse(o => { if (o.isMesh) { o.material.roughness = .85; } }); });
  progTxt.textContent = 'Carregando texturas…'; await carregarTexturas(Q);
  mundo = criarMundo(scene, modelos, Q, tempoU);
  // limite de partículas (buffers fixos, sem alocação durante a partida)
  fx = new Particulas(scene, Q.baixa ? 420 : Q.mobile ? 600 : 1600, true);
  fxD = new Particulas(scene, Q.baixa ? 180 : Q.mobile ? 260 : 700, false);
  if (Q.mobile) blobs = new SombrasBlob(scene, 64);
  aneis = new Aneis(scene); if (Q.mobile) aneis.max = Q.baixa ? 6 : 9; textos = new Textos(camera);
  if (PODERES_NOVOS) { // identidade própria de cada poder (poderes.js): atlas de partículas + 5 GLBs do Tripo
    const [atl, ...pg] = await Promise.all([new THREE.TextureLoader().loadAsync(Q.mobile ? 'vfx/poderes_512.webp' : 'vfx/poderes.webp').catch(() => null), ...GLB_PODERES.map(n => carregar('tripo/poderes/' + n).catch(() => null))]);
    if (atl) { atl.colorSpace = THREE.SRGBColorSpace; atl.generateMipmaps = false; atl.minFilter = THREE.LinearFilter; fx.usarAtlas(atl); fxD.usarAtlas(atl); }
    const mods = Object.fromEntries(GLB_PODERES.map((n, i) => [n, pg[i] && pg[i].scene]));
    poderes = criarPoderes({ scene, camera, fx: () => fx, fxD: () => fxD, aneis, agendar, efeitos, tremer, frente, som, texB, mobile: Q.mobile, baixa: Q.baixa, atlas: () => atl, modelo: (n) => mods[n],
      aliados: (h, r) => unidades.filter(u => u.vivo && u !== h && u.time === h.time && u.obj.position.distanceTo(h.obj.position) < r) });
    poderes.preparar();
  }
  redimensionar();
  criarEstruturas();
  gerarRetratosSelecao();
  $('carregando').classList.add('fora');
  const h0 = P.get('heroi');
  if (h0 && HEROIS[h0] && CENA !== 'sel' && CENA !== 'perfil' && CENA !== 'nome') comecarPartida(h0, P.get('vs'));
  else abrirSelecao();
  aquecerShaders();
  if (!CAPTURA) { relogio.start(); requestAnimationFrame(loop); }
  if (!(h0 && HEROIS[h0] && CENA !== 'sel')) window.__pronto = true; // com herói na URL, comecarPartida avisa quando estiver pronto
}

// ================= vestes (skins): textura repintada só na roupa =================
const texVestes = new Map();
function carregarVeste(id, vid) {
  const v = vesteDe(id, vid); if (!v) return Promise.resolve(null);
  const k = id + ':' + vid; if (texVestes.has(k)) return texVestes.get(k);
  const pr = new THREE.TextureLoader().loadAsync(urlAbs(v.tex)).then(t => { t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Q.baixa ? 1 : 4; t.needsUpdate = true; return t; }).catch(e => { console.warn('[veste]', k, e && e.message); return null; });
  texVestes.set(k, pr); return pr;
}
// troca o mapa de cor dos materiais (os materiais da Unidade já são cópias só dela); o LOD de longe é desligado para
// o herói com veste (o seu herói está sempre perto da câmera)
function vestirMats(mats, t) { for (const m of mats) if (m.map) { const o = m.map; t.wrapS = o.wrapS; t.wrapT = o.wrapT; t.channel = o.channel; m.map = t; m.needsUpdate = true; } }
async function aplicarVeste(u, vid) { const t = await carregarVeste(u.id, vid); if (!t || !u.mats) return; vestirMats(u.mats.filter(m => m.name !== 'lod1_cores'), t); u.semLOD = true; u.modelo.traverse(o => { if (o.isMesh && o.userData.lod !== undefined) o.visible = o.userData.lod === 0; }); u.veste = vid; }

// ================= estruturas: torres, núcleos, fontes =================
const inimigo = (t) => t === 'luz' ? 'trevas' : 'luz';
function criarEstruturas() {
  const add = (time, tipo, g, o) => { const e = { time, tipo, obj: g, vivo: true, raio: g.userData.raio || 2.6, cd: 0, alcance: PROP_TORRE.alcance, alvoAnt: null, serie: 0, ...o }; e.maxHp = e.hp; criarBarra(e); estruturas.push(e); return e; };
  const tl1 = add('luz', 'torre', mundo.torreLuz, { hp: 2400 * HPE, nome: 'Torre Externa da Luz', ordem: 1, placas: 0 });
  const tl2 = add('luz', 'torre', mundo.torreLuz2, { hp: 2700 * HPE, nome: 'Torre Interna da Luz', ordem: 2, requer: [tl1] });
  const tl3 = mundo.torreLuz3 ? add('luz', 'torre', mundo.torreLuz3, { hp: 2900 * HPE, nome: 'Torre da Base da Luz', ordem: 3, requer: [tl2] }) : null;
  const nl = add('luz', 'nucleo', mundo.nucleoLuz, { hp: 3000 * HPE, nome: 'Núcleo da Luz', alcance: 0, requer: [tl1, tl2, tl3].filter(Boolean) });
  const tt1 = add('trevas', 'torre', mundo.torreTrevas, { hp: 2400 * HPE, nome: 'Torre Externa das Trevas', ordem: 1, placas: 0 });
  const tt2 = add('trevas', 'torre', mundo.torreTrevas2, { hp: 2700 * HPE, nome: 'Torre Interna das Trevas', ordem: 2, requer: [tt1] });
  const tt3 = mundo.torreTrevas3 ? add('trevas', 'torre', mundo.torreTrevas3, { hp: 2900 * HPE, nome: 'Torre da Base das Trevas', ordem: 3, requer: [tt2] }) : null;
  const nt = add('trevas', 'nucleo', mundo.nucleoTrevas, { hp: 3000 * HPE, nome: 'Núcleo das Trevas', alcance: 0, requer: [tt1, tt2, tt3].filter(Boolean) });
  nl.obj.userData.raio = 3.2; nt.obj.userData.raio = 3.2;
  for (const e of estruturas) if (e.tipo === 'torre') criarAnelTorre(e); prepararRuinas();
}
// círculo de alcance da torre (como no WR): aparece quando o seu herói chega perto; fica mais forte dentro do alcance
// e pulsa quando a torre está mirando em você
const geoAnelT = new THREE.RingGeometry(.975, 1, 128, 1).rotateX(-Math.PI / 2);
const geoDiscoT = new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2);
function criarAnelTorre(e) {
  const g = new THREE.Group(); g.position.set(e.obj.position.x, .13, e.obj.position.z); g.scale.setScalar(e.alcance);
  const mat = new THREE.MeshBasicMaterial({ color: 0xff3b4f, transparent: true, opacity: 0, depthWrite: false, fog: false, toneMapped: false });
  const matD = new THREE.MeshBasicMaterial({ color: 0xff3b4f, transparent: true, opacity: 0, depthWrite: false, fog: false, toneMapped: false });
  const a = new THREE.Mesh(geoAnelT, mat), d = new THREE.Mesh(geoDiscoT, matD); a.renderOrder = d.renderOrder = 3;
  g.add(d, a); g.visible = false; scene.add(g); e.anel = { g, mat, matD, op: 0 };
}
function atualizarAneisTorre(dt) {
  const ref = jogador && jogador.vivo ? jogador.obj.position : null; const t = estado.tempo;
  for (const e of estruturas) {
    if (!e.anel) continue; const A = e.anel; let alvo = 0, inim = false;
    if (e.vivo && ref && !estado.fim) {
      inim = e.time !== jogador.time; const d = Math.hypot(ref.x - e.obj.position.x, ref.z - e.obj.position.z);
      if (inim) alvo = d < e.alcance ? .9 : d < e.alcance + 6 ? .55 * (1 - (d - e.alcance) / 6) + .2 : 0;
      else alvo = d < e.alcance + 1 ? .28 : 0;
    }
    if (ANEIS_TODOS && e.vivo) { alvo = .8; inim = e.time !== jogadorTime(); }
    A.op += (alvo - A.op) * (1 - Math.exp(-dt * 8)); A.g.visible = A.op > .02; if (!A.g.visible) continue;
    const mira = inim && e.alvoAnt === jogador && estado.tempo - (e.tiroT || -9) < 1.6;
    const cor = inim ? (mira ? 0xff1a2e : 0xff4a5a) : 0x5fc8ff; A.mat.color.setHex(cor); A.matD.color.setHex(cor);
    A.mat.opacity = A.op * (mira ? .75 + .25 * Math.sin(t * 14) : 1); A.matD.opacity = A.op * (mira ? .16 : .07);
  }
}
const protegida = (e) => e.requer && e.requer.some(r => r.vivo);
const FONTE = { luz: POS.baseLuz, trevas: POS.baseTrevas };
const NUCLEO = { luz: POS.nucleoLuz, trevas: POS.nucleoTrevas };
const naFonte = (h, r = 8.5) => h.obj.position.distanceTo(FONTE[h.time]) < r;

// ================= Davi do Grok Build =================
// ajusta altura ao Davi atual (mesma escala de jogo), mantém materiais/texturas próprios do modelo
function montarGrok(g, ref) {
  const root = g.scene; root.updateMatrixWorld(true); ref.updateMatrixWorld(true); reduzirTexturas(root, 1024, renderer);
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = !Q.baixa; o.frustumCulled = false; const m = o.material; if (m.map) { m.map.anisotropy = Q.baixa ? 1 : 4; } } });
  const hRef = new THREE.Box3().setFromObject(ref, true).getSize(new THREE.Vector3()).y;
  const hG = new THREE.Box3().setFromObject(root, true).getSize(new THREE.Vector3()).y || 1.8;
  const k = hRef / hG; const wrap = new THREE.Group(); wrap.name = 'davi_grok'; root.scale.setScalar(k); wrap.add(root);
  console.log('[grok] altura ref', hRef.toFixed(3), 'grok', hG.toFixed(3), 'escala', k.toFixed(3));
  return wrap;
}
// ================= heróis do Tripo =================
// modelo ~1 m de altura (rig Mixamo "mixamorig"), olhando para +Z. Ajusta à altura do herói atual e prepara materiais.
function montarTripo(g, ref, id, escJogo = null) {
  const root = g.scene; root.updateMatrixWorld(true); ref.updateMatrixWorld(true); reduzirTexturas(root, 1024, renderer);
  root.traverse(o => { if (!o.isMesh) return; o.castShadow = true; o.receiveShadow = !Q.baixa; const m = o.material;
    // estilo pintado à mão: o PBR do Tripo vem com metal 1 + mapa; suaviza reflexo para não ficar "plástico/cromado"
    m.side = THREE.FrontSide; m.metalness = Math.min(m.metalness, .85); m.envMapIntensity = .8;
    // tropas: o mapa de metal/rugosidade do Tripo deixava a armadura "cromada"; material fosco e uniforme, mais pintado
    if (escJogo) { m.metalnessMap = m.roughnessMap = null; m.metalness = .15; m.roughness = .62; m.envMapIntensity = .5; m.needsUpdate = true; } if (m.normalMap) m.normalScale.set(.8, .8); if (m.map) m.map.anisotropy = Q.baixa ? 1 : 4; });
  const hRef = new THREE.Box3().setFromObject(ref, true).getSize(new THREE.Vector3()).y;
  const hT = new THREE.Box3().setFromObject(root, true).getSize(new THREE.Vector3()).y || 1;
  const k = hRef / hT; const wrap = new THREE.Group(); wrap.name = 'tripo_' + id; root.scale.setScalar(k); wrap.add(root);
  console.log('[tripo]', id, 'altura', hT.toFixed(3), '→', hRef.toFixed(3), 'escala', k.toFixed(3));
  let hips = null; root.traverse(o => { if (!hips && /Hips$/.test(o.name)) hips = o.position.clone(); });
  return { cena: wrap, escMundo: k * (escJogo || ESC_HEROI * HEROIS[id].esc), hips };
}
// animações do Tripo: idle / run / slash / fall. Cria clipes com os nomes que o jogo já pede, reajustando o tempo:
//  - run: sem deslocamento da raiz, passo casado com a velocidade do herói; também serve para avanços/rolamentos
//  - slash (6,6 s, dois golpes): 1º golpe vira o ataque básico (impacto no tempo "atrasoAtaque"), 2º golpe vira o lançamento de habilidade
//  - fall: morte, sem arrastar o corpo para o lado
// fecha a emenda de um clipe em loop: o run do Tripo termina ~19° fora da pose inicial (braços), o que dava um "tranco" a cada
// passada. Nos últimos `frac` do clipe cada trilha é puxada suavemente (slerp/lerp com rampa suave) até o valor do 1º quadro.
function fecharLoop(c, frac = .3) {
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
  for (const t of c.tracks) {
    const n = t.times.length, st = t.getValueSize(); if (n < 3) continue; const v = t.values, T = t.times[n - 1], t0 = T - (T - t.times[0]) * frac;
    for (let i = 1; i < n; i++) { if (t.times[i] < t0) continue; let w = (t.times[i] - t0) / (T - t0); w = w * w * (3 - 2 * w);
      if (st === 4) { qa.fromArray(v, i * 4); qb.fromArray(v, 0); if (qa.dot(qb) < 0) qb.set(-qb.x, -qb.y, -qb.z, -qb.w); qa.slerp(qb, w).toArray(v, i * 4); }
      else for (let k = 0; k < st; k++) v[i * st + k] += (v[k] - v[i * st + k]) * w; }
  }
  return c;
}
function aliasTripo(anims, clipsRef, d, escMundo, rest) {
  const acha = (n) => anims.find(a => a.name.split('.')[0] === n);
  const semRaiz = (c, manterY = true) => { for (const t of c.tracks) if (/Hips\.position$/.test(t.name)) { const v = t.values, x0 = rest ? rest.x : v[0], z0 = rest ? rest.z : v[2]; for (let i = 0; i < v.length; i += 3) { v[i] = x0; v[i + 2] = z0; if (!manterY) v[i + 1] = v[1]; } } return c; };
  const trecho = (c, nome, t0, t1, fator) => { const fps = 24; const k = THREE.AnimationUtils.subclip(c, nome, Math.round(t0 * fps), Math.round(t1 * fps), fps); semRaiz(k); if (fator !== 1) { for (const t of k.tracks) t.scale(fator); k.resetDuration(); } return k; };
  const idle = acha('idle'), run = acha('run'), slash = acha('slash'), fall = acha('fall');
  // velocidade da raiz no run original (m/s no modelo) -> em unidades do mundo
  let vRaiz = 2.17; if (run) { const tr = run.tracks.find(t => /Hips\.position$/.test(t.name)); if (tr) { const v = tr.values, n = v.length / 3; vRaiz = Math.abs(v[(n - 1) * 3 + 2] - v[2]) / (tr.times[n - 1] - tr.times[0]) || 2.17; } }
  const vMundo = vRaiz * escMundo; const A = d.anim;
  const out = [];
  const add = (c, nome) => { if (!c) return; const k = c.clone(); k.name = nome; out.push(k); };
  const cIdle = idle ? fecharLoop(semRaiz(idle.clone()), .25) : null;
  const fRun = (A.velCorrer || 1) * vMundo / d.base.vel; const cRun = run ? fecharLoop(semRaiz(run.clone()), .35) : null; if (cRun && fRun !== 1) { for (const t of cRun.tracks) t.scale(fRun); cRun.resetDuration(); }
  const GOLPE1 = [1.7, 2.45, 2.13], GOLPE2 = [2.85, 3.6, 3.21];
  const fAtk = ((A.atrasoAtaque || .25) * (A.velAtaque || 1)) / (GOLPE1[2] - GOLPE1[0]);
  const cAtk = slash ? trecho(slash, 'atk', GOLPE1[0], GOLPE1[1], fAtk) : null;
  const cCast = slash ? trecho(slash, 'cast', GOLPE2[0], GOLPE2[1], .28 / (GOLPE2[2] - GOLPE2[0])) : null;
  const cMorte = fall ? semRaiz(fall.clone()) : null;
  const nomes = new Set([...clipsRef.map(c => c.name), A.idle, A.correr, A.ataque, A.morte]);
  for (const n of nomes) {
    if (n === A.ataque) add(cAtk, n); else if (n === A.correr) add(cRun, n); else if (n === A.idle || /Idle/.test(n)) add(cIdle, n);
    else if (/Death/.test(n)) add(cMorte, n); else if (/Jog|Sprint|Walk|Run|Roll|Dash/.test(n)) add(cRun, n); else if (/Hit/.test(n)) add(cIdle, n); else add(cCast, n);
  }
  return out;
}

// o jogo pede animações pelos nomes da biblioteca Quaternius: cria apelidos para as 5 animações do Grok (idle/run/attack/cast/death)
function aliasGrok(anims, clipsRef) {
  const por = (n) => anims.find(a => a.name === n); const out = [...anims];
  for (const c of clipsRef) {
    const n = c.name; const alvo = /Death/.test(n) ? 'death' : /Idle/.test(n) ? 'idle' : /Jog|Sprint|Walk|Run|Roll|Dash/.test(n) ? 'run' : /Throw|Sword|Punch|Melee|Hook|Scratch|Attack/.test(n) ? 'attack' : /Hit/.test(n) ? 'idle' : 'cast';
    const src = por(alvo); if (src) { const k = src.clone(); k.name = n; out.push(k); }
  }
  return out;
}

// ================= minions =================
const texAura = texBrilho([[0, 'rgba(255,255,255,.8)'], [.6, 'rgba(255,255,255,.25)'], [1, 'rgba(255,255,255,0)']]);
const ANIM_TROPA = {
  guardiao: { idle: 'Idle_Shield_Loop', correr: 'Jog_Fwd_Loop', velCorrer: .8, ataque: 'Sword_Regular_A', velAtaque: .9, morte: 'Death01', vel: 3.3, atrasoAtaque: .35 },
  sombra: { idle: 'Zombie_Idle_Loop', correr: 'Zombie_Walk_Fwd_Loop', velCorrer: 1.9, ataque: 'Zombie_Scratch', velAtaque: 1.5, morte: 'Death01', vel: 3.1, atrasoAtaque: .35 },
  bruto: { idle: 'Zombie_Idle_Loop', correr: 'Zombie_Walk_Fwd_Loop', velCorrer: 1.9, ataque: 'Melee_Hook', velAtaque: .9, morte: 'Death01', atrasoAtaque: .35 },
};
function novoMinion(time, x, z, bruto = false) {
  let u; const min = estado.tempo / 60; const k = 1 + min * .09;
  if (time === 'luz') {
    u = new Unidade(BASES.guardiao.cena, BASES.guardiao.clips || clips, { time, tipo: 'minion', nome: 'Guardião', escala: ESC_TROPA * (bruto ? 1.12 : 1), raio: bruto ? .8 : .7, hp: (bruto ? 720 : 480) * k, vel: 3.3, alcance: 1.9, dano: (bruto ? 32 : 22) * k, cadencia: 1.15, anim: { idle: 'Idle_Shield_Loop', correr: 'Jog_Fwd_Loop', velCorrer: .8, ataque: 'Sword_Regular_A', velAtaque: .9, morte: 'Death01' } });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), new THREE.MeshBasicMaterial({ map: texAura, color: 0x3a7bff, transparent: true, opacity: .45, depthWrite: false, blending: THREE.AdditiveBlending })); glow.rotation.x = -Math.PI / 2; glow.position.y = .07; u.obj.add(glow);
  } else {
    const b = bruto ? BASES.sombra_guerreiro : BASES.sombra;
    u = new Unidade(b.cena, b.clips || clips, { time, tipo: 'minion', nome: 'Sombra', escala: bruto ? ESC_TROPA * 1.14 : ESC_TROPA, raio: bruto ? .8 : .7, hp: (bruto ? 700 : 470) * k, vel: 3.1, alcance: 1.9, dano: (bruto ? 32 : 22) * k, cadencia: 1.2, anim: { idle: 'Zombie_Idle_Loop', correr: 'Zombie_Walk_Fwd_Loop', velCorrer: 1.9, ataque: bruto ? 'Melee_Hook' : 'Zombie_Scratch', velAtaque: bruto ? .9 : 1.5, morte: 'Death01' } });
    u.obj.add(auraSombra(texAura)); u.fumaca = true;
  }
  u.bruto = bruto; u.ouro = bruto ? 50 : 30; u.xpV = bruto ? 60 : 42; u.st = { arm: bruto ? 18 : 10, rm: 10 };
  iniciarStatus(u);
  u.obj.position.set(x, 0, z); u.laneOff = z - laneZ(x); scene.add(u.obj); unidades.push(u); criarBarra(u);
  // tropas fortalecidas: com a torre interna inimiga caída, as tropas chegam mais fortes (o Núcleo exposto não segura para sempre)
  if (!u.invocado && estruturas.some(e => e.time !== time && e.tipo === 'torre' && e.ordem === 2 && !e.vivo)) { u.maxHp *= 1.5; u.hp = u.maxHp; u.dano *= 1.6; u.fortalecida = true; }
  if (SELVA_ON) aoCriarMinion(u);
  return u;
}
function onda(time, n = 4) {
  const s = time === 'luz' ? 1 : -1; const x0 = NUCLEO[time].x + s * 4.5;
  for (let i = 0; i < n; i++) { const x = x0 - s * Math.floor(i / 2) * 1.8, off = (i % 2 ? 1 : -1) * 1.1; novoMinion(time, x, laneZ(x) + off, i === n - 1); }
}
function iniciarStatus(u) { u.lento = 0; u.lentoT = 0; u.atord = 0; u.escudos = []; u.dots = []; u.buffs = []; u.invis = 0; u.provoc = null; u.combateT = 99; u.vooT = 0; u.voo = 0; u.vooH = 0; u.medo = null; u.encanto = null; u.raiz = 0; u.empurrao = null; }

// ================= heróis =================
function criarHeroi(id, time, ehBot) {
  const d = HEROIS[id]; const b = BASES[id];
  const u = new Unidade(b.cena, b.clips || clips, { time, tipo: 'heroi', nome: d.nome, escala: ESC_HEROI * d.esc, raio: d.esc > 1.2 ? .95 : .75, hp: d.base.hp, vel: d.base.vel, alcance: d.base.alcance, dano: d.base.ad, cadencia: d.base.cad, anim: { ...d.anim } });
  Object.assign(u, { id, def: d, bot: ehBot, nivel: 1, xp: 0, pontos: 1, ouro: 500, itens: [], abates: 0, mortes: 0, assist: 0, cs: 0, atkCd: 0, travado: 0, contAtaque: 0, proxBonus: 0, proxMag: 0, ctrl: { x: 0, y: 0, len: 0 }, canal: null, dash: null, morteT: 0, feit: { curar: 0, clarao: 0 }, cdPassiva: 0, cdEscudoFe: 0 });
  u.mago = ['debora', 'farao', 'jezabel'].includes(id);
  u.hab = { q: { nv: 0, cd: 0 }, w: { nv: 0, cd: 0 }, e: { nv: 0, cd: 0 }, r: { nv: 0, cd: 0 } };
  u.stats = { danoHerois: 0, danoSofrido: 0, danoEstr: 0, danoTropas: 0, torres: 0, cura: 0, controles: 0, primeiro: false, mortes: 0, maiorSerie: 0, ouroTotal: 500, historico: [500] }; u.sequencia = 0;
  iniciarStatus(u); recalcular(u, true);
  u.anel = anelHeroi(); if (time !== jogadorTime()) u.anel.material.color.set(0xff5060); u.obj.add(u.anel);
  u.alturaBarra = 3.45 * d.esc;
  renascer(u, true);
  scene.add(u.obj); unidades.push(u); herois.push(u); criarBarra(u);
  return u;
}
let _timeJogador = 'luz'; const jogadorTime = () => _timeJogador;
function recalcular(h, cheio = false) {
  const b = h.def.base, n = h.nivel - 1;
  let st;
  {
    // curva do Wild Rift por nível + ajuste da função (tanque, lutador, assassino, mago, suporte, atirador)
    const F = FUNCOES[h.def.funcao] || FUNCOES.lutador, g = crescimento(h.nivel);
    st = { hp: b.hp + b.hpN * F.hp * g, mana: b.mana + b.manaN * g, ad: b.ad + b.adN * F.ad * g, ap: 0, arm: b.arm + b.armN * F.arm * g, rm: b.rm + b.rmN * F.rm * g, as: F.as * n, ms: 0, ah: 0, crit: 0, ls: 0, let: 0, penA: 0, penM: 0, penMp: 0 };
  }
  for (const it of h.itens) for (const [k, v] of Object.entries(ITENS[it].st)) st[k] += v;
  if (h.itens.includes('cajadoArao')) st.ap *= 1.15;
  st.adBase = b.ad + b.adN * (FUNCOES[h.def.funcao] || FUNCOES.lutador).ad * crescimento(h.nivel);
  const hpAnt = h.maxHp, manaAnt = h.manaMax;
  h.st = st; h.maxHp = st.hp; h.manaMax = st.mana; h.alcance = b.alcance;
  if (cheio || hpAnt === undefined) { h.hp = h.maxHp; h.mana = h.manaMax; } else { h.hp = Math.min(h.maxHp, h.hp + Math.max(0, h.maxHp - hpAnt)); h.mana = Math.min(h.manaMax, h.mana + Math.max(0, h.manaMax - manaAnt)); }
}
const buff = (u, tipo) => u.buffs.reduce((s, b) => s + (b.tipo === tipo ? b.v : 0), 0);
const intervaloAtaque = (h) => h.def.base.cad / (1 + h.st.as + buff(h, 'as'));
const _olhar = new THREE.Vector3();
const velocidade = (u) => { const ms = u.st && u.st.ms !== undefined ? u.st.ms : 0; return u.vel * (1 + ms + buff(u, 'ms')) * (1 - u.lento); };
const arm = (u) => (u.st ? u.st.arm : 15) + buff(u, 'arm');
const rmag = (u) => (u.st ? u.st.rm : 15) + buff(u, 'arm');
const XP_NIVEL = (n) => MODO2 ? 190 + 130 * (n - 1) : 100 + 60 * (n - 1); // 2v2 com selva: curva mais lenta (nível 11–13 aos 15 min)
function darXp(h, v) {
  if (!h || h.nivel >= 15) return; h.xp += v;
  while (h.nivel < 15 && h.xp >= XP_NIVEL(h.nivel)) {
    h.xp -= XP_NIVEL(h.nivel); h.nivel++; h.pontos++; recalcular(h);
    aneis.add(h.obj.position, new THREE.Color(1, .85, .4), .5, 2.6, .7);
    for (let k = 0; k < 26; k++) { const a = k / 26 * 6.28; fx.emit(h.obj.position.x + Math.cos(a) * .8, .2, h.obj.position.z + Math.sin(a) * .8, { vel: [0, 4 + Math.random() * 2, 0], cor: [1, .85, .4], vida: .8, t0: .4, t1: 0 }); }
    if (h === jogador) {
      const primeira = !localStorage.getItem('lxt.dicaNivel'); if (primeira && h.pontos && !AUTO) { localStorage.setItem('lxt.dicaNivel', '1'); aviso('Nível ' + h.nivel + '! Toque em + para evoluir uma habilidade'); } else aviso('Nível ' + h.nivel + '!');
      som('nivel', null, .8); const r = document.querySelector('#painel .retrato'); if (r) { r.classList.remove('subiu'); void r.offsetWidth; r.classList.add('subiu'); }
    }
    if (h.bot || AUTO && h === jogador) autoPontos(h);
  }
  if (h.nivel >= 15) h.xp = 0;
}
function podeSubir(h, k) {
  if (h.pontos <= 0) return false; const nv = h.hab[k].nv;
  if (k === 'r') return nv < [5, 9, 13].filter(l => h.nivel >= l).length;
  return nv < 5 && nv < Math.ceil(h.nivel / 2);
}
function subirHab(h, k) { if (!podeSubir(h, k)) return false; h.hab[k].nv++; h.pontos--; if (h === jogador) { $('b' + k.toUpperCase()).classList.add('evoluiu'); setTimeout(() => $('b' + k.toUpperCase()).classList.remove('evoluiu'), 500); } return true; }
function autoPontos(h) { const ordem = ['r', 'q', 'e', 'w']; let g = 0; while (h.pontos > 0 && g++ < 20) { let ok = false; for (const k of ordem) if (subirHab(h, k)) { ok = true; break; } if (!ok) break; } }
function renascer(h, inicio = false) {
  const f = FONTE[h.time]; const s = h.time === 'luz' ? 1 : -1;
  h.obj.position.set(f.x + s * 4, 0, laneZ(f.x + s * 4) + (inicio ? 0 : (Math.random() - .5) * 2));
  h.obj.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2;
  h.vivo = true; h.hp = h.maxHp; h.mana = h.manaMax; h.morteT = 0; iniciarStatus(h); h.canal = null; h.dash = null; h.obj.visible = true;
  h.tocar(h.anim.idle, 0);
  if (!inicio) { aneis.add(h.obj.position, new THREE.Color(.6, .85, 1), .4, 3, .8); if (h === jogador) aviso('Você renasceu na base'); }
}

// ================= dano =================
// dano depois de armadura/RM e modificadores (sem escudos); também usado pela IA e por tools/balanco.mjs
function mitigar(fonte, alvo, valor, o = {}) {
  let v = valor;
  let r = o.mag ? rmag(alvo) : arm(alvo);
  // penetração (estilo WR): % primeiro, depois o valor fixo (letalidade / penetração mágica)
  if (fonte && fonte.tipo === 'heroi' && fonte.st) r = o.mag ? r * (1 - (fonte.st.penMp || 0)) - (fonte.st.penM || 0) : r * (1 - (fonte.st.penA || 0)) - (fonte.st.let || 0) * (.6 + .4 * (fonte.nivel || 1) / 15);
  if (!o.puro) v *= 100 / (100 + Math.max(0, r));
  if (alvo.id === 'golias') v *= .85;
  if (fonte && fonte.tipo === 'minion' && alvo.tipo === 'heroi') v *= .6; // tropa em herói na proporção do WR (~13 de dano no começo)
  if (fonte && fonte.tipo === 'minion' && alvo.tipo === 'minion') v *= 2.2; // tropa x tropa resolve rápido: sem isso as ondas empilhavam no meio e a rota travava
  if (fonte && fonte.tipo === 'heroi') {
    if (o.hab && fonte.id === 'jezabel' && alvo.hp < alvo.maxHp * .5) v *= 1.25;
    if (fonte.itens.includes('espadaGolias') && alvo.maxHp > fonte.maxHp) v *= 1.08;
  }
  return v;
}
// números de balanceamento: troca (1 ataque + Q) e combo completo de f em a, já mitigados
function medirDano(f, a) {
  const bas = mitigar(f, a, f.st.ad, { ataque: true });
  const hab = (k) => { const H = f.hab[k], d = f.def.hab[k]; if (!H.nv || (!d.dano && !d.dps)) return 0; let v = valorHab(f, d, H.nv); if (d.impactos) v *= d.impactos; if (d.dur && d.dps) v = (d.dps[H.nv - 1] * multRank(f, d, H.nv) + (d.k || 0) * f.st.ap * K_AP) * d.dur; return mitigar(f, a, v, { mag: d.mag, hab: true }); };
  const q = hab('q'); const combo = bas * (1 + f.st.crit * .75) * Math.max(2, 3 / intervaloAtaque(f)) + q + hab('w') + hab('e') + hab('r'); // 3 s de luta
  return { basico: Math.round(bas), q: Math.round(q), troca: Math.round(bas + q), combo: Math.round(combo), hpAlvo: Math.round(a.maxHp), trocasMatar: +(a.maxHp / Math.max(1, bas + q)).toFixed(1), comboPct: Math.round(100 * combo / a.maxHp) };
}
function danificar(fonte, alvo, valor, o = {}) {
  if (!alvo || !alvo.vivo || estado.fim) return false;
  if (alvo.invulneravel) return false;
  if (SELVA_ON) valor *= multDano(fonte);
  if (alvo.tipo === 'torre' || alvo.tipo === 'nucleo') return danoEstrutura(fonte, alvo, valor);
  let v = Math.max(1, Math.round(mitigar(fonte, alvo, valor, o)));
  if (alvo.tipo === 'monstro' && fonte) { alvo.ultimoAgressor = fonte; fonte.agrediuMonstroT = estado.tempo; }
  // escudos
  let resto = v; for (const e of alvo.escudos) { const a = Math.min(e.v, resto); e.v -= a; resto -= a; if (resto <= 0) break; }
  alvo.escudos = alvo.escudos.filter(e => e.v > 0 && e.t > 0);
  alvo.hp -= resto; alvo.flash = .12; alvo.combateT = 0;
  if (fonte && fonte.stats) { if (alvo.tipo === 'heroi') fonte.stats.danoHerois += resto; else fonte.stats.danoTropas += resto; }
  if (alvo.stats && fonte && fonte.tipo === 'heroi') alvo.stats.danoSofrido += resto;
  if (fonte === jogador || alvo === jogador) { alvo.flashCor = alvo === jogador ? 'mal' : o.crit ? 'crit' : o.mag ? 'mag' : 'fis'; alvo.flash = o.crit ? .2 : .14; }
  if (fonte === jogador && o.crit && alvo.tipo === 'heroi') paradaImpacto(.045);
  if (fonte === jogador && o.ult && alvo.tipo === 'heroi') paradaImpacto(.07);
  if (alvo.canal && resto > 0 && alvo.canal.tipo === 'recuo') { alvo.canal = null; if (alvo === jogador) aviso('Recuo interrompido', true); }
  if (fonte && fonte.tipo === 'heroi') {
    fonte.combateT = 0;
    if (alvo.tipo === 'heroi') { alvo.ultimoAgressor = fonte; alvo.agressorT = estado.tempo; fonte.agrediuHeroiT = estado.tempo; }
    if (o.ataque && fonte.st.ls) curarU(fonte, v * fonte.st.ls, false);
    if (o.cura) curarU(fonte, v * o.cura, true);
    if (o.hab && fonte.id === 'debora' && alvo.tipo === 'heroi' && fonte.cdPassiva <= 0) { fonte.cdPassiva = 8; darEscudo(fonte, 60 + 4 * fonte.nivel, 3); }
    if (o.hab && fonte.itens.includes('cetroEster')) aplicarLento(alvo, .1, 1);
  }
  if (o.ataque && !o.reflexo && alvo.itens && alvo.itens.includes('armaduraSaul') && fonte && fonte.vivo) danificar(alvo, fonte, valor * .1, { mag: true, reflexo: true });
  // textos
  if (fonte === jogador) textos.add(alvo.obj.position, o.crit ? v + '!' : '' + v, o.crit ? 'crit' : (o.mag ? 'mag' : ''), alvo);
  else if (alvo === jogador) textos.add(alvo.obj.position, '-' + v, 'mal');
  // passivas defensivas
  if (alvo.tipo === 'heroi' && alvo.hp > 0) {
    if (alvo.id === 'farao' && alvo.hp < alvo.maxHp * .4 && alvo.cdPassiva <= 0) { alvo.cdPassiva = 40; darEscudo(alvo, 150 + 15 * alvo.nivel, 4); textoInfo(alvo, 'Coração Endurecido'); }
    if (alvo.itens.includes('escudoFe') && alvo.hp < alvo.maxHp * .3 && alvo.cdEscudoFe <= 0) { alvo.cdEscudoFe = 60; darEscudo(alvo, 200, 4); textoInfo(alvo, 'Escudo da Fé'); }
  }
  if (alvo.hp <= 0) { alvo.hp = 0; morrer(alvo, fonte); return true; }
  return false;
}
// a partir de 6:00 as muralhas enfraquecem (+40% de dano em estruturas por minuto; +100%/min a mais depois de 9:00): a partida fecha entre 8 e 12 min
const muralhas = () => 1 + Math.max(0, (estado.tempo - 360) / 60) * .4 + Math.max(0, (estado.tempo - 540) / 60) * 1.0;
function danoEstrutura(fonte, e, valor) {
  if (!e.vivo || protegida(e)) { if (fonte === jogador && protegida(e)) aviso(e.tipo === 'nucleo' ? 'Destrua as torres antes do Núcleo' : 'Destrua a torre externa primeiro', true); return false; }
  // fortificação (estilo WR): até 4:00 as torres recebem 45% menos dano de heróis; de 4:00 a 5:00 o bônus some aos poucos
  const fort = fonte && fonte.tipo === 'heroi' && e.tipo === 'torre' ? 1 - .45 * Math.min(1, Math.max(0, (300 - estado.tempo) / 60)) : 1;
  const v = Math.round(valor * fort * (fonte && fonte.tipo === 'minion' ? 1.1 : 1) * muralhas()); e.hp -= v; e.flash = .12;
  if (fonte && fonte.tipo === 'heroi') fonte.stats.danoEstr += v;
  if (e.placas !== undefined && estado.tempo < 300) {
    const n = Math.min(4, Math.floor((1 - Math.max(0, e.hp) / e.maxHp) / .2));
    while (e.placas < n) { e.placas++; for (const h of herois) if (h.vivo && h.time !== e.time && h.obj.position.distanceTo(e.obj.position) < 13) { ganharOuro(h, 40, e.obj.position.clone().setY(3)); if (h === jogador) textoInfo(h, 'Placa da torre!'); } }
  }
  if (fonte === jogador) textos.add(e.obj.position.clone().setY(2), '' + v, '');
  if (e.hp <= 0) { e.hp = 0; destruirEstrutura(e, fonte); return true; }
  return false;
}
function curarU(u, v, mostrar = true, fonte = null) { if (!u.vivo) return; const a = Math.min(u.maxHp - u.hp, v); u.hp += a; const quem = fonte || (u.tipo === 'heroi' ? u : null); if (quem && quem.stats && a > 0) quem.stats.cura += a; if (mostrar && a > 5 && (u === jogador)) textos.add(u.obj.position, '+' + Math.round(a), 'cura'); }
function darEscudo(u, v, t) { u.escudos.push({ v, t }); aneis.add(u.obj.position, new THREE.Color(1, .9, .5), .5, 2, .5); }
function aplicarLento(u, v, t) { if (!u.vivo) return; if (v >= u.lento || u.lentoT < t) { u.lento = Math.max(u.lento, v); u.lentoT = Math.max(u.lentoT, t); } }
function atordoar(u, t) { if (!u.vivo || t <= 0) return; u.atord = Math.max(u.atord, t); if (u.canal) u.canal = null; if (u.tipo === 'heroi') textos.add(u.obj.position, 'Atordoado', 'info'); }
// controle de grupo com identidade própria (arremesso, empurrão, medo, encanto, raiz)
function arremessar(u, t, hA = 2.2) { if (!u.vivo || t <= 0) return; atordoar(u, t); u.voo = t; u.vooT = t; u.vooH = hA * (u.tipo === 'heroi' && u.def && u.def.esc > 1.2 ? .75 : 1); u.dash = null; if (u.tipo === 'heroi') textoInfo(u, 'Arremessado!'); const p = u.obj.position; for (let j = 0; j < 14; j++) fxD.emit(p.x + (Math.random() - .5), .3, p.z + (Math.random() - .5), { vel: [(Math.random() - .5) * 3, 2 + Math.random() * 3, (Math.random() - .5) * 3], cor: [.55, .45, .32], vida: .8, t0: .6, t1: 1.6, alpha: .7 }); }
function empurrar(u, dir, dist, t = .25) { if (!u.vivo || dist <= 0) return; u.empurrao = { dir: dir.clone().setY(0).normalize(), v: dist / t, t }; u.dash = null; }
function amedrontar(u, fonte, t) { if (!u.vivo || t <= 0) return; u.medo = { de: fonte.clone(), t }; if (u.canal) u.canal = null; if (u.tipo === 'heroi') textoInfo(u, 'Amedrontado!'); }
function encantar(u, fonte, t) { if (!u.vivo || t <= 0) return; u.encanto = { por: fonte, t }; if (u.canal) u.canal = null; if (u.tipo === 'heroi') textoInfo(u, 'Encantado!'); }
function enraizar(u, t) { if (!u.vivo || t <= 0) return; u.raiz = Math.max(u.raiz, t); u.dash = null; if (u.canal) u.canal = null; if (u.tipo === 'heroi') textoInfo(u, 'Enraizado!'); }
const controlado = (u) => u.atord > 0 || !!u.medo || !!u.encanto;
// movimento forçado por medo/encanto; devolve true se a unidade está sob efeito
function moverForcado(u, dt) {
  const c = u.medo || u.encanto; if (!c) return false;
  const p = u.obj.position; const alvo = u.medo ? p.clone().multiplyScalar(2).sub(c.de) : c.por.obj.position;
  const d = alvo.clone().sub(p).setY(0); if (d.length() > .3) { d.normalize(); const v = velocidade(u) * (u.medo ? .85 : .6); if (!(u.raiz > 0)) { p.addScaledVector(d, v * dt); if (u.tipo === 'heroi') limitar(p); } u.olharPara(p.clone().add(d), dt, 14); u.tocar(u.anim.correr, .15, false, u.anim.velCorrer || 1); }
  if (Math.random() < dt * 14) { const cc = u.medo ? [1, .85, .3] : [1, .35, .8]; fx.emit(p.x + (Math.random() - .5) * .8, (u.alturaBarra || 2.6) - .4, p.z + (Math.random() - .5) * .8, { vel: [0, 1.2, 0], cor: cc, vida: .5, t0: u.medo ? .35 : .5, t1: 0 }); }
  return true;
}
function textoInfo(u, t) { textos.add(u.obj.position.clone().add(new THREE.Vector3(0, 1, 0)), t, 'info'); }

function morrer(u, fonte) {
  if (u.tipo === 'monstro') return monstroMorreu(u, fonte);
  u.vivo = false; u.morteT = 0; u.tocar(u.anim.morte, .1, true); u.canal = null; u.dash = null;
  const heroiFonte = fonte && fonte.tipo === 'heroi' ? fonte : null;
  if (u.tipo === 'minion') {
    if (heroiFonte && heroiFonte.time !== u.time) { ganharOuro(heroiFonte, u.ouro, u.obj.position); heroiFonte.cs++; }
    // quem estava perto e não deu o último golpe leva 40% (como no Wild Rift)
    for (const h of herois) if (h.vivo && h !== heroiFonte && h.time !== u.time && h.obj.position.distanceTo(u.obj.position) < 11) ganharOuro(h, Math.round(u.ouro * .4), u.obj.position, true);
    for (const h of herois) if (h.vivo && h.time !== u.time && h.obj.position.distanceTo(u.obj.position) < 14) darXp(h, u.xpV);
    if (u.fumaca) for (let k = 0; k < 24; k++) fxD.emit(u.obj.position.x + (Math.random() - .5), .6 + Math.random(), u.obj.position.z + (Math.random() - .5), { vel: [(Math.random() - .5) * 2, 1 + Math.random() * 2, (Math.random() - .5) * 2], cor: [.12, .03, .12], vida: 1.2, t0: 1, t1: 2.2, drag: 1.5, alpha: .8 });
  }
  if (u.tipo === 'heroi') {
    u.mortes++; u.morteT = 6 + 1.5 * u.nivel + Math.max(0, estado.tempo / 60 - 10); u.canal = null;
    const matador = heroiFonte || (u.ultimoAgressor && estado.tempo - u.agressorT < 10 ? u.ultimoAgressor : null);
    estado[inimigo(u.time)]++;
    const serieV = u.sequencia || 0; u.sequencia = 0; u.stats.mortes++;
    const bonus = serieV >= 2 ? Math.min(450, 100 * (serieV - 1) + 50) : 0; // recompensa por encerrar a série
    if (matador) {
      matador.abates++; matador.sequencia = (matador.sequencia || 0) + 1; matador.stats.maiorSerie = Math.max(matador.stats.maiorSerie, matador.sequencia);
      ganharOuro(matador, 300 + bonus, u.obj.position.clone().add(new THREE.Vector3(0, .5, 0))); darXp(matador, 140 + 25 * u.nivel);
      if (!estado.primeiroSangue) { estado.primeiroSangue = true; matador.stats.primeiro = true; ganharOuro(matador, 100, matador.obj.position); anunciar('primeiro', matador, u); }
      else if (bonus) anunciar('fimSerie', matador, u, bonus);
      else if (matador.sequencia >= 2) anunciar('serie' + [8, 5, 3, 2].find(n => matador.sequencia >= n), matador, u);
      if (matador === jogador || u === jogador) paradaImpacto(.09);
      for (const a of herois) if (a !== matador && a.time === matador.time && a.vivo && a.obj.position.distanceTo(u.obj.position) < 15) { a.assist++; ganharOuro(a, 150, a.obj.position, true); darXp(a, 70 + 12 * u.nivel); }
    }
    else for (const h of herois) if (h.time !== u.time) { ganharOuro(h, 150, h.obj.position); darXp(h, 100); }
    if (!estado.anunciou) avisoAbate(matador, u); estado.anunciou = false; feedAbate(matador, u, bonus);
    if (u === jogador) aviso(`Você foi derrotado! Renasce em ${Math.ceil(u.morteT)} s`, true);
  }
  if (heroiFonte && heroiFonte.id === 'nabuco') darEscudo(heroiFonte, 40 + 8 * heroiFonte.nivel, 4);
}
// material escurecido da ruína: um por material original (cache), criado no carregamento em prepararRuinas()
const RUINA = new Map();
function matRuina(m, k, ke = 1) { const ch = m.uuid + k; let r = RUINA.get(ch); if (!r) { r = m.clone(); r.color.multiplyScalar(k); if (r.emissive) r.emissive.multiplyScalar(ke); RUINA.set(ch, r); } return r; }
function prepararRuinas() { for (const e of estruturas) e.obj.traverse(o => { if (!o.isMesh || !o.material || !o.material.color) return; matRuina(o.material, .5); matRuina(o.material, .45, .2); }); }
function destruirEstrutura(e, fonte) {
  e.vivo = false; tremer(.6);
  const p = e.obj.position; const cor = e.time === 'luz' ? [.6, .85, 1] : [1, .25, .35];
  for (let k = 0; k < 90; k++) { const a = Math.random() * 6.28, s = 3 + Math.random() * 9; fx.emit(p.x, 2 + Math.random() * 5, p.z, { vel: [Math.cos(a) * s, 2 + Math.random() * 8, Math.sin(a) * s], cor, vida: 1 + Math.random(), t0: .7, t1: 0, grav: 9, drag: 1 }); }
  for (let k = 0; k < 40; k++) fxD.emit(p.x + (Math.random() - .5) * 4, 1 + Math.random() * 3, p.z + (Math.random() - .5) * 4, { vel: [(Math.random() - .5) * 3, 1 + Math.random() * 2, (Math.random() - .5) * 3], cor: [.35, .3, .28], vida: 2.2, t0: 1.5, t1: 4, alpha: .7 });
  for (let i = 0; i < 3; i++) agendar(i * .15, () => aneis.add(p, new THREE.Color(...cor), 1, 9 + i * 2, .9));
  // ruína: esconde partes altas e luzes
  // Tripo: a peça é uma malha só; em ruína ela é achatada e escurecida
  // sem compilar nada na hora: os materiais de ruína já existem (criados/compilados no carregamento) e as luzes só apagam
  // (esconder uma PointLight muda a contagem de luzes e recompila TODOS os materiais iluminados: era o travamento no iPhone)
  e.obj.traverse(o => { if (o.userData.ruina) { o.scale.y *= .36; o.traverse(m => { if (m.isMesh) m.material = matRuina(m.material, .5); }); } });
  e.obj.traverse(o => { if (o === e.obj) return; if (o.isPointLight) o.intensity = 0; else if (o.parent === e.obj && o.position.y > (e.tipo === 'nucleo' ? 1.5 : 2.2)) o.visible = false; if (o.isMesh && o.material && o.material.color && o.visible && o.parent === e.obj) o.material = matRuina(o.material, .45, .2); });
  e.barra.style.display = 'none';
  const amigos = herois.filter(h => h.time !== e.time);
  for (const h of amigos) { if (e.tipo !== 'nucleo') { h.ouro += 200; h.stats.ouroTotal += 200; } darXp(h, 120); }
  if (fonte && fonte.tipo === 'heroi') fonte.stats.torres++; else { const hh = herois.find(h => h.time !== e.time && h.vivo && h.obj.position.distanceTo(e.obj.position) < 14); if (hh) hh.stats.torres++; }
  if (e.tipo === 'torre') {
    anunciar(e.time === jogadorTime() ? 'torreAliada' : 'torre', null, null);
    if (jogador && e.time !== jogador.time) { textos.add(jogador.obj.position.clone().add(new THREE.Vector3(0, 1.4, 0)), '+200', 'ouro'); pulsarOuro(); }
    const nuc = estruturas.find(n => n.tipo === 'nucleo' && n.time === e.time); if (nuc && !protegida(nuc)) agendar(2.6, () => !estado.fim && anunciar('nucleoExposto', null, null, 0, e.time));
  }
  if (e.tipo === 'nucleo') fimDePartida(inimigo(e.time), e);
}
function avisoAbate(m, v) {
  const el = $('abate'); if (!el) return;
  const cls = (u) => u && u.time === jogadorTime() ? 'al' : 'in';
  el.innerHTML = `<span class="${cls(m)}">${m ? m.def.nome : (v.time === 'luz' ? 'As Trevas' : 'A Luz')}</span><i>abateu</i><span class="${cls(v)}">${v.def.nome}</span>`;
  el.className = 'on'; clearTimeout(el._t); el._t = setTimeout(() => el.className = '', 2600);
}

// ================= projéteis =================
const projeteis = [];
const geoPedra = new THREE.DodecahedronGeometry(.2, 0);
const geoBola = new THREE.SphereGeometry(.2, 10, 8);
const geoLanca = new THREE.ConeGeometry(.12, 1.2, 6); geoLanca.rotateX(Math.PI / 2);
const texB = texBrilho();
const matBrilho = (c) => new THREE.SpriteMaterial({ map: texB, color: c, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .9 });
const MAT_PROJ = {
  pedra: new THREE.MeshStandardMaterial({ color: 0xd8d0c0, roughness: .5, emissive: 0x332a18 }),
  ouro: new THREE.MeshStandardMaterial({ color: 0xffe6a0, emissive: 0xffb830, emissiveIntensity: 3, roughness: .3 }),
};
const matsCor = new Map(); const matCor = (cor) => { const k = cor.join(); if (!matsCor.has(k)) matsCor.set(k, new THREE.MeshBasicMaterial({ color: new THREE.Color(...cor).multiplyScalar(2.6) })); return matsCor.get(k); };
const brilhosCor = new Map(); const brilhoCor = (cor) => { const k = cor.join(); if (!brilhosCor.has(k)) brilhosCor.set(k, matBrilho(new THREE.Color(...cor))); return brilhosCor.get(k); };
// pool de projéteis: reaproveita malha + brilho (evita criar/destruir objetos a cada tiro)
const poolProj = new Map(); let projCriados = 0;
function pegarProj(geo, mat) {
  const k = geo.uuid + mat.uuid; const l = poolProj.get(k); let m = l && l.pop();
  if (!m) { m = new THREE.Mesh(geo, mat); m.userData.k = k; const sp = new THREE.Sprite(brilhoCor([1, .85, .5])); sp.scale.setScalar(1.4); m.add(sp); m.userData.sp = sp; scene.add(m); projCriados++; }
  m.visible = true; m.rotation.set(0, 0, 0); return m;
}
function soltarProj(m) { m.visible = false; const k = m.userData.k; if (!poolProj.has(k)) poolProj.set(k, []); poolProj.get(k).push(m); }
function lancar(de, alvo, o) {
  const m = pegarProj(o.geo || geoPedra, o.mat || MAT_PROJ.pedra); m.position.copy(de); m.scale.setScalar(o.esc || 1);
  const sp = m.userData.sp; if (o.semBrilho) sp.visible = false; else { sp.visible = true; sp.material = brilhoCor(o.cor || [1, .85, .5]); }
  if (o.dir) m.lookAt(m.position.clone().add(o.dir));
  projeteis.push({ m, alvo, t0: performance.now(), dir: o.dir ? o.dir.clone() : null, vel: o.vel || 26, time: o.time, fonte: o.fonte, trilha: o.trilha, perfura: o.perfura, atingidos: new Set(), dist: 0, max: o.max || 14, onHit: o.onHit, cor: o.cor || [1, .85, .5], larg: o.larg || .9, giro: o.giro !== false });
}
function atualizarProjeteis(dt) {
  for (let i = projeteis.length - 1; i >= 0; i--) {
    const p = projeteis[i]; const pos = p.m.position; let fim = false;
    if (p.alvo) {
      const tp = p.alvo.obj.position.clone(); tp.y += p.alvo.tipo === 'torre' || p.alvo.tipo === 'nucleo' ? 3 : 1.2;
      const d = tp.sub(pos); const L = d.length(); const step = p.vel * dt;
      if (L <= step + .3 || !p.alvo.vivo) { if (p.alvo.vivo) impacto(p, p.alvo); fim = true; } else pos.addScaledVector(d.normalize(), step);
    } else {
      pos.addScaledVector(p.dir, p.vel * dt); p.dist += p.vel * dt;
      for (const u of unidades) { if (!u.vivo || u.time === p.time || p.atingidos.has(u)) continue; const dx = u.obj.position.x - pos.x, dz = u.obj.position.z - pos.z; if (dx * dx + dz * dz < (u.raio + p.larg) ** 2) { p.atingidos.add(u); impacto(p, u); if (!p.perfura) { fim = true; break; } } }
      if (p.dist > p.max) fim = true;
    }
    if (p.giro) { p.m.rotation.x += dt * 14; p.m.rotation.y += dt * 9; }
    if (p.trilha) p.trilha(pos, dt, p);
    if (fim) { soltarProj(p.m); projeteis.splice(i, 1); }
  }
}
function impacto(p, u) {
  const hp = u.obj.position.clone(); hp.y += 1.2;
  for (let k = 0; k < 10; k++) fx.emit(hp.x, hp.y, hp.z, { vel: [(Math.random() - .5) * 8, Math.random() * 5, (Math.random() - .5) * 8], cor: p.cor, vida: .35 + Math.random() * .2, t0: .5, t1: 0, drag: 3 });
  aneis.add(u.obj.position, new THREE.Color(...p.cor), .2, 1.1, .35);
  if (p.onHit) p.onHit(u, p);
}

// ================= alvos =================
const vivos = () => unidades.filter(u => u.vivo);
function visivelPara(u, time) { return !(u.invis > 0) || u.time === time; }
function inimigosEm(ponto, time, raio) { const out = []; for (const u of unidades) { if (!u.vivo || u.time === time || u.spawnT > 0) continue; const dx = u.obj.position.x - ponto.x, dz = u.obj.position.z - ponto.z; if (dx * dx + dz * dz < (raio + u.raio * .5) ** 2) out.push(u); } return out; }
function heroiInimigoProximo(h, alc) { let best = null, bd = alc; for (const u of herois) { if (!u.vivo || u.time === h.time || !visivelPara(u, h.time)) continue; const d = u.obj.position.distanceTo(h.obj.position) - u.raio; if (d < bd) { bd = d; best = u; } } return best; }
function alvoAtaque(h, alc, prefHeroi = true) {
  let best = null, bd = alc, bh = null, bhd = alc;
  for (const u of unidades) { if (!u.vivo || u.time === h.time || u.spawnT > 0 || !visivelPara(u, h.time)) continue; const d = u.obj.position.distanceTo(h.obj.position) - u.raio; if (d < bd) { bd = d; best = u; } if (u.tipo === 'heroi' && d < bhd) { bhd = d; bh = u; } }
  for (const e of estruturas) { if (!e.vivo || e.time === h.time || protegida(e)) continue; const d = e.obj.position.distanceTo(h.obj.position) - e.raio; if (d < bd && !best) { bd = d; best = e; } else if (d < alc && !best) best = e; }
  if (h.tipo === 'heroi' && h.forcarAlvo && h.forcarAlvo.vivo && h.forcarAlvo.obj.position.distanceTo(h.obj.position) - (h.forcarAlvo.raio || 1) < alc) return h.forcarAlvo;
  return prefHeroi && bh ? bh : best;
}
const frente = (u) => new THREE.Vector3(Math.sin(u.obj.rotation.y), 0, Math.cos(u.obj.rotation.y));
function mirar(h, d) {
  const alc = d.alc || d.comp || (d.centro === 'frente' ? (d.dist || 2) + d.raio : 0) || d.dist || 8;
  if (h.mira) {
    const mm = h.mira; h.mira = null; const dir = mm.dir.clone().setY(0).normalize(); const ponto = h.obj.position.clone().addScaledVector(dir, Math.max(1.2, alc * mm.frac));
    let alvo = null, bd = 4; for (const u of unidades) { if (!u.vivo || u.time === h.time || !visivelPara(u, h.time)) continue; const dd = u.obj.position.distanceTo(ponto) - (u.tipo === 'heroi' ? 1.2 : 0); if (dd < bd) { bd = dd; alvo = u; } }
    return { alvo, dir, ponto, manual: true };
  }
  let alvo = h.trava && h.trava.u.vivo && h.trava.u.obj.position.distanceTo(h.obj.position) < alc + 1 ? h.trava.u : heroiInimigoProximo(h, alc + 1);
  if (!alvo) { let bd = alc + 1; for (const u of unidades) { if (!u.vivo || u.time === h.time || u.tipo !== 'minion') continue; const dd = u.obj.position.distanceTo(h.obj.position); if (dd < bd) { bd = dd; alvo = u; } } }
  let dir;
  if (alvo) dir = alvo.obj.position.clone().sub(h.obj.position).setY(0).normalize();
  else if (h.ctrl.len > .2) dir = new THREE.Vector3(h.ctrl.x, 0, h.ctrl.y).normalize();
  else dir = frente(h);
  const ponto = alvo ? alvo.obj.position.clone() : h.obj.position.clone().addScaledVector(dir, Math.min(alc, 6));
  return { alvo, dir, ponto };
}
const posMao = (u) => { const v = new THREE.Vector3(); if (!u.maoR) u.modelo.traverse(o => { if (/^(hand_r|Hand_R|mixamorigRightHand)$/.test(o.name) && !u.maoR) u.maoR = o; }); if (u.maoR) u.maoR.getWorldPosition(v); else v.copy(u.obj.position).setY(1.6); return v; };

// ================= ataque básico =================
function atacar(h) {
  if (!h.vivo || h.atkCd > 0 || h.travado > .15 || controlado(h) || h.dash || estado.fim) return false;
  const alvo = alvoAtaque(h, h.alcance + (h.def.distancia ? .6 : .9));
  if (!alvo) return false;
  h.atkCd = intervaloAtaque(h); if (h.canal) h.canal = null;
  h.olharPara(alvo.obj.position, 1, 1);
  const vA = (h.anim.velAtaque || 1) * Math.max(1, h.def.base.cad / h.atkCd);
  h.tocar(h.anim.ataque, .08, true, vA); h.travado = Math.min(.5, h.atkCd * .7);
  const atraso = (h.anim.atrasoAtaque || .25) / Math.max(1, h.def.base.cad / h.atkCd);
  agendar(atraso, () => {
    if (h === jogador && !AUTO) h.travado = 0; // o golpe já saiu: o jogador pode andar na hora (cancelar a animação)
    if (!h.vivo || !alvo.vivo) return;
    let dano = h.st.ad, crit = false, mag = 0;
    if (h.st.crit && Math.random() < h.st.crit) { dano *= 1.75; crit = true; }
    let lento = 0;
    if (h.id === 'davi') { h.contAtaque++; if (h.contAtaque % 4 === 0) { dano *= crit ? 1.2 : 1.8; crit = true; lento = .3; } }
    if (h.id === 'sansao') dano *= 1 + .4 * (1 - h.hp / h.maxHp);
    if (h.proxBonus) { dano *= 1 + h.proxBonus; h.proxBonus = 0; }
    if (h.gideaoBonus) { dano += 55 + .6 * h.st.ad; h.gideaoBonus = false; }
    if (h.proxMag) { mag += h.proxMag; h.proxMag = 0; }
    if (h.itens.includes('arcoJonatas')) mag += 15;
    const aplicar = () => { if (!alvo.vivo) return; danificar(h, alvo, dano, { ataque: true, crit }); if (SELVA_ON) aoAtacar(h, alvo); if (mag && alvo.vivo && alvo.tipo !== 'torre' && alvo.tipo !== 'nucleo') danificar(h, alvo, mag, { mag: true }); if (lento) aplicarLento(alvo, lento, 1); };
    if (h.def.distancia) {
      const de = posMao(h); de.y = Math.max(de.y, 1.4);
      const tp = h.def.projetil; const cor = h.def.cor;
      lancar(de, alvo, { time: h.time, fonte: h, vel: 30, cor, geo: tp === 'pedra' ? geoPedra : geoBola, mat: tp === 'pedra' ? (crit ? MAT_PROJ.ouro : MAT_PROJ.pedra) : matCor(cor), esc: crit ? 1.5 : 1, onHit: aplicar,
        trilha: (p) => { fx.emit(p.x, p.y, p.z, { cor, vida: .3, t0: .6, t1: 0, alpha: .8 }); } });
    } else {
      aplicar();
      const p = alvo.obj.position; for (let k = 0; k < (crit ? 14 : 7); k++) fx.emit(p.x, 1.2, p.z, { vel: [(Math.random() - .5) * 6, Math.random() * 4, (Math.random() - .5) * 6], cor: h.def.cor, vida: .3, t0: .45, t1: 0 });
      if (h === jogador && crit) tremer(.08);
    }
  });
  return true;
}

// ================= habilidades (executor genérico) =================
// escala por nível da habilidade estilo WR: cada nível vale mais que o anterior (o dano cresce devagar no começo e explode no fim)
const ESC_RANK = [1, 1.14, 1.34, 1.6, 1.9], ESC_RANK_R = [1, 1.4, 1.8], K_AP = 1.2;
const multRank = (h, d, nv) => (d === h.def.hab.r ? ESC_RANK_R : ESC_RANK)[Math.max(0, nv - 1)] || 1;
function valorHab(h, d, nv) { const escV = d.esc === 'ap' ? h.st.ap * K_AP : d.esc === 'adb' ? h.st.ad - h.st.adBase : h.st.ad; return (d.dano ? d.dano[nv - 1] * multRank(h, d, nv) : 0) + (d.k || 0) * escV + (d.kAd || 0) * h.st.ad + (d.kHp || 0) * h.maxHp; }
function acertarHab(h, u, d, nv, dano, extra = {}) {
  if (!u.vivo) return;
  let v = dano;
  if (d.antiGigante && u.maxHp > h.maxHp) v *= 1 + d.antiGigante;
  if (d.kPerdida) v += d.kPerdida * (u.maxHp - u.hp);
  if (u.tipo === 'torre' || u.tipo === 'nucleo') return;
  danificar(h, u, v, { mag: d.mag, hab: true, cura: d.rouba, ult: d === h.def.hab.r });
  if (!u.vivo) return;
  if (u.tipo === 'heroi' && h.stats && (d.lento || d.atordoa || d.raiz || d.medo || d.encanta || d.arremessa || d.provoca || d.atordoaLonge)) h.stats.controles++;
  if (d.lento) aplicarLento(u, d.lento[0], d.lento[1]);
  if (d.atordoa && !extra.semAtordoar) atordoar(u, d.atordoa);
  if (d.veneno) u.dots.push({ dps: v * d.veneno[0] / d.veneno[1], t: d.veneno[1], fonte: h, mag: true });
  if (d.provoca) { u.provoc = { por: h, t: d.provoca }; if (u.tipo === 'heroi') textoInfo(u, 'Provocado!'); }
  if (d.queima) { const q = u.dots.find(x => x.queima && x.fonte === h); const dps = v * d.queima[0] / d.queima[1] + 8; if (q) { q.t = d.queima[1]; } else u.dots.push({ dps, t: d.queima[1], fonte: h, mag: true, queima: true }); }
  if (d.empurraHab) { const c = extra.centro || h.obj.position; const dir = u.obj.position.clone().sub(c).setY(0); if (dir.lengthSq() < .01) dir.copy(frente(h)); empurrar(u, dir, d.empurraHab * (u.tipo === 'heroi' && u.def.esc > 1.2 ? .6 : 1)); }
  if (d.arremessa && !extra.semAtordoar) arremessar(u, d.arremessa);
  if (d.medo && !extra.semAtordoar) amedrontar(u, h.obj.position, u.tipo === 'heroi' ? d.medo : Math.min(.3, d.medo)); // tropas só se espalham um instante (senão o Gideão perdia a onda inteira)
  if (d.encanta) encantar(u, h, d.encanta);
  if (d.raiz) enraizar(u, d.raiz);
  if (d.atordoaLonge && extra.frac !== undefined && extra.frac >= d.atordoaLonge[1]) { atordoar(u, d.atordoaLonge[0]); aneis.add(u.obj.position, new THREE.Color(1, .9, .4), .3, 2.2, .5); if (h === jogador) aviso('Tiro Certeiro! Atordoou'); }
}
// retângulo à frente (skillshot instantâneo tipo estocada/linha)
function inimigosEmLinha(o, dir, comp, larg, time) { const out = []; for (const u of unidades) { if (!u.vivo || u.time === time || u.spawnT > 0) continue; const vx = u.obj.position.x - o.x, vz = u.obj.position.z - o.z; const a = vx * dir.x + vz * dir.z; if (a < -u.raio || a > comp + u.raio) continue; const pd = Math.abs(vx * dir.z - vz * dir.x); if (pd < larg / 2 + u.raio * .6) out.push(u); } return out; }
const geoRet = new THREE.PlaneGeometry(1, 1); geoRet.rotateX(-Math.PI / 2); geoRet.translate(0, 0, .5);
function avisoLinha(o, dir, comp, larg, cor, t) {
  const m = new THREE.Mesh(geoRet, new THREE.MeshBasicMaterial({ map: texB, color: cor, transparent: true, opacity: .0, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.position.set(o.x, .1, o.z); m.rotation.y = Math.atan2(dir.x, dir.z); m.scale.set(larg, 1, comp); m.renderOrder = 6; scene.add(m);
  const borda = new THREE.Mesh(geoRet, new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: .0, depthWrite: false, blending: THREE.AdditiveBlending, wireframe: true })); borda.position.copy(m.position); borda.rotation.y = m.rotation.y; borda.scale.copy(m.scale); scene.add(borda);
  efeitos.push({ t: 0, vida: t + .25, up: (e) => { const k = Math.min(1, e.t / Math.max(.05, t)); m.material.opacity = e.t < t ? .25 + .5 * k : .8 * (1 - (e.t - t) / .25); m.scale.z = comp * (e.t < t ? k : 1); borda.material.opacity = m.material.opacity * .6; if (e.t >= e.vida) { scene.remove(m); scene.remove(borda); m.material.dispose(); borda.material.dispose(); return false; } return true; } });
}
function usarHab(h, k) {
  const H = h.hab[k], d = h.def.hab[k];
  if (!h.vivo || estado.fim) return false;
  if (H.nv === 0) { if (h === jogador) aviso(h.pontos > 0 ? 'Toque em + para aprender esta habilidade' : 'Habilidade ainda não aprendida', true); return false; }
  if (H.cd > 0 || controlado(h) || h.dash) return false;
  if (h.raiz > 0 && (d.tipo === 'dash' || d.tipo === 'salto')) { if (h === jogador) aviso('Enraizado: não pode avançar', true); return false; }
  const nv = H.nv, mana = d.mana[nv - 1];
  if (h.mana < mana) { if (h === jogador) aviso('Mana insuficiente', true); return false; }
  const m = mirar(h, d);
  if ((d.tipo === 'salto' || d.tipo === 'marca') && !(m.alvo && m.alvo.obj.position.distanceTo(h.obj.position) < d.alc + 1)) { if (h === jogador) aviso('Nenhum inimigo ao alcance', true); return false; }
  h.mana -= mana; H.cd = d.cd[nv - 1] * 100 / (100 + h.st.ah); h.canal = null; h.usos = (h.usos || 0) + 1;
  if (d.tipo !== 'buff' || d.cura) h.olharPara(m.ponto, 1, 1);
  h.tocar(d.anim || 'Spell_Simple_Shoot', .08, true, d.velAnim || 1); h.travado = d.tipo === 'dash' ? .3 : .55;
  if (h.id === 'gideao') h.gideaoBonus = true;
  if (h === jogador) aviso(d.nome);
  const dano = valorHab(h, d, nv); const cor = new THREE.Color(...(d.cor || h.def.cor));
  const T = d.tipo;
  if (T === 'proj') {
    agendar(d.atraso || .25, () => {
      if (!h.vivo) return; const de = posMao(h); de.y = Math.max(de.y, 1.3);
      const dir = m.alvo && m.alvo.vivo && !m.manual ? m.alvo.obj.position.clone().sub(h.obj.position).setY(0).normalize() : m.dir;
      const lanca = d.visual === 'lanca' || d.icone === 'lanca' || d.icone === 'adaga'; const pj = PZ.proj(d);
      PZ.lancou(d, h, de, dir);
      lancar(de, null, { dir, time: h.time, fonte: h, vel: d.vel || 28, max: d.alc, perfura: d.perfura, larg: .9 + (d.tam || 1) * .15, cor: d.cor || h.def.cor, geo: pj ? pj.geo : lanca ? geoLanca : (d.icone === 'funda' ? geoPedra : geoBola), mat: pj ? pj.mat : d.icone === 'funda' ? MAT_PROJ.ouro : matCor(d.cor || h.def.cor), esc: pj ? pj.esc : d.tam || 1, giro: pj ? pj.giro : !lanca,
        trilha: (p, dt, pp) => { if (PZ.trilha(d, p, pp.dir, (performance.now() - pp.t0) / 1000)) return; trilhaHab(d, p); for (let j = 0; j < 2; j++) fx.emit(p.x + (Math.random() - .5) * .3, p.y + (Math.random() - .5) * .3, p.z + (Math.random() - .5) * .3, { vel: [(Math.random() - .5), Math.random() * 1.5, (Math.random() - .5)], cor: d.cor || h.def.cor, vida: .45, t0: .7, t1: 0, alpha: .6 }); },
        onHit: (u, pp) => { if (d.empurra && u.tipo === 'minion') u.obj.position.addScaledVector(dir, d.empurra); acertarHab(h, u, d, nv, dano, { frac: pp ? pp.dist / pp.max : 0 }); if (PZ.acerto(d, u, h)) { if (h === jogador) tremer(.1); return; } if (d.visual === 'encanto') visualArea('encanto', u.obj.position.clone(), 1.4, cor, h); if (h === jogador) tremer(.1); } });
      aneis.add(h.obj.position, cor, .4, 2.2, .35);
    });
  } else if (T === 'area') {
    const centro = d.centro === 'self' ? h.obj.position.clone() : d.centro === 'frente' ? h.obj.position.clone().addScaledVector(m.dir, d.dist || 1.8) : m.manual ? m.ponto.clone() : (m.alvo && m.alvo.obj.position.distanceTo(h.obj.position) < d.alc + 1 ? m.alvo.obj.position.clone() : h.obj.position.clone().addScaledVector(m.dir, Math.min(d.alc, 6)));
    if (d.armBuff) h.buffs.push({ tipo: 'arm', v: d.armBuff[0], t: d.armBuff[1] });
    if (d.atraso > .3) aneis.add(centro, cor, d.raio, d.raio, d.atraso + .1, .12, .9);
    PZ.inicio(d, h, centro);
    const n = d.impactos || 1;
    const segue = d.centro === 'self';
    for (let i = 0; i < n; i++) agendar((d.atraso || 0) + i * (d.intervalo || 0), () => {
      if (!h.vivo && d.centro === 'self') return;
      const c = segue ? h.obj.position.clone() : centro.clone(); if (n > 2) { const a = Math.random() * 6.28, r = Math.random() * d.raio * .6; c.x += Math.cos(a) * r; c.z += Math.sin(a) * r; }
      const rr = n > 2 ? d.raio * .55 : d.raio;
      if (!PZ.area(d, c, rr, h, i)) visualArea(d.visual, c, rr, cor, h);
      for (const u of inimigosEm(c, h.time, rr)) acertarHab(h, u, d, nv, dano, { semAtordoar: n > 1 && i > 0, centro: c });
    });
    if (d.visual === 'coluna') ultColuna(centro);
  } else if (T === 'zona') {
    const centro = d.centro === 'self' ? h.obj.position.clone() : m.manual ? m.ponto.clone() : (m.alvo && m.alvo.obj.position.distanceTo(h.obj.position) < d.alc + 1 ? m.alvo.obj.position.clone() : h.obj.position.clone().addScaledVector(m.dir, Math.min(d.alc || 6, 6)));
    if (d.armBuff) h.buffs.push({ tipo: 'arm', v: d.armBuff[0], t: d.armBuff[1] });
    if (d.ms) h.buffs.push({ tipo: 'ms', v: d.ms, t: d.msDur });
    const vis = objetoZona(d.visual, centro, d.raio); PZ.zonaIni(d, centro);
    let tick = 0;
    efeitos.push({ t: 0, vida: d.dur, up: (e, dt) => {
      const c = d.segue ? h.obj.position : centro; if (vis) vis.position.set(c.x, 0, c.z);
      if (!PZ.zona(d, c, d.raio, dt, e.t)) particulasZona(d.visual, c, d.raio, dt);
      tick -= dt; if (tick <= 0) { tick = .5;
        for (const u of inimigosEm(c, h.time, d.raio)) { danificar(h, u, (d.dps[nv - 1] * multRank(h, d, nv) + (d.k || 0) * (d.esc === 'ap' ? h.st.ap * K_AP : d.esc === 'adb' ? h.st.ad - h.st.adBase : h.st.ad)) * .5, { mag: d.mag, hab: true }); if (d.lento) aplicarLento(u, d.lento[0], d.lento[1]); }
        if (d.curaSeg && h.vivo && h.obj.position.distanceTo(c) < d.raio) curarU(h, (d.curaSeg[nv - 1] + .1 * h.st.ap) * .5, true);
        if (d.curaAliados) for (const u of unidades) if (u.vivo && u !== h && u.time === h.time && u.obj.position.distanceTo(c) < d.raio) { curarU(u, (d.curaSeg[nv - 1] * .6) * .5, false, h); if (Math.random() < .5) fx.emit(u.obj.position.x, 1.6, u.obj.position.z, { vel: [0, 2, 0], cor: [.6, 1, .6], vida: .6, t0: .4, t1: 0 }); }
        if (d.queima) for (const u of inimigosEm(c, h.time, d.raio)) { const q = u.dots.find(x => x.queima && x.fonte === h); if (q) q.t = d.queima[1]; else u.dots.push({ dps: d.dps[nv - 1] * d.queima[0], t: d.queima[1], fonte: h, mag: true, queima: true }); }
      }
      if (e.t >= e.vida) { if (vis) scene.remove(vis); return false; } return true; } });
  } else if (T === 'dash') {
    let dir = m.dir.clone(); let dist = d.dist;
    if (d.paraAlvo && m.alvo) { const dd = m.alvo.obj.position.distanceTo(h.obj.position); if (dd < d.dist + 2) dist = Math.max(1, dd - (d.blink ? -1.4 : 1)); }
    else if (h.ctrl.len > .2) dir = new THREE.Vector3(h.ctrl.x, 0, h.ctrl.y).normalize();
    h.obj.rotation.y = Math.atan2(dir.x, dir.z);
    const fim = () => { PZ.dashFim(h, d); if (!h.vivo) return; if (d.danoFim) { const c = h.obj.position.clone(); if (!PZ.area(d, c, d.raioFim, h, 0)) visualArea(d.visualFim || 'golpe', c, d.raioFim, cor, h); for (const u of inimigosEm(c, h.time, d.raioFim)) acertarHab(h, u, { ...d, dano: d.danoFim }, nv, valorHab(h, { ...d, dano: d.danoFim }, nv), { centro: c }); } if (d.proxAtaque) h.proxBonus = d.proxAtaque; if (d.blink && m.alvo) h.olharPara(m.alvo.obj.position, 1, 1); };
    if (d.blink) { const a = h.obj.position.clone(); h.obj.position.addScaledVector(dir, dist); limitar(h.obj.position); if (!PZ.blink(h, d, a, h.obj.position.clone())) for (const p of [a, h.obj.position]) { for (let j = 0; j < 20; j++) fx.emit(p.x, 1 + Math.random(), p.z, { vel: [(Math.random() - .5) * 5, (Math.random() - .5) * 5, (Math.random() - .5) * 5], cor: [.6, .3, .9], vida: .45, t0: .6, t1: 0 }); } fim(); }
    else h.dash = { dir, t: dist / d.vel, vel: d.vel, fim, d };
  } else if (T === 'buff') {
    const escC = h.mago ? h.st.ap : (h.st.ad - h.st.adBase);
    if (d.cura) curarU(h, d.cura[nv - 1] + (d.kCura || 0) * escC, true);
    if (d.escudo) darEscudo(h, d.escudo[nv - 1] + (d.kEscudoHp || 0) * h.maxHp, d.dur || 3);
    if (d.as) h.buffs.push({ tipo: 'as', v: d.as, t: d.asDur });
    if (d.ms) h.buffs.push({ tipo: 'ms', v: d.ms, t: d.msDur });
    if (d.invis) { h.invis = d.invis; h.buffs.push({ tipo: 'ms', v: 0, t: 0 }); for (const u of unidades) if (u.alvoU === h) u.alvoU = null; }
    if (d.proxAtaqueMag) h.proxMag = d.proxAtaqueMag[nv - 1] + .5 * h.st.ap;
    if (d.aliados) for (const u of unidades) if (u.vivo && u !== h && u.time === h.time && u.obj.position.distanceTo(h.obj.position) < d.aliados) { if (d.escudoAliados) darEscudo(u, d.escudoAliados[nv - 1] + .3 * h.st.ap, 3); if (d.cura) curarU(u, (d.cura[nv - 1] + (d.kCura || 0) * escC) * .5, false); }
    if (PZ.buff(d, h)) { aneis.add(h.obj.position, cor, .5, 2.6, .6, .15, .6); return true; }
    if (d.visual) visualBuff(d.visual, h, cor, d);
    for (let i = 0; i < 3; i++) agendar(i * .15, () => aneis.add(h.obj.position, cor, .5, 3.2, .7, .15));
    for (let j = 0; j < 40; j++) agendar(j * .02, () => { const a = j * .6, r = 1 + Math.random() * .4, p = h.obj.position; fx.emit(p.x + Math.cos(a) * r, .2 + Math.random() * .4, p.z + Math.sin(a) * r, { vel: [-Math.sin(a) * 1.5, 3 + Math.random() * 2, Math.cos(a) * 1.5], cor: [cor.r, cor.g, cor.b], vida: 1, t0: .5, t1: .1, drag: .8 }); });
  } else if (T === 'linha') {
    const o = h.obj.position.clone(); const dir = m.dir.clone(); const t = d.atraso || .3;
    avisoLinha(o, dir, d.comp, d.larg, cor, t); PZ.linhaIni(d, o, dir, h, t);
    if (d.visual === 'colunas') for (let i = 0; i < 5; i++) { const pp = o.clone().addScaledVector(dir, 1.6 + i * (d.comp - 1.6) / 4); pp.x += dir.z * (i % 2 ? .7 : -.7); pp.z -= dir.x * (i % 2 ? .7 : -.7); agendar(t - .3 + i * .05, () => pedraCaindo(pp, true)); }
    agendar(t, () => {
      if (!h.vivo) return;
      if (!PZ.linha(d, o, dir, d.comp, d.larg, h)) visualLinha(d.visual, o, dir, d.comp, d.larg, cor);
      for (const u of inimigosEmLinha(o, dir, d.comp, d.larg, h.time)) acertarHab(h, u, d, nv, dano, { centro: o });
      if (h === jogador) tremer(d.visual === 'colunas' ? .6 : .15);
    });
  } else if (T === 'invocar') {
    const f = frente(h); const lado = new THREE.Vector3(f.z, 0, -f.x);
    for (let i = 0; i < (d.n || 1); i++) {
      const p = h.obj.position.clone().addScaledVector(f, 1.4).addScaledVector(lado, i % 2 ? 1.5 : -1.5);
      const u = novoMinion(h.time, p.x, p.z, true); u.invocado = h; u.vidaT = d.dur; u.ouro = 0; u.xpV = 10; u.maxHp = u.hp = d.hp[nv - 1]; u.dano = d.danoInv[nv - 1]; u.nome = 'Guarda da Babilônia';
      u.obj.scale.multiplyScalar(1.08);
      const coroa = new THREE.Mesh(GEO_COROA, MAT_COROA); coroa.rotation.x = Math.PI / 2; coroa.position.y = .1; u.obj.add(coroa);
      if (!PZ.invocar(d, h, p)) { for (let j = 0; j < 26; j++) fx.emit(p.x + (Math.random() - .5), .2 + Math.random() * 2, p.z + (Math.random() - .5), { vel: [(Math.random() - .5) * 2, 3 + Math.random() * 3, (Math.random() - .5) * 2], cor: Math.random() > .4 ? [1, .6, .15] : [1, .9, .5], vida: .8, t0: .6, t1: 0 });
      aneis.add(p, cor, .3, 2, .6); }
    }
  } else if (T === 'salto') {
    const alvo = m.alvo; const a = h.obj.position.clone(); const b = alvo.obj.position.clone(); const dur = .5;
    h.travado = dur + .3; h.saltando = true;
    efeitos.push({ t: 0, vida: dur, up: (e) => { const k = Math.min(1, e.t / dur); h.obj.position.lerpVectors(a, b, k); h.obj.position.y = Math.sin(k * Math.PI) * 3.2; fx.emit(h.obj.position.x, h.obj.position.y + 1, h.obj.position.z, { cor: [1, .8, .4], vida: .4, t0: .8, t1: 0 });
      if (k >= 1) { h.obj.position.y = 0; h.saltando = false; tremer(.35); if (!PZ.salto(d, h, h.obj.position.clone())) { visualArea('golpe', h.obj.position.clone(), d.raio, cor, h); visualArea(d.visual || 'onda', h.obj.position.clone(), d.raio, cor, h); } for (const u of inimigosEm(h.obj.position, h.time, d.raio)) acertarHab(h, u, d, nv, dano, { centro: h.obj.position.clone() }); return false; } return true; } });
  } else if (T === 'marca') {
    const alvo = m.alvo; const mk = new THREE.Sprite(new THREE.SpriteMaterial({ map: texB, color: 0xb040ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); mk.scale.setScalar(2.2); scene.add(mk);
    textoInfo(alvo, 'Decreto!'); const mst = PZ.marcaIni(d, h, alvo) || null;
    efeitos.push({ t: 0, vida: d.atraso, up: (e) => { if (mst) PZ.marcaUp(mst, alvo, e); mk.position.copy(alvo.obj.position).setY(3.6 + Math.sin(e.t * 12) * .1); mk.material.opacity = .5 + .5 * Math.sin(e.t * 20); if (Math.random() < .5) fx.emit(alvo.obj.position.x + (Math.random() - .5) * 1.5, .3, alvo.obj.position.z + (Math.random() - .5) * 1.5, { vel: [0, 3, 0], cor: [.7, .3, 1], vida: .6, t0: .5, t1: 0 });
      if (e.t >= e.vida) { scene.remove(mk); if (!alvo.vivo && mst) PZ.marcaFim({ m: mst.m, so: true }, alvo); if (alvo.vivo) { if (!(mst && PZ.marcaFim(mst, alvo))) visualArea('trevas', alvo.obj.position.clone(), 2.4, new THREE.Color(.7, .3, 1), h); acertarHab(h, alvo, d, nv, valorHab(h, d, nv)); tremer(.3); } return false; } return true; } });
  }
  return true;
}

// ================= visuais das habilidades =================
function visualArea(tipo, c, r, cor, h) {
  const rgb = [cor.r, cor.g, cor.b];
  const burst = (n, s, cc = rgb, y = .5, vy = 3, vida = .6, grav = 0) => { for (let j = 0; j < n; j++) { const a = Math.random() * 6.28, sp = s * (.4 + Math.random() * .6); fx.emit(c.x + Math.cos(a) * .4, y, c.z + Math.sin(a) * .4, { vel: [Math.cos(a) * sp, vy * Math.random(), Math.sin(a) * sp], cor: cc, vida: vida + Math.random() * .3, t0: .5, t1: 0, drag: 2, grav }); } };
  switch (tipo) {
    case 'golpe': aneis.add(c, cor, .4, r, .35); burst(22, r * 3, rgb, 1, 3, .4); break;
    case 'onda': for (let i = 0; i < 3; i++) agendar(i * .1, () => aneis.add(c, cor, .5, r * (1 + i * .1), .5, .12)); burst(30, r * 3.5, rgb, .6, 2, .5); break;
    case 'fogo': aneis.add(c, new THREE.Color(1, .6, .2), .3, r, .45); burst(40, r * 3, [1, .6, .2], 1, 6, .6, 4); burst(16, r * 2, [1, .95, .6], 1.2, 5, .4); tremer(.12); break;
    case 'trevas': aneis.add(c, new THREE.Color(.5, .2, .8), .3, r, .6); for (let j = 0; j < 36; j++) fxD.emit(c.x + (Math.random() - .5) * r * 1.4, .4 + Math.random() * 1.6, c.z + (Math.random() - .5) * r * 1.4, { vel: [(Math.random() - .5) * 2, 1 + Math.random(), (Math.random() - .5) * 2], cor: [.08, .02, .12], vida: 1.4, t0: 1.2, t1: 2.6, alpha: .85 }); burst(14, r * 2, [.7, .3, 1], 1, 3, .5); break;
    case 'terremoto': tremer(.6); for (let i = 0; i < 4; i++) agendar(i * .12, () => aneis.add(c, new THREE.Color(.9, .6, .3), .6, r * (.5 + i * .18), .6, .12)); for (let j = 0; j < 50; j++) { const a = Math.random() * 6.28, d = Math.random() * r; fxD.emit(c.x + Math.cos(a) * d, .3, c.z + Math.sin(a) * d, { vel: [0, 2 + Math.random() * 3, 0], cor: [.45, .35, .25], vida: 1.2, t0: .8, t1: 2, alpha: .7 }); } burst(30, r * 2.5, [1, .6, .3], .5, 7, .6, 9); break;
    case 'colunas': tremer(.7); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28 + Math.random() * .4, d = r * (.4 + Math.random() * .5); pedraCaindo(new THREE.Vector3(c.x + Math.cos(a) * d, 0, c.z + Math.sin(a) * d)); } for (let i = 0; i < 3; i++) agendar(i * .1, () => aneis.add(c, new THREE.Color(1, .75, .4), .6, r * (1 + i * .08), .7, .15)); break;
    case 'estrelas': { const a = c.clone(); for (let j = 0; j < 16; j++) fx.emit(a.x + (Math.random() - .5) * 2, 10 + Math.random() * 4, a.z + (Math.random() - .5) * 2, { vel: [0, -26, 0], cor: [.8, .9, 1], vida: .4, t0: .6, t1: .2, drag: 0 }); agendar(.3, () => { aneis.add(a, new THREE.Color(.7, .85, 1), .4, r, .5, .15); burst(40, r * 3, [.8, .9, 1], .5, 6, .6, 6); tremer(.2); }); break; }
    case 'pragas': { const tipos = [[.8, .1, .1], [.4, .8, .3], [.9, .95, 1], [.3, .2, .1]]; const cc = tipos[Math.floor(Math.random() * tipos.length)]; for (let j = 0; j < 10; j++) fx.emit(c.x + (Math.random() - .5), 8 + Math.random() * 3, c.z + (Math.random() - .5), { vel: [0, -22, 0], cor: cc, vida: .4, t0: .5, t1: .2, drag: 0 }); agendar(.35, () => { aneis.add(c, new THREE.Color(...cc), .3, r, .4); burst(20, r * 2.5, cc, .5, 4, .5, 6); }); break; }
    case 'queixada': { const f = h ? frente(h) : new THREE.Vector3(1, 0, 0); const a0 = Math.atan2(f.z, f.x); for (let j = 0; j < 34; j++) { const a = a0 + (j / 33 - .5) * 2.2, rr = r * (.7 + Math.random() * .3); fx.emit(c.x + Math.cos(a) * rr * .5, 1.1, c.z + Math.sin(a) * rr * .5, { vel: [Math.cos(a) * 7, 1 + Math.random() * 2, Math.sin(a) * 7], cor: j % 3 ? [1, .92, .75] : [1, .7, .35], vida: .35, t0: .7, t1: 0, drag: 4 }); } aneis.add(c, new THREE.Color(1, .85, .6), .4, r, .35); burst(10, r * 2, [.6, .5, .38], .4, 2, .6); tremer(.15); break; }
    case 'pisao': tremer(.45); rachadura(c, r * 1.1, 2.2); for (let i = 0; i < 2; i++) agendar(i * .1, () => aneis.add(c, new THREE.Color(.85, .6, .35), .5, r * (1.05 + i * .15), .55, .12)); for (let j = 0; j < 40; j++) { const a = Math.random() * 6.28, d = Math.random() * r; fxD.emit(c.x + Math.cos(a) * d, .3, c.z + Math.sin(a) * d, { vel: [Math.cos(a) * 3, 1.5 + Math.random() * 3, Math.sin(a) * 3], cor: [.5, .4, .28], vida: 1.1, t0: .8, t1: 2, alpha: .8 }); } burst(18, r * 2, [.9, .65, .35], .4, 6, .5, 10); break;
    case 'poeira': tremer(.3); rachadura(c, r, 1.4); burst(26, r * 3, [1, .75, .4], .6, 7, .5, 10); for (let j = 0; j < 20; j++) fxD.emit(c.x + (Math.random() - .5) * r, .3, c.z + (Math.random() - .5) * r, { vel: [(Math.random() - .5) * 3, 2 + Math.random() * 2, (Math.random() - .5) * 3], cor: [.5, .42, .3], vida: 1, t0: .7, t1: 1.8, alpha: .75 }); break;
    case 'trombeta': for (let i = 0; i < 4; i++) agendar(i * .12, () => { aneis.add(c, new THREE.Color(1, .88, .35), .6, r * (.55 + i * .17), .55, 1.2 + i * .15, .9); aneis.add(c, new THREE.Color(1, .55, .15), .4, r * (.5 + i * .17), .45, .12, .7); }); for (let j = 0; j < 30; j++) { const a = j / 30 * 6.28; fx.emit(c.x + Math.cos(a) * .8, 1.4, c.z + Math.sin(a) * .8, { vel: [Math.cos(a) * r * 2.4, .3, Math.sin(a) * r * 2.4], cor: j % 2 ? [1, .9, .4] : [1, .6, .2], vida: .45, t0: .55, t1: .1, drag: 2 }); } tremer(.12); break;
    case 'encanto': for (let j = 0; j < 14; j++) fx.emit(c.x + (Math.random() - .5), 1.2 + Math.random(), c.z + (Math.random() - .5), { vel: [(Math.random() - .5) * 2, 2 + Math.random() * 2, (Math.random() - .5) * 2], cor: j % 2 ? [1, .4, .85] : [1, .75, .95], vida: .8, t0: .5, t1: .1, drag: 1.5 }); aneis.add(c, new THREE.Color(1, .35, .8), .3, r, .5); break;
    case 'golpeReal': { aneis.add(c, new THREE.Color(1, .8, .3), .4, r, .35); const f = h ? frente(h) : new THREE.Vector3(1, 0, 0); for (let j = 0; j < 24; j++) { const a = Math.atan2(f.z, f.x) + (Math.random() - .5) * 1.4; fx.emit(c.x, 1.1, c.z, { vel: [Math.cos(a) * 8, Math.random() * 3, Math.sin(a) * 8], cor: j % 3 ? [1, .8, .3] : [1, .5, .15], vida: .35, t0: .6, t1: 0, drag: 3 }); } break; }
    case 'desafio': for (let i = 0; i < 3; i++) agendar(i * .12, () => aneis.add(c, new THREE.Color(1, .3, .2), r * .3, r, .5, .12)); burst(24, r * 2, [1, .35, .2], 1.6, 2, .6); break;
    case 'coluna': break;
    default: aneis.add(c, cor, .3, r, .4); burst(20, r * 3, rgb, .8, 3, .5);
  }
}
// rachadura no chão (decal que some aos poucos)
let texRach = null; function texRachadura() { if (texRach) return texRach; const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d'); g.strokeStyle = 'rgba(20,12,6,.95)'; g.lineCap = 'round';
  for (let i = 0; i < 9; i++) { let x = 128, y = 128, a = i / 9 * 6.28 + Math.random() * .5; g.lineWidth = 7; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 7; k++) { a += (Math.random() - .5) * .9; x += Math.cos(a) * 16; y += Math.sin(a) * 16; g.lineTo(x, y); g.lineWidth = Math.max(1.5, 7 - k); } g.stroke(); }
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 60); gr.addColorStop(0, 'rgba(30,18,8,.6)'); gr.addColorStop(1, 'rgba(30,18,8,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  texRach = new THREE.CanvasTexture(cv); texRach.colorSpace = THREE.SRGBColorSpace; return texRach; }
const geoPlanoU = new THREE.PlaneGeometry(1, 1);
function rachadura(c, r, vida = 2) { const m = new THREE.Mesh(geoPlanoU, new THREE.MeshBasicMaterial({ map: texRachadura(), transparent: true, depthWrite: false, opacity: .9 })); m.scale.set(r * 2.2, r * 2.2, 1); m.rotation.x = -Math.PI / 2; m.rotation.z = Math.random() * 6; m.position.set(c.x, .09, c.z); m.renderOrder = 5; scene.add(m);
  efeitos.push({ t: 0, vida, up: (e) => { m.material.opacity = .9 * Math.min(1, (e.vida - e.t) / .6); if (e.t >= e.vida) { scene.remove(m); m.material.dispose(); return false; } return true; } }); }
// visuais das habilidades em linha
function visualLinha(tipo, o, dir, comp, larg, cor) {
  if (tipo === 'colunas') { tremer(.6); for (let i = 0; i < 4; i++) { const p = o.clone().addScaledVector(dir, comp * (.25 + i * .22)); rachadura(p, larg * .7, 2.4); } for (let j = 0; j < 60; j++) { const k = Math.random() * comp, sd = (Math.random() - .5) * larg; const x = o.x + dir.x * k + dir.z * sd, z = o.z + dir.z * k - dir.x * sd; fxD.emit(x, .4, z, { vel: [(Math.random() - .5) * 3, 2 + Math.random() * 3, (Math.random() - .5) * 3], cor: [.55, .48, .4], vida: 1.3, t0: .9, t1: 2.2, alpha: .8 }); if (j % 2) fx.emit(x, .6, z, { vel: [(Math.random() - .5) * 4, 3 + Math.random() * 5, (Math.random() - .5) * 4], cor: [1, .8, .5], vida: .6, t0: .5, t1: 0, grav: 9 }); } return; }
  if (tipo === 'estocada') { for (let j = 0; j < 46; j++) { const k = j / 45 * comp; fx.emit(o.x + dir.x * k, 1.2, o.z + dir.z * k, { vel: [dir.x * 6 + (Math.random() - .5), Math.random(), dir.z * 6 + (Math.random() - .5)], cor: j % 3 ? [1, .72, .35] : [1, .95, .7], vida: .3 + j / 45 * .2, t0: .55, t1: .05, drag: 3 }); } const fim = o.clone().addScaledVector(dir, comp); aneis.add(fim, new THREE.Color(1, .7, .35), .2, 1.4, .35); return; }
  for (let j = 0; j < 30; j++) { const k = Math.random() * comp; fx.emit(o.x + dir.x * k, 1, o.z + dir.z * k, { vel: [0, 2, 0], cor: [cor.r, cor.g, cor.b], vida: .5, t0: .5, t1: 0 }); }
}
// visuais de buffs (cada herói com forma própria)
function visualBuff(tipo, h, cor, d) {
  const p = h.obj.position;
  if (tipo === 'harpa') { for (let j = 0; j < 18; j++) agendar(j * .06, () => { const a = j * .9; fx.emit(p.x + Math.cos(a) * 1.3, 2 + Math.sin(j) * .5, p.z + Math.sin(a) * 1.3, { vel: [0, 1.4, 0], cor: j % 2 ? [1, .9, .5] : [.8, 1, .7], vida: 1.1, t0: .45, t1: .15, drag: .5 }); }); }
  else if (tipo === 'leao') { tremer(.1); for (let i = 0; i < 3; i++) agendar(i * .09, () => aneis.add(p, new THREE.Color(1, .55, .15), .8, 3 + i * .5, .45, 1.2, .9)); for (let j = 0; j < 30; j++) { const a = Math.random() * 6.28; fx.emit(p.x, 1.6, p.z, { vel: [Math.cos(a) * 7, (Math.random() - .3) * 3, Math.sin(a) * 7], cor: [1, .6, .2], vida: .4, t0: .6, t1: 0, drag: 3 }); } }
  else if (tipo === 'velo') { for (let j = 0; j < 30; j++) fx.emit(p.x + (Math.random() - .5) * 2, 4 + Math.random() * 2, p.z + (Math.random() - .5) * 2, { vel: [0, -3, 0], cor: [.8, .95, 1], vida: 1.2, t0: .3, t1: .15, drag: 0 }); }
  else if (tipo === 'cantico') { const r = (d && d.aliados) || 6; for (let i = 0; i < 3; i++) agendar(i * .2, () => aneis.add(p, new THREE.Color(.5, .95, 1), .5, r, .8, .12, .8)); for (const u of unidades) if (u.vivo && u !== h && u.time === h.time && u.obj.position.distanceTo(p) < r) aneis.add(u.obj.position, new THREE.Color(.55, .95, 1), .3, 1.4, .6); }
}
// rastros dos projéteis de habilidade
function trilhaHab(d, p) {
  if (d.visual === 'serpente') { const t = performance.now() * .02; fx.emit(p.x + Math.sin(t) * .35, p.y - .2, p.z + Math.cos(t) * .35, { vel: [0, .2, 0], cor: [.3, 1, .35], vida: .6, t0: .6, t1: .1, alpha: .8 }); }
  else if (d.visual === 'encanto') { fx.emit(p.x + (Math.random() - .5) * .6, p.y + (Math.random() - .5) * .6, p.z + (Math.random() - .5) * .6, { vel: [0, .8, 0], cor: Math.random() > .5 ? [1, .4, .85] : [1, .8, .95], vida: .5, t0: .7, t1: 0 }); }
  else if (d.icone === 'funda') fx.emit(p.x, p.y, p.z, { cor: [1, .95, .7], vida: .25, t0: .9, t1: 0 });
}
let geoBloco = new THREE.BoxGeometry(1.1, 2.6, 1.1), matBloco = new THREE.MeshStandardMaterial({ map: null, color: 0xd9d2c4, roughness: .5 });
// com os props do Tripo, as colunas que desabam (Sansão R) usam a coluna de pedra pintada do mapa em vez de caixas brancas
function colunaDoTemplo(cena) { let m = null; cena.updateMatrixWorld(true); cena.traverse(o => { if (o.isMesh && !m) m = o; }); if (!m) return; const g = m.geometry.clone(); g.applyMatrix4(m.matrixWorld); g.computeBoundingBox(); const b = g.boundingBox, c = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3()); g.translate(-c.x, -c.y, -c.z); g.scale(1.3 / Math.max(sz.x, sz.z), 3 / sz.y, 1.3 / Math.max(sz.x, sz.z)); geoBloco = g; matBloco = m.material; }
function pedraCaindo(p, grande = false) {
  const m = new THREE.Mesh(geoBloco, matBloco); if (grande) m.scale.set(1.25, 1.5, 1.25); m.position.set(p.x, 12, p.z); m.rotation.set(Math.random(), Math.random(), Math.random()); m.castShadow = !Q.mobile; scene.add(m);
  efeitos.push({ t: 0, vida: 1.4, up: (e, dt) => { if (m.position.y > 1) { m.position.y -= dt * 30; m.rotation.x += dt * 3; if (m.position.y <= 1) { for (let j = 0; j < 12; j++) fxD.emit(p.x, .5, p.z, { vel: [(Math.random() - .5) * 5, 2 + Math.random() * 2, (Math.random() - .5) * 5], cor: [.5, .45, .4], vida: 1, t0: .8, t1: 1.8, alpha: .8 }); } } else m.position.y -= dt * .8; if (e.t >= e.vida) { scene.remove(m); return false; } return true; } });
}
function ultColuna(ponto) {
  const col = colunaLuz(scene, ponto, tempoU);
  const luz = luzUlt; luz.position.copy(ponto).setY(3); luzUltN++; ultAtivaT = tempoU.value + 2.5;
  efeitos.push({ t: 0, vida: 2.2, up: (e) => {
    const k = e.t / e.vida; col.material.uniforms.uK.value = Math.min(1, Math.max(0, (e.t - .78) / .6));
    luz.intensity = e.t < .8 ? e.t * 60 : Math.max(0, 48 - (e.t - .8) * 40);
    if (e.t < .8) for (let j = 0; j < 4; j++) { const a = Math.random() * 6.28, r = Math.random() * 4.4; fx.emit(ponto.x + Math.cos(a) * r, 8 + Math.random() * 6, ponto.z + Math.sin(a) * r, { vel: [0, -18, 0], cor: [1, .75, .35], vida: .5, t0: .4, t1: .15, drag: 0, alpha: .8 }); }
    if (!e.bateu && e.t > .75) { e.bateu = true; tremer(.5); for (let i = 0; i < 3; i++) agendar(i * .1, () => aneis.add(ponto, new THREE.Color(1, .8, .4), .5, 6 + i, .7, .15)); for (let j = 0; j < 70; j++) { const a = Math.random() * 6.28, s = 5 + Math.random() * 10; fx.emit(ponto.x + Math.cos(a) * .8, .4, ponto.z + Math.sin(a) * .8, { vel: [Math.cos(a) * s, 1.5 + Math.random() * 5, Math.sin(a) * s], cor: Math.random() > .25 ? [1, .6, .18] : [1, .9, .6], vida: .8 + Math.random() * .5, t0: .4, t1: 0, grav: 9, drag: 1.6 }); } }
    if (k >= 1) { scene.remove(col); col.material.dispose(); if (--luzUltN <= 0) { luz.intensity = 0; luz.position.y = -50; } return false; } return true;
  } });
}
const GEO_COROA = new THREE.TorusGeometry(.55, .09, 6, 16), MAT_COROA = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, .72, .25).multiplyScalar(2) });
const GEO_EST = { pe: new THREE.BoxGeometry(1.4, .6, 1.4), co: new THREE.CylinderGeometry(.35, .55, 3.2, 10), ca: new THREE.SphereGeometry(.4, 12, 8), co2: new THREE.CylinderGeometry(.35, .3, .4, 10) };
const GEO_ZONA = new Map(); function geoZona(r) { let g = GEO_ZONA.get(r); if (!g) { g = { anel: new THREE.RingGeometry(r * .92, r, 48), disco: new THREE.CircleGeometry(r, 48) }; GEO_ZONA.set(r, g); } return g; }
let ultAtivaT = -1;
const matOuroZ = new THREE.MeshStandardMaterial({ color: 0xffc857, metalness: 1, roughness: .3, emissive: 0x442200 });
let PALMA = null;
function prepararPalma() { if (PALMA) return; const fs = []; for (let i = 0; i < 7; i++) { const f = new THREE.ConeGeometry(.25, 2, 4); const a = i / 7 * 6.28; f.scale(1, 1, .3); f.rotateX(Math.sin(a) * 1.2); f.rotateZ(-Math.cos(a) * 1.2); f.translate(Math.cos(a) * .8, 3.1, Math.sin(a) * .8); fs.push(f.index ? f.toNonIndexed() : f); }
  const n = fs.reduce((t, f) => t + f.attributes.position.array.length, 0), pos = new Float32Array(n); let o = 0; for (const f of fs) { pos.set(f.attributes.position.array, o); o += f.attributes.position.array.length; } const copa = new THREE.BufferGeometry(); copa.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  PALMA = { tronco: new THREE.CylinderGeometry(.12, .2, 3.2, 8), copa, mT: new THREE.MeshStandardMaterial({ color: 0x8a5a2a, roughness: .8 }), mF: new THREE.MeshStandardMaterial({ color: 0x4f9a3a, roughness: .7, emissive: 0x123a10 }) }; }
function objetoZona(tipo, c, r) {
  const g = new THREE.Group(); g.position.set(c.x, 0, c.z);
  const cor = { palmeira: 0x7ad060, gafanhotos: 0xa0c040, estatua: 0xffc857, fornalha: 0xff6a20 }[tipo] || 0xffffff;
  const disco = new THREE.Mesh(geoZona(r).anel, new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending })); disco.rotation.x = -Math.PI / 2; disco.position.y = .08; g.add(disco);
  const fundo = new THREE.Mesh(geoZona(r).disco, new THREE.MeshBasicMaterial({ map: texB, color: cor, transparent: true, opacity: .35, depthWrite: false, blending: THREE.AdditiveBlending })); fundo.rotation.x = -Math.PI / 2; fundo.position.y = .07; g.add(fundo);
  if (tipo === 'palmeira') { // tronco + copa (7 folhas fundidas numa malha só): 2 draw calls, geometria criada uma vez
    prepararPalma();
    const tr = new THREE.Mesh(PALMA.tronco, PALMA.mT); tr.position.y = 1.6; tr.rotation.z = .08; g.add(tr); g.add(new THREE.Mesh(PALMA.copa, PALMA.mF));
  }
  if (tipo === 'estatua') {
    const s = new THREE.Group(); const pe = new THREE.Mesh(GEO_EST.pe, matOuroZ); pe.position.y = .3; s.add(pe);
    const co = new THREE.Mesh(GEO_EST.co, matOuroZ); co.position.y = 2.2; s.add(co);
    const ca = new THREE.Mesh(GEO_EST.ca, matOuroZ); ca.position.y = 4.05; s.add(ca);
    const co2 = new THREE.Mesh(GEO_EST.co2, matOuroZ); co2.position.y = 4.55; s.add(co2);
    s.traverse(o => { if (o.isMesh) o.castShadow = true; }); g.add(s); s.position.y = -4.6; g.userData.sobe = s;
    efeitos.push({ t: 0, vida: .6, up: (e) => { s.position.y = -4.6 * (1 - Math.min(1, e.t / .5)); return e.t < e.vida; } });
  }
  scene.add(g); return g;
}
function particulasZona(tipo, c, r, dt) {
  const n = Math.random() < dt * 30 ? 1 : 0; if (!n) return;
  const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * r;
  const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
  if (tipo === 'gafanhotos') { for (let j = 0; j < 3; j++) fx.emit(x, .6 + Math.random() * 1.6, z, { vel: [(Math.random() - .5) * 6, (Math.random() - .5) * 2, (Math.random() - .5) * 6], cor: [.55, .7, .2], vida: .5, t0: .25, t1: .2, drag: 0 }); }
  else if (tipo === 'fornalha') { const aa = Math.random() * 6.28; fx.emit(c.x + Math.cos(aa) * r, .3, c.z + Math.sin(aa) * r, { vel: [0, 4 + Math.random() * 3, 0], cor: Math.random() > .3 ? [1, .45, .1] : [1, .85, .4], vida: .7, t0: .9, t1: 0 }); fx.emit(c.x + Math.cos(aa + 3) * r * .95, .3, c.z + Math.sin(aa + 3) * r * .95, { vel: [0, 3, 0], cor: [1, .35, .05], vida: .6, t0: .8, t1: 0 }); }
  else if (tipo === 'palmeira') fx.emit(x, .2, z, { vel: [0, 2.5, 0], cor: [.6, 1, .6], vida: .8, t0: .35, t1: 0 });
  else if (tipo === 'estatua') fx.emit(x, .2, z, { vel: [0, 1.5, 0], cor: [1, .8, .35], vida: .8, t0: .3, t1: 0 });
}

// ================= feitiços e recuo =================
const FEIT = { curar: 90, clarao: 120 };
function curar(h) { if (!h.vivo || h.feit.curar > 0) return; h.feit.curar = FEIT.curar; curarU(h, 90 + 15 * h.nivel + h.maxHp * .1, true); h.buffs.push({ tipo: 'ms', v: .3, t: 1 }); aneis.add(h.obj.position, new THREE.Color(.5, 1, .6), .5, 2.5, .6); for (let k = 0; k < 30; k++) fx.emit(h.obj.position.x + (Math.random() - .5) * 2, .3, h.obj.position.z + (Math.random() - .5) * 2, { vel: [0, 3 + Math.random() * 2, 0], cor: [.5, 1, .6], vida: .9, t0: .4, t1: 0 }); }
function clarao(h, dirF) { if (!h.vivo || h.feit.clarao > 0 || h.atord > 0) return; h.feit.clarao = FEIT.clarao; const dir = dirF || (h.ctrl.len > .1 ? new THREE.Vector3(h.ctrl.x, 0, h.ctrl.y).normalize() : frente(h)); const a = h.obj.position.clone(); h.obj.position.addScaledVector(dir, 5); limitar(h.obj.position); h.canal = null; for (const p of [a, h.obj.position]) { for (let k = 0; k < 24; k++) fx.emit(p.x, 1 + Math.random(), p.z, { vel: [(Math.random() - .5) * 6, (Math.random() - .5) * 6, (Math.random() - .5) * 6], cor: [1, .95, .6], vida: .4, t0: .5, t1: 0 }); aneis.add(p, new THREE.Color(1, .95, .6), .2, 1.8, .4); } }
function recuar(h) { if (!h.vivo || h.canal || estado.fim) return; h.canal = { tipo: 'recuo', t: 0, dur: 4 }; if (h === jogador) aviso('Recuando para a base…'); }

// ================= agendamentos / efeitos =================
const agenda = []; const efeitos = [];
function agendar(t, f) { agenda.push({ t, f }); }
let shake = 0; function tremer(v) { if (CFG.tremor) shake = Math.max(shake, v); }
let avisoT = 0; const avisoEl = document.getElementById('aviso');
function aviso(txt, mal = false) { avisoEl.textContent = txt; avisoEl.className = 'on' + (mal ? ' mal' : ''); avisoT = 1.8; }

// ================= inteligência do bot (herói inimigo) =================
function mover2(h, alvo) {
  if (SELVA_ON) alvo = desvioCova(h.obj.position, alvo);
  const p = h.obj.position; let dx = alvo.x - p.x, dz = alvo.z - p.z; const L = Math.hypot(dx, dz); if (L < .4) { h.ctrl.len = 0; return; } dx /= L; dz /= L;
  // desvia de estruturas no caminho (Núcleo, torres) em vez de travar nelas
  for (const e of estruturas) {
    if (!e.vivo) continue; const vx = e.obj.position.x - p.x, vz = e.obj.position.z - p.z; const ao = vx * dx + vz * dz;
    if (ao <= 0 || ao > Math.min(L, 7)) continue; const R = e.raio * .85 + h.raio * .5 + .7; const px = vx - ao * dx, pz = vz - ao * dz; const pd = Math.hypot(px, pz);
    if (pd < R) { let sx = -px, sz = -pz; if (pd < .05) { sx = -dz; sz = dx; } const sl = Math.hypot(sx, sz) || 1; const k = (R - pd) / R * 2.2; dx += sx / sl * k; dz += sz / sl * k; const n = Math.hypot(dx, dz); dx /= n; dz /= n; }
  }
  h.ctrl.x = dx; h.ctrl.y = dz; h.ctrl.len = 1;
}
// próxima peça comprável da build (componente ou o item inteiro, o que vier primeiro)
function proximaPeca(h) {
  for (const id of h.def.build) {
    if (h.itens.includes(id)) continue; const it = ITENS[id]; const { custo } = custoEfetivo(id, h.itens);
    if (!it.receita) return custo; const faltam = it.receita.filter((c, i) => it.receita.slice(0, i + 1).filter(x => x === c).length > h.itens.filter(x => x === c).length);
    return faltam.length ? Math.min(custo, ...faltam.map(c => ITENS[c].custo)) : custo;
  }
  return 1e9;
}
// dano estimado de um combo (habilidades prontas + ~3 s de ataques)
function danoCombo(h, alvo) {
  let d = 0, dr = 0; const resist = (m) => 100 / (100 + Math.max(0, m ? rmag(alvo) : arm(alvo)));
  for (const k of ['q', 'w', 'e', 'r']) { const H = h.hab[k], dh = h.def.hab[k]; if (!H.nv || H.cd > 0 || h.mana < dh.mana[H.nv - 1] || !dh.dano) continue; const v = mitigar(h, alvo, valorHab(h, dh, H.nv), { mag: dh.mag, hab: true }) * (dh.dur && dh.tipo === 'zona' ? .6 : 1); d += v; if (k === 'r') dr = v; }
  d += mitigar(h, alvo, h.st.ad, { ataque: true }) * (1 + h.st.crit * .75) * (3 / intervaloAtaque(h));
  return { total: d, r: dr };
}
function avaliarLuta(h, inim, inimSobTorre, hpF, inimHp) {
  const meu = danoCombo(h, inim), dele = danoCombo(inim, h);
  // quantos "combos" cada um aguenta: < 1 = morre na troca
  const aguento = h.hp / Math.max(1, dele.total), aguenta = inim.hp / Math.max(1, meu.total);
  let score = (aguento - aguenta) * .35 + (hpF - inimHp) * .6 + (h.nivel - inim.nivel) * .08;
  const rProntoMeu = h.hab.r.nv && h.hab.r.cd <= 0, rProntoDele = inim.hab.r.nv && inim.hab.r.cd <= 0;
  score += (rProntoMeu ? .12 : 0) - (rProntoDele ? .12 : 0);
  if (inimSobTorre) score -= .45;
  const tMinha = estruturas.some(e => e.vivo && e.tipo === 'torre' && e.time === h.time && e.obj.position.distanceTo(h.obj.position) < e.alcance);
  if (tMinha) score += .3;
  const abate = meu.total >= inim.hp * DIF.abate && aguento > .7 && (!inimSobTorre || inim.hp < meu.total * .5);
  return { score, abate, danoR: meu.r };
}
function proximaCompra(h) { for (const id of h.def.build) { if (h.itens.includes(id)) continue; return custoEfetivo(id, h.itens).custo; } return 1e9; }
function comprarBuild(h) {
  for (const id of h.def.build) {
    if (h.itens.includes(id)) continue;
    const it = ITENS[id];
    // compra componente a componente (como um jogador faria)
    if (it.receita) { const { custo } = custoEfetivo(id, h.itens); if (h.ouro >= custo) { comprar(h, id); continue; } for (const c of it.receita) { const falta = it.receita.filter(x => x === c).length - h.itens.filter(x => x === c).length; if (falta > 0 && h.ouro >= ITENS[c].custo && h.itens.length < 6) { comprar(h, c); } } }
    else if (h.ouro >= it.custo) comprar(h, id);
    break;
  }
}
function estruturaInimigaProxima(h, raio) { let best = null, bd = raio; for (const e of estruturas) { if (!e.vivo || e.time === h.time || e.tipo !== 'torre') continue; const d = e.obj.position.distanceTo(h.obj.position); if (d < bd) { bd = d; best = e; } } return best; }
function pensar(h, dt) {
  const c = h.ctrl; c.x = c.y = c.len = 0; h.forcarAlvo = null;
  if (!h.vivo) { comprarBuild(h); return; }
  const pos = h.obj.position; const s = h.time === 'luz' ? 1 : -1; const hpF = h.hp / h.maxHp;
  if (h.pontos > 0) autoPontos(h);
  if (naFonte(h)) { comprarBuild(h); h.recuando = false; if (hpF < .92 || h.mana < h.manaMax * .5) { if (h.obj.position.distanceTo(FONTE[h.time]) > 5) mover2(h, FONTE[h.time]); return; } }
  if (h.canal) return;
  const inim = heroiInimigoProximo(h, 13);
  const dInim = inim ? inim.obj.position.distanceTo(pos) : 99;
  // recuar com pouca vida
  if ((hpF < .3 && !(inim && dInim < 8 && avaliarLuta(h, inim, false, hpF, inim.hp / inim.maxHp).abate)) || h.recuando) {
    h.recuando = true;
    if (hpF < .25 && h.feit.curar <= 0) curar(h);
    if (inim && dInim < 4 && hpF < .18 && h.feit.clarao <= 0) clarao(h, FONTE[h.time].clone().sub(pos).setY(0).normalize());
    if (dInim > 11 && h.combateT > 2.5 && !naFonte(h, 20)) { recuar(h); return; }
    mover2(h, FONTE[h.time]); return;
  }
  // voltar para comprar quando houver ouro sobrando e ninguém por perto
  const pc = proximaPeca(h);
  if (!naFonte(h, 20) && h.combateT > 3 && ((dInim > 10 && (h.ouro >= pc + DIF.margem || (h.ouro >= pc && hpF < .55))) || (dInim > 7 && h.ouro >= pc + 900))) { h.recuando = true; recuar(h); return; }
  // frente da tropa aliada
  const torresMinhas = estruturas.filter(e => e.time === h.time && e.vivo && e.tipo !== 'nucleo');
  let frenteX = torresMinhas.length ? torresMinhas.reduce((a, e) => s * e.obj.position.x > s * a ? e.obj.position.x : a, -s * 99) : NUCLEO[h.time].x;
  let nAliados = 0;
  for (const u of unidades) if (u.vivo && u.tipo === 'minion' && u.time === h.time) { nAliados++; if (s * (u.obj.position.x - frenteX) > 0) frenteX = u.obj.position.x; }
  // perigo de torre inimiga
  const torre = estruturaInimigaProxima(h, 14);
  let tanqueTorre = 0; if (torre) for (const u of unidades) if (u.vivo && u.tipo === 'minion' && u.time === h.time && u.obj.position.distanceTo(torre.obj.position) < torre.alcance) tanqueTorre++;
  const naTorre = torre && pos.distanceTo(torre.obj.position) < torre.alcance + 1.2;
  const inimHp = inim ? inim.hp / inim.maxHp : 1;
  const inimSobTorre = inim && estruturas.some(e => e.vivo && e.tipo === 'torre' && e.time !== h.time && e.obj.position.distanceTo(inim.obj.position) < e.alcance);
  // pressão: herói inimigo morto (ou fraco e longe) → empurra a rota em vez de ficar parado no meio
  const adv = herois.find(x => x.time !== h.time); const pressao = adv && (!adv.vivo || (adv.hp / adv.maxHp < .35 && dInim > 12)) && hpF > .45;
  if (naTorre && (tanqueTorre === 0 || torre.alvoAnt === h) && !(inim && inimHp < .15)) { mover2(h, pos.clone().add(new THREE.Vector3(-s * 6, 0, 0)).setZ(laneZ(pos.x - s * 6))); return; }
  // lutar contra o herói: placar de luta (vida, nível, habilidades prontas, torre) e chance de abate
  if (inim && (dInim < 10 || (dInim < 13 && inim.hp < inim.maxHp * .3))) {
    const L = avaliarLuta(h, inim, inimSobTorre, hpF, inimHp);
    // Gideão: com o inimigo amedrontado pela Trombeta, parte para cima (é a janela de abate dele)
    const favoravel = (L.score > DIF.limiar && (!inimSobTorre || L.abate)) || (h.id === 'gideao' && inim && inim.medo && hpF > .35 && !inimSobTorre);
    if (favoravel || L.abate) {
      h.lutaT = (h.lutaT || 0) + dt;
      const reage = Math.random() < dt * DIF.reflexo;
      for (const k of ['r', 'e', 'w', 'q']) {
        const H = h.hab[k], d = h.def.hab[k]; if (!H.nv || H.cd > 0 || h.mana < d.mana[H.nv - 1]) continue;
        if (k === 'r' && !(L.abate || L.danoR >= inim.hp * .55 || hpF < .35 || (d.tipo === 'buff' || d.tipo === 'invocar'))) continue;
        if (!reage && k !== 'r') continue;
        const alc = d.alc || d.comp || (d.centro === 'frente' ? (d.dist || 2) + d.raio * .8 : 0) || d.raio || d.dist || 6;
        if (d.tipo === 'dash' && dInim < h.alcance * .8 && h.def.distancia) continue;
        if (d.tipo === 'buff' || d.tipo === 'invocar' ? (hpF < .8 || dInim < 5) : dInim < alc + (d.centro === 'self' ? 0 : .5)) { if (usarHab(h, k)) break; }
      }
      if (hpF < .25 && h.feit.curar <= 0) curar(h);
      if (L.abate && dInim > h.alcance + 1.5 && dInim < 7 && h.feit.clarao <= 0 && DIF.clarao) clarao(h, inim.obj.position.clone().sub(pos).setY(0).normalize());
      h.forcarAlvo = inim;
      if (dInim > h.alcance + inim.raio) mover2(h, inim.obj.position); else atacar(h);
      return;
    }
    h.lutaT = 0;
    // cutucar (poke) à distância com habilidades de dano quando sobra mana
    for (const k of ['q', 'w', 'e']) { const H = h.hab[k], d = h.def.hab[k]; if (!H.nv || H.cd > 0 || !['proj', 'linha', 'area', 'zona'].includes(d.tipo) || h.mana < h.manaMax * .45) continue; const alc = d.alc || d.comp || 6; if (dInim < alc && dInim > 3.5 && !inimSobTorre && Math.random() < dt * DIF.poke) { usarHab(h, k); break; } }
    if (dInim < 5.5 && L.score < DIF.limiar - .15) { mover2(h, pos.clone().add(new THREE.Vector3(-s * 4, 0, 0))); return; }
  }
  // estrutura primeiro quando as tropas aliadas estão tanqueando a torre (empurra a rota como um jogador faria)
  if (torre && tanqueTorre >= (pressao ? 1 : 2) && !protegida(torre) && hpF > .45 && !(inim && dInim < 7)) { const d = torre.obj.position.distanceTo(pos); h.forcarAlvo = torre; if (d > h.alcance + torre.raio) mover2(h, torre.obj.position); else atacar(h); return; }
  { const nuc = estruturas.find(e => e.vivo && e.tipo === 'nucleo' && e.time !== h.time && !protegida(e)); if (nuc && nuc.obj.position.distanceTo(pos) < 14 && hpF > .4 && !(inim && dInim < 6)) { h.forcarAlvo = nuc; if (nuc.obj.position.distanceTo(pos) > h.alcance + nuc.raio) mover2(h, nuc.obj.position); else atacar(h); return; } }
  if (SELVA_ON) { botUsarOlho(h); if (botSelva(h, dt, { hpF, inim, dInim })) return; }
  // farmar: tropa inimiga com menos vida por perto
  let alvo = null, melhor = 1e9;
  for (const u of unidades) { if (!u.vivo || u.time === h.time || u.tipo !== 'minion') continue; const d = u.obj.position.distanceTo(pos); if (d > 10) continue; if (torre && u.obj.position.distanceTo(torre.obj.position) < torre.alcance && tanqueTorre === 0) continue; const sc = u.hp + d * 25; if (sc < melhor) { melhor = sc; alvo = u; } }
  if (alvo) {
    // habilidade em grupo de tropas
    const qq = h.hab.q, dq = h.def.hab.q; if (qq.nv && qq.cd <= 0 && h.mana > h.manaMax * .65 && dq.tipo !== 'buff' && inimigosEm(alvo.obj.position, h.time, 3).length >= 3 && Math.random() < dt) usarHab(h, 'q');
    if (pressao) for (const k of ['q', 'w', 'e']) { const H = h.hab[k], d = h.def.hab[k]; if (H.nv && H.cd <= 0 && h.mana > h.manaMax * .3 && ['proj', 'linha', 'area', 'zona'].includes(d.tipo) && inimigosEm(alvo.obj.position, h.time, 3).length >= 2 && Math.random() < dt * 2) { usarHab(h, k); break; } }
    h.forcarAlvo = alvo;
    const d = alvo.obj.position.distanceTo(pos);
    if (d > h.alcance + alvo.raio) mover2(h, alvo.obj.position); else atacar(h);
    return;
  }
  // derrubar estrutura quando as tropas aliadas estiverem tanqueando
  for (const e of estruturas) { if (!e.vivo || e.time === h.time || protegida(e)) continue; const d = e.obj.position.distanceTo(pos); if (d < 16 && (tanqueTorre > 0 || e.tipo === 'nucleo' || !estruturas.some(t => t.vivo && t.time !== h.time && t.tipo === 'torre' && t.obj.position.distanceTo(pos) < t.alcance + 1))) { h.forcarAlvo = e; if (d > h.alcance + e.raio) mover2(h, e.obj.position); else atacar(h); return; } }
  // posição: logo atrás da tropa aliada
  const alvoX = THREE.MathUtils.clamp(frenteX - s * (h.def.distancia ? 4 : 2.5), -56, 56);
  const p = new THREE.Vector3(alvoX, 0, laneZ(alvoX) + (h.def.distancia ? -1 : 1));
  if (nAliados === 0 && torresMinhas.length) { const t = torresMinhas.reduce((a, e) => s * e.obj.position.x > s * a.obj.position.x ? e : a); p.set(t.obj.position.x - s * 2, 0, laneZ(t.obj.position.x)); }
  mover2(h, p);
}

// ================= simulação =================
function limitar(p) { if (MAPA_WR) { p.x = THREE.MathUtils.clamp(p.x, LANE.x0 + 3.5, LANE.x1 - 3.5); const lim = MAPA_C + MAPA_FOLGA - Math.abs(p.x - 1); if (Math.abs(p.z) > lim) p.z = Math.sign(p.z) * Math.max(0, lim); empurrarCova(p); return; } p.x = THREE.MathUtils.clamp(p.x, LANE.x0 + 3.5, LANE.x1 - 3.5); const zc = laneZ(p.x); const L = SELVA_ON && Math.abs(p.x - 1) < 54 ? SELVA_LARG : LANE.largura + 3.5; p.z = THREE.MathUtils.clamp(p.z, zc - L, zc + (SELVA_ON && L === SELVA_LARG ? SELVA_SUL : L)); if (SELVA_ON) empurrarCova(p); }
function atualizarStatus(u, dt) {
  if (u.lentoT > 0) { u.lentoT -= dt; if (u.lentoT <= 0) u.lento = 0; }
  if (u.atord > 0) u.atord -= dt;
  if (u.vooT > 0) { u.vooT -= dt; const k = 1 - Math.max(0, u.vooT) / u.voo; u.obj.position.y = Math.sin(Math.min(1, k * 1.15) * Math.PI) * u.vooH; if (u.vooT <= 0) { u.obj.position.y = 0; if (u.tipo === 'heroi') aneis.add(u.obj.position, new THREE.Color(.8, .65, .45), .2, 1.4, .35); } }
  if (u.empurrao) { const e = u.empurrao; const st = Math.min(dt, e.t); u.obj.position.addScaledVector(e.dir, e.v * st); limitar(u.obj.position); e.t -= dt; if (Math.random() < .6) fxD.emit(u.obj.position.x, .2, u.obj.position.z, { vel: [0, .8, 0], cor: [.55, .45, .32], vida: .6, t0: .6, t1: 1.3, alpha: .6 }); if (e.t <= 0) u.empurrao = null; }
  if (u.medo) { u.medo.t -= dt; if (u.medo.t <= 0) u.medo = null; }
  if (u.encanto) { u.encanto.t -= dt; if (u.encanto.t <= 0 || !u.encanto.por.vivo) u.encanto = null; }
  if (u.raiz > 0) { u.raiz -= dt; if (Math.random() < dt * 10) fxD.emit(u.obj.position.x + (Math.random() - .5) * 1.2, .2, u.obj.position.z + (Math.random() - .5) * 1.2, { vel: [0, .5, 0], cor: [.12, .04, .2], vida: .7, t0: .5, t1: 1, alpha: .8 }); }
  if (u.invis > 0) u.invis -= dt;
  if (u.provoc) { u.provoc.t -= dt; if (u.provoc.t <= 0 || !u.provoc.por.vivo) u.provoc = null; }
  for (const e of u.escudos) e.t -= dt; if (u.escudos.length) u.escudos = u.escudos.filter(e => e.t > 0 && e.v > 0);
  for (const b of u.buffs) b.t -= dt; if (u.buffs.length) u.buffs = u.buffs.filter(b => b.t > 0);
  for (const d of u.dots) { d.t -= dt; d.acc = (d.acc || 0) + dt; if (d.acc >= .5) { d.acc = 0; danificar(d.fonte, u, d.dps * .5, { mag: d.mag }); } } if (u.dots.length) u.dots = u.dots.filter(d => d.t > 0);
  u.combateT += dt;
}
function atualizarHeroi(h, dt) {
  if (!h.vivo) { h.morteT -= dt; if (h.morteT <= 0 && !estado.fim) renascer(h); return; }
  atualizarStatus(h, dt); if (!h.vivo) return;
  for (const k of ['q', 'w', 'e', 'r']) h.hab[k].cd = Math.max(0, h.hab[k].cd - dt);
  h.feit.curar = Math.max(0, h.feit.curar - dt); h.feit.clarao = Math.max(0, h.feit.clarao - dt); h.cdPassiva = Math.max(0, h.cdPassiva - dt); h.cdEscudoFe = Math.max(0, h.cdEscudoFe - dt);
  h.atkCd = Math.max(0, h.atkCd - dt); h.travado = Math.max(0, h.travado - dt);
  // regeneração
  const fora = h.combateT > 6;
  let rh = (1.2 + .12 * h.nivel) * (fora ? 2.5 : 1), rm = (2.5 + .25 * h.nivel) * (fora ? 2 : 1);
  if (h.itens.includes('harpaDavi') && fora) rh += h.maxHp * .01;
  if (h.itens.includes('couracaJustica') && h.agressorT && estado.tempo - h.agressorT < 5) rh += h.maxHp * .004;
  if (naFonte(h)) { rh += h.maxHp * .12; rm += h.manaMax * .12; }
  h.hp = Math.min(h.maxHp, h.hp + rh * dt); h.mana = Math.min(h.manaMax, h.mana + rm * dt);
  if (h.anel) h.anel.rotation.z += dt * .8;
  // canalizando recuo
  if (h.canal) {
    h.canal.t += dt; const p = h.obj.position;
    if (Math.random() < dt * 20) fx.emit(p.x + (Math.random() - .5) * 1.4, .2, p.z + (Math.random() - .5) * 1.4, { vel: [0, 4, 0], cor: h.time === 'luz' ? [.5, .8, 1] : [1, .35, .5], vida: .8, t0: .4, t1: 0 });
    if (h.ctrl.len > .25) { h.canal = null; if (h === jogador) aviso('Recuo cancelado', true); }
    else if (h.canal.t >= h.canal.dur) { h.canal = null; const f = FONTE[h.time], s = h.time === 'luz' ? 1 : -1; aneis.add(h.obj.position, new THREE.Color(.6, .85, 1), .3, 2.5, .6); h.obj.position.set(f.x + s * 4, 0, laneZ(f.x + s * 4)); aneis.add(h.obj.position, new THREE.Color(.6, .85, 1), .3, 2.5, .6); if (h === jogador) { camIni = false; aviso('De volta à base — a LOJA está liberada'); } }
    h.tocar(h.anim.idle, .2); return;
  }
  if (h.atord > 0) { h.tocar(h.anim.idle, .2); if (Math.random() < dt * 10) fx.emit(h.obj.position.x + (Math.random() - .5), 3.2 * h.def.esc, h.obj.position.z + (Math.random() - .5), { vel: [0, .5, 0], cor: [1, .95, .5], vida: .4, t0: .35, t1: 0 }); return; }
  if (moverForcado(h, dt)) return;
  if (h.saltando) return;
  if (h.dash) {
    h.dash.t -= dt; h.obj.position.addScaledVector(h.dash.dir, h.dash.vel * dt); limitar(h.obj.position);
    const p = h.obj.position; if (!(h.dash.d && PZ.dash(h, h.dash.d, p))) { fxD.emit(p.x, .3, p.z, { vel: [(Math.random() - .5) * 2, 1, (Math.random() - .5) * 2], cor: [.55, .45, .32], vida: .6, t0: .7, t1: 1.6, alpha: .6 }); fx.emit(p.x, 1.2, p.z, { cor: h.def.cor, vida: .3, t0: 1.1, t1: 0, alpha: .5 }); }
    if (h.dash.t <= 0) { const f = h.dash.fim; h.dash = null; if (f) f(); }
    return;
  }
  // provocado: bot é forçado a atacar quem provocou
  if (h.provoc && h.bot) h.forcarAlvo = h.provoc.por;
  const c = h.ctrl;
  // histerese: começa a correr acima de 0,15 e só para abaixo de 0,08 (não fica piscando entre parado e correndo)
  h.andando = c.len > (h.andando ? .08 : .15);
  if (h.andando && h.travado < .2 && !(h.raiz > 0)) {
    const v = velocidade(h) * Math.min(1, c.len * 1.3);
    h.obj.position.x += c.x * v * dt; h.obj.position.z += c.y * v * dt; limitar(h.obj.position);
    h.olharPara(_olhar.set(h.obj.position.x + c.x, 0, h.obj.position.z + c.y), dt, 12);
    // velocidade do clipe acompanha a velocidade real (pés sem deslizar), atualizada em todo quadro
    h.tocar(h.anim.correr, .18, false, Math.max(.45, (h.anim.velCorrer || 1) * v / h.vel));
    if (Math.random() < dt * 8) fxD.emit(h.obj.position.x, .15, h.obj.position.z, { vel: [0, .6, 0], cor: [.6, .5, .38], vida: .5, t0: .4, t1: .9, alpha: .45 });
  } else if (h.travado <= 0) h.tocar(h.anim.idle, .2);
  // invisível: fica translúcido
  const alvoOp = h.invis > 0 ? (h.time === jogadorTime() ? .45 : .12) : 1;
  if (h._op !== alvoOp) { h._op = alvoOp; h.mats.forEach(m => { m.transparent = alvoOp < 1; m.opacity = alvoOp; m.needsUpdate = true; }); }
}
function alvoMinion(u) {
  if (u.provoc && u.provoc.por.vivo) return u.provoc.por;
  let best = null, bd = 7.5, heroi = null, hd = 7.5, est = null, ed = 9;
  for (const v of unidades) { if (!v.vivo || v.time === u.time || v.time === 'neutro' || v.spawnT > 0 || !visivelPara(v, u.time)) continue; const d = v.obj.position.distanceTo(u.obj.position) - v.raio; if (v.tipo === 'heroi') { if (d < hd) { hd = d; heroi = v; if (v.agrediuHeroiT && estado.tempo - v.agrediuHeroiT < 2.5 && d < 6) return v; } } else if (d < bd) { bd = d; best = v; } }
  for (const e of estruturas) { if (!e.vivo || e.time === u.time || protegida(e)) continue; const d = e.obj.position.distanceTo(u.obj.position) - e.raio; if (d < ed) { ed = d; est = e; } }
  return best || est || heroi;
}
function atualizarMinion(u, dt) {
  if (!u.vivo) { u.morteT += dt; if (u.morteT > 1.6) u.obj.position.y -= dt * 1.2; if (u.morteT > 3) u.remover = true; return; }
  atualizarStatus(u, dt); if (!u.vivo) return;
  if (u.invocado) { u.vidaT -= dt; if (u.vidaT <= 0 || !u.invocado.vivo) { u.xpV = 0; u.ouro = 0; aneis.add(u.obj.position, new THREE.Color(1, .7, .25), .3, 1.6, .5); morrer(u, null); return; } }
  if (u.atord > 0) { u.tocar(u.anim.idle, .2); return; }
  if (moverForcado(u, dt)) return;
  u.cd -= dt;
  const alvo = alvoMinion(u);
  if (alvo) {
    const d = u.obj.position.distanceTo(alvo.obj.position) - (alvo.raio || 1) - u.raio;
    if (d > u.alcance) { mover(u, alvo.obj.position, dt); u.tocar(u.anim.correr, .2, false, u.anim.velCorrer || 1); }
    else { u.olharPara(alvo.obj.position, dt); if (u.cd <= 0) { u.cd = u.cadencia; u.tocar(u.anim.ataque, .1, true, u.anim.velAtaque || 1); u.onFim = () => u.vivo && u.tocar(u.anim.idle, .2);
      agendar(.35, () => { if (!u.vivo || !alvo.vivo) return; danificar(u, alvo, u.dano, { ataque: true }); const p = alvo.obj.position; for (let k = 0; k < 4; k++) fx.emit(p.x, 1.1, p.z, { vel: [(Math.random() - .5) * 4, Math.random() * 3, (Math.random() - .5) * 4], cor: u.time === 'luz' ? [.6, .8, 1] : [1, .2, .35], vida: .3, t0: .35, t1: 0 }); }); }
      else if (u.atual && u.atual.loop !== THREE.LoopOnce) u.tocar(u.anim.idle, .2); }
  } else if (u.invocado && u.invocado.obj.position.distanceTo(u.obj.position) > 3) { mover(u, u.invocado.obj.position, dt); u.tocar(u.anim.correr, .2, false, u.anim.velCorrer || 1);
  } else if (u.invocado) { u.tocar(u.anim.idle, .2);
  } else {
    const s = u.time === 'luz' ? 1 : -1; const px = u.obj.position.x + s * 3;
    let dv = 0; if (MAPA_WR) for (const e of estruturas) { if (!e.vivo || e.tipo !== 'torre') continue; const ddx = Math.abs(e.obj.position.x - px); if (ddx < 4.5) dv = Math.max(dv, (1 - ddx / 4.5) * .8); } // torre em cima da estrada: contorna pelo lado de baixo
    mover(u, new THREE.Vector3(px, 0, laneZ(px) + u.laneOff + dv), dt); u.tocar(u.anim.correr, .2, false, u.anim.velCorrer || 1);
  }
  if (u.fumaca && Math.random() < dt * 4) { const p = u.obj.position; fxD.emit(p.x + (Math.random() - .5) * .8, .3 + Math.random() * .8, p.z + (Math.random() - .5) * .8, { vel: [0, .8, 0], cor: [.16, .04, .18], vida: 1.1, t0: .5, t1: 1.3, alpha: .55 }); }
}
function mover(u, alvo, dt) { if (u.raiz > 0) return; const d = new THREE.Vector3().subVectors(alvo, u.obj.position); d.y = 0; const L = d.length(); if (L < .01) return; d.multiplyScalar(Math.min(velocidade(u) * dt, L) / L); u.obj.position.add(d); u.olharPara(alvo, dt, 8); }
const matTiroL = new THREE.MeshBasicMaterial({ color: new THREE.Color(.45, .75, 1).multiplyScalar(3) }), matTiroT = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, .2, .35).multiplyScalar(3) });
function atualizarTorres(dt) {
  for (const e of estruturas) {
    if (e.flash > 0) e.flash -= dt;
    if (!e.vivo || e.tipo !== 'torre') continue;
    e.cd -= dt; if (e.cd > 0) continue;
    const tp = e.obj.position; let alvo = null;
    // 1) herói inimigo que atacou um herói aliado dentro do alcance
    for (const h of herois) if (h.vivo && h.time !== e.time && visivelPara(h, e.time) && h.agrediuHeroiT && estado.tempo - h.agrediuHeroiT < 2.5 && h.obj.position.distanceTo(tp) < e.alcance) alvo = h;
    // 2) mantém o alvo atual
    if (!alvo && e.alvoAnt && e.alvoAnt.vivo && visivelPara(e.alvoAnt, e.time) && e.alvoAnt.obj.position.distanceTo(tp) < e.alcance) alvo = e.alvoAnt;
    // 3) tropa mais próxima, depois herói
    if (!alvo) { let bd = e.alcance; for (const u of unidades) { if (!u.vivo || u.time === e.time || u.tipo !== 'minion') continue; const d = u.obj.position.distanceTo(tp); if (d < bd) { bd = d; alvo = u; } } }
    if (!alvo) { let bd = e.alcance; for (const h of herois) { if (!h.vivo || h.time === e.time || !visivelPara(h, e.time)) continue; const d = h.obj.position.distanceTo(tp); if (d < bd) { bd = d; alvo = h; } } }
    if (!alvo) { e.alvoAnt = null; e.serie = 0; continue; }
    if (alvo === e.alvoAnt && alvo.tipo === 'heroi') e.serie = Math.min(e.serie + 1, 4); else e.serie = 0;
    if (alvo === jogador && e.alvoAnt !== jogador) aviso('A torre está mirando em você!', true);
    e.alvoAnt = alvo; e.tiroT = estado.tempo; e.cd = 1.25;
    const dano = alvo.tipo === 'heroi' ? (190 + 11 * estado.tempo / 60) * (1 + .4 * e.serie) : alvo.maxHp * (alvo.bruto ? .3 : .4) * Math.max(.6, 1 - estado.tempo / 60 * .035); // tropas aguentam mais tiros com o tempo
    const de = tp.clone(); de.y = e.obj.userData.topo; const cor = e.time === 'luz' ? [.45, .75, 1] : [1, .2, .35];
    lancar(de, alvo, { time: e.time, vel: 22, mat: e.time === 'luz' ? matTiroL : matTiroT, esc: 1.8, cor, onHit: (u) => danificar(e, u, dano, { puro: alvo.tipo === 'minion' }), trilha: (p) => { for (let k = 0; k < 2; k++) fx.emit(p.x, p.y, p.z, { cor, vida: .35, t0: .9, t1: 0 }); } });
  }
  // fontes: atiram em invasores
  for (const time of ['luz', 'trevas']) {
    const f = FONTE[time]; fonteCd[time] -= dt; if (fonteCd[time] > 0) continue;
    for (const u of unidades) if (u.vivo && u.time !== time && u.obj.position.distanceTo(f) < 10) { fonteCd[time] = .5; const de = f.clone(); de.y = time === 'luz' ? 5.2 : 7; lancar(de, u, { time, vel: 40, mat: time === 'luz' ? matTiroL : matTiroT, esc: 2.2, cor: time === 'luz' ? [.5, .8, 1] : [1, .3, .4], onHit: (a) => danificar(null, a, 450, { puro: true }) }); break; }
  }
}
const fonteCd = { luz: 0, trevas: 0 };
function colisoes() {
  for (let i = 0; i < unidades.length; i++) for (let j = i + 1; j < unidades.length; j++) {
    const a = unidades[i], b = unidades[j]; if (!a.vivo || !b.vivo || a.saltando || b.saltando) continue; const dx = b.obj.position.x - a.obj.position.x, dz = b.obj.position.z - a.obj.position.z; const d2 = dx * dx + dz * dz, m = a.raio + b.raio;
    if (d2 < m * m && d2 > 1e-8) { const d = Math.sqrt(d2); const k = (m - d) / d * .5; const fa = a.tipo === 'heroi' ? .25 : 1, fb = b.tipo === 'heroi' ? .25 : 1; a.obj.position.x -= dx * k * fa; a.obj.position.z -= dz * k * fa; b.obj.position.x += dx * k * fb; b.obj.position.z += dz * k * fb; }
  }
  for (const u of unidades) { if (!u.vivo) continue; for (const e of estruturas) { if (!e.vivo) continue; const dx = u.obj.position.x - e.obj.position.x, dz = u.obj.position.z - e.obj.position.z; const r = e.raio * (e.tipo === 'torre' ? .7 : .85) + u.raio * .5; const d2 = dx * dx + dz * dz; if (d2 < r * r && d2 > 1e-6) { const d = Math.sqrt(d2); u.obj.position.x = e.obj.position.x + dx / d * r; u.obj.position.z = e.obj.position.z + dz / d * r; } } }
}
let ondaT = 5, regenT = 0, histT = 0;
function atualizar(dt) {
  tempoU.value += dt;
  for (let i = agenda.length - 1; i >= 0; i--) { agenda[i].t -= dt; if (agenda[i].t <= 0) { const f = agenda[i].f; agenda.splice(i, 1); f(); } }
  for (let i = efeitos.length - 1; i >= 0; i--) { const e = efeitos[i]; e.t += dt; if (!e.up(e, dt)) efeitos.splice(i, 1); }
  if (estado.iniciado && !estado.fim) {
    estado.tempo += dt;
    regenT += dt; if (regenT >= 1) { regenT -= 1; for (const h of herois) { h.ouro += 3; h.stats.ouroTotal += 3; if (h.vivo) darXp(h, 2); } }
    if (!estado.muralhaAviso && estado.tempo >= 360) { estado.muralhaAviso = true; anunciar('muralhas', null, null); }
    histT += dt; if (histT >= 10) { histT -= 10; for (const h of herois) h.stats.historico.push(h.stats.ouroTotal); }
    // mira travada no inimigo (toque no retrato dele): 4 s
    if (jogador && jogador.trava) { jogador.trava.t -= dt; if (jogador.trava.t <= 0 || !jogador.trava.u.vivo) { jogador.trava = null; anelTrava.visible = false; } }
    if (jogador && !AUTO) jogador.forcarAlvo = jogador.trava ? jogador.trava.u : null;
    // compra reservada ("comprar ao chegar")
    if (jogador && jogador.reserva && podeComprar(jogador)) { const id = jogador.reserva; jogador.reserva = null; const e = comprar(jogador, id); if (!e) { aviso('Comprado: ' + ITENS[id].nome); som('moeda'); } }
    // entrada do jogador
    lerEntrada();
    for (const h of herois) if (h.bot || (AUTO && h === jogador)) pensar(h, dt);
    if (jogador && !jogador.bot && !AUTO && segurandoAtaque) { if (!atacar(jogador) && jogador.ctrl.len < .12 && jogador.atkCd <= 0) { const a = alvoAtaque(jogador, jogador.alcance + 6); if (a) mover2(jogador, a.obj.position); } }
    for (const h of herois) atualizarHeroi(h, dt);
    for (const u of unidades) if (u.tipo === 'minion') atualizarMinion(u, dt);
    colisoes();
    atualizarTorres(dt);
    if (SELVA_ON) atualizarSelva(dt, camAlvo);
    ondaT -= dt; if (ondaT <= 0) { ondaT = estado.tempo > 360 ? 22 : 25; for (const t of ['luz', 'trevas']) if (unidades.filter(u => u.time === t && u.tipo === 'minion' && u.vivo).length < (MODO2 ? 22 : 16)) onda(t, (MODO2 ? 6 : 4) + (estado.tempo > 300 ? 1 : 0) + (estruturas.some(e => e.time !== t && e.tipo === 'torre' && !e.vivo) ? 1 : 0)); }
  } else if (estado.fim) { for (const u of unidades) if (!u.vivo && u.tipo === 'minion') atualizarMinion(u, dt); }
  for (let i = unidades.length - 1; i >= 0; i--) if (unidades[i].remover) { const u = unidades[i]; scene.remove(u.obj); u.barra.remove(); unidades.splice(i, 1); }
  // animações: pula personagens muito longe da câmera
  atualizarFrustum(camera); let visU = 0; if (mundo.lodProps) mundo.lodProps(camAlvo);
  for (const u of unidades) {
    if (u.tipo === 'monstro') continue;
    const dx = u.obj.position.x - camAlvo.x; if (Math.abs(dx) >= 34 && u.tipo !== 'heroi') continue;
    u.animAcc = (u.animAcc || 0) + dt; const vis = naTela(u.obj.position, 2.8); if (vis) visU++;
    if (u.modelo.userData.lod && !u.semLOD) aplicarLOD(u, camera.position);
    // o seu herói anima em todo quadro; tropas: no celular a 30 Hz, de longe (LOD1) a 12 Hz; fora da câmera ~7 Hz
    const passo = u === jogador ? 0 : !vis ? .14 : u.tipo !== 'minion' ? 0 : u.lodNivel === 1 ? (Q.mobile ? 1 / 12 : 1 / 15) : Q.mobile ? 1 / 31 : 0;
    if (u.animAcc >= passo) { u.mixer.update(u.animAcc); u.animAcc = 0; }
    u.atualizarFlash(dt);
  }
  perfStat.visU = visU;
  mundo.anim.forEach(f => f(dt, tempoU.value));
  atualizarProjeteis(dt); fx.update(dt); fxD.update(dt); aneis.update(dt); if (poderes) poderes.atualizar(dt); if (jogador) ouvinteSom(jogador.obj.position);
}

// ================= entrada (joystick + botões + teclado) =================
const entrada = { x: 0, y: 0, len: 0 };
const joyZona = $('joyZona'), joy = $('joy'), joyBotao = $('joyBotao');
let joyId = null, joyC = { x: 0, y: 0 }, joyR = 1;
function joyPos(x, y) { joy.style.left = (x - joy.offsetWidth / 2) + 'px'; joy.style.top = (y - joy.offsetHeight / 2) + 'px'; joy.style.bottom = 'auto'; }
// botões da interface nunca são capturados pelo joystick flutuante (loja, compra rápida, pings, recuar, feitiços…)
const BOTOES_UI = 'button,#minimapa,#inimInfo,#rodaPing,#lojaPainel,#placar,#topoDir';
function botaoSob(e) { for (const el of document.elementsFromPoint(e.clientX, e.clientY)) { if (el === joyZona || joyZona.contains(el)) continue; const b = el.closest && el.closest(BOTOES_UI); if (b && !b.hidden && getComputedStyle(b).visibility !== 'hidden') return b; } return null; }
joyZona.addEventListener('pointerdown', (e) => { const b = botaoSob(e); if (b) { e.preventDefault(); e.stopPropagation(); b.dispatchEvent(new PointerEvent('pointerdown', e)); b.dispatchEvent(new PointerEvent('pointerup', e)); if (b.onclick) b.click(); return; } e.preventDefault(); joyId = e.pointerId; joyZona.setPointerCapture(e.pointerId); const r = joyZona.getBoundingClientRect(); if (!CFG.joyFixo) joyPos(e.clientX - r.left, e.clientY - r.top); const jr = joy.getBoundingClientRect(); joyC = { x: jr.left + jr.width / 2, y: jr.top + jr.height / 2 }; joyR = jr.width * .42; moverJoy(e); });
joyZona.addEventListener('pointermove', (e) => { if (e.pointerId === joyId) moverJoy(e); });
const soltar = (e) => { if (e.pointerId !== joyId) return; joyId = null; entrada.x = entrada.y = entrada.len = 0; joyBotao.style.transform = ''; joy.style.left = joy.style.top = ''; joy.style.bottom = ''; };
joyZona.addEventListener('pointerup', soltar); joyZona.addEventListener('pointercancel', soltar);
function moverJoy(e) { let dx = e.clientX - joyC.x, dy = e.clientY - joyC.y; const L = Math.hypot(dx, dy); if (L > joyR) { dx *= joyR / L; dy *= joyR / L; } joyBotao.style.transform = `translate(${dx}px,${dy}px)`; if (L < joyR * .08) { entrada.x = entrada.y = entrada.len = 0; return; } entrada.x = dx / joyR; entrada.y = dy / joyR; entrada.len = Math.min(1, (L - joyR * .08) / (joyR * .92)); }
function joyVisual(dx, dy) { const r = joy.offsetWidth * .42; joyBotao.style.transform = `translate(${dx * r}px,${dy * r}px)`; }
const J = (f) => () => jogador && !estado.fim && f(jogador);
const botoes = { bAtaque: J(atacar), bQ: J(h => usarHab(h, 'q')), bW: J(h => usarHab(h, 'w')), bE: J(h => usarHab(h, 'e')), bR: J(h => usarHab(h, 'r')), bCurar: J(curar), bClarao: J(h => clarao(h)), bRecuar: J(recuar) };
let segurandoAtaque = false;
if (SELVA_ON) {
  const roda = $('rodaPing');
  $('bPing').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); roda.classList.toggle('on'); });
  roda.querySelectorAll('button').forEach(b => b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); roda.classList.remove('on'); if (jogador && jogador.vivo !== undefined && !estado.fim) ping(jogador, b.dataset.p); }));
  $('bBeemote').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (jogador) invocarBeemote(jogador); });
}
for (const k of ['q', 'w', 'e', 'r']) ligarMira(k);
$('inimInfo').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); travarInimigo(); });
$('compraRapida').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); tocarCompraRapida(); });
for (const [id, f] of Object.entries(botoes)) {
  if (['bQ', 'bW', 'bE', 'bR'].includes(id)) continue;
  const el = $(id);
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (e.target.closest('.mais')) return; el.classList.add('press'); f(); if (id === 'bAtaque') segurandoAtaque = true; });
  const up = () => { el.classList.remove('press'); if (id === 'bAtaque') segurandoAtaque = false; };
  el.addEventListener('pointerup', up); el.addEventListener('pointerleave', up); el.addEventListener('pointercancel', up);
}
function addMais(k) { const m = document.createElement('b'); m.className = 'mais'; m.textContent = '+'; $('b' + k.toUpperCase()).appendChild(m); m.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (jogador) subirHab(jogador, k); }); }
addEventListener('touchend', (e) => { if (e.touches.length === 0) { segurandoAtaque = false; document.querySelectorAll('.press').forEach(b => b.classList.remove('press')); if (joyId !== null) soltar({ pointerId: joyId }); } });
addEventListener('blur', () => { segurandoAtaque = false; teclas.clear(); });
$('loja').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (jogador) abrirLoja(); });
const teclas = new Set();
addEventListener('keydown', (e) => {
  if (!jogador || lojaAberta) { if (e.code === 'Escape' || e.code === 'KeyB') fecharLoja(); return; }
  teclas.add(e.code);
  const m = { Space: botoes.bAtaque, KeyJ: botoes.bAtaque, KeyQ: botoes.bQ, Digit1: botoes.bQ, KeyE: botoes.bW, Digit2: botoes.bW, KeyR: botoes.bE, Digit3: botoes.bE, KeyF: botoes.bR, Digit4: botoes.bR, KeyH: botoes.bRecuar, KeyC: botoes.bCurar, KeyX: botoes.bClarao, KeyB: () => abrirLoja() };
  if (e.ctrlKey && ['KeyQ', 'KeyE', 'KeyR', 'KeyF'].includes(e.code)) { subirHab(jogador, { KeyQ: 'q', KeyE: 'w', KeyR: 'e', KeyF: 'r' }[e.code]); return; }
  if (m[e.code] && !e.repeat) m[e.code](); if (e.code === 'Space') segurandoAtaque = true;
});
addEventListener('keyup', (e) => { teclas.delete(e.code); if (e.code === 'Space') segurandoAtaque = false; });
addEventListener('contextmenu', e => e.preventDefault());
let cenaInput = null;
const entSuave = { x: 0, y: 0, t: 0 };
if (!CAPTURA && P.get('som') !== '0') { const dest = () => destravarSom(); addEventListener('pointerdown', dest, { passive: true }); addEventListener('pointerup', dest, { passive: true }); addEventListener('click', dest); addEventListener('keydown', dest); addEventListener('touchend', dest, { passive: true }); document.addEventListener('visibilitychange', () => { if (!document.hidden) destravarSom(); }); } else somLigado(false);
function lerEntrada() {
  if (!jogador) return;
  let kx = (teclas.has('KeyD') || teclas.has('ArrowRight') ? 1 : 0) - (teclas.has('KeyA') || teclas.has('ArrowLeft') ? 1 : 0);
  let ky = (teclas.has('KeyS') || teclas.has('ArrowDown') ? 1 : 0) - (teclas.has('KeyW') || teclas.has('ArrowUp') ? 1 : 0);
  if (AUTO) { const [vx, vy] = mundoTela(jogador.ctrl.x, jogador.ctrl.y); joyVisual(vx * jogador.ctrl.len, vy * jogador.ctrl.len); return; }
  const c = jogador.ctrl; let rx, ry;
  if (cenaInput) { rx = cenaInput.x; ry = cenaInput.y; }
  else if (kx || ky) { const L = Math.hypot(kx, ky); rx = kx / L; ry = ky / L; }
  else { rx = entrada.x * entrada.len; ry = entrada.y * entrada.len; }
  // suaviza o joystick (filtro exponencial pelo tempo real do quadro): sem tremida do dedo nem viradas bruscas de 1 quadro
  const agora = performance.now(), dt = Math.min(.05, (agora - (entSuave.t || agora)) / 1000); entSuave.t = agora;
  const k = CAPTURA || cenaInput ? 1 : 1 - Math.exp(-dt * (Math.hypot(rx, ry) > .05 ? 22 : 30));
  entSuave.x += (rx - entSuave.x) * k; entSuave.y += (ry - entSuave.y) * k;
  const L = Math.hypot(entSuave.x, entSuave.y); c.len = Math.min(1, L); if (L > 1e-4) { [c.x, c.y] = telaMundo(entSuave.x / L, entSuave.y / L); }
}

// ================= câmera =================
const perfStat = { visU: 0 };
const camAlvo = new THREE.Vector3(); let camIni = false; let camExtra = null;
function atualizarCamera(dt) {
  // defesa contra tela preta: posição NaN/infinita (empurrão, colisão, divisão por zero) deixaria a câmera em NaN e nada seria desenhado
  for (const u of unidades) { const q = u.obj.position; if (Number.isFinite(q.x + q.y + q.z)) { (u._okPos || (u._okPos = new THREE.Vector3())).copy(q); } else { console.warn('[NaN] posição de', u.nome || u.tipo); if (u._okPos) q.copy(u._okPos); else q.set(0, 0, 0); u.empurrao = null; u.dash = null; } }
  if (!Number.isFinite(camAlvo.x + camAlvo.y + camAlvo.z)) camIni = false;
  const ref = estado.fim ? estado.fim.nucleo.obj.position : (jogador ? jogador.obj.position : POS.baseLuz);
  const foco = ref.clone(); foco.y = 0; if (CAM_ANTIGA || estado.fim) { foco.x += 1.2; foco.z -= 1.2; }
  if (!camIni) { camAlvo.copy(foco); camIni = true; }
  camAlvo.lerp(foco, 1 - Math.exp(-dt * (estado.fim ? 2 : 6)));
  const off = camExtra ? camExtra.off : CAM_OFF;
  camera.position.copy(camAlvo).add(off); if (camExtra && camExtra.dx) camera.position.x += camExtra.dx;
  if (shake > 0) { camera.position.x += (Math.random() - .5) * shake; camera.position.y += (Math.random() - .5) * shake; shake = Math.max(0, shake - dt * 1.5); }
  camera.lookAt(camAlvo.x + (camExtra && camExtra.dx || 0), camAlvo.y + (camExtra ? camExtra.y : .6), camAlvo.z - (camExtra ? camExtra.dz : CAM_ANTIGA ? 0 : CAM_DZ * -CAM_FRENTE.z)); if (!camExtra && !CAM_ANTIGA && MAPA_WR) camera.lookAt(camAlvo.x + CAM_DZ * CAM_FRENTE.x, camAlvo.y + .6, camAlvo.z + CAM_DZ * CAM_FRENTE.z);
  sol.position.copy(camAlvo).add(SOL_OFF); sol.target.position.copy(camAlvo);
}

// ================= barras de vida (HTML) =================
const hudEl = $('hud');
function criarBarra(u, tipo) {
  const el = document.createElement('div');
  if (u.tipo === 'heroi') { const al = u.time === jogadorTime(); el.className = 'hpUnid heroi ' + (u === jogador || (!jogador && !u.bot) ? 'eu' : al ? 'aliado' : 'inimigo'); el.innerHTML = `<div class="lv">1</div><div class="col"><div class="nm">${u.bot ? u.def.nome : nomeHtml()}</div><div class="t"><s></s><i></i></div><div class="m"><i></i></div></div>`; }
  else if (u.tipo === 'torre' || u.tipo === 'nucleo') { el.className = 'hpUnid torre ' + (u.time === jogadorTime() ? 'aliado' : 'inimigo'); el.innerHTML = `<div class="t"><b></b><i></i><em></em></div><div class="hpN"></div>`; el.style.setProperty('--seg', (100 * 500 / u.maxHp).toFixed(3) + '%'); u.barraC = el.querySelector('.t b'); u.barraN = el.querySelector('.hpN'); u.hpTxt = -1; }
  else { el.className = 'hpUnid ' + (u.time === jogadorTime() ? 'aliado' : 'inimigo'); el.innerHTML = '<div class="t"><i></i></div>'; }
  hudEl.insertBefore(el, hudEl.firstChild); u.barra = el; u.barraI = el.querySelector('.t i'); u.barraM = el.querySelector('.m i'); u.barraS = el.querySelector('.t s'); u.barraLv = el.querySelector('.lv');
}
function recolorirBarras() { for (const e of estruturas) { e.barra.className = 'hpUnid torre ' + (e.time === jogadorTime() ? 'aliado' : 'inimigo'); } }
const vp = new THREE.Vector3();
let topoB = null, topoBW = 0;
function topoBarras() {
  if (!topoB || topoBW !== W * 1e4 + H) { const pl = $('placar'); const r = pl ? pl.getBoundingClientRect() : { bottom: 40 }; const u = Math.min(H, W * .46) / 100; const mm = $('minimapa').getBoundingClientRect(); const ii = $('inimInfo').getBoundingClientRect();
    topoB = { y: r.bottom + 3.2 * u, x0: mm.right + 6, x1: ii.width ? ii.left - 6 : W - 8, yMm: mm.bottom, yIi: ii.bottom }; topoBW = W * 1e4 + H; }
  return topoB;
}
function atualizarBarras() {
  for (const u of [...unidades, ...estruturas]) {
    if (!u.barra) continue;
    if (!u.vivo || (u.invis > 0 && u.time !== jogadorTime()) || estado.fim) { u.barra.style.display = 'none'; continue; }
    const alt = u.tipo === 'torre' ? u.obj.userData.topo + 1.3 : u.tipo === 'nucleo' ? (u.obj.userData.barraY || 7) : u.tipo === 'heroi' || u.tipo === 'monstro' ? u.alturaBarra : (u.nome === 'Sombra' ? 2.55 : 2.85);
    const estr = u.tipo === 'torre' || u.tipo === 'nucleo';
    if (estr) { vp.copy(u.obj.position); vp.y += 1; vp.project(camera); if (vp.z > 1 || Math.abs(vp.x) > 1.15 || Math.abs(vp.y) > 1.15) { u.barra.style.display = 'none'; continue; } }
    vp.copy(u.obj.position); vp.y += alt; vp.project(camera);
    if (!estr && (vp.z > 1 || Math.abs(vp.x) > 1.2 || Math.abs(vp.y) > 1.2)) { u.barra.style.display = 'none'; continue; }
    u.barra.style.display = '';
    let x = (vp.x * .5 + .5) * W, y = (-vp.y * .5 + .5) * H;
    // torre visível mas topo fora da tela (câmera perto): a barra "gruda" logo abaixo do placar, sempre legível
    if (estr) { const m = topoBarras(); if (!u.bH || u.bWk !== topoBW) { u.bH = u.barra.offsetHeight; u.bW = u.barra.offsetWidth; u.bWk = topoBW; } y = Math.max(y, m.y + u.bH);
      // não cobre o minimapa (esq.) nem o retrato do inimigo (dir.) enquanto estiver na altura deles
      const xa = y - u.bH < m.yMm ? m.x0 : 8, xb = y - u.bH < m.yIi ? m.x1 : W - 8; x = Math.min(Math.max(x, xa + u.bW / 2), Math.max(xa + u.bW / 2, xb - u.bW / 2));
      if (u.placas !== undefined) { const on = estado.tempo < 300 && u.vivo; if (on !== u.placasOn) { u.placasOn = on; u.barra.classList.toggle('placas', on); } } }
    u.barra.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-100%)`;
    u.barraI.style.transform = `scaleX(${(u.hp / u.maxHp).toFixed(3)})`;
    if (u.tipo === 'torre' || u.tipo === 'nucleo') {
      u.barra.classList.toggle('prot', protegida(u)); u.barra.classList.toggle('hit', u.flash > 0);
      u.barraC.style.transform = u.barraI.style.transform; // "rastro" de dano que desce depois (transição no CSS)
      const n = Math.max(0, Math.ceil(u.hp)); if (n !== u.hpTxt) { u.hpTxt = n; u.barraN.textContent = fmt(n) + ' / ' + fmt(u.maxHp); }
    }
    if (u.barraM) u.barraM.style.transform = `scaleX(${(u.mana / u.manaMax).toFixed(3)})`;
    if (u.barraS) { const e = u.escudos.reduce((s, a) => s + a.v, 0); u.barraS.style.transform = `scaleX(${Math.min(1, (u.hp + e) / u.maxHp).toFixed(3)})`; u.barraS.style.opacity = e > 0 ? 1 : 0; }
    if (u.barraLv && u.barraLv.textContent != u.nivel) u.barraLv.textContent = u.nivel;
  }
}

// ================= HUD =================
const mmCtx = $('mm').getContext('2d');
const mmFundo = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  if (MAPA_WR) { const P = (x, z) => mmPos(x, z); const linha = (pts, cor, w) => { g.strokeStyle = cor; g.lineWidth = w; g.lineCap = g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, z], i) => { const [a, b] = P(x, z); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.stroke(); };
    g.fillStyle = '#10140e'; g.fillRect(0, 0, 256, 256);
    const L = MAPA_C + MAPA_FOLGA; const bg = g.createLinearGradient(0, 256, 256, 0); bg.addColorStop(0, '#5a5220'); bg.addColorStop(.45, '#24401f'); bg.addColorStop(.55, '#23391f'); bg.addColorStop(1, '#3a1f3e'); g.fillStyle = bg;
    g.beginPath(); [[1 - L, 0], [1, -L], [1 + L, 0], [1, L]].forEach(([x, z], i) => { const [a, b] = P(x, z); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.closePath(); g.fill();
    linha([[1, -L + 2], [1, L - 2]], 'rgba(80,150,200,.55)', 12);
    linha(ROTA_TOPO, 'rgba(210,190,150,.3)', 8); linha(ROTA_BAIXO, 'rgba(210,190,150,.3)', 8);
    const mid = []; for (let x = LANE.x0 + 6; x <= LANE.x1 - 6; x += 4) mid.push([x, laneZ(x)]); linha(mid, 'rgba(235,215,170,.85)', 10);
    for (const [x, z] of TORRES_LATERAIS) { const [a, b] = P(x, z); g.fillStyle = 'rgba(160,160,160,.55)'; g.beginPath(); g.arc(a, b, 3.5, 0, 7); g.fill(); }
    for (const [x, z, cor] of [[...POCO_XZ, 'rgba(40,200,190,.5)'], [...DRAG_XZ, 'rgba(255,110,40,.5)']]) { const [a, b] = P(x, z); g.fillStyle = cor; g.beginPath(); g.arc(a, b, 11, 0, 7); g.fill(); }
    const base = (x, y, c1) => { const gr = g.createRadialGradient(x, y, 0, x, y, 26); gr.addColorStop(0, c1); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, 26, 0, 7); g.fill(); };
    base(...P(POS.baseLuz.x, POS.baseLuz.z), 'rgba(255,210,100,.8)'); base(...P(POS.baseTrevas.x, POS.baseTrevas.z), 'rgba(200,40,110,.8)'); return c; }
  const bg = g.createLinearGradient(0, 256, 256, 0); bg.addColorStop(0, '#5a5220'); bg.addColorStop(.45, '#24401f'); bg.addColorStop(.55, '#23391f'); bg.addColorStop(1, '#3a1f3e'); g.fillStyle = bg; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(80,150,200,.45)'; g.lineWidth = 12; g.beginPath(); g.moveTo(20, 20); g.lineTo(236, 236); g.stroke();
  g.lineCap = 'round'; g.strokeStyle = 'rgba(210,190,150,.35)'; g.lineWidth = 9;
  g.beginPath(); g.moveTo(26, 230); g.lineTo(26, 26); g.lineTo(230, 26); g.stroke();
  g.beginPath(); g.moveTo(26, 230); g.lineTo(230, 230); g.lineTo(230, 26); g.stroke();
  g.strokeStyle = 'rgba(235,215,170,.85)'; g.lineWidth = 11; g.beginPath(); g.moveTo(28, 228); g.lineTo(228, 28); g.stroke();
  const base = (x, y, c1) => { const gr = g.createRadialGradient(x, y, 0, x, y, 30); gr.addColorStop(0, c1); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, 30, 0, 7); g.fill(); };
  base(20, 236, 'rgba(255,210,100,.8)'); base(236, 20, 'rgba(200,40,110,.8)');
  return c;
})();
function mmPos(x, z) { if (MAPA_WR) { const k = 148 / (MAPA_C + MAPA_FOLGA + 2); const u = (x - 1) * k, v = z * k; return [128 + .7071 * (u + v), 128 + .7071 * (v - u)]; } const u = (x + 64) / 128; const px = 22 + u * 212, py = 234 - u * 212; const off = (z - laneZ(x)) * 2.2; return [px + off * .707, py + off * .707]; }
function desenharMinimapa() {
  const g = mmCtx; g.drawImage(mmFundo, 0, 0);
  const inv = jogadorTime() === 'trevas';
  for (const e of estruturas) { const [x, y] = mmPos(e.obj.position.x, e.obj.position.z); const al = e.time === jogadorTime(); g.globalAlpha = e.vivo ? 1 : .3; g.fillStyle = al ? '#6fc3ff' : '#ff4a64'; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); if (e.tipo === 'nucleo') { g.arc(x, y, 8, 0, 7); } else { g.moveTo(x, y - 9); g.lineTo(x + 7, y + 6); g.lineTo(x - 7, y + 6); g.closePath(); } g.fill(); g.stroke(); g.globalAlpha = 1; }
  for (const u of unidades) { if (!u.vivo || u.tipo !== 'minion') continue; const [x, y] = mmPos(u.obj.position.x, u.obj.position.z); g.fillStyle = u.time === jogadorTime() ? '#8fd6ff' : '#ff5a6e'; g.beginPath(); g.arc(x, y, 3.2, 0, 7); g.fill(); }
  if (SELVA_ON) desenharSelvaMM(g, mmPos);
  const [cx, cy] = mmPos(camAlvo.x, camAlvo.z); g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 1.5; g.save(); g.translate(cx, cy); if (!MAPA_WR) g.rotate(-Math.PI / 4); g.strokeRect(-26, -14, 52, 28); g.restore();
  for (const h of herois) { if (!h.vivo || (h.invis > 0 && h.time !== jogadorTime())) continue; const [hx, hy] = mmPos(h.obj.position.x, h.obj.position.z); const img = retratos[h.id]; if (img) { g.save(); g.beginPath(); g.arc(hx, hy, 12, 0, 7); g.clip(); g.drawImage(img, hx - 12, hy - 12, 24, 24); g.restore(); } g.strokeStyle = h === jogador ? '#ffd66b' : h.time === jogadorTime() ? '#6fc3ff' : '#ff4a64'; g.lineWidth = 2.5; g.beginPath(); g.arc(hx, hy, 12, 0, 7); g.stroke(); const al = h.time === jogadorTime(); g.fillStyle = 'rgba(0,0,0,.7)'; g.fillRect(hx - 12, hy + 13, 24, 4.5); g.fillStyle = al ? '#4aa8ff' : '#ff4058'; g.fillRect(hx - 11.5, hy + 13.5, 23 * Math.max(0, h.hp / h.maxHp), 3.5); }
}
const cdEls = { q: $('bQ'), w: $('bW'), e: $('bE'), r: $('bR') };
let hudT = 0, fpsAcc = 0, fpsN = 0, fpsMostrado = 60;
const mmss = (t) => String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(Math.floor(t % 60)).padStart(2, '0');
function atualizarHUD(dt) {
  if (!jogador) return;
  const h = jogador;
  hudT += dt; fpsAcc += dt; fpsN++;
  if (fpsAcc > .5) { fpsMostrado = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; if (!CAPTURA) $('fps').textContent = fpsMostrado + ' FPS'; ajustarQualidade(fpsMostrado); }
  const setCd = (el, cd, max) => { const c = el.querySelector('.cd'); if (cd > 0) { c.classList.add('on'); c.style.setProperty('--p', (cd / max).toFixed(3)); c.textContent = cd > 1 ? Math.ceil(cd) : cd.toFixed(1).replace('.', ','); } else c.classList.remove('on'); };
  for (const [k, el] of Object.entries(cdEls)) { const H = h.hab[k], d = h.def.hab[k]; setCd(el, H.cd, H.nv ? d.cd[H.nv - 1] * 100 / (100 + h.st.ah) : 1); el.classList.toggle('bloq', H.nv === 0); el.classList.toggle('semMana', H.nv > 0 && h.mana < d.mana[H.nv - 1]); el.classList.toggle('podeSubir', podeSubir(h, k)); const nvEl = el.querySelector('.nvs'); if (nvEl) nvEl.innerHTML = Array.from({ length: k === 'r' ? 3 : 5 }, (_, i) => `<i class="${i < H.nv ? 'on' : ''}"></i>`).join(''); }
  if (SELVA_ON) { const ob = h.olhoBeemote > estado.tempo; const bb = $('bBeemote'); if (bb.hidden === ob) bb.hidden = !ob; }
  setCd($('bCurar'), h.feit.curar, FEIT.curar); setCd($('bClarao'), h.feit.clarao, FEIT.clarao);
  { const R = h.hab.r; const pronta = R.nv > 0 && R.cd <= 0 && h.mana >= h.def.hab.r.mana[R.nv - 1] && h.vivo; if (pronta !== h.ultPronta) { h.ultPronta = pronta; cdEls.r.classList.toggle('pronta', pronta); if (pronta && estado.tempo > 1) som('ultPronta', null, .8); } }
  atualizarAnuncio(dt);
  $('bRecuar').classList.toggle('ativo', !!h.canal);
  if (hudT < .1 && !CAPTURA) return; hudT = 0;
  $('tempo').textContent = mmss(estado.tempo);
  $('ptsLuz').textContent = estado.luz; $('ptsTrevas').textContent = estado.trevas;
  $('ouro').textContent = fmt(h.ouro); $('cs').textContent = h.cs; $('kda').textContent = `${h.abates}/${h.mortes}/${h.assist}`;
  $('bVida').style.transform = `scaleX(${h.hp / h.maxHp})`; $('tVida').textContent = `${fmt(h.hp)} / ${fmt(h.maxHp)}`;
  $('bMana').style.transform = `scaleX(${h.mana / h.manaMax})`; $('tMana').textContent = `${fmt(h.mana)} / ${fmt(h.manaMax)}`;
  $('bXp').style.transform = `scaleX(${h.nivel >= 15 ? 1 : h.xp / XP_NIVEL(h.nivel)})`; $('nivel').textContent = h.nivel;
  $('loja').classList.toggle('pode', podeComprar(h)); $('loja').classList.toggle('temOuro', h.ouro >= 400); atualizarCompraRapida();
  hudEl.classList.toggle('semRotulos', estado.tempo > 60);
  { const u = grade.uniforms.uCinza; u.value += ((!h.vivo && !estado.fim ? .85 : 0) - u.value) * .15; }
  const m = $('morte'); if (!h.vivo && !estado.fim) { m.className = 'on'; m.innerHTML = `Renascendo em <b>${Math.ceil(h.morteT)}</b><small>Aproveite para comprar na LOJA</small>`; } else m.className = '';
  $('pontosAviso').className = h.pontos > 0 && h.vivo ? 'on' : '';
  const b = bot; if (b) { const ii = $('inimInfo'); if (!ii.firstChild) { ii.innerHTML = `<canvas width="64" height="64"></canvas><div><b>${b.def.nome}</b><small></small></div><span class="mira">Toque: travar mira</span>`; const cv = ii.querySelector('canvas'); if (retratos[b.id]) cv.getContext('2d').drawImage(retratos[b.id], 0, 0, 64, 64); }
    const tx = `Nv ${b.nivel} · ${b.abates}/${b.mortes}`; const sm = ii.querySelector('small'); if (sm.textContent !== tx) sm.textContent = tx; ii.classList.toggle('morto', !b.vivo); ii.classList.toggle('dica', estado.tempo < 45); }
  desenharMinimapa();
}
let qualT = 0;
// resolução dinâmica: abaixo de 55 FPS baixa a resolução em passos de 0,1 (mín. 0,75 no celular); acima de 59 por 3 s sobe de novo
let prAlvo = null, quedaT = -1e9;
const PODERES_NOVOS = P.get('poderes') !== 'antigos'; const GLB_PODERES = ['pedra_funda', 'lanca', 'espada_luz', 'cetro_farao', 'cristal_trevas', 'tocha_gideao']; let poderes = null;
const PZ = new Proxy({}, { get: (_, k) => poderes ? poderes[k] : () => false }); // ganchos dos poderes (no-op com ?poderes=antigos)
function ajustarQualidade(fps) {
  if (CAPTURA) return; qualT++;
  // desce rápido (1 amostra de 0,5 s abaixo de 56), sobe devagar (8 s a 59+) e nunca sobe de novo por 20 s depois de descer:
  // cada troca realoca os buffers (um tranco), então ela não pode ficar oscilando
  const pr = renderer.getPixelRatio(); const min = Q.mobile ? .8 : .9; const agora = performance.now();
  if (fps < 56 && qualT >= 1 && pr > min) { renderer.setPixelRatio(Math.max(min, +(pr - (fps < 45 ? .2 : .1)).toFixed(2))); redimensionar(); qualT = 0; quedaT = agora; }
  else if (fps >= 59 && qualT >= 16 && pr < Q.pr && agora - quedaT > 20000) { renderer.setPixelRatio(Math.min(Q.pr, +(pr + .1).toFixed(2))); redimensionar(); qualT = 0; }
  else if (fps < 59) qualT = Math.min(qualT, 1);
}

// compila de antemão os shaders de tudo que pode aparecer (LOD1, tropas, heróis ainda fora de cena): sem tranco na 1ª aparição
function aquecerShaders() {
  const tmp = new THREE.Group(); for (const b of Object.values(BASES)) if (b && b.cena) tmp.add(skClone(b.cena)); scene.add(tmp);
  const ocultos = []; scene.traverse(o => { if (!o.visible) { ocultos.push(o); o.visible = true; } });
  // variantes que só nascem no meio da luta (coroa dos guardas = básico sem textura; sombras dos objetos dos poderes)
  const coroa = new THREE.Mesh(new THREE.TorusGeometry(.5, .1, 4, 8), new THREE.MeshBasicMaterial({ color: 0xffc040 })); coroa.castShadow = true; tmp.add(coroa);
  for (const o of [{ transparent: true, opacity: .5, depthWrite: false, blending: THREE.AdditiveBlending }, { map: texB, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }, { transparent: true, opacity: .5 }, {}]) { const m = new THREE.Mesh(coroa.geometry, new THREE.MeshBasicMaterial({ color: 0xffffff, ...o })); tmp.add(m); } // anéis/discos de zona e projéteis de cor
  prepararPalma(); const gq = new THREE.BoxGeometry(.1, .1, .1);
  for (const mt of [matOuroZ, PALMA.mT, PALMA.mF, MAT_COROA].filter(Boolean)) { const m = new THREE.Mesh(gq, mt); m.castShadow = true; tmp.add(m); }
  if (matBloco) for (const cs of [true, false]) { const m = new THREE.Mesh(geoBloco, matBloco); m.castShadow = cs; tmp.add(m); } tmp.add(new THREE.Mesh(GEO_COROA, MAT_COROA)); for (const g of Object.values(GEO_EST)) tmp.add(new THREE.Mesh(g, matOuroZ));
  { const r = new THREE.Mesh(geoPlanoU, new THREE.MeshBasicMaterial({ map: texRachadura(), transparent: true, depthWrite: false, opacity: .9 })); tmp.add(r); } // sobe a textura da rachadura p/ GPU agora
  { const b = new THREE.Mesh(gq, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .5, depthWrite: false, blending: THREE.AdditiveBlending, wireframe: true })); tmp.add(b); }
  colunaLuz(tmp, new THREE.Vector3(), tempoU);
  tmp.add(new THREE.Sprite(new THREE.SpriteMaterial({ map: texB, color: 0xb040ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }))); // geometria compartilhada dos sprites (Decreto de Jezabel)
  tmp.position.copy(camAlvo || new THREE.Vector3());
  try { renderer.compile(scene, camera); renderer.shadowMap.needsUpdate = true; composer.render(0); for (const pr of renderer.info.programs || []) { pr.getUniforms(); pr.getAttributes(); } } catch (e) { console.warn('[aquecer]', e && e.message); } // 1 quadro completo (inclui o passe de sombra)
  for (const o of ocultos) o.visible = false; scene.remove(tmp); coroa.geometry.dispose();
}

// ================= retratos (renderizados dos próprios modelos 3D) =================
const retratos = {}, retratosCorpo = {};
function renderRetrato(id, S, Hh, corpo, tex = null) {
  const rtP = new THREE.WebGLRenderTarget(S, Hh, { samples: 4 }); rtP.texture.colorSpace = THREE.SRGBColorSpace;
  const cena = new THREE.Scene(); cena.environment = scene.environment; cena.environmentIntensity = .5;
  const d = HEROIS[id]; const anim = corpo ? d.anim.idle : 'Idle_Loop';
  const u = new Unidade(BASES[id].cena, BASES[id].clips || clips, { time: d.time, anim: { idle: anim } }); u.obj.rotation.y = corpo ? .38 : .35; u.mixer.update(.6); cena.add(u.obj); if (tex) { vestirMats(u.mats, tex); u.modelo.traverse(o => { if (o.isMesh && o.userData.lod !== undefined) o.visible = o.userData.lod === 0; }); }
  u.obj.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
  cena.add(new THREE.HemisphereLight('#fff4dd', '#45304a', 2)); const dl = new THREE.DirectionalLight('#fff', 3); dl.position.set(2, 3, 4); cena.add(dl); const rl = new THREE.DirectionalLight(d.time === 'luz' ? '#7fb8ff' : '#ff5a7a', 2.4); rl.position.set(-3, 2, -2); cena.add(rl);
  const e = d.esc * (VISUAL[id].corpo === 'f' ? .97 : 1);
  const cam = new THREE.PerspectiveCamera(30, S / Hh, .1, 30);
  if (corpo) { const ec = e > 1.2 ? 1.14 : e, up = e > 1.2 ? .06 : 0; cam.position.set(.3 * ec, (1.02 + up) * ec, 4.4 * ec); cam.lookAt(0, (.97 + up) * ec, 0); }else { const eb = e > 1.2 ? 1.14 : e; const hy = (VISUAL[id].corpo === 'f' ? 1.53 : 1.58) * eb + (e > 1.2 ? .05 : 0); cam.position.set(.3 * eb, hy + .12 * eb, 1.15 * eb); cam.lookAt(0, hy, 0); }
  renderer.setRenderTarget(rtP); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(cena, cam); renderer.setRenderTarget(null);
  const px = new Uint8Array(S * Hh * 4); renderer.readRenderTargetPixels(rtP, 0, 0, S, Hh, px);
  const c = document.createElement('canvas'); c.width = S; c.height = Hh; const g = c.getContext('2d'); const img = g.createImageData(S, Hh);
  for (let y = 0; y < Hh; y++) img.data.set(px.subarray((Hh - 1 - y) * S * 4, (Hh - y) * S * 4), y * S * 4);
  g.putImageData(img, 0, 0); rtP.dispose();
  return c;
}
function retratoRosto(id, tex) {
  const b = renderRetrato(id, 160, 160, false, tex); const c = document.createElement('canvas'); c.width = c.height = 160; const g = c.getContext('2d');
  const gr = g.createRadialGradient(80, 60, 10, 80, 80, 90); const luz = HEROIS[id].time === 'luz'; gr.addColorStop(0, luz ? '#6f9be0' : '#b04a6a'); gr.addColorStop(1, luz ? '#1a2a4d' : '#3a0f22'); g.fillStyle = gr; g.fillRect(0, 0, 160, 160); g.drawImage(b, 0, 0);
  return c;
}
function gerarRetratosSelecao() {
  for (const id of [...LUZ, ...TREVAS]) { retratos[id] = retratoRosto(id); retratosCorpo[id] = renderRetrato(id, 300, 560, true); }
}
// retratos com a veste (cache): usados no HUD, minimapa, tela VS, fim de partida e tela de veste liberada
const retratosVeste = {};
async function retratosDaVeste(id, vid) {
  const k = id + ':' + vid; if (retratosVeste[k]) return retratosVeste[k];
  const t = await carregarVeste(id, vid); if (!t) return null;
  return (retratosVeste[k] = { rosto: retratoRosto(id, t), corpo: renderRetrato(id, 300, 560, true, t) });
}

// ================= tela de seleção =================
const toURL = (c) => c.toDataURL('image/png');
let selLado = null, selHeroi = null;
function abrirSelecao() {
  const el = $('selecao'); el.classList.add('on'); $('hud').classList.remove('on');
  const imgs = (lista) => lista.map(id => `<img src="${toURL(retratosCorpo[id])}" alt="${HEROIS[id].nome}">`).join('');
  $('selLados').innerHTML = `
    <button class="lado luz" data-lado="luz"><div class="fig">${imgs(LUZ)}</div><b>LUZ</b><small>Heróis da fé · Davi, Sansão, Débora e Gideão</small></button>
    <button class="lado trevas" data-lado="trevas"><div class="fig">${imgs(TREVAS)}</div><b>TREVAS</b><small>Vilões das Escrituras · Golias, Faraó, Jezabel e Nabucodonosor</small></button>`;
  el.querySelectorAll('.lado').forEach(b => b.addEventListener('click', () => escolherLado(b.dataset.lado)));
  $('selVoltar').onclick = () => { $('selHerois').hidden = true; $('selLados').hidden = false; $('selPasso').textContent = 'Escolha seu lado'; };
  $('selOk').onclick = () => { if (!selHeroi) return; el.classList.remove('on'); if (SELVA_ON && P.get('modo') !== '1v1') pedirFuncao(selHeroi); else comecarPartida(selHeroi, null); };
  const bg = $('selGaleria'); if (bg) bg.onclick = () => telaGaleria(() => selHeroi && verHeroi(selHeroi));
  const bp = $('selPerfil'); const botaoPerfil = () => { if (bp) bp.innerHTML = `<i>${nivelConta().nivel}</i><span><b>${nomeHtml()}</b><small>Perfil</small></span>`; }; botaoPerfil(); if (bp) bp.onclick = () => telaPerfil(botaoPerfil);
  if (CENA === 'perfil') { perfilExemplo(); botaoPerfil(); telaPerfil(botaoPerfil); }
  if ((!CAPTURA && !AUTO && !perfil().nomeOk) || CENA === 'nome') pedirNome(botaoPerfil);
  const l0 = P.get('lado'); if (l0) escolherLado(l0, P.get('heroi'));
}
function escolherLado(lado, h0) {
  selLado = lado; const lista = lado === 'luz' ? LUZ : TREVAS;
  $('selLados').hidden = true; $('selHerois').hidden = false; $('selecao').dataset.lado = lado;
  $('selPasso').innerHTML = lado === 'luz' ? 'Escolha seu herói da <b class="al">Luz</b>' : 'Escolha seu vilão das <b class="in">Trevas</b>';
  $('selCards').innerHTML = lista.map(id => `<button class="card" data-id="${id}"><img src="${toURL(retratosCorpo[id])}"><b>${HEROIS[id].nome}</b><small>${HEROIS[id].papel}</small></button>`).join('');
  $('selCards').querySelectorAll('.card').forEach(b => b.addEventListener('click', () => verHeroi(b.dataset.id)));
  $('selAdv').innerHTML = `Adversário: um herói <b>${lado === 'luz' ? 'das Trevas' : 'da Luz'}</b> controlado pelo computador`;
  verHeroi(h0 && lista.includes(h0) ? h0 : lista[0]);
}
function verHeroi(id) {
  selHeroi = id; const d = HEROIS[id];
  $('selCards').querySelectorAll('.card').forEach(b => b.classList.toggle('sel', b.dataset.id === id));
  const hab = (k, x) => `<div class="hb"><span class="ic">${iconeHab(id, ({ 1: 'q', 2: 'w', 3: 'e', Ult: 'r' })[k] || String(k).toLowerCase(), x)}</span><div><b><em>${k}</em>${x.nome}</b><small>${x.desc}</small></div></div>`;
  $('selDet').innerHTML = `<h2>${d.nome}<small>${d.titulo} · ${d.papel}</small></h2>
    <div class="hb pas"><span class="ic">${svg(d.icone)}</span><div><b><em>Passiva</em>${d.passiva.nome}</b><small>${d.passiva.desc}</small></div></div>
    ${hab('1', d.hab.q)}${hab('2', d.hab.w)}${hab('3', d.hab.e)}${hab('Ult', d.hab.r)}${htmlVestes(id)}`;
  ligarVestes($('selDet'), id, () => verHeroi(id));
  // o card do herói mostra a veste equipada
  const vid = vesteEquipada(id); const card = $('selCards').querySelector(`.card[data-id="${id}"] img`);
  if (card) { if (vid) retratosDaVeste(id, vid).then(r => { if (r && selHeroi === id) card.src = toURL(r.corpo); }); else card.src = toURL(retratosCorpo[id]); }
}

// ================= loja =================
let lojaAberta = false, lojaAba = 'rec', lojaSel = null;
const podeComprar = (h) => !h.vivo || naFonte(h, 9);
function comprar(h, id) {
  const it = ITENS[id]; const { custo, usa } = custoEfetivo(id, h.itens);
  if (h.ouro < custo) return 'Ouro insuficiente';
  const livre = 6 - h.itens.length + usa.length; if (livre <= 0) return 'Inventário cheio (6 itens)';
  for (const c of usa) h.itens.splice(h.itens.indexOf(c), 1);
  h.ouro -= custo; h.itens.push(id); recalcular(h); return null;
}
function vender(h, id) { const i = h.itens.indexOf(id); if (i < 0) return; if (!podeComprar(h)) { if (h === jogador) aviso("Volte à base para vender", true); return; } h.itens.splice(i, 1); h.ouro += Math.round(ITENS[id].custo * .7); recalcular(h); }
function abrirLoja(sel) { if (!jogador) return; lojaAberta = true; $('lojaPainel').classList.add('on'); if (sel) lojaSel = sel; if (!lojaSel) lojaSel = proximoRecomendado(jogador) || jogador.def.build[0]; desenharLoja(); }
function fecharLoja() { lojaAberta = false; $('lojaPainel').classList.remove('on'); }
function proximoRecomendado(h) { return h.def.build.find(id => !h.itens.includes(id)); }
// ícones do Tripo (atlas 5×4 de 256 px, ui/itens_tripo.webp, cada um já com moldura dourada); ?modelos=antigos volta aos SVG
const ICONES_TRIPO = ['espadaCurta', 'aljava', 'luvas', 'cota', 'manto', 'cinto', 'rolo', 'oleo', 'salmo', 'sandalias', 'espadaGolias', 'arcoJonatas', 'laminaEude', 'armaduraSaul', 'escudoFe', 'couracaJustica', 'cajadoArao', 'cetroEster', 'harpaDavi'];
if (TRIPO) { document.documentElement.classList.add('icTripo'); document.documentElement.style.setProperty('--tItens', `url(${urlAbs('ui/itens_tripo.webp')})`); }
// ícones de habilidade do Tripo (atlas 4×8 de 192 px, ui/habs_tripo.webp: linha = herói, coluna = Q/W/E/R); ?modelos=antigos volta aos SVG
const HAB_TRIPO = ['davi', 'sansao', 'debora', 'gideao', 'golias', 'farao', 'jezabel', 'nabuco'];
if (TRIPO) document.documentElement.style.setProperty('--tHabs', `url(${urlAbs('ui/habs_tripo.webp')})`);
function iconeHab(hid, k, x) { const r = TRIPO ? HAB_TRIPO.indexOf(hid) : -1; const c = 'qwer'.indexOf(k);
  if (r < 0 || c < 0) return svg(x.icone);
  return `<i class="icHab" style="background-position:${(c * 100 / 3).toFixed(3)}% ${(r * 100 / 7).toFixed(3)}%"></i>`; }
// botão de ataque básico com arte do Tripo (atlas 4×2 de 192 px, ui/ataques_tripo.webp, na ordem HAB_TRIPO). Gere com tools/atlas_ataques.py e ligue aqui.
const ATK_TRIPO = true;
if (TRIPO && ATK_TRIPO) document.documentElement.style.setProperty('--tAtk', `url(${urlAbs('ui/ataques_tripo.webp')})`);
const ATK_FALTA = ['nabuco']; // arte do Nabucodonosor ainda não veio (a pasta tinha o Davi repetido): fica o ícone antigo
function iconeAtaque(hid, d) { const i = TRIPO && ATK_TRIPO && !ATK_FALTA.includes(hid) ? HAB_TRIPO.indexOf(hid) : -1; if (i < 0) return svg(d.icone);
  return `<i class="icHab icAtk" style="background-position:${((i % 4) * 100 / 3).toFixed(3)}% ${((i / 4) | 0) * 100}%"></i>`; }
function iconeItem(id, extra = '') { const it = ITENS[id]; const n = TRIPO ? ICONES_TRIPO.indexOf(id) : -1;
  if (n >= 0) return `<span class="it tp ${it.cat} ${it.receita ? 'comp' : ''} ${extra}" data-id="${id}" style="background-position:${(n % 5) * 25}% ${((n / 5) | 0) * 100 / 3}%"></span>`;
  return `<span class="it ${it.cat} ${it.receita ? 'comp' : ''} ${extra}" data-id="${id}">${svg(it.icone)}</span>`; }
function desenharLoja() {
  const h = jogador; lojaChave = Math.floor(h.ouro) + '|' + podeComprar(h) + '|' + h.itens.join(); const el = $('lojaPainel'); const pode = podeComprar(h);
  const abas = [['rec', 'Recomendado'], ['ataque', 'Ataque'], ['defesa', 'Defesa'], ['habilidade', 'Habilidade']];
  let grade = '';
  if (lojaAba === 'rec') {
    grade = `<div class="rotulo">Build recomendada · ${h.def.nome}</div><div class="build">${h.def.build.map((id, i) => `${i ? '<i class="seta">›</i>' : ''}<button class="item ${h.itens.includes(id) ? 'tem' : ''} ${lojaSel === id ? 'sel' : ''}" data-id="${id}">${iconeItem(id)}<small>${ITENS[id].nome}</small>${precoHtml(id, h)}</button>`).join('')}</div>`;
    const prox = proximoRecomendado(h); if (prox && ITENS[prox].receita) grade += `<div class="rotulo">Componentes do próximo item</div><div class="grade">${[...new Set(ITENS[prox].receita)].map(c => btnItem(c)).join('')}</div>`;
  } else {
    const ids = Object.keys(ITENS).filter(id => ITENS[id].cat === lojaAba);
    grade = `<div class="rotulo">Itens completos</div><div class="grade">${ids.filter(i => ITENS[i].receita).map(btnItem).join('')}</div><div class="rotulo">Componentes</div><div class="grade">${ids.filter(i => !ITENS[i].receita).map(btnItem).join('')}</div>`;
  }
  const it = ITENS[lojaSel]; const { custo, usa } = custoEfetivo(lojaSel, h.itens);
  const arvore = it.receita ? `<div class="arvore"><div class="no topo">${iconeItem(lojaSel)}${precoHtml(lojaSel, h)}</div><div class="ramos" style="--n:${it.receita.length}">${it.receita.map(c => `<div class="no ${usa.includes(c) ? 'tem' : ''}" data-id="${c}">${iconeItem(c)}<b>${fmt(ITENS[c].custo)}</b></div>`).join('')}</div><div class="rec">+ ${fmt(it.custo - it.receita.reduce((a, c) => a + ITENS[c].custo, 0))} de receita</div></div>` :
    `<div class="usadoEm"><div class="rotulo">Usado em</div>${Object.keys(ITENS).filter(i => (ITENS[i].receita || []).includes(lojaSel)).map(i => `<button class="mini" data-id="${i}">${iconeItem(i)}<small>${ITENS[i].nome}</small></button>`).join('')}</div>`;
  const temIt = h.itens.includes(lojaSel);
  const msg = !pode ? 'Volte à base (ou aguarde o renascimento) para comprar' : h.ouro < custo ? `Faltam ${fmt(custo - h.ouro)} de ouro` : '';
  el.innerHTML = `<div class="janela">
    <div class="topo"><b class="tit">LOJA</b><span class="ouroL"><span class="moeda"></span>${fmt(h.ouro)}</span><span class="st ${pode ? 'ok' : ''}">${pode ? 'Compras liberadas' : 'Compras só na base ou enquanto estiver morto'}</span><button class="fechar" aria-label="Fechar">✕</button></div>
    <div class="corpo"><div class="abas">${abas.map(([k, n]) => `<button class="aba ${lojaAba === k ? 'on' : ''}" data-aba="${k}">${n}</button>`).join('')}</div>
      <div class="lista">${grade}</div>
      <div class="det">${iconeItem(lojaSel, 'grande')}<h3>${it.nome}</h3><div class="cat">${CATS[it.cat]}${it.receita ? ' · item completo' : ' · componente'}</div>
        <ul class="sts">${Object.entries(it.st).map(([k, v]) => `<li>${fmtSt(k, v)}</li>`).join('')}</ul>${it.passiva ? `<p class="pas">${it.passiva}</p>` : ''}${it.lore ? `<p class="lore">${it.lore}</p>` : ''}
        ${arvore}
        <div class="compra"><button class="bComprar" ${pode && h.ouro >= custo ? '' : 'disabled'}>Comprar <b>${fmt(custo)}</b></button>${temIt && pode ? `<button class="bVender">Vender ${fmt(it.custo * .7)}</button>` : ''}</div><div class="msg">${msg}</div></div></div>
    <div class="inv">${Array.from({ length: 6 }, (_, i) => h.itens[i] ? `<button class="slot" data-id="${h.itens[i]}">${iconeItem(h.itens[i])}</button>` : '<span class="slot vazio"></span>').join('')}<div class="stsH">${['ad', 'ap', 'arm', 'rm', 'as', 'ms'].map(k => `<span>${{ ad: 'AD', ap: 'PH', arm: 'ARM', rm: 'RM', as: 'VA', ms: 'VM' }[k]} <b>${k === 'as' || k === 'ms' ? Math.round((h.st[k]) * 100) + '%' : Math.round(h.st[k])}</b></span>`).join('')}</div></div>
  </div>`;
  el.querySelector('.fechar').onclick = fecharLoja;
  el.querySelectorAll('.aba').forEach(b => b.onclick = () => { lojaAba = b.dataset.aba; desenharLoja(); });
  el.querySelectorAll('[data-id]').forEach(b => { if (b.classList.contains('it')) return; b.onclick = (e) => { e.stopPropagation(); lojaSel = b.dataset.id; desenharLoja(); }; });
  const bc = el.querySelector('.bComprar'); if (bc) bc.onclick = () => { const erro = comprar(h, lojaSel); if (erro) aviso(erro, true); else { aviso('Comprado: ' + it.nome); const n = proximoRecomendado(h); if (lojaAba === 'rec' && n) lojaSel = n; } desenharLoja(); };
  const bv = el.querySelector('.bVender'); if (bv) bv.onclick = () => { vender(h, lojaSel); desenharLoja(); };
}
// preço com desconto de receita (estilo WR): total − componentes que você já tem; mostra o cheio riscado quando há desconto
function precoHtml(id, h) { const { custo } = custoEfetivo(id, h.itens); const cheio = ITENS[id].custo; return custo < cheio && !h.itens.includes(id) ? `<b class="desc"><s>${fmt(cheio)}</s> ${fmt(custo)}</b>` : `<b>${fmt(cheio)}</b>`; }
function btnItem(id) { const h = jogador; const { custo } = custoEfetivo(id, h.itens); return `<button class="item ${lojaSel === id ? 'sel' : ''} ${h.itens.includes(id) ? 'tem' : ''} ${h.ouro >= custo ? 'da' : ''}" data-id="${id}">${iconeItem(id)}<small>${ITENS[id].nome}</small>${precoHtml(id, h)}</button>`; }
let lojaT = 0, lojaChave = '';

// ================= ouro, narrador, parada de impacto (top 10: itens 3, 4, 5, 7) =================
let paradaT = 0; function paradaImpacto(t) { paradaT = Math.max(paradaT, t); }
let pulsoT = 0;
function pulsarOuro() { const el = $('loja'); if (!el || performance.now() - pulsoT < 120) return; pulsoT = performance.now(); el.classList.remove('pulso'); void el.offsetWidth; el.classList.add('pulso'); }
// ouro com moeda subindo ("tlim"); dividido = sem o último golpe (cinza, menor, sem som)
function ganharOuro(h, v, pos, dividido = false) {
  if (!h || v <= 0) return; v = Math.round(v * OURO_K); h.ouro += v; if (h.stats) h.stats.ouroTotal += v;
  if (h !== jogador || !pos) return;
  textos.add(pos.clone().add(new THREE.Vector3(0, dividido ? .6 : 1, 0)), dividido ? '+' + v + ' dividido' : '+' + v, dividido ? 'ouroD' : 'ouro');
  if (!dividido) { som('moeda', null, .7); pulsarOuro(); }
}
// narrador: faixa grande com retratos + fanfarra sintetizada; fila curta para não empilhar
const filaAnuncio = []; let anuncioT = 0;
function anunciar(tipo, m, v, bonus = 0, timeNucleo = null) {
  const f = NARRADOR[tipo]; if (!f) return false; estado.anunciou = !!m;
  let [tit, sub] = f; let mal = false;
  if (tipo === 'nucleoExposto') { mal = timeNucleo === jogadorTime(); tit = mal ? 'Nosso Núcleo está exposto!' : 'O Núcleo inimigo está exposto!'; sub = mal ? 'Defenda a base' : 'Avancem com as tropas'; }
  else if (tipo === 'torreAliada') mal = true;
  else if (m) mal = m.time !== jogadorTime();
  if (tipo === 'fimSerie' && bonus) sub += ` · +${bonus} de ouro`;
  filaAnuncio.push({ tit, sub, mal, m, v }); if (filaAnuncio.length > 2) filaAnuncio.shift();
  if (anuncioT <= 0) proximoAnuncio();
  return true;
}
function proximoAnuncio() {
  const a = filaAnuncio.shift(); const el = $('anuncio'); if (!a || !el) return;
  const ret = (u) => u ? `<canvas width="80" height="80" class="${u.time === jogadorTime() ? 'al' : 'in'}" data-r="${u.id}"></canvas>` : '';
  el.innerHTML = `${ret(a.m)}<div class="tx"><b>${a.tit}</b><small>${a.sub}</small></div>${a.v ? `<i class="x">⚔</i>${ret(a.v)}` : ''}`;
  el.querySelectorAll('canvas').forEach(c => { const img = retratos[c.dataset.r]; if (img) c.getContext('2d').drawImage(img, 0, 0, 80, 80); });
  el.className = 'on' + (a.mal ? ' mal' : ''); som(a.mal ? 'anuncioMal' : 'anuncio', null, .9); anuncioT = 2.6;
}
function atualizarAnuncio(dt) { if (anuncioT > 0) { anuncioT -= dt; if (anuncioT <= 0) { $('anuncio').className = ''; if (filaAnuncio.length) setTimeout(proximoAnuncio, 250); } } }
// registro de abates (canto direito) com retratos
function feedAbate(m, v, bonus) {
  const el = $('feed'); if (!el) return; const d = document.createElement('div');
  const ret = (u) => `<canvas width="48" height="48" class="${u.time === jogadorTime() ? 'al' : 'in'}"></canvas>`;
  d.className = 'lin ' + (v.time === jogadorTime() ? 'mal' : 'bom'); d.innerHTML = `${m ? ret(m) : '<span class="tropa">⚔</span>'}<i>${bonus ? '✦' : '›'}</i>${ret(v)}`;
  const cs = d.querySelectorAll('canvas'); const us = m ? [m, v] : [v]; cs.forEach((c, i) => { const img = retratos[us[i].id]; if (img) c.getContext('2d').drawImage(img, 0, 0, 48, 48); });
  el.prepend(d); while (el.children.length > 3) el.lastChild.remove(); setTimeout(() => d.classList.add('sai'), 5500); setTimeout(() => d.remove(), 6200);
}

// ================= compra rápida (item 5) =================
function proximaPecaId(h) {
  for (const id of h.def.build) {
    if (h.itens.includes(id)) continue; const it = ITENS[id]; if (!it.receita) return id;
    const { custo } = custoEfetivo(id, h.itens); if (h.ouro >= custo) return id;
    const falta = it.receita.find((c, i) => it.receita.slice(0, i + 1).filter(x => x === c).length > h.itens.filter(x => x === c).length);
    return falta || id;
  }
  return null;
}
let rapidaChave = '';
function atualizarCompraRapida() {
  const el = $('compraRapida'); if (!el || !jogador) return; const h = jogador; const id = proximaPecaId(h);
  if (!id || h.itens.length >= 6 && !ITENS[id].receita) { el.hidden = true; return; } el.hidden = false;
  const { custo } = custoEfetivo(id, h.itens); const pode = podeComprar(h), tem = h.ouro >= custo;
  const k = id + '|' + custo + '|' + pode + '|' + tem + '|' + (h.reserva === id); if (k === rapidaChave) return; rapidaChave = k;
  el.className = (tem ? 'da ' : '') + (tem && pode ? 'pode ' : '') + (h.reserva === id ? 'res' : '');
  el.innerHTML = `${iconeItem(id)}<b>${h.reserva === id ? 'Reservado' : tem && pode ? 'Comprar ' + fmt(custo) : tem ? 'Ao chegar' : fmt(custo)}</b><small>${ITENS[id].nome}</small>`;
  el.dataset.id = id;
}
function tocarCompraRapida() {
  const h = jogador; if (!h) return; const id = proximaPecaId(h); if (!id) return; const { custo } = custoEfetivo(id, h.itens);
  if (podeComprar(h)) { const e = comprar(h, id); if (e) aviso(e, true); else { aviso('Comprado: ' + ITENS[id].nome); som('moeda'); } }
  else if (h.ouro >= custo) { h.reserva = h.reserva === id ? null : id; aviso(h.reserva ? `${ITENS[id].nome}: compra automática ao chegar na base` : 'Reserva cancelada'); }
  else aviso(`Faltam ${fmt(custo - h.ouro)} de ouro para ${ITENS[id].nome}`, true);
  rapidaChave = ''; atualizarCompraRapida();
}

// ================= mira arrastando (item 10) =================
let indMira = null; const geoAnelMira = new THREE.RingGeometry(.955, 1, 128, 1).rotateX(-Math.PI / 2); // anel mais grosso: visível no chão claro (sol forte / tela de celular)
function criarIndicadores() {
  const cor = 0x4fb4ff; const mb = (o) => new THREE.MeshBasicMaterial({ color: cor, transparent: true, depthWrite: false, depthTest: false, toneMapped: false, ...o });
  const linha = new THREE.Mesh(geoRet, mb({ opacity: .6 })); const disco = new THREE.Mesh(geoDiscoT, mb({ opacity: .42 })); const borda = new THREE.Mesh(geoAnelMira, mb({ opacity: .95 })); const alcance = new THREE.Mesh(geoAnelMira, mb({ opacity: .85 }));
  for (const m of [linha, disco, borda, alcance]) { m.renderOrder = 7; m.visible = false; m.frustumCulled = false; scene.add(m); }
  indMira = { linha, disco, borda, alcance };
}
const MIRA = { k: null, id: null, x0: 0, y0: 0, dx: 0, dy: 0, arrastou: false, cancela: false };
const RAIO_MIRA = () => Math.min(W, H) * .16;
function esconderMira() { if (indMira) for (const m of Object.values(indMira)) m.visible = false; $('cancelaMira').className = ''; }
function desenharMira() {
  if (!indMira) criarIndicadores(); const h = jogador; const d = h.def.hab[MIRA.k]; const p = h.obj.position;
  const L = Math.hypot(MIRA.dx, MIRA.dy); const dir = L > 1 ? new THREE.Vector3(...(([a, b]) => [a, 0, b])(telaMundo(MIRA.dx / L, MIRA.dy / L))) : frente(h); const frac = Math.min(1, L / RAIO_MIRA());
  const alc = d.alc || d.comp || (d.centro === 'frente' ? (d.dist || 2) + (d.raio || 1) : 0) || d.dist || 8;
  const { linha, disco, borda, alcance } = indMira; for (const m of Object.values(indMira)) m.visible = false;
  alcance.visible = true; alcance.position.set(p.x, .09, p.z); alcance.scale.setScalar(alc);
  const T = d.tipo;
  if (T === 'proj' || T === 'linha' || T === 'dash' || (T === 'area' && d.centro === 'frente')) { const comp = T === 'dash' ? d.dist || 5 : alc; linha.visible = true; linha.position.set(p.x, .1, p.z); linha.rotation.y = Math.atan2(dir.x, dir.z); linha.scale.set(d.larg || d.tam || 1.3, 1, comp); }
  else if (d.centro === 'self' || T === 'buff') { disco.visible = borda.visible = true; const r = d.raio || 2.5; disco.position.set(p.x, .1, p.z); borda.position.copy(disco.position); disco.scale.setScalar(r); borda.scale.setScalar(r); }
  else { const c = p.clone().addScaledVector(dir, Math.max(1.2, alc * frac)); const r = d.raio || 2.2; disco.visible = borda.visible = true; disco.position.set(c.x, .11, c.z); borda.position.copy(disco.position); disco.scale.setScalar(r); borda.scale.setScalar(r); }
  const cor = MIRA.cancela ? 0xff3a4a : 0x2f9dff; for (const m of Object.values(indMira)) m.material.color.setHex(cor);
  $('cancelaMira').className = 'on' + (MIRA.cancela ? ' sobre' : '');
}
function sobreCancelar(e) { const r = $('cancelaMira').getBoundingClientRect(); const pad = 14; return e.clientX > r.left - pad && e.clientX < r.right + pad && e.clientY > r.top - pad && e.clientY < r.bottom + pad; }
function ligarMira(k) {
  const el = $('b' + k.toUpperCase());
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (e.target.closest('.mais') || !jogador || estado.fim) return; el.classList.add('press'); try { el.setPointerCapture(e.pointerId); } catch (_) { } Object.assign(MIRA, { k, id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, arrastou: false, cancela: false }); });
  el.addEventListener('pointermove', (e) => { if (MIRA.id !== e.pointerId || MIRA.k !== k) return; MIRA.dx = e.clientX - MIRA.x0; MIRA.dy = e.clientY - MIRA.y0; if (!MIRA.arrastou && Math.hypot(MIRA.dx, MIRA.dy) > 14) MIRA.arrastou = true; if (MIRA.arrastou && jogador && jogador.hab[k].nv) { MIRA.cancela = sobreCancelar(e); desenharMira(); } });
  const fim = (e, cancelado) => {
    if (MIRA.id !== e.pointerId || MIRA.k !== k) return; el.classList.remove('press'); const m = { ...MIRA }; MIRA.k = MIRA.id = null; esconderMira();
    if (cancelado || !jogador || estado.fim) return;
    if (m.arrastou && sobreCancelar(e)) { som('cancelar'); aviso('Habilidade cancelada'); return; }
    if (m.arrastou) { const L = Math.hypot(m.dx, m.dy); jogador.mira = { dir: new THREE.Vector3(...(([a, b]) => [a, 0, b])(telaMundo(m.dx / L, m.dy / L))), frac: Math.min(1, L / RAIO_MIRA()) }; }
    usarHab(jogador, k); jogador.mira = null;
  };
  el.addEventListener('pointerup', (e) => fim(e, false)); el.addEventListener('pointercancel', (e) => fim(e, true));
}
// travar a mira no inimigo: toque no retrato dele (4 s, anel dourado)
const anelTrava = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.3, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: .95, depthWrite: false, blending: THREE.AdditiveBlending })); anelTrava.position.y = .12; anelTrava.visible = false; anelTrava.renderOrder = 7;
function travarInimigo() { if (!jogador || !bot || !bot.vivo) return; jogador.trava = { u: bot, t: 4 }; if (anelTrava.parent !== bot.obj) bot.obj.add(anelTrava); anelTrava.visible = true; anelTrava.scale.setScalar(1 / bot.obj.scale.x * (bot.raio + .3)); aviso(`Mira travada em ${bot.def.nome}`); $('inimInfo').classList.add('trava'); setTimeout(() => $('inimInfo').classList.remove('trava'), 4000); }

// ================= tela VS (item 8) =================
const nomeVeste = (id, vid) => vid ? vesteDe(id, vid).nome : VESTES[id].padrao;
function telaVS(id, vsId, vid, dur = 2.8) {
  const el = $('vs'); const dica = sortear([...(DICAS[id] || []), ...DICAS.geral]);
  const img = (hid, v) => { const r = v && retratosVeste[hid + ':' + v]; return toURL(r ? r.corpo : retratosCorpo[hid]); };
  const card = (hid, eu, v) => { const d = HEROIS[hid]; return `<div class="card ${d.time}"><img src="${img(hid, v)}"><span class="skin">Veste: ${nomeVeste(hid, v)}</span><div class="rod"><b>${d.nome}</b><small>${d.titulo} · ${d.papel}</small><div class="j"><span>${eu ? nomeHtml() : `Computador (${DIF.nome})`}</span><span class="st">0%</span></div><div class="barra"><i></i></div></div></div>`; };
  const [a, b] = HEROIS[id].time === 'luz' ? [card(id, true, vid), card(vsId, false, null)] : [card(vsId, false, null), card(id, true, vid)];
  el.innerHTML = `<div class="logo"><span>LUZ</span><i>x</i><span>TREVAS</span></div><div class="cards">${a}<div class="vsT">VS</div>${b}</div><div class="pct">Preparando a batalha…</div><div class="dica"><b>${sortear(VERSOS)}</b><p>Dica: ${dica}</p></div>`;
  el.className = 'on'; const t0 = performance.now(); const barras = el.querySelectorAll('.barra i'), sts = el.querySelectorAll('.st');
  return new Promise(res => {
    const tick = () => { const k = Math.min(1, (performance.now() - t0) / (dur * 1000)); barras.forEach((b, i) => { const v = Math.min(1, k * (i ? 1.18 : 1.05)); b.style.width = (v * 100).toFixed(0) + '%'; sts[i].textContent = v >= 1 ? 'Pronto' : Math.round(v * 100) + '%'; });
      if (k < 1) requestAnimationFrame(tick); else res(); };
    if (CAPTURA) { barras.forEach(b => b.style.width = '86%'); sts.forEach((s, i) => s.textContent = i ? '72%' : 'Pronto'); res(); } else tick();
  });
}

// ================= vestes: seletor, veste liberada, galeria (item 9) =================
function htmlVestes(id) {
  const V = VESTES[id]; const eq = vesteEquipada(id);
  const b = (vid, nome, livre, prog) => `<button class="vst ${eq === vid || (!eq && !vid) ? 'on' : ''} ${livre ? '' : 'trancada'}" data-v="${vid || ''}"><canvas width="72" height="72" data-h="${id}" data-v="${vid || ''}"></canvas><b>${nome}</b><small>${livre ? (eq === vid || (!eq && !vid) ? 'Equipada' : 'Vestir') : `🔒 ${prog.atual}/${prog.n}`}</small></button>`;
  return `<div class="vestes"><div class="rot">Vestes</div>${b(null, V.padrao, true)}${V.lista.map(v => b(v.id, v.nome, vesteLiberada(id, v.id), progressoVeste(id, v))).join('')}<div class="req" id="vReq"></div></div>`;
}
function ligarVestes(root, id, aoTrocar) {
  root.querySelectorAll('canvas[data-h]').forEach(async c => { const vid = c.dataset.v; const g = c.getContext('2d'); g.drawImage(retratos[id], 0, 0, 72, 72); if (vid) { const r = await retratosDaVeste(id, vid); if (r) g.drawImage(r.rosto, 0, 0, 72, 72); } });
  root.querySelectorAll('.vst').forEach(b => b.onclick = () => {
    const vid = b.dataset.v || null; const v = vid && vesteDe(id, vid);
    if (v && !vesteLiberada(id, vid)) { const p = progressoVeste(id, v); root.querySelector('#vReq').innerHTML = `<b>${v.nome}</b> · ${v.req} <span class="ouro">(${fmt(p.atual)}/${fmt(p.n)})</span><div class="bar"><i style="width:${(100 * p.atual / p.n).toFixed(0)}%"></i></div>`; return; }
    equipar(id, vid); aoTrocar && aoTrocar(vid);
  });
}
function telaVesteNova(nv, depois) {
  const el = $('vesteNova'); const { heroi: id, veste: v } = nv; const d = HEROIS[id]; const p = progressoVeste(id, v);
  const prox = Object.entries(VESTES).flatMap(([h, V]) => V.lista.map(x => ({ h, x }))).find(o => !vesteLiberada(o.h, o.x.id));
  const pp = prox && progressoVeste(prox.h, prox.x);
  el.innerHTML = `<div class="raios"></div><img class="heroi" alt=""><div class="okObj">✓ Objetivo concluído: ${v.req.replace(/^./, c => c.toLowerCase())}</div>
    <div class="titulo"><small>NOVA VESTE LIBERADA!</small><h1>${d.nome}</h1><h2>${v.nome}</h2>
    <div class="req">${v.req} <b class="ouro">${fmt(p.atual)} / ${fmt(p.n)}</b><div class="bar"><i></i></div></div>
    <div class="vers">${v.verso}</div>
    <div class="btns"><button class="b1" id="vnVestir">Vestir agora</button><button class="b2" id="vnTodas">Ver todas as vestes</button></div>
    ${prox ? `<div class="prox">Próxima: ${HEROIS[prox.h].nome} — ${prox.x.nome} · ${prox.x.req.replace(/^./, c => c.toLowerCase())} (${fmt(pp.atual)}/${fmt(pp.n)})</div>` : ''}</div><button class="fecharV" aria-label="Fechar">✕</button>`;
  retratosDaVeste(id, v.id).then(r => { if (r) el.querySelector('.heroi').src = toURL(r.corpo); });
  el.className = 'on'; som('anuncio', null, .9);
  const fechar = () => { el.className = ''; depois && depois(); };
  $('vnVestir').onclick = () => { equipar(id, v.id); aviso && aviso(`Veste equipada: ${d.nome} — ${v.nome}`); fechar(); };
  $('vnTodas').onclick = () => { el.className = ''; telaGaleria(depois); };
  el.querySelector('.fecharV').onclick = fechar;
}
function telaGaleria(depois) {
  const el = $('galeria'); const ids = [...LUZ, ...TREVAS];
  el.innerHTML = `<div class="janela"><div class="topo"><b>Vestes</b><span>Complete objetivos com cada herói para liberar novas vestes</span><button class="fecharV">✕</button></div><div class="lista">${ids.map(id => { const v = VESTES[id].lista[0]; const p = progressoVeste(id, v); const livre = vesteLiberada(id, v.id); return `<div class="gv ${livre ? 'livre' : ''}"><canvas width="120" height="224" data-h="${id}" data-v="${v.id}"></canvas><b>${HEROIS[id].nome}</b><small>${v.nome}</small><div class="bar"><i style="width:${(100 * p.atual / p.n).toFixed(0)}%"></i></div><em>${livre ? (vesteEquipada(id) === v.id ? 'Equipada' : 'Liberada') : `${v.req} · ${fmt(p.atual)}/${fmt(p.n)}`}</em></div>`; }).join('')}</div></div>`;
  el.className = 'on';
  el.querySelectorAll('canvas').forEach(async c => { const g = c.getContext('2d'); const r = await retratosDaVeste(c.dataset.h, c.dataset.v); if (r) g.drawImage(r.corpo, 0, 0, 120, 224); });
  el.querySelector('.fecharV').onclick = () => { el.className = ''; depois && depois(); };
}

// ================= Perfil (progresso salvo só no aparelho) =================
const escHtml = (t) => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const nomeHtml = () => escHtml(nomeJogador());
const NOMES_CAMPO = { vitorias: 'vitórias', torres: 'torres', cura: 'de cura', abates: 'abates', controles: 'controles', semMorrer: 'vitórias sem morrer', nucleos: 'Núcleos' };
const dataCurta = (t) => { const d = new Date(t); const z = (n) => String(n).padStart(2, '0'); return `${z(d.getDate())}/${z(d.getMonth() + 1)} ${z(d.getHours())}:${z(d.getMinutes())}`; };
function telaPerfil(depois) {
  const el = $('perfilTela'); const p = perfil(); const nv = nivelConta(p.xp); const ids = [...LUZ, ...TREVAS];
  const der = Math.max(0, p.partidas - p.vitorias); const tx = p.partidas ? Math.round(100 * p.vitorias / p.partidas) : 0;
  const hs = ids.map(id => ({ id, s: p.heroi[id] || null })).filter(o => o.s && o.s.partidas > 0).sort((a, b) => b.s.partidas - a.s.partidas || b.s.vitorias - a.s.vitorias);
  const mais = hs[0];
  const med = (x, n) => n ? (x / n).toFixed(1).replace('.', ',') : '–';
  const linhasH = ids.map(id => { const s = p.heroi[id]; const n = s ? s.partidas : 0; return `<tr class="${n ? '' : 'nada'}"><td><canvas width="44" height="44" data-r="${id}"></canvas><b>${HEROIS[id].nome}</b><small class="fn ${HEROIS[id].time}">${(FUNCOES[HEROIS[id].funcao] || {}).nome || ''}</small></td><td>${n}</td><td>${n ? Math.round(100 * s.vitorias / n) + '%' : '–'}</td><td>${n ? `${med(s.abates, n)} / ${med(s.mortes || 0, n)} / ${med(s.assist || 0, n)}` : '–'}</td><td>${n && s.pontos ? `<b class="nt">${nota(Math.round(s.pontos / n))}</b>` : '–'}</td></tr>`; }).join('');
  const hist = p.hist.length ? p.hist.map(m => `<li class="${m.v ? 'vit' : 'der'}"><canvas width="44" height="44" data-r="${m.h}"></canvas><span class="hn"><b>${HEROIS[m.h] ? HEROIS[m.h].nome : m.h}</b><small>${m.vs && HEROIS[m.vs] ? 'x ' + HEROIS[m.vs].nome : ''} · ${mmss(m.dur || 0)}</small></span><span class="res">${m.v ? 'Vitória' : 'Derrota'}</span><span class="kda">${m.k}/${m.d}/${m.a}</span><b class="nt">${m.n}</b><small class="dt">${dataCurta(m.t)}</small></li>`).join('') : '<li class="vazio">Nenhuma partida ainda. Jogue uma para começar seu histórico!</li>';
  const vestes = ids.map(id => { const v = VESTES[id].lista[0]; const pr = progressoVeste(id, v); const livre = vesteLiberada(id, v.id); return `<li class="${livre ? 'livre' : ''}"><canvas width="44" height="44" data-r="${id}" data-v="${livre ? v.id : ''}"></canvas><span><b>${v.nome}</b><small>${livre ? 'Liberada ✓' : v.req}</small><div class="bar"><i style="width:${(100 * pr.atual / pr.n).toFixed(0)}%"></i></div></span><em>${livre ? '✓' : `${fmt(pr.atual)}/${fmt(pr.n)}`}</em></li>`; }).join('');
  const nLivres = ids.filter(id => vesteLiberada(id, VESTES[id].lista[0].id)).length;
  el.innerHTML = `<div class="janela">
    <div class="pfCab">
      <div class="pfAv">${mais ? `<img alt="" src="${toURL(retratosCorpo[mais.id])}">` : '<span>?</span>'}<i class="nv">${nv.nivel}</i></div>
      <div class="pfId"><label class="nome"><input id="pfNome" maxlength="16" value="${escHtml(p.nome)}" aria-label="Nome do jogador" autocomplete="off" spellcheck="false"><span class="lapis">✎</span></label>
        <div class="pfNv"><b>Nível ${nv.nivel}</b> · Caminho do Peregrino <span class="ouro">${fmt(nv.resto)} / ${fmt(nv.falta)} XP</span></div><div class="bar"><i style="width:${(100 * nv.resto / nv.falta).toFixed(1)}%"></i></div></div>
      <div class="pfNums"><div><b>${p.vitorias}</b><small>Vitórias</small></div><div><b>${der}</b><small>Derrotas</small></div><div><b>${p.partidas ? tx + '%' : '–'}</b><small>Taxa de vitória</small></div><div class="mj"><b>${mais ? HEROIS[mais.id].nome : '–'}</b><small>Mais jogado${mais ? ` · ${mais.s.partidas} partidas` : ''}</small></div></div>
      <button class="fecharV" aria-label="Fechar">✕</button>
    </div>
    <div class="pfCols">
      <section class="pfH"><h3>Heróis</h3><div class="rolar"><table><tr><th>Herói</th><th>Part.</th><th>Vit.</th><th>A/M/A</th><th>Nota</th></tr>${linhasH}</table></div></section>
      <section class="pfU"><h3>Últimas partidas <small>${p.hist.length}/10</small></h3><div class="rolar"><ul>${hist}</ul></div></section>
      <section class="pfV"><h3>Vestes <small>${nLivres}/${ids.length} liberadas</small></h3><div class="rolar"><ul>${vestes}</ul></div></section>
    </div>
    <div class="pfRod"><small>Salvo só neste aparelho</small><button id="pfReset" class="perigo">Resetar progresso</button></div>
    <div class="pfConf" hidden><div class="cx"><b>Resetar progresso?</b><p>Isso apaga seu nível, as estatísticas, as últimas partidas e as vestes liberadas <u>deste aparelho</u>. Não dá para desfazer.</p><div class="bt"><button class="sec" id="pfNao">Cancelar</button><button class="perigo" id="pfSim">Sim, resetar</button></div></div></div>
  </div>`;
  el.className = 'on';
  el.querySelectorAll('canvas[data-r]').forEach(async c => { const g = c.getContext('2d'); const id = c.dataset.r; if (!retratos[id]) return; g.drawImage(retratos[id], 0, 0, 44, 44); if (c.dataset.v) { const r = await retratosDaVeste(id, c.dataset.v); if (r) g.drawImage(r.rosto, 0, 0, 44, 44); } });
  const inp = el.querySelector('#pfNome');
  const salvarNome = () => { inp.value = mudarNome(inp.value); document.querySelectorAll('.hpUnid.heroi.eu .nm').forEach(n => n.textContent = nomeJogador()); };
  inp.addEventListener('change', salvarNome); inp.addEventListener('blur', salvarNome); inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') inp.blur(); e.stopPropagation(); });
  const conf = el.querySelector('.pfConf');
  $('pfReset').onclick = () => { conf.hidden = false; };
  $('pfNao').onclick = () => { conf.hidden = true; };
  conf.onclick = (e) => { if (e.target === conf) conf.hidden = true; };
  $('pfSim').onclick = () => { resetarPerfil(); salvarPerfil(); telaPerfil(depois); aviso && aviso('Progresso resetado'); };
  el.querySelector('.fecharV').onclick = () => { salvarNome(); el.className = ''; depois && depois(); };
}
// primeira vez: pergunta o nome (salvo no perfil do aparelho)
function pedirNome(depois) {
  const el = $('nomeTela'); if (!el) return; const p = perfil();
  el.innerHTML = `<div class="cx"><div class="logo"><span>LUZ</span><i>x</i><span>TREVAS</span></div><b>Bem-vindo, peregrino!</b><p>Como você quer ser chamado na batalha?</p>
    <input id="nomeIn" maxlength="16" placeholder="Seu nome" autocomplete="off" spellcheck="false" enterkeyhint="done" value="${p.nome === 'Peregrino' ? '' : escHtml(p.nome)}">
    <small>Aparece sobre o seu herói e no Perfil. Dá para trocar depois no Perfil.</small>
    <div class="bt"><button class="sec" id="nomePular">Agora não</button><button id="nomeOk">Começar</button></div></div>`;
  el.className = 'on'; const inp = $('nomeIn');
  const fim = (salvar) => { if (salvar && inp.value.trim()) mudarNome(inp.value); p.nomeOk = true; salvarPerfil(); el.className = ''; depois && depois(); };
  $('nomeOk').onclick = () => fim(true); $('nomePular').onclick = () => fim(false);
  inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') fim(true); });
  if (!CAPTURA) setTimeout(() => inp.focus(), 250); else inp.value = 'Edson';
}
// dados de exemplo para prints (?cap&cena=perfil) — só na memória, nada é salvo
function perfilExemplo() {
  const p = perfil(); p.nome = 'Edson'; p.xp = 2380; p.partidas = 34; p.vitorias = 21;
  const H = { davi: [14, 10, 71, 30, 88, 4], golias: [7, 4, 22, 25, 51, 1], gideao: [5, 3, 34, 19, 20, 0], debora: [3, 2, 9, 12, 41, 0], farao: [3, 1, 11, 14, 19, 0], jezabel: [2, 1, 13, 7, 5, 1] };
  for (const [id, [n, v, k, d, a, sm]] of Object.entries(H)) Object.assign(statsHeroi(id), { partidas: n, vitorias: v, abates: k, mortes: d, assist: a, semMorrer: sm, nucleos: v, pontos: n * (60 + (k / n) * 3), torres: Math.round(n * 1.4), cura: id === 'debora' ? 3900 : 800, controles: n * 6 });
  statsHeroi('davi').vitorias = 10; p.vestes = { davi: ['rei'], gideao: ['tocha'] };
  const agora = new Date(2026, 8, 30, 10, 41).getTime();
  const L = [['davi', 'golias', 1, 9, 2, 6, 'S'], ['davi', 'nabuco', 1, 6, 3, 8, 'A'], ['golias', 'sansao', 0, 2, 5, 7, 'B'], ['davi', 'farao', 1, 11, 1, 4, 'S+'], ['gideao', 'jezabel', 0, 4, 6, 3, 'C'], ['debora', 'golias', 1, 3, 2, 14, 'A'], ['jezabel', 'davi', 1, 8, 3, 2, 'S'], ['davi', 'golias', 0, 3, 5, 4, 'B'], ['farao', 'gideao', 1, 5, 2, 9, 'A'], ['golias', 'debora', 1, 4, 1, 10, 'A']];
  p.hist = L.map(([h, vs, v, k, d, a, n], i) => ({ h, vs, v, k, d, a, n, xp: 0, dur: 520 + i * 23, t: agora - i * 5.3 * 3600e3 }));
}

// ================= fim de partida (item 9 do plano: tela de resultados) =================
function registrarPerfil(venceu) {
  if (estado.salvo || !jogador) return null; estado.salvo = true; const h = jogador;
  const p = perfil(); const r = bot; const t = estado.tempo;
  const pts = pontuacao(h, { tempo: t, danoTotal: h.stats.danoHerois + (r ? r.stats.danoHerois : 0), venceu }); const notaP = nota(pts);
  const xp = xpPartida({ venceu, abates: h.abates, assist: h.assist, notaP }); const xpG = xp.total;
  const antes = nivelConta(p.xp); p.xp += xpG; p.partidas++; if (venceu) p.vitorias++;
  const s = statsHeroi(h.id); s.partidas++; if (venceu) { s.vitorias++; s.nucleos++; if (h.mortes === 0) s.semMorrer++; }
  s.abates += h.abates; s.torres += h.stats.torres; s.cura += Math.round(h.stats.cura); s.controles += h.stats.controles;
  s.mortes += h.mortes; s.assist += h.assist; s.pontos += pts; s.melhor = Math.max(s.melhor || 0, pts); s.tempo += Math.round(t);
  p.hist.unshift({ h: h.id, vs: r ? r.id : null, v: venceu ? 1 : 0, k: h.abates, d: h.mortes, a: h.assist, n: notaP, xp: xpG, dur: Math.round(t), t: Date.now() }); p.hist = p.hist.slice(0, 10);
  salvarPerfil(); const novas = conferirVestes();
  return { xpG, partes: xp.partes, antes, depois: nivelConta(p.xp), novas };
}
function fimDePartida(vencedor, nucleo) {
  if (estado.fim) return;
  estado.fim = { vencedor, nucleo, t: estado.tempo }; fecharLoja(); esconderMira();
  for (const h of herois) h.stats.historico.push(h.stats.ouroTotal);
  const p = nucleo.obj.position;
  for (let i = 0; i < 5; i++) agendar(i * .25, () => { tremer(.8); aneis.add(p, new THREE.Color(...(nucleo.time === 'luz' ? [.6, .85, 1] : [1, .3, .4])), 1, 12 + i * 3, 1.2); for (let k = 0; k < 60; k++) { const a = Math.random() * 6.28, s = 4 + Math.random() * 12; fx.emit(p.x, 3 + Math.random() * 3, p.z, { vel: [Math.cos(a) * s, 3 + Math.random() * 10, Math.sin(a) * s], cor: nucleo.time === 'luz' ? [.6, .85, 1] : [1, .3, .4], vida: 1.4, t0: .8, t1: 0, grav: 8, drag: .8 }); } });
  const venceu = jogador && vencedor === jogador.time;
  const reg = registrarPerfil(venceu);
  agendar(CAPTURA ? .01 : 2.4, () => mostrarFim(venceu, reg));
}
function graficoOuro(a, b) {
  const W2 = 372, H2 = 70, n = Math.max(a.length, b.length), mx = Math.max(...a, ...b, 1);
  const pts = (l) => l.map((v, i) => `${(i / Math.max(1, n - 1) * W2).toFixed(1)},${(H2 - 4 - v / mx * (H2 - 10)).toFixed(1)}`).join(' ');
  const marcas = Array.from({ length: Math.floor(estado.fim.t / 120) }, (_, i) => { const x = ((i + 1) * 12 / Math.max(1, n - 1)) * W2; return `<line x1="${x}" x2="${x}" y1="0" y2="${H2}" stroke="#ffffff18"/><text x="${x + 2}" y="${H2 - 2}" fill="#ffffff66" font-size="8">${(i + 1) * 2}:00</text>`; }).join('');
  return `<svg viewBox="0 0 ${W2} ${H2}" preserveAspectRatio="none">${marcas}<polyline fill="none" stroke="#4fb4ff" stroke-width="2" points="${pts(a)}"/><polyline fill="none" stroke="#ff4a6a" stroke-width="2" points="${pts(b)}"/></svg>`;
}
const ICON_MED = { pedra: '🪨', trigo: '🌾', muro: '🧱', estrela: '⭐', escudo: '🛡️', coroa: '👑', folha: '🌿' };
function mostrarFim(venceu, reg) {
  reg = reg || { xpG: 0, antes: nivelConta(), depois: nivelConta(), novas: [] };
  const el = $('fim'); el.className = 'on ' + (venceu ? 'vit' : 'der'); $('hud').classList.add('fimJogo'); avisoEl.className = ''; avisoT = 0;
  const h = jogador, r = bot, t = estado.fim.t; const TODOS = [h, aliado, r, cacador].filter(Boolean); const danoTotal = TODOS.reduce((a, u) => a + u.stats.danoHerois, 0);
  const sc = (u) => pontuacao(u, { tempo: t, danoTotal, venceu: u.time === h.time ? venceu : !venceu }); const sH = sc(h), sR = sc(r); const SC = new Map(TODOS.map(u => [u, sc(u)]));
  const mvp = TODOS.reduce((a, u) => SC.get(u) > SC.get(a) ? u : a, h); const nMvp = nota(SC.get(mvp));
  const med = medalhas(h, r); const vid = vesteEquipada(h.id);
  const v0 = VESTES[h.id].lista[0]; const pv = progressoVeste(h.id, v0); const lib = vesteLiberada(h.id, v0.id);
  const nomeU = (u) => u === h ? nomeHtml() : 'Computador';
  const linha = (u, cols) => `<tr class="${u === h ? 'eu' : u.time === h.time ? 'al' : 'in'}"><td><canvas width="40" height="40" data-r="${u.id}"></canvas>${u.def.nome} <small>${u === h ? '(você)' : u.time === h.time ? '(aliado)' : '(PC)'}${u.funcao ? ` <small class="fn">${u.funcao === 'selva' ? 'Selva' : 'Meio'}</small>` : ''}</small></td>${cols(u).map(c => `<td>${c}</td>`).join('')}</tr>`;
  const ouroF = (u) => fmt(u.stats.ouroTotal);
  const abas = {
    resumo: `<table><tr><th>Herói</th><th>Nota</th><th>A/M/A</th><th>Dano a heróis</th><th>Dano sofrido</th><th>Tropas</th><th>Ouro</th></tr>${TODOS.map(u => linha(u, (u) => [`<b class="${u === h ? 'ouro' : ''}">${nota(SC.get(u))}</b>`, `${u.abates}/${u.mortes}/${u.assist}`, fmt(u.stats.danoHerois), fmt(u.stats.danoSofrido), u.cs, ouroF(u)])).join('')}</table>
      <div class="gr"><small>Ouro ao longo da partida</small>${graficoOuro(h.stats.historico, r.stats.historico)}</div>`,
    dano: `<table><tr><th>Herói</th><th>A heróis</th><th>A tropas</th><th>A estruturas</th><th>Sofrido</th><th>Cura</th><th>Controles</th></tr>${TODOS.map(u => linha(u, (u) => [fmt(u.stats.danoHerois), fmt(u.stats.danoTropas), fmt(u.stats.danoEstr), fmt(u.stats.danoSofrido), fmt(u.stats.cura), u.stats.controles])).join('')}</table>
      <div class="barrasD">${TODOS.map(u => `<div><span>${u.def.nome}</span><i style="width:${(100 * u.stats.danoHerois / Math.max(1, danoTotal)).toFixed(0)}%" class="${u.time === h.time ? 'al' : 'in'}"></i><b>${Math.round(100 * u.stats.danoHerois / Math.max(1, danoTotal))}%</b></div>`).join('')}</div>`,
    ouro: `<table><tr><th>Herói</th><th>Ouro total</th><th>Por minuto</th><th>Torres</th><th>Maior série</th><th>Itens</th></tr>${TODOS.map(u => linha(u, (u) => [ouroF(u), fmt(u.stats.ouroTotal / Math.max(1, t / 60)), u.stats.torres, u.stats.maiorSerie, `<span class="itens">${u.itens.map(i => iconeItem(i)).join('')}</span>`])).join('')}</table>
      <div class="gr"><small>Ouro ao longo da partida (azul: você · vermelho: Computador)</small>${graficoOuro(h.stats.historico, r.stats.historico)}</div>`,
  };
  const { antes, depois, xpG } = reg; const subiu = depois.nivel > antes.nivel;
  el.innerHTML = `<div class="caixaF">
    <h1>${venceu ? 'Vitória' : 'Derrota'}</h1><div class="sub">${venceu ? (h.time === 'luz' ? 'O Núcleo das Trevas caiu. A Luz prevaleceu!' : 'O Núcleo da Luz caiu. As Trevas dominaram a rota!') : (h.time === 'luz' ? 'O Núcleo da Luz caiu…' : 'O Núcleo das Trevas caiu…')} · ${mmss(t)} · LUZ ${estado.luz} x ${estado.trevas} TREVAS</div>
    <div class="mvp ${mvp.time}"><img alt=""><span class="selo">MVP</span><span class="nota">${nMvp}</span><div class="rod"><b>${mvp.def.nome}</b>${nomeU(mvp)} · ${mvp.abates} / ${mvp.mortes} / ${mvp.assist} · ${mvp.cs} tropas</div></div>
    <div class="tab"><div class="abas"><button data-a="resumo" class="on">Resumo</button><button data-a="dano">Dano</button><button data-a="ouro">Ouro</button></div><div class="conteudo">${abas.resumo}</div></div>
    <div class="med">${med.length ? med.map(([ic, n, d]) => `<div><i>${ICON_MED[ic] || '✦'}</i><span><b>${n}</b>${d}</span></div>`).join('') : '<div class="vazio"><span>Nenhuma medalha desta vez. Tente de novo!</span></div>'}</div>
    <div class="xpC"><div class="xpLin"><span class="xpNv"><i>${depois.nivel}</i></span><span>Caminho do Peregrino — nível ${depois.nivel}${subiu ? ' <b class="ouro subiu">Subiu de nível!</b>' : ''}</span><b class="xpG">+${xpG} XP</b><span class="xpPartes">${(reg.partes || []).map(([n, v]) => `<em>${n} +${v}</em>`).join('')}</span></div><span class="ouro dir">${lib ? `Veste “${h.def.nome} — ${v0.nome}” liberada` : `Veste “${h.def.nome} — ${v0.nome}”: ${fmt(pv.atual)}/${fmt(pv.n)} ${{ vitorias: 'vitórias', torres: 'torres', cura: 'de cura', abates: 'abates', controles: 'controles', semMorrer: 'vitórias sem morrer', nucleos: 'Núcleos' }[v0.campo]}`}</span><div class="bar xpBar"><i class="xpAntes" style="width:${subiu ? 0 : (100 * antes.resto / antes.falta).toFixed(1)}%"></i><i class="xpNovo" data-w="${(100 * depois.resto / depois.falta).toFixed(1)}" style="left:${subiu ? 0 : (100 * antes.resto / antes.falta).toFixed(1)}%;width:0%"></i></div><small class="xpFalta">${fmt(depois.resto)} / ${fmt(depois.falta)} XP para o nível ${depois.nivel + 1}</small></div>
    <div class="btnsF"><button id="fimPerfil" class="sec">Perfil</button><button id="fimStats" class="sec">Ver estatísticas</button><button id="fimTrocar" class="sec">Trocar herói</button><button id="fimDenovo">Jogar de novo</button></div></div>`;
  const imgMvp = el.querySelector('.mvp img'); const vM = mvp === h ? vid : null;
  imgMvp.src = toURL(vM && retratosVeste[mvp.id + ':' + vM] ? retratosVeste[mvp.id + ':' + vM].corpo : retratosCorpo[mvp.id]);
  const ligar = () => el.querySelectorAll('canvas[data-r]').forEach(c => c.getContext('2d').drawImage(retratos[c.dataset.r], 0, 0, 40, 40)); ligar();
  el.querySelectorAll('.abas button').forEach(b => b.onclick = () => { el.querySelectorAll('.abas button').forEach(x => x.classList.toggle('on', x === b)); el.querySelector('.conteudo').innerHTML = abas[b.dataset.a]; ligar(); });
  { const nv = el.querySelector('.xpNovo'); if (nv) { const esq = parseFloat(nv.style.left) || 0; const w = Math.max(0, parseFloat(nv.dataset.w) - esq); if (CAPTURA) nv.style.width = w + '%'; else requestAnimationFrame(() => setTimeout(() => { nv.style.width = w + '%'; }, 350)); } }
  $('fimPerfil').onclick = () => telaPerfil();
  $('fimStats').onclick = () => el.querySelector('.abas button[data-a="dano"]').click();
  $('fimDenovo').onclick = () => { const u = new URL(location.href); u.searchParams.set('heroi', h.id); ['cena', 'cap', 'veste'].forEach(k => u.searchParams.delete(k)); location.href = u.toString(); };
  $('fimTrocar').onclick = () => { const u = new URL(location.href); ['heroi', 'vs', 'cena', 'cap', 'lado', 'veste'].forEach(k => u.searchParams.delete(k)); location.href = u.toString(); };
  if (reg.novas && reg.novas.length) setTimeout(() => telaVesteNova(reg.novas[0]), CAPTURA ? 0 : 1400);
}

// ================= início da partida =================
// ================= Android: tela cheia + trava na horizontal, botão Voltar =================
const ANDROID = /Android/i.test(navigator.userAgent);
const TEM_TELA_CHEIA = !!document.documentElement.requestFullscreen && !/iPhone|iPod/.test(navigator.userAgent);
async function telaCheia(ligar = true) {
  try {
    if (ligar && !document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    else if (!ligar && document.fullscreenElement) { await document.exitFullscreen(); return; }
    if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape').catch(() => { });
  } catch (e) { console.warn('[tela cheia]', e && e.message); }
}
if (ANDROID) document.documentElement.classList.add('android');
{ const bg = document.getElementById('girarBtn'); if (bg) bg.onclick = () => telaCheia(true); }
// no Android, o 1º toque de "Confirmar" (gesto do usuário) já entra em tela cheia na horizontal
if (ANDROID && !CAPTURA) document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('#selOk,#girarBtn,.lado,.card')) telaCheia(true); }, true);
addEventListener('fullscreenchange', () => { setTimeout(() => dispatchEvent(new Event('resize')), 120); const c = document.getElementById('cfgTela'); if (c) c.checked = !!document.fullscreenElement; });
// Voltar do Android (e do navegador): fecha loja/menus; na partida pergunta antes de sair (e pausa)
let voltarArmado = false;
function armarVoltar() { if (voltarArmado || CAPTURA) return; voltarArmado = true; history.pushState({ lxt: 1 }, ''); }
addEventListener('popstate', () => {
  if (!voltarArmado) return; voltarArmado = false;
  const fechou = (id) => { const el = $(id); if (el && /\bon\b/.test(el.className)) { el.className = el.className.replace(/\bon\b/, '').trim(); return true; } return false; };
  if (lojaAberta) fecharLoja(); else if (fechou('galeria') || fechou('perfilTela') || fechou('vesteNova') || fechou('cfgMenu')) { }
  else if (estado.iniciado && !estado.fim) menuSair(true);
  else if ($('selHerois') && !$('selHerois').hidden && $('selecao').classList.contains('on')) $('selVoltar').click();
  else { history.back(); return; }
  armarVoltar();
});
function menuSair(abrir) {
  const el = $('sairMenu'); estado.pausado = abrir; el.className = abrir ? 'on' : '';
  if (!abrir) return;
  el.innerHTML = `<div class="caixa"><b>Sair da partida?</b><small>A partida está pausada.</small><div class="bts"><button id="sairNao">Continuar</button><button id="sairSim" class="sec">Sair para a seleção</button></div></div>`;
  $('sairNao').onclick = () => menuSair(false);
  $('sairSim').onclick = () => { const u = new URL(location.href); ['heroi', 'vs', 'cena', 'cap', 'lado', 'veste'].forEach(k => u.searchParams.delete(k)); location.replace(u.toString()); };
}
// menu da engrenagem: dificuldade, analógico fixo, tremor da tela e FPS (tudo salvo no aparelho)
function menuConfig() {
  const b = document.querySelector('#topoDir .engr'); if (!b || b.dataset.ok) return; b.dataset.ok = 1;
  const m = document.createElement('div'); m.id = 'cfgMenu';
  m.innerHTML = `<b>Configurações</b>
    <label class="sel">Dificuldade do Computador <select id="cfgDif">${Object.entries(DIFS).map(([k, d]) => `<option value="${k}" ${k === DIF_ID ? 'selected' : ''}>${d.nome}</option>`).join('')}</select></label>
    <label><input type="checkbox" id="cfgJoy"> Analógico fixo</label>
    <label><input type="checkbox" id="cfgTremor"> Tremor da tela</label>
    <label><input type="checkbox" id="cfgFps"> Contador de FPS</label>
    ${TEM_TELA_CHEIA ? '<label><input type="checkbox" id="cfgTela"> Tela cheia</label>' : ''}
    <small>Resolução automática: baixa sozinha se o FPS cair de 55.</small>`; $('hud').appendChild(m);
  const cb = m.querySelector('#cfgFps'); cb.checked = contador.on;
  cb.onchange = () => { contador.mostrar(cb.checked); localStorage.setItem('mobaFps', cb.checked ? '1' : '0'); };
  const cj = m.querySelector('#cfgJoy'); cj.checked = CFG.joyFixo; cj.onchange = () => { CFG.joyFixo = cj.checked; localStorage.setItem('mobaJoyFixo', cj.checked ? '1' : '0'); document.body.classList.toggle('joyFixo', CFG.joyFixo); };
  const ct = m.querySelector('#cfgTremor'); ct.checked = CFG.tremor; ct.onchange = () => { CFG.tremor = ct.checked; localStorage.setItem('mobaTremor', ct.checked ? '1' : '0'); };
  const cf = m.querySelector('#cfgTela'); if (cf) { cf.checked = !!document.fullscreenElement; cf.onchange = () => telaCheia(cf.checked); }
  const cd = m.querySelector('#cfgDif'); cd.onchange = () => { DIF_ID = cd.value; DIF = DIFS[DIF_ID]; localStorage.setItem('mobaDif', DIF_ID); aviso('Dificuldade: ' + DIF.nome); };
  b.addEventListener('click', (e) => { e.stopPropagation(); m.classList.toggle('on'); });
  document.addEventListener('pointerdown', (e) => { if (!m.contains(e.target) && e.target !== b && !b.contains(e.target)) m.classList.remove('on'); });
}
function configurarHUD() {
  menuConfig(); document.body.classList.toggle('joyFixo', CFG.joyFixo);
  const h = jogador, d = h.def;
  $('nomeHeroi').innerHTML = `${d.nome} <small>${d.titulo}</small>`;
  const rc = $('retrato').getContext('2d'); rc.drawImage(retratos[h.id], 0, 0, 160, 160);
  $('bAtaque').innerHTML = iconeAtaque(h.id, d); $('bAtaque').classList.toggle('temArte', TRIPO && ATK_TRIPO && !ATK_FALTA.includes(h.id));
  for (const k of ['q', 'w', 'e', 'r']) { const x = d.hab[k]; const b = $('b' + k.toUpperCase()); b.setAttribute('aria-label', x.nome); b.innerHTML = `${iconeHab(h.id, k, x)}<em class="cd"></em><b class="custo">${x.mana[0]}</b><span class="nvs"></span>${k === 'r' ? '<span class="anelUlt"></span>' : ''}`; addMais(k); }
  $('painel').className = h.time;
  document.body.dataset.time = h.time;
}
function selvaDeps() {
  return { scene, unidades, herois, estado, Q, carregar, danificar, ganharOuro, darXp, criarBarra, iniciarStatus, atualizarStatus, mover2, atacar, usarHab, estruturas, protegida, jogadorTime, jogador: () => jogador, get fx() { return fx; }, get fxD() { return fxD; }, tremer, anunciar, retratos, aviso, som, FONTE, laneZ, aplicarLento };
}
// tela de função (2v2): Selva ou Meio; o aliado fica com a outra
function pedirFuncao(id) {
  const el = $('funcaoTela'); el.classList.add('on');
  el.querySelector('.aliado').textContent = `Você: ${HEROIS[id].nome} · o aliado (PC) escolhe um herói do seu lado`;
  el.querySelectorAll('.cartas button').forEach(b => b.onclick = () => { el.classList.remove('on'); comecarPartida(id, null, b.dataset.f); });
  $('funcaoVoltar').onclick = () => { el.classList.remove('on'); $('selecao').classList.add('on'); };
}
window.__pedirFuncao = pedirFuncao;
async function comecarPartida(id, vs, funcao) {
  const d = HEROIS[id]; _timeJogador = d.time; recolorirBarras();
  const lista = d.time === 'luz' ? TREVAS : LUZ;
  const vsId = vs && HEROIS[vs] && HEROIS[vs].time !== d.time ? vs : lista[Math.floor(Math.random() * lista.length)];
  const vid = vesteEquipada(id);
  // veste: textura + retratos antes da tela VS (a tela já mostra a veste)
  if (vid) { const r = await retratosDaVeste(id, vid); if (r) retratos[id] = r.rosto; }
  const mostrarVS = !CAPTURA || CENA === 'vs';
  const vsP = mostrarVS ? telaVS(id, vsId, vid) : null;
  jogador = criarHeroi(id, d.time, false); bot = criarHeroi(vsId, inimigo(d.time), true);
  if (SELVA_ON && P.get('modo') !== '1v1') { // 2v2: você + aliado (PC) contra caçador + meio (PC)
    const meus = (d.time === 'luz' ? LUZ : TREVAS).filter(x => x !== id), deles = lista.filter(x => x !== vsId);
    const aId = HEROIS[P.get('aliado')] && meus.includes(P.get('aliado')) ? P.get('aliado') : meus[Math.floor(Math.random() * meus.length)];
    const cId = HEROIS[P.get('cacador')] && deles.includes(P.get('cacador')) ? P.get('cacador') : deles[Math.floor(Math.random() * deles.length)];
    aliado = criarHeroi(aId, d.time, true); cacador = criarHeroi(cId, inimigo(d.time), true);
    funcao = funcao || P.get('funcao') || 'meio'; jogador.funcao = funcao; aliado.funcao = funcao === 'selva' ? 'meio' : 'selva'; bot.funcao = 'meio'; cacador.funcao = 'selva';
  }
  if (SELVA_ON && !selvaIni) selvaIni = iniciarSelva(selvaDeps());
  if (SELVA_ON) { $('bPing').hidden = !aliado; }
  if (vid) await aplicarVeste(jogador, vid);
  configurarHUD(); camIni = false;
  if (CENA === 'vs') { $('hud').classList.remove('on'); window.__pronto = true; return; }
  if (selvaIni) await Promise.race([selvaIni, esperar(5000)]); aquecerShaders(); // monstros/aliados/cacador: compila na tela VS, não na luta
  if (vsP) { await vsP; await esperar(250); $('vs').classList.add('sai'); setTimeout(() => $('vs').className = '', 450); }
  $('hud').classList.add('on'); estado.iniciado = true; armarVoltar();
  aviso(`${d.nome} x ${HEROIS[vsId].nome} — destrua o Núcleo inimigo!`);
  if (AUTO) autoPontos(jogador);
  if (selvaIni && CAPTURA) await selvaIni;
  if (CENA) cenario();
  window.__pronto = true;
}

// ================= cenários para prints / vídeo =================
function nivelar(h, n) { while (h.nivel < n) { h.xp = XP_NIVEL(h.nivel); darXp(h, 0); } h.xp = XP_NIVEL(h.nivel) * .45; autoPontos(h); h.hp = h.maxHp; h.mana = h.manaMax; }
function limparTropas() { for (const u of [...unidades]) if (u.tipo === 'minion') { scene.remove(u.obj); u.barra.remove(); unidades.splice(unidades.indexOf(u), 1); } }
function cenario() {
  const s = jogador.time === 'luz' ? 1 : -1;
  if (CENA === 'luta') {
    estado.tempo = 6 * 60 + 18; estado.muralhaAviso = true; estado.luz = 3; estado.trevas = 2; ondaT = 99;
    nivelar(jogador, 8); nivelar(bot, 8); jogador.abates = 3; jogador.mortes = 2; jogador.cs = 64; bot.abates = 2; bot.mortes = 3; bot.cs = 58;
    ['espadaCurta', 'aljava', 'sandalias'].forEach(i => jogador.itens.push(i)); jogador.itens = ['sandalias', 'arcoJonatas', 'luvas']; recalcular(jogador, true); bot.itens = ['sandalias', 'armaduraSaul']; recalcular(bot, true);
    limparTropas();
    const xT = POS.torreTrevas.x; // perto da torre externa das Trevas
    for (let i = 0; i < 4; i++) { const x = xT - 9 - (i % 2) * 1.6 - Math.floor(i / 2) * 1.8; novoMinion('luz', x, laneZ(x) + (i % 2 ? 1 : -1) * 1.2, i === 3); }
    for (let i = 0; i < 4; i++) { const x = xT - 4 + (i % 2) * 1.6 + Math.floor(i / 2) * 1.8; novoMinion('trevas', x, laneZ(x) + (i % 2 ? 1 : -1) * 1.2, i === 3); }
    const [hL, hT] = jogador.time === 'luz' ? [jogador, bot] : [bot, jogador];
    hL.obj.position.set(xT - 11, 0, laneZ(xT - 11) + 1.8); hT.obj.position.set(xT - 5.5, 0, laneZ(xT - 5.5) - .6); hL.olharPara(hT.obj.position, 1, 99); hT.olharPara(hL.obj.position, 1, 99);
    if (jogador.time === 'trevas') camExtra = { off: new THREE.Vector3(1.2, 12.2, 11.2), y: .9, dz: .2, dx: -2.4 };
    bot.hp = bot.maxHp * .62; jogador.hp = jogador.maxHp * .78; jogador.ouro = 740;
    estruturas.find(e => e.time === 'trevas' && e.ordem === 1).hp = 1900;
    if (jogador.time === 'luz') camExtra = { off: new THREE.Vector3(-1.2, 12.2, 11.2), y: .9, dz: .2, dx: 2.4 };
  } else if (CENA === 'loja') {
    estado.tempo = 9 * 60 + 5; estado.luz = 4; estado.trevas = 3; nivelar(jogador, 9); nivelar(bot, 9);
    jogador.itens = ['sandalias', 'arcoJonatas', 'espadaCurta']; jogador.ouro = 1980; recalcular(jogador, true); jogador.abates = 4; jogador.mortes = 3; jogador.cs = 88;
    lojaAba = 'rec'; lojaSel = 'laminaEude';
    agendar(.05, () => abrirLoja('laminaEude'));
  } else if (CENA === 'vitoria' || CENA === 'fim' || CENA === 'skin') {
    estado.tempo = 14 * 60 + 37; estado.luz = 9; estado.trevas = 5; nivelar(jogador, 13); nivelar(bot, 12);
    jogador.itens = ['sandalias', 'arcoJonatas', 'laminaEude', 'espadaGolias', 'cota']; bot.itens = ['sandalias', 'armaduraSaul', 'couracaJustica', 'cinto']; recalcular(jogador, true); recalcular(bot, true);
    jogador.abates = 9; jogador.mortes = 5; jogador.cs = 142; bot.abates = 5; bot.mortes = 9; bot.cs = 121; jogador.ouro = 1340; bot.ouro = 820;
    limparTropas();
    const inim = estruturas.filter(e => e.time !== jogador.time);
    for (const e of inim) if (e.tipo === 'torre') destruirEstrutura(e, jogador);
    const n = inim.find(e => e.tipo === 'nucleo'); jogador.obj.position.set(n.obj.position.x - s * 6, 0, laneZ(n.obj.position.x - s * 6) + 1);
    bot.vivo = false; bot.morteT = 20; bot.obj.visible = false;
    n.hp = 1; agendar(.1, () => danificar(jogador, n, 50)); camIni = false;
  } else if (CENA === 'video') {
    ondaT = 1; estado.tempo = 0;
  }
  if (CENA === 'vitoria' || CENA === 'fim' || CENA === 'skin') {
    // números de uma partida "de verdade" para a tela de resultados
    const hist = (fim, n) => Array.from({ length: n }, (_, i) => Math.round(500 + (fim - 500) * Math.pow(i / (n - 1), 1.15)));
    Object.assign(jogador.stats, { danoHerois: 14820, danoSofrido: 9310, danoEstr: 11240, danoTropas: 38400, torres: 3, cura: 2150, controles: 21, primeiro: true, maiorSerie: 3, ouroTotal: 7940, historico: hist(7940, 64) });
    Object.assign(bot.stats, { danoHerois: 8105, danoSofrido: 16550, danoEstr: 4020, danoTropas: 30110, torres: 1, cura: 640, controles: 12, maiorSerie: 1, ouroTotal: 5620, historico: hist(5620, 64) });
    estado.tempo = 10 * 60 + 42; jogador.abates = 7; jogador.mortes = 2; jogador.cs = 104; bot.abates = 2; bot.mortes = 7; bot.cs = 91; estado.luz = 7; estado.trevas = 2;
    if (CENA === 'skin') { const v = VESTES[jogador.id].lista[0]; statsHeroi(jogador.id)[v.campo] = v.n - (v.campo === 'vitorias' || v.campo === 'nucleos' ? 1 : 0); }
    else { const v = VESTES[jogador.id].lista[0]; statsHeroi(jogador.id)[v.campo] = Math.max(0, v.n - 2); }
  }
  if (CENA === 'galeria') telaGaleria();
}
window.__jogo = { get aliado() { return aliado; }, get cacador() { return cacador; }, nivelar, limparTropas, camExtra: (v) => { camExtra = v; }, camAlvo, perfStat, medirDano, recalcular, autoPontos, get ITENS() { return ITENS; }, estadoSom, menuSair, get RT_FLOAT() { return RT_FLOAT; }, avaliarLuta, danoCombo, get DIF() { return DIF; }, anunciar, ganharOuro, feedAbate, telaVesteNova, telaGaleria, travarInimigo, paradaImpacto, MIRA, desenharMira, esconderMira, get textos() { return textos; }, retratosDaVeste, retratosCorpo, get retratos() { return retratos; }, get fx() { return fx; }, get fxD() { return fxD; }, scene, camera, renderer, estado, get jogador() { return jogador; }, get bot() { return bot; }, unidades, estruturas, herois, entrada, set input(v) { cenaInput = v; if (v) joyVisual(v.x, v.y); else joyVisual(0, 0); }, set cam(v) { camExtra = v; }, onda, novoMinion, laneZ, THREE, usarHab, atacar, abrirLoja, fecharLoja, comprar, nivelar, POS, subirHab, curar, clarao, recuar, get ondaT() { return ondaT; }, set ondaT(v) { ondaT = v; }, danificar };

// ================= laço =================
const relogio = new THREE.Clock(false);
let quadroN = 0;
const contador = new ContadorFPS(renderer);
if (P.has('fps') || localStorage.getItem('mobaFps') === '1') contador.mostrar(true);
function passo(dt) { const t0 = performance.now(); renderer.info.reset(); if (SOMBRA_ALTERNADA) renderer.shadowMap.needsUpdate = (quadroN++ & (tempoU.value < ultAtivaT ? 3 : 1)) === 0; let dtL = estado.pausado ? 0 : dt; if (paradaT > 0 && dtL) { paradaT -= dt; dtL = dt * .1; } atualizar(dtL); if (blobs) blobs.atualizar(unidades.filter(u => u.tipo === 'minion')); atualizarCamera(dt); atualizarBarras(); atualizarAneisTorre(dt); textos.update(dt, W, H); atualizarHUD(dt); if (lojaAberta && jogador) { lojaT += dt; if (lojaT > .3) { lojaT = 0; const k = Math.floor(jogador.ouro) + '|' + podeComprar(jogador) + '|' + jogador.itens.join(); if (k !== lojaChave) desenharLoja(); } } if (avisoT > 0) { avisoT -= dt; if (avisoT <= 0) avisoEl.className = ''; } composer.render(dt); if (contador.on) contador.quadro(dt, performance.now() - t0, renderer.info.render, `res ${renderer.getPixelRatio().toFixed(2)}x · ${W}×${H}<br>tropas na tela ${perfStat.visU}/${unidades.length} · projéteis ${projCriados}`); }
window.__perf = () => ({ pr: renderer.getPixelRatio(), projCriados, visU: perfStat.visU, blobs: blobs ? blobs.m.count : 0, sombraAlternada: SOMBRA_ALTERNADA });
function loop() { const dt = Math.min(relogio.getDelta(), 1 / 20); passo(dt); requestAnimationFrame(loop); }
window.__info = () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries, tex: renderer.info.memory.textures, progs: renderer.info.programs.length });
window.__atualizar = (dt = 1 / 60) => { atualizar(dt); atualizarCamera(dt); };
window.__tick = (n = 1, dt = 1 / 30) => { for (let i = 0; i < n; i++) { if (i < n - 1) { atualizar(dt); atualizarCamera(dt); } else passo(dt); } return true; };

iniciar().catch(e => { console.error(e); progTxt.textContent = 'Erro ao carregar: ' + e.message; });
