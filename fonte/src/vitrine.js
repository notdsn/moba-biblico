// vitrine de modelos estáticos (ferramenta de desenvolvimento): vitrine.html?m=tripo/props/arvore,tripo/props/pedra[&alto]
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
const P = new URLSearchParams(location.search); const L = new GLTFLoader(); L.setMeshoptDecoder(MeshoptDecoder);
const R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); R.setSize(innerWidth, innerHeight); R.toneMapping = THREE.ACESFilmicToneMapping; R.outputColorSpace = THREE.SRGBColorSpace; document.body.appendChild(R.domElement);
const S = new THREE.Scene(); S.background = new THREE.Color('#2a2f3a'); const pm = new THREE.PMREMGenerator(R); S.environment = pm.fromScene(new RoomEnvironment(), .04).texture; S.environmentIntensity = .6;
S.add(new THREE.HemisphereLight('#fff1dc', '#3a3050', 1.4)); const dl = new THREE.DirectionalLight('#fff3e0', 2.4); dl.position.set(3, 6, 5); S.add(dl);
const nomes = (P.get('m') || '').split(',').filter(Boolean); const n = nomes.length;
const cam = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, .1, 200);
const gs = await Promise.all(nomes.map(m => L.loadAsync('models/' + m + '.glb')));
gs.forEach((g, i) => { const o = g.scene; const b = new THREE.Box3().setFromObject(o); const s = b.getSize(new THREE.Vector3()); const k = 1 / s.y; o.scale.setScalar(k); o.position.set((i - (n - 1) / 2) * 1.25, -b.min.y * k, 0); S.add(o);
  let tri = 0; o.traverse(m => { if (m.isMesh) { tri += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3; if (m.material.metalness > .6) m.material.metalness = .6; } });
  document.getElementById('r').insertAdjacentHTML('beforeend', `<span>${nomes[i].split('/').pop()} · ${(tri / 1000).toFixed(1)}k</span>`); });
const w = n * 1.25; const d = Math.max(2.6, w / (2 * Math.tan(15 * Math.PI / 180) * innerWidth / innerHeight) * 1.05);
if (P.has('alto')) cam.position.set(0, d * .75, d * .7); else cam.position.set(0, .7, d); cam.lookAt(0, .45, 0);
R.render(S, cam); window.__pronto = true; window.__tick = () => R.render(S, cam);
