import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { clone as skClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
const P = new URLSearchParams(location.search); window.__dbg = P.has('dbg'); if (P.get('kc')) window.__kcab = +P.get('kc');
const L = new GLTFLoader(); L.setMeshoptDecoder(MeshoptDecoder);
const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setSize(innerWidth, innerHeight); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#2a2f3a'); { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture; scene.environmentIntensity = .45; }
const cam = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, .1, 100);
const alto = P.has('alto'); if (alto) { cam.position.set(0, 7.2, 6.4); cam.lookAt(0, .9, 0); } else { cam.position.set(0, 1.45, +(P.get('d') || 7.5)); cam.lookAt(0, .98, 0); }
scene.add(new THREE.HemisphereLight('#fff1dc', '#3a3050', 1.6));
const dl = new THREE.DirectionalLight('#fff3e0', 2.6); dl.position.set(3, 6, 5); dl.castShadow = true; dl.shadow.mapSize.set(2048, 2048); scene.add(dl);
const rim = new THREE.DirectionalLight('#8ab8ff', 1.4); rim.position.set(-4, 3, -4); scene.add(rim);
const chao = new THREE.Mesh(new THREE.CircleGeometry(6, 48), new THREE.MeshStandardMaterial({ color: '#6b6258', roughness: .9 })); chao.rotation.x = -Math.PI / 2; chao.receiveShadow = true; scene.add(chao);
const { montarVariante } = await import('./equip.js').catch(() => ({}));
const g = await L.loadAsync('models/heroi.glb'); const gs = await L.loadAsync('models/soldado.glb');
const cab = await L.loadAsync('models/cabelo_simpleparted.glb');
const { VISUAL, CABELOS } = await import('./herois3d.js');
const gf = await L.loadAsync('models/heroi_f.glb');
const cabelos = {}; for (const n of CABELOS) cabelos[n] = await L.loadAsync('models/cabelo_' + n + '.glb');
const tipos = (P.get('t') || 'davi,guardiao,sombra').split(',');
const anim = (P.get('a') || 'Idle_Loop,Idle_Shield_Loop,Zombie_Idle_Loop').split(',');
const T = +(P.get('tt') || .6);
const mixers = [];
tipos.forEach((t, i) => {
  const vis = VISUAL[t]; const src = vis ? (vis.corpo === 'f' ? gf : g) : gs;
  let base = montarVariante(src, t, { cabelo: cab, cabelos });
  const o = skClone(base); o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; } });
  o.position.x = (i - (tipos.length - 1) / 2) * +(P.get('sp') || 1.6); o.rotation.y = +(P.get('ry') || .35);
  if (vis) o.scale.setScalar(vis.esc); else o.scale.setScalar(t === 'bruto' ? 1.0 : .88);
  scene.add(o);
  const mx = new THREE.AnimationMixer(o); const c = g.animations.find(a => a.name === (anim[i] || anim[0])); if (c && !P.has('rest')) mx.clipAction(c).play(); mx.update(T); mixers.push(mx);
});
renderer.render(scene, cam);
if (P.get('nomes')) { const ns = P.get('nomes').split(','); const tt = P.get('titulo');
  const st = document.createElement('style'); st.textContent = "@import url('fonts.css'); .nm{position:fixed;transform:translate(-50%,0);font:900 22px Cinzel,serif;color:#ffe2a8;text-shadow:0 2px 6px #000;text-align:center;white-space:nowrap} .nm small{display:block;font:700 13px Nunito,sans-serif;color:#ff9a8a;letter-spacing:1px} .tt{position:fixed;top:18px;left:0;right:0;text-align:center;font:900 30px Cinzel,serif;color:#fff;text-shadow:0 2px 8px #000}"; document.head.appendChild(st);
  if (tt) { const d = document.createElement('div'); d.className = 'tt'; d.textContent = tt; document.body.appendChild(d); }
  scene.children.filter(o => o.userData.tipo).forEach((o, i) => { const p = o.position.clone(); p.y = 0; p.project(cam); const d = document.createElement('div'); d.className = 'nm'; const [n, sub] = (ns[i] || '').split('|'); d.innerHTML = n + (sub ? '<small>' + sub + '</small>' : ''); d.style.left = ((p.x + 1) / 2 * innerWidth) + 'px'; d.style.top = ((1 - p.y) / 2 * innerHeight + 14) + 'px'; document.body.appendChild(d); });
  await document.fonts.ready; await new Promise(r => setTimeout(r, 300)); }
window.__pronto = true;
