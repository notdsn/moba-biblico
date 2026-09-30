// Conserta capas "esticadas" do auto-rig do Tripo: os vértices da capa (achados pela cor da textura + posição na pose T)
// recebem peso de braço/perna; aqui esse peso passa para o osso-pai mais próximo do tronco (ombro / quadril),
// então a capa acompanha o tronco em vez de ser puxada pelos braços e pernas.
//   preset 'davi'  : capa vermelha atrás do corpo (braços e pernas -> ombro/quadril)
//   preset 'debora': capa/véu verde abaixo dos braços (só os braços -> ombro)
import sharp from 'sharp';
const hsv = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx - mn < 1e-3) return [0, 0, mx]; let h = mx === r ? (g - b) / (mx - mn) : mx === g ? 2 + (b - r) / (mx - mn) : 4 + (r - g) / (mx - mn); return [(h * 60 + 360) % 360, (mx - mn) / mx, mx]; };
const PRESETS = {
  davi: { cor: (h, s, v) => (h < 14 || h > 342) && s > .45 && v > .18, onde: (x, y, z) => z < -.02 && y < .85 && !(Math.abs(x) > .2 && y > .66), pernas: true, y0: .22, y1: .72 },
  debora: { cor: (h, s, v) => h > 95 && h < 175 && s > .4 && v > .15, onde: (x, y, z) => y < .72 && !(Math.abs(x) > .3 && y > .62), pernas: false, y0: .15, y1: .62 },
};
export async function consertarCapa(doc, preset) {
  const P = PRESETS[preset]; if (!P) throw new Error('preset de capa desconhecido: ' + preset);
  const r = doc.getRoot(); const skin = r.listSkins()[0]; const J = skin.listJoints(); const nome = J.map(j => j.getName().replace(/^mixamorig:?/, ''));
  const pai = new Map(); for (const j of J) for (const c of j.listChildren()) pai.set(c, j);
  const idx = new Map(J.map((j, i) => [j, i]));
  const ruim = (n) => /(Arm|ForeArm|Hand)/.test(n) || (P.pernas && /(UpLeg|Leg|Foot|Toe)/.test(n));
  // sobe na hierarquia até sair de braço/perna (ex.: LeftForeArm -> LeftArm -> LeftShoulder; RightLeg -> RightUpLeg -> Hips)
  const destino = J.map((j, i) => { let k = j; while (k && ruim(nome[idx.get(k)] ?? '')) k = pai.get(k); return k ? idx.get(k) : i; });
  const iHips = nome.findIndex(n => n === 'Hips'); let mudou = 0;
  for (const m of r.listMeshes()) for (const p of m.listPrimitives()) {
    const t = p.getMaterial()?.getBaseColorTexture(); const uv = p.getAttribute('TEXCOORD_0'); if (!t || !uv) continue;
    const S = 256; const { data } = await sharp(Buffer.from(t.getImage())).resize(S, S).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const pos = p.getAttribute('POSITION'), jo = p.getAttribute('JOINTS_0'), we = p.getAttribute('WEIGHTS_0'); const e = [], u = [], j = [], w = []; const n = pos.getCount();
    // vizinhança (vértices soldados por posição + arestas dos triângulos)
    const id = new Int32Array(n), mapa = new Map(); for (let i = 0; i < n; i++) { pos.getElement(i, e); const k = e.map(v => Math.round(v * 1e4)).join(); if (!mapa.has(k)) mapa.set(k, i); id[i] = mapa.get(k); }
    const viz = Array.from({ length: n }, () => new Set()); const ind = p.getIndices().getArray();
    for (let t = 0; t < ind.length; t += 3) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) if (a !== b) viz[id[ind[t + a]]].add(id[ind[t + b]]);
    const regiao = new Uint8Array(n), sel = new Float32Array(n);
    for (let i = 0; i < n; i++) { pos.getElement(i, e); if (!P.onde(e[0], e[1], e[2])) continue; regiao[id[i]] = 1;
      uv.getElement(i, u); const x = Math.min(S - 1, Math.floor(((u[0] % 1) + 1) % 1 * S)), y = Math.min(S - 1, Math.floor(((u[1] % 1) + 1) % 1 * S)); const o = (y * S + x) * 3;
      if (P.cor(...hsv(data[o] / 255, data[o + 1] / 255, data[o + 2] / 255))) sel[id[i]] = 1; }
    // fecha buracos (acabamentos dourados, sombras pintadas) e suaviza a borda: 2 anéis de dilatação dentro da região, depois 3 de média
    for (let it = 0; it < 2; it++) { const s2 = sel.slice(); for (let i = 0; i < n; i++) if (id[i] === i && regiao[i] && !sel[i]) for (const v of viz[i]) if (sel[v] === 1) { s2[i] = 1; break; } sel.set(s2); }
    const duro = sel.slice(); for (let it = 0; it < 3; it++) { const s2 = sel.slice(); for (let i = 0; i < n; i++) { if (id[i] !== i || duro[i] === 1) continue; let sm = 0, c = 0; for (const v of viz[i]) { sm += sel[v]; c++; } if (c) s2[i] = sm / c; } sel.set(s2); }
    for (let i = 0; i < n; i++) {
      const k = sel[id[i]]; if (k <= 0.01) continue; pos.getElement(i, e);
      jo.getElement(i, j); we.getElement(i, w);
      const soma = new Map(); const add = (b, v) => soma.set(b, (soma.get(b) || 0) + v);
      for (let q = 0; q < 4; q++) if (w[q] > 0) { add(j[q], w[q] * (1 - k)); }
      // versão consertada: braço/perna -> osso do tronco; parte de baixo da capa vai passando para o quadril
      // (no golpe o tronco se inclina muito e a capa rígida no tronco ficava "de asa")
      const f = Math.min(1, Math.max(0, (e[1] - P.y0) / (P.y1 - P.y0))); const kq = iHips >= 0 ? 1 - f * f * (3 - 2 * f) : 0;
      for (let q = 0; q < 4; q++) if (w[q] > 0) add(destino[j[q]], w[q] * k * (1 - kq));
      if (kq > 0) add(iHips, k * kq);
      const lst = [...soma.entries()].filter(x => x[1] > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4); const tot = lst.reduce((a, b) => a + b[1], 0) || 1;
      const nj = [0, 0, 0, 0], nw = [0, 0, 0, 0]; lst.forEach(([b, v], q) => { nj[q] = b; nw[q] = v / tot; });
      jo.setElement(i, nj); we.setElement(i, nw); mudou++;
    }
  }
  console.log('capa', preset, ': vértices re-pesados', mudou);
  return mudou;
}
