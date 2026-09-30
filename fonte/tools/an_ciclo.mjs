// mede a emenda do loop do clipe 'run' (diferença angular entre o 1º e o último quadro de cada osso) e procura o melhor ponto de corte
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions'; import { MeshoptDecoder } from 'meshoptimizer';
await MeshoptDecoder.ready; const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const ang = (a, b) => { const d = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]); return 2 * Math.acos(Math.min(1, d)) * 180 / Math.PI; };
for (const f of process.argv.slice(2)) {
  const doc = await io.read(f); const an = doc.getRoot().listAnimations().find(a => /^run/.test(a.getName())); if (!an) continue;
  const tr = an.listChannels().filter(c => c.getTargetPath() === 'rotation').map(c => ({ n: c.getTargetNode().getName(), t: c.getSampler().getInput().getArray(), v: c.getSampler().getOutput().getArray() }));
  const q = (x, i) => [x.v[i * 4], x.v[i * 4 + 1], x.v[i * 4 + 2], x.v[i * 4 + 3]]; const N = tr[0].t.length;
  let pior = tr.map(x => [x.n, ang(q(x, 0), q(x, N - 1))]).sort((a, b) => b[1] - a[1]).slice(0, 3);
  // melhor fim j (>= 60% do clipe) que casa com o quadro 0: soma dos ângulos de todos os ossos
  let best = null; for (let j = Math.floor(N * .6); j < N; j++) { let s = 0, m = 0; for (const x of tr) { const a = ang(q(x, 0), q(x, j)); s += a; m = Math.max(m, a); } if (!best || s < best.s) best = { j, s, m, t: tr[0].t[j] }; }
  console.log(f.split('/').pop(), 'quadros', N, 'dur', tr[0].t[N - 1].toFixed(3), 'emenda pior:', pior.map(p => p[0].replace(/.*:/, '') + ' ' + p[1].toFixed(1) + '°').join(', '), '| melhor corte quadro', best.j, 't=' + best.t.toFixed(3), 'máx', best.m.toFixed(1) + '°');
}
