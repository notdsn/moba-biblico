// Selva (estilo Wild Rift): dados do mapa, sem three.js (usado por world.js e selva.js)
const qs = new URLSearchParams(location.search);
export const SELVA_ON = qs.get('selva') !== '0';
// ?mapa=antigo: selva da versão anterior (uma rota só, faixa de 33 de cada lado). Padrão: mapa completo estilo Wild Rift.
export const MAPA_WR = SELVA_ON && qs.get('mapa') !== 'antigo';
// escala do mapa WR: rotas 1,5x mais longas (torres a ~18 m uma da outra com alcance 10,5, como a proporção do WR); acampamentos e poços acompanham
export const MAPA_K = MAPA_WR ? 1.5 : 1;
const K = MAPA_K, KP = (p) => [p[0] * K, p[1] * K];
export const laneZ = (x) => 2.2 * Math.sin(x / K * 0.045) - 0.6 * Math.sin(x / K * 0.11 + 1); // usado também por world.js
// Rotas laterais (topo e baixo/Dragão): desenhadas, andáveis e com torres, mas DESLIGADAS por enquanto
// (sem ondas de tropas, torres só decorativas, sem IA). Ligar no futuro: ROTAS_LATERAIS = true (falta a lógica de tropas por rota).
export const ROTAS_LATERAIS = false;
export const SELVA_LARG = 33; // (mapa antigo) meia-largura andável (|z - rota|)
export const SELVA_SUL = 33;
// Mapa WR: o Meio é o eixo x (Luz em x<0, Trevas em x>0); o mapa é um losango |x-1|+|z| <= MAPA_C + MAPA_FOLGA.
// A câmera gira 45°: na tela a base da Luz fica embaixo à esquerda, a das Trevas em cima à direita; z<0 = topo/esquerda (rio de cima).
export const MAPA_C = 64 * K, MAPA_FOLGA = 4.5;
export const distLosango = (x, z) => Math.abs(x - 1) + Math.abs(z);
// rotas laterais (polilinhas): saem da base, seguem a borda do losango e dobram no canto (1, ∓61)
export const ROTA_TOPO = [[-50, -4], [-44, -19], [-6, -57], [1, -61], [8, -57], [46, -19], [52, -4]].map(([x, z]) => [(x - 1) * K + 1, z * K]);
export const ROTA_BAIXO = ROTA_TOPO.map(([x, z]) => [x, -z]);
function distPoli(pl, x, z) { let m = 1e9; for (let i = 0; i < pl.length - 1; i++) { const [ax, az] = pl[i], [bx, bz] = pl[i + 1]; const vx = bx - ax, vz = bz - az; const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz))); const dx = x - ax - vx * t, dz = z - az - vz * t; m = Math.min(m, dx * dx + dz * dz); } return Math.sqrt(m); }
export const distLateral = (x, z) => MAPA_WR ? Math.min(distPoli(ROTA_TOPO, x, z), distPoli(ROTA_BAIXO, x, z)) : 1e9;
// torres das rotas laterais (só visuais): base, interna, externa de cada metade; [x, z, time]
export const TORRES_LATERAIS = [];
if (MAPA_WR) for (const pl of [ROTA_TOPO, ROTA_BAIXO]) for (const [ti, a, b] of [['luz', pl[1], pl[2]], ['trevas', pl[5], pl[4]]]) for (const t of [.06, .38, .72]) {
  const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t; const nx = 1 - x, nz = -z, nl = Math.hypot(nx, nz); TORRES_LATERAIS.push([x + nx / nl * 4.6, z + nz / nl * 4.6, ti]); } // na beira da estrada (lado da selva): a rota fica livre
