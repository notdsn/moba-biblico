// analisa vértices da capa (cor da textura + posição) e os ossos que os puxam
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions'; import sharp from 'sharp';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS); const d = await io.read(process.argv[2]); const r = d.getRoot();
const p = r.listMeshes()[0].listPrimitives()[0]; const skin = r.listSkins()[0]; const J = skin.listJoints().map(j => j.getName().replace('mixamorig:', ''));
const t = p.getMaterial().getBaseColorTexture(); const S = 256; const { data } = await sharp(Buffer.from(t.getImage())).resize(S, S).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const pos = p.getAttribute('POSITION'), uv = p.getAttribute('TEXCOORD_0'), jo = p.getAttribute('JOINTS_0'), we = p.getAttribute('WEIGHTS_0');
const hue = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx - mn < 1e-3) return [0, 0, mx]; let h = mx === r ? (g - b) / (mx - mn) : mx === g ? 2 + (b - r) / (mx - mn) : 4 + (r - g) / (mx - mn); h = (h * 60 + 360) % 360; return [h, (mx - mn) / mx, mx]; };
const alvo = process.argv[3] || 'vermelho'; const faixa = alvo === 'vermelho' ? h => h < 12 || h > 345 : h => h > 95 && h < 175;
const e = [], u = [], j = [], w = []; const cont = {}; let n = 0; const bb = [9, 9, 9, -9, -9, -9];
const grade = {};
for (let i = 0; i < pos.getCount(); i++) { uv.getElement(i, u); const x = Math.min(S - 1, Math.floor(((u[0] % 1) + 1) % 1 * S)), y = Math.min(S - 1, Math.floor(((u[1] % 1) + 1) % 1 * S)); const o = (y * S + x) * 3; const [h, s, v] = hue(data[o] / 255, data[o + 1] / 255, data[o + 2] / 255);
  if (!(faixa(h) && s > .45 && v > .2)) continue; pos.getElement(i, e); n++; for (let k = 0; k < 3; k++) { bb[k] = Math.min(bb[k], e[k]); bb[k + 3] = Math.max(bb[k + 3], e[k]); }
  jo.getElement(i, j); we.getElement(i, w); for (let k = 0; k < 4; k++) if (w[k] > .05) cont[J[j[k]]] = (cont[J[j[k]]] || 0) + w[k];
  const gk = `y${(e[1] * 10 | 0)} z${e[2] < -0.05 ? 'tras' : e[2] > 0.05 ? 'frente' : 'meio'}`; grade[gk] = (grade[gk] || 0) + 1; }
console.log('vértices', n, 'de', pos.getCount(), 'bbox', bb.map(v => v.toFixed(2)).join(','));
console.log(Object.entries(cont).sort((a, b) => b[1] - a[1]).slice(0, 18).map(([k, v]) => k + ':' + v.toFixed(0)).join(' '));
console.log(Object.entries(grade).sort().map(([k, v]) => k + '=' + v).join(' '));
