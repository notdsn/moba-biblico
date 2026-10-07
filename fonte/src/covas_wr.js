// Rodada 5: poços do Dragão e do Leviatã no estilo do Wild Rift (peças modulares do Jarvys, /tripo_work/covas):
// borda = dois arcos baixos com duas bocas opostas (estática, meshopt, WebP 512; celular usa a variante KTX2 _k.glb),
// chão = disco plano com textura circular (lava radial no Dragão, pedra molhada com runas roxas no Leviatã).
// Colisão/IA: selva_mapa.js (COVA_RIN/COVA_ROUT, bocas a 0 e 180°). O Jordão contorna os poços (rioX).
import * as THREE from 'three';
import { COVAS, COVA_RIN, COVA_ROUT } from './selva_mapa.js';
const BASE = 'models/covas/';
// por poço: modelo, ângulo da boca no espaço do modelo (atan2(z, x)), altura da borda, tom do material
const CFG = {
  poco: { nome: 'leviata', bocaM: Math.PI / 2, alt: 3.2, tom: 0xffffff, rug: .55 },
  dragao: { nome: 'dragao', bocaM: -Math.PI / 4, alt: 2.6, tom: 0x8a4f42, rug: .9 }, // a borda saiu pedra clara: escurece/avermelha para a lava
};
export async function covasWR(scene, loader, anim, mobile) {
  const tl = new THREE.TextureLoader(); const texP = (u) => new Promise((ok) => tl.load(BASE + u, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; ok(t); }, undefined, () => ok(null)));
  const glbP = (n) => new Promise((ok) => loader.load(BASE + n + '_borda.glb', (g) => ok(g.scene), undefined, () => ok(null)));
  const pocos = COVAS.filter(cv => cv.poco);
  const res = await Promise.all(pocos.map(async (cv) => { const c = CFG[cv.c.tipo]; const [m, chao, em] = await Promise.all([glbP(c.nome), texP(c.nome + '_chao.webp'), cv.c.tipo === 'dragao' ? texP('dragao_chao_em.webp') : null]); return { cv, c, m, chao, em }; }));
  const lava = [];
  for (const { cv, c, m, chao, em } of res) {
    // chão: disco plano um pouco maior que o miolo (a borda cobre a emenda)
    if (chao) { const mat = new THREE.MeshStandardMaterial({ map: chao, alphaTest: .5, roughness: c.rug, metalness: 0 });
      if (em) { mat.emissiveMap = em; mat.emissive = new THREE.Color(0xff6a2a); mat.emissiveIntensity = 1.1; lava.push(mat); }
      const d = new THREE.Mesh(new THREE.CircleGeometry(COVA_RIN + 1.8, mobile ? 32 : 48), mat); d.rotation.x = -Math.PI / 2; d.position.set(cv.x, .035, cv.z); d.receiveShadow = true; d.name = 'cova_chao_' + c.nome; scene.add(d); }
    if (!m) { console.warn('[covas] borda não carregou', c.nome); continue; }
    // escala: raio externo = COVA_ROUT, altura baixa (os arcos vêm altos demais na proporção); bocas viradas para 0° e 180° (rio / selva)
    const g = new THREE.Group(); g.add(m); m.rotation.y = c.bocaM; m.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(m); const half = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) / 2;
    const s = COVA_ROUT / half, sy = c.alt / Math.max(.01, b.max.y - b.min.y);
    g.scale.set(s, sy, s); g.position.set(cv.x - (b.max.x + b.min.x) / 2 * s, -b.min.y * sy - .05, cv.z - (b.max.z + b.min.z) / 2 * s);
    m.traverse(o => { if (!o.isMesh) return; o.castShadow = !mobile; o.receiveShadow = true; o.matrixAutoUpdate = true;
      if (c.tom !== 0xffffff) { o.material = o.material.clone(); o.material.color = new THREE.Color(c.tom); }
      o.material.roughness = c.rug; });
    g.name = 'cova_borda_' + c.nome; scene.add(g); g.updateMatrixWorld(true); g.traverse(o => { o.matrixAutoUpdate = false; });
  }
  // lava: brilho que respira (só a intensidade muda: nenhum shader novo)
  if (lava.length) anim.push((dt, tt) => { const k = 1.05 + .35 * Math.sin(tt * 1.6) + .12 * Math.sin(tt * 4.3); for (const mt of lava) mt.emissiveIntensity = k; });
  return res.length;
}