// Layout (simetria por ROTAÇÃO de 180° em volta de (1, 0), como no WR): Luz (x<0) — Rocha (azul) + Lobos entre a base e o rio de cima,
// Sarça (vermelho) + Gigantes entre o Meio e a rota de baixo. Trevas: o mesmo girado. Acampamentos a >= 15 das torres ativas.
const ROT = (s, p) => s < 0 ? p : [2 - p[0], -p[1]];
export const CAMPOS = [];
const LUZ_CAMPOS = MAPA_WR ? { rocha: KP([-19, -20]), lobos: KP([-13, -27]), gigantes: KP([-12, 24]), sarca: KP([-19, 15]) } : { rocha: [-26, -12], lobos: [-20, -23], gigantes: [-31, 11], sarca: [-27, 22] };
for (const s of [-1, 1]) {
  const t = s < 0 ? 'luz' : 'trevas';
  for (const [tipo, p] of Object.entries(LUZ_CAMPOS)) { const [x, z] = ROT(s, p); CAMPOS.push({ id: tipo + '_' + t, tipo, lado: t, x, z }); }
}
export const COVA_RIN = 8.4, COVA_ROUT = 12.2; // poços (Dragão e Leviatã): miolo andável e borda externa
export const POCO_XZ = MAPA_WR ? [0, -30 * K] : [7, -24], DRAG_XZ = MAPA_WR ? [2, 30 * K] : [-5, 24];
CAMPOS.push({ id: 'dragao', tipo: 'dragao', lado: null, x: DRAG_XZ[0], z: DRAG_XZ[1] });
CAMPOS.push({ id: 'poco', tipo: 'poco', lado: null, x: POCO_XZ[0], z: POCO_XZ[1] }); // Beemote e depois Leviatã
// o Jordão: curva por fora dos dois poços (antes passava a 2,7 m do centro); do lado do rio fica uma das bocas
const desvioRio = (z, zc, alvoX) => { const W = 30, t = (z - zc) / W; if (Math.abs(t) >= 1) return 0; const base = 1 + 2.2 * Math.sin(zc * .09); return (alvoX - base) * .5 * (1 + Math.cos(Math.PI * t)); };
const RIO_LARG = 7.5;
export function rioX(z) { let x = 1 + 2.2 * Math.sin(z * .09); if (MAPA_WR) { x += desvioRio(z, POCO_XZ[1], POCO_XZ[0] + COVA_ROUT + RIO_LARG / 2 + .6); x += desvioRio(z, DRAG_XZ[1], DRAG_XZ[0] - COVA_ROUT - RIO_LARG / 2 - .6); } return x; }
// trilhas (segmentos) ligando rotas, acampamentos e as entradas diagonais dos dois poços do rio
export const TRILHAS = [];
{ const R_POCO = 9, e = R_POCO * .72;
  const eb = COVA_ROUT + 1.5; // trilhas chegam nas bocas (leste/oeste) dos poços
  const pN1 = [POCO_XZ[0] - eb, POCO_XZ[1]], pN2 = [POCO_XZ[0] + eb, POCO_XZ[1]], dS1 = [DRAG_XZ[0] - eb, DRAG_XZ[1]], dS2 = [DRAG_XZ[0] + eb, DRAG_XZ[1]];
  const seg0 = (a, b) => TRILHAS.push([...a, ...b]);
  for (const s of [-1, 1]) {
    const R = (p) => ROT(s, p), L = (x) => { const q = R([x, 0]); return [q[0], laneZ(q[0])]; };
    const seg = (a, b) => TRILHAS.push([...a, ...b]);
    const { rocha, lobos, gigantes, sarca } = LUZ_CAMPOS;
    if (MAPA_WR) {
      seg(L(-21 * K), R(rocha)); seg(R(rocha), R(lobos)); seg(R(lobos), s < 0 ? pN1 : dS2); seg(R(rocha), R(KP([-31, -32]))); seg(R(lobos), R(KP([-24, -39])));
      seg(L(-21 * K), R(sarca)); seg(R(sarca), R(gigantes)); seg(R(gigantes), s < 0 ? dS1 : pN2); seg(R(sarca), R(KP([-33, 29]))); seg(R(gigantes), R(KP([-25, 38])));
      seg(L(-6 * K), R(KP([-6, -14]))); seg(R(KP([-6, -14])), R(lobos)); seg(L(-6 * K), R(KP([-6, 14]))); seg(R(KP([-6, 14])), R(gigantes));
    } else {
      seg(L(-17), R(rocha)); seg(R(rocha), R(lobos)); seg(R(lobos), R([-8, -21])); seg(R([-8, -21]), s < 0 ? pN1 : dS2);
      seg(L(-17), R(gigantes)); seg(R(gigantes), R(sarca)); seg(R(sarca), R([-14, 24])); seg(R([-14, 24]), s < 0 ? dS1 : pN2);
      seg(L(-36), R([-34, -8])); seg(R([-34, -8]), R(rocha)); seg(L(-38), R(gigantes));
    }
  }
  seg0([1, laneZ(1)], pN1); seg0([1, laneZ(1)], pN2); seg0([1, laneZ(1)], dS1); seg0([1, laneZ(1)], dS2);
  if (MAPA_WR) { seg0(pN1, KP([-14, -50])); seg0(pN2, KP([16, -50])); seg0(dS1, KP([-14, 50])); seg0(dS2, KP([16, 50])); } } // rio até as rotas laterais
