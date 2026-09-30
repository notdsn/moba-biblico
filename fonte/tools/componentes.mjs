import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS); const d = await io.read(process.argv[2]); const p = d.getRoot().listMeshes()[0].listPrimitives()[0];
const pos = p.getAttribute('POSITION'), ind = p.getIndices().getArray(); const n = pos.getCount(); const par = new Int32Array(n).map((_, i) => i);
const f = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; }; const u = (a, b) => { a = f(a); b = f(b); if (a !== b) par[a] = b; };
const e = []; const m = new Map(); for (let i = 0; i < n; i++) { pos.getElement(i, e); const k = e.map(v => Math.round(v * 1e4)).join(); if (m.has(k)) u(i, m.get(k)); else m.set(k, i); }
for (let i = 0; i < ind.length; i += 3) { u(ind[i], ind[i + 1]); u(ind[i], ind[i + 2]); }
const c = {}; for (let i = 0; i < n; i++) { const r = f(i); c[r] = (c[r] || 0) + 1; } const l = Object.values(c).sort((a, b) => b - a); console.log('componentes', l.length, l.slice(0, 15).join(' '));
