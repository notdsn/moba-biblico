// velocidade angular de braços/tronco ao longo de um clipe (para achar golpes e pontos de loop)
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS); const d = await io.read(process.argv[2]); const r = d.getRoot();
const alvo = process.argv[3] || 'slash.001'; const ossos = ['mixamorig:RightArm', 'mixamorig:RightForeArm', 'mixamorig:LeftArm', 'mixamorig:Spine1', 'mixamorig:Hips'];
const a = r.listAnimations().find(x => x.getName() === alvo);
const tr = {}; for (const c of a.listChannels()) if (ossos.includes(c.getTargetNode().getName()) && c.getTargetPath() === 'rotation') tr[c.getTargetNode().getName()] = c.getSampler();
const s0 = Object.values(tr)[0]; const n = s0.getInput().getCount(); const t = i => s0.getInput().getScalar(i);
const ang = (q, p) => 2 * Math.acos(Math.min(1, Math.abs(q.reduce((x, y, k) => x + y * p[k], 0)))) * 57.3;
let linha = []; for (let i = 1; i < n; i++) { let tot = 0; for (const o of ossos) { const s = tr[o]; if (!s) continue; const q = [], p = []; s.getOutput().getElement(i, q); s.getOutput().getElement(i - 1, p); tot += ang(q, p); } linha.push(t(i).toFixed(2) + ':' + (tot / (t(i) - t(i - 1)) | 0)); }
console.log(alvo, 'n', n, '\n' + linha.join(' '));
// distância de pose em relação ao quadro 0 (para loop)
const dist = []; for (let i = 0; i < n; i++) { let tot = 0; for (const o of ossos) { const s = tr[o]; if (!s) continue; const q = [], p = []; s.getOutput().getElement(i, q); s.getOutput().getElement(0, p); tot += ang(q, p); } dist.push(t(i).toFixed(2) + ':' + tot.toFixed(0)); }
console.log('dist ao quadro 0:', dist.join(' '));