export function distTrilha(x, z) {
  let m = 1e9;
  for (const [ax, az, bx, bz] of TRILHAS) { const vx = bx - ax, vz = bz - az; const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz))); const dx = x - ax - vx * t, dz = z - az - vz * t; const d = dx * dx + dz * dz; if (d < m) m = d; }
  return Math.sqrt(m);
}
export function distCampo(x, z) { let m = 1e9, c = null; for (const k of CAMPOS) { const d = Math.hypot(x - k.x, z - k.z); if (d < m) { m = d; c = k; } } return [m, c]; }

// covas (estilo WR): poços com muralha de pedra e duas entradas voltadas para a rota; buffs com meia-cova no lado de fora
export const COVAS = CAMPOS.filter(c => ['dragao', 'poco', 'sarca', 'rocha'].includes(c.tipo)).map(c => {
  const poco = !c.lado; const r = poco ? 9 : 5; const dz = c.z > 0 ? -1 : 1; // direção da rota
  // rodada 5: poços com a borda modular do Jarvys (dois arcos baixos, entradas opostas): uma boca para o rio (que contorna o poço) e outra para a selva
  const ent = poco ? [0, Math.PI] : null;
  const fora = Math.atan2(-dz, 0); // buffs: arco de pedra só do lado de fora (longe da rota)
  const rIn = poco ? COVA_RIN : r + .3, rOut = poco ? COVA_ROUT : r + 2.2;
  return { c, x: c.x, z: c.z, r, poco, ent, fora, arco: poco ? null : 1.25, rIn, rOut, meia: c.tipo === 'poco' ? .17 : .27 };
});
const angD = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
export function naMuralha(cv, a) { return cv.poco ? cv.ent.every(e => angD(a, e) > cv.meia) : angD(a, cv.fora) < cv.arco; }
// altura extra do terreno: borda elevada das covas (o fundo fica no nível do chão, a borda sobe)
export function bordaCova(x, z) {
  let h = 0;
  for (const cv of COVAS) { const dx = x - cv.x, dz = z - cv.z; const d = Math.hypot(dx, dz); if (cv.poco || d > cv.r + 4) continue; if (!naMuralha(cv, Math.atan2(dz, dx))) continue;
    const k = Math.max(0, 1 - Math.abs(d - (cv.r + 1.2)) / 2.4); h = Math.max(h, k * k * (3 - 2 * k) * (cv.poco ? 1.5 : .9)); }
  return h;
}
// colisão com a muralha das covas (heróis) e desvio pelas entradas (IA)
export function empurrarCova(p) {
  for (const cv of COVAS) { const dx = p.x - cv.x, dz = p.z - cv.z, d = Math.hypot(dx, dz); if (d > cv.rOut + 1 || d < 1e-3) continue; if (!naMuralha(cv, Math.atan2(dz, dx))) continue;
    const w0 = cv.rIn, w1 = cv.rOut; if (d > w0 && d < w1) { const nd = d - w0 < w1 - d ? w0 : w1; p.x = cv.x + dx / d * nd; p.z = cv.z + dz / d * nd; } }
}
export function desvioCova(p, alvo) {
  for (const cv of COVAS) {
    const w0 = cv.rIn, w1 = cv.rOut;
    const dp = Math.hypot(p.x - cv.x, p.z - cv.z), da = Math.hypot(alvo.x - cv.x, alvo.z - cv.z); const inP = dp < w0 + .2, inA = da < w0 + .2;
    const ap = Math.atan2(p.z - cv.z, p.x - cv.x), aa = Math.atan2(alvo.z - cv.z, alvo.x - cv.x);
    const es = cv.poco ? cv.ent : [cv.fora + Math.PI];
    const naBoca = !inP && dp < w1 + .6 && !naMuralha(cv, ap); // dentro do corredor da entrada
    if (!inP && !inA && !naBoca) { // passa por fora: se o caminho reto cruza a cova, contorna pela borda (senão entra, bate na muralha e oscila)
      const vx = alvo.x - p.x, vz = alvo.z - p.z, L2 = vx * vx + vz * vz; if (L2 < 1e-6) continue; const t = ((cv.x - p.x) * vx + (cv.z - p.z) * vz) / L2; if (t <= 0 || t >= 1) continue;
      const qx = p.x + vx * t, qz = p.z + vz * t; let nx = qx - cv.x, nz = qz - cv.z; const dq = Math.hypot(nx, nz); if (dq > w1 + .2) continue;
      if (dq < .05) { nx = -vz; nz = vx; } const nl = Math.hypot(nx, nz); return { x: cv.x + nx / nl * (w1 + 1.6), z: cv.z + nz / nl * (w1 + 1.6) }; }
    if (inP && inA) continue;
    if (!inP && !inA) { // na boca, indo para fora: termina de sair pela boca
      let e0 = es[0]; for (const e of es) if (angD(ap, e) < angD(ap, e0)) e0 = e; return { x: cv.x + Math.cos(e0) * (w1 + 1.4), z: cv.z + Math.sin(e0) * (w1 + 1.4) }; }
    let best = es[0], bd = 1e9; for (const e of es) { const ex = cv.x + Math.cos(e) * (w1 + .6), ez = cv.z + Math.sin(e) * (w1 + .6); const c = Math.hypot(p.x - ex, p.z - ez) + Math.hypot(alvo.x - ex, alvo.z - ez); if (c < bd) { bd = c; best = e; } }
    if (inA) { // entrando
      if (naBoca) { let e0 = es[0]; for (const e of es) if (angD(ap, e) < angD(ap, e0)) e0 = e; if (angD(aa, e0) < cv.meia * .8 || dp < w0 + 1) return alvo; return { x: cv.x + Math.cos(e0) * (w0 - 1.2), z: cv.z + Math.sin(e0) * (w0 - 1.2) }; }
      // contorna por fora até a boca (a reta até ela cortaria a muralha): passos de ~0,45 rad no anel externo
      let da = Math.atan2(Math.sin(best - ap), Math.cos(best - ap)); if (Math.abs(da) > .35) { const a2 = ap + Math.sign(da) * Math.min(Math.abs(da), .45), rr = Math.max(w1 + 1.6, Math.min(dp, w1 + 3)); return { x: cv.x + Math.cos(a2) * rr, z: cv.z + Math.sin(a2) * rr }; }
      return { x: cv.x + Math.cos(best) * (w1 + .8), z: cv.z + Math.sin(best) * (w1 + .8) };
    }
    // saindo (p dentro, alvo fora): vai até a boca por dentro e depois sai por ela
    if (!naMuralha(cv, aa) && da < w1 + 2) return alvo;
    return angD(ap, best) < cv.meia * .7 ? { x: cv.x + Math.cos(best) * (w1 + 1.4), z: cv.z + Math.sin(best) * (w1 + 1.4) } : { x: cv.x + Math.cos(best) * (w0 - 1.5), z: cv.z + Math.sin(best) * (w0 - 1.5) };
  }
  return alvo;
}
