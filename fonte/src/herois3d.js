// Visual dos heróis (Luz) e vilões (Trevas) sobre a base CC0 Quaternius: cascas + peças rígidas
import * as THREE from 'three';
import { VARIANTES, capa, ombreira, pintar, V, C } from './equip.js';

const OURO = '#e6b85a';
const G = THREE;
// ---------- auxiliares ----------
function joelheiras(m, cor, mt = 'bronze', aro = OURO, r = .058) {
  for (const sd of ['l', 'r']) { const k = m.bp['calf_' + sd]; const j = new G.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI * .5); j.rotateX(Math.PI / 2); j.scale(1, 1.15, .7); j.translate(k.x, k.y - .01, k.z + r + .002); m.peca(j, 'calf_' + sd, cor, mt);
    if (aro) { const t = new G.TorusGeometry(r - .002, .007, 5, 20); t.scale(1, 1.15, 1); t.translate(k.x, k.y - .01, k.z + r + .004); m.peca(t, 'calf_' + sd, aro, 'ouro'); } }
}
// saia/túnica longa (tronco de cone) com pesos distribuídos entre pélvis e coxas
function saia(m, { y0, y1, r0 = .19, r1 = .27, cor, mt = 'tecido', rz = .82, fenda = 0, seg = 28, z = -.03, borda = null, dupla = true }) {
  const h = y0 - y1; const geo = new G.CylinderGeometry(r0, r1, h, seg, 8, true, fenda ? fenda / 2 : 0, Math.PI * 2 - fenda);
  geo.rotateY(Math.PI / 2 + (fenda ? 0 : 0)); geo.scale(1, 1, rz); geo.translate(0, (y0 + y1) / 2, z);
  // ondulado leve
  const P = geo.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), zz = P.getZ(i); const t = (y0 - y) / h; const a = Math.atan2(x, zz - z); const k = 1 + .045 * t * Math.sin(a * 9); P.setXYZ(i, x * k, y, z + (zz - z) * k); }
  geo.computeVertexNormals();
  const w = (p) => { const t = THREE.MathUtils.clamp((y0 - p.y) / h, 0, 1); const lat = THREE.MathUtils.clamp(Math.abs(p.x) / r1, 0, 1); const k = Math.min(.8, t * 1.1) * (.35 + .65 * lat); return [['pelvis', 1 - k], [p.x > 0 ? 'thigh_l' : 'thigh_r', k]]; };
  m.peca(geo, w, cor, mt);
  if (dupla) { const g2 = geo.clone(); const ii = g2.index ? null : null; const gi = g2.toNonIndexed(); const Q = gi.attributes.position; for (let i = 0; i < Q.count; i += 3) { const t = [Q.getX(i), Q.getY(i), Q.getZ(i)]; Q.setXYZ(i, Q.getX(i + 1), Q.getY(i + 1), Q.getZ(i + 1)); Q.setXYZ(i + 1, ...t); }
    for (let i = 0; i < Q.count; i++) { const x = Q.getX(i), zz = Q.getZ(i); Q.setX(i, x * .985); Q.setZ(i, z + (zz - z) * .985); } gi.computeVertexNormals(); m.peca(gi, w, cor, mt); }
  if (borda) { const t = new G.TorusGeometry(r1 * 1.02, .011, 5, seg * 2, Math.PI * 2 - fenda); t.rotateX(Math.PI / 2); t.rotateY(-Math.PI / 2 + (fenda ? -fenda / 2 : 0)); t.scale(1, 1, rz); const Pt = t.attributes.position; for (let i = 0; i < Pt.count; i++) { const x = Pt.getX(i), zz = Pt.getZ(i); const a = Math.atan2(x, zz); const k = 1 + .045 * Math.sin(a * 9); Pt.setX(i, x * k); Pt.setZ(i, zz * k); } t.translate(0, y1, z); m.peca(t, w, borda, 'ouro'); }
}
function tubo(pts, r0, r1 = r0, seg = 10, rs = 6) {
  const tub = new G.TubeGeometry(new G.CatmullRomCurve3(pts), seg, 1, rs, false); const P = tub.attributes.position; const n = rs + 1;
  const cur = new G.CatmullRomCurve3(pts);
  for (let i = 0; i < P.count; i++) { const k = Math.floor(i / n) / seg; const c = cur.getPointAt(k); const r = r0 + (r1 - r0) * k; P.setXYZ(i, c.x + (P.getX(i) - c.x) * r, c.y + (P.getY(i) - c.y) * r, c.z + (P.getZ(i) - c.z) * r); }
  tub.computeVertexNormals(); return tub;
}
const box = (w, h, d, x, y, z) => { const g = new G.BoxGeometry(w, h, d); g.translate(x, y, z); return g; };
const esf = (r, x, y, z, sx = 1, sy = 1, sz = 1, ws = 12, hs = 8) => { const g = new G.SphereGeometry(r, ws, hs); g.scale(sx, sy, sz); g.translate(x, y, z); return g; };
const anel = (r, t, y, z = 0, sz = 1.1, rx = Math.PI / 2) => { const g = new G.TorusGeometry(r, t, 6, 32); g.rotateX(rx); g.scale(1, 1, sz); g.translate(0, y, z); return g; };
function gema(m, osso, x, y, z, cor = '#ff2a3a', r = .022) { const g = new G.OctahedronGeometry(r, 0); g.scale(1, 1.3, .6); g.translate(x, y, z); m.peca(g, osso, cor, 'brilho'); }
// arma na mão direita, eixo ao longo de +Z (pose T): f(x,y,z,geo) com o punho na origem
function naMao(m, lado, pecas) { const h = m.bp['hand_' + lado]; const x = h.x + (lado === 'r' ? -.07 : .07); for (const [geo, cor, mt] of pecas) { geo.translate(x, h.y, h.z); m.peca(geo, 'hand_' + lado, cor, mt); } }
const zc = (g) => { g.rotateX(Math.PI / 2); return g; }; // cilindro ao longo de Z

// =============== LUZ ===============
VARIANTES.sansao = (m, { body, tronco, cabelos, sobr }) => {
  const COURO = '#5a3418', LEAO = '#b98a44', JUBA = '#6e4418', BR = '#b67a3c';
  body.material.map = pintar(m, body.material.map, [
    [(c, b) => (b === 'quadril' || b === 'coxa') && c.y > .6, '#6a4424'],
    [(c, b) => b === 'pe' || (b === 'canela' && c.y < .16), COURO],
  ]);
  m.casca((c, b) => b === 'quadril' || b === 'coxa', .03, '#6b4424', 'tiras', { cor: BR, mt: 'bronze', w: .014 }, [{ eixo: 'y', min: .6, max: .93 }]);
  m.casca((c, b) => b === 'tronco' || b === 'quadril', .038, '#3a2210', 'couro', { cor: OURO, w: .01 }, [{ eixo: 'y', min: .9, max: 1.0 }]);
  m.casca((c, b) => tronco(c, b), .03, '#3e2412', 'couro', { cor: BR, mt: 'bronze', w: .006, h: .004 }, [{ eixo: 'y', min: .99, max: 1.44 }, { eixo: 'd', min: 1.19, max: 1.25 }, { eixo: 'ax', max: .2 }]);
  m.casca((c, b) => b === 'antebraco' || b === 'mao', .016, BR, 'bronze', { cor: OURO, w: .012 }, [{ eixo: 'ax', min: .5, max: .67 }]);
  m.casca((c, b) => b === 'canela', .012, '#8a6a44', 'corda', null, [{ eixo: 'y', min: .16, max: .46 }]);
  m.casca((c, b) => b === 'pe' || b === 'canela', .01, COURO, 'couro', { cor: '#2a180c', mt: 'couro', w: .01 }, [{ eixo: 'y', max: .16 }]);
  joelheiras(m, BR);
  // pele de leão: manto + juba + cabeça no ombro + patas cruzadas no peito
  capa(m, { cor: LEAO, y1: .62, larg0: .25, larg1: .36, recuo: .16, rasgada: true });
  for (let k = 0; k < 22; k++) { const a = -Math.PI * .95 + k / 21 * Math.PI * 1.9; const c = new G.ConeGeometry(.045, .16, 5); c.rotateX(Math.PI * .75); c.rotateY(a); c.translate(Math.sin(a) * .16, 1.5 + Math.cos(a) * .01, Math.cos(a) * .12 - .03); if (Math.cos(a) > .6) continue; m.peca(c, 'spine_03', k % 2 ? JUBA : '#8a5a24', 'couro'); }
  { const cx = .2, cy = 1.56, cz = -.03; m.peca(esf(.085, cx, cy, cz, 1, .85, 1.15), 'clavicle_l', LEAO, 'couro'); m.peca(esf(.045, cx, cy - .02, cz + .09, 1, .8, 1), 'clavicle_l', '#c89a54', 'couro');
    m.peca(esf(.012, cx - .03, cy + .02, cz + .08), 'clavicle_l', '#1a120a', 'pedra'); m.peca(esf(.012, cx + .03, cy + .02, cz + .08), 'clavicle_l', '#1a120a', 'pedra');
    for (const s of [-1, 1]) { const o = new G.ConeGeometry(.025, .05, 5); o.translate(cx + s * .05, cy + .08, cz - .02); m.peca(o, 'clavicle_l', LEAO, 'couro'); }
    for (let k = 0; k < 9; k++) { const a = k / 8 * Math.PI * 2; const c = new G.ConeGeometry(.04, .12, 5); c.rotateX(-Math.PI / 2 - .5); c.rotateY(a); c.translate(cx + Math.sin(a) * .07, cy + Math.cos(a) * .06, cz - .05); m.peca(c, 'clavicle_l', JUBA, 'couro'); } }
  for (const s of [-1, 1]) { const p = tubo([V(s * .2, 1.47, .02), V(s * .13, 1.4, .12), V(s * .03, 1.33, .15)], .03, .022, 8); m.peca(p, 'spine_03', LEAO, 'couro'); }
  m.peca(anel(.03, .01, 1.33, .15, 1, 0), 'spine_03', OURO, 'ouro');
  // correntes quebradas nos pulsos
  for (const sd of ['l', 'r']) { const h = m.bp['lowerarm_' + sd], s = sd === 'l' ? 1 : -1; for (let k = 0; k < 2; k++) { const t = new G.TorusGeometry(.055, .012, 5, 16); t.rotateY(Math.PI / 2); t.translate(s * (.64 - k * .035), h.y - .005, h.z + .005); m.peca(t, 'lowerarm_' + sd, '#6a6d74', 'prata'); }
    for (let k = 0; k < 3; k++) { const t = new G.TorusGeometry(.022, .007, 4, 10); if (k % 2) t.rotateX(Math.PI / 2); t.translate(s * .62, h.y - .07 - k * .035, h.z + .01); m.peca(t, 'lowerarm_' + sd, '#6a6d74', 'prata'); } }
  // queixada de jumento na mão direita
  { const pts = [V(0, 0, -.05), V(0, .02, .15), V(0, .07, .32), V(0, .03, .48)]; const q = tubo(pts, .035, .05, 10, 7); q.scale(.8, 1, 1);
    const pc = [[q, '#e4d6b4', 'pedra']];
    for (let k = 0; k < 6; k++) { const d = new G.ConeGeometry(.013, .045, 4); d.rotateX(Math.PI); d.translate(0, .02 - .035 + k * .008, .2 + k * .045); pc.push([d, '#f4ecd6', 'pedra']); }
    pc.push([zc(new G.CylinderGeometry(.03, .03, .1, 8)), '#5a3418', 'corda']);
    naMao(m, 'r', pc); }
  cabelos.push(['long', '#2a1a10'], ['beard', '#2a1a10']);
};

VARIANTES.debora = (m, { body, tronco, cabelos }) => {
  const BR = '#f1ebdc', AZ = '#2f6fb8', AZ2 = '#1f4f8f';
  body.material.map = pintar(m, body.material.map, [
    [(c, b) => b === 'braco' && Math.abs(c.x) < m.AX(.36), BR],
    [(c, b) => tronco(c, b) || b === 'quadril' || b === 'coxa' || b === 'canela', BR],
    [(c, b) => b === 'pe', '#6a4424'],
  ]);
  body.material.normalMap = null;
  const BT = { cor: OURO, w: .008, h: .005 };
  m.casca((c, b) => b === 'tronco' || b === 'braco', .007, BR, 'tecido', BT, [{ eixo: 'y', min: .95, max: 1.5 }, { eixo: 'ax', max: .34 }]);
  m.casca((c, b) => tronco(c, b), .022, '#d9d9e0', 'prata', { cor: OURO }, [{ eixo: 'y', min: 1.12, max: 1.43 }, { eixo: 'z', min: .0 }, { eixo: 'ax', max: .17 }]);
  m.casca((c, b) => b === 'tronco' || b === 'quadril', .03, AZ, 'tecido', { cor: OURO, w: .01 }, [{ eixo: 'y', min: .93, max: 1.02 }]);
  m.casca((c, b) => b === 'antebraco' || b === 'mao', .014, OURO, 'ouro', { cor: '#b8862a', w: .008 }, [{ eixo: 'ax', min: .5, max: .66 }]);
  m.casca((c, b) => b === 'pe' || b === 'canela', .008, '#6a4424', 'couro', { cor: OURO, w: .008 }, [{ eixo: 'y', max: .14 }]);
  const y0 = m.Y(.97), y1 = m.Y(.26);
  saia(m, { y0, y1, r0: .17, r1: .27, cor: BR, borda: OURO, z: -.035 });
  saia(m, { y0: m.Y(.4), y1: y1 + .004, r0: .262, r1: .285, cor: AZ, z: -.035, dupla: false, seg: 28 });
  // faixa pendente azul na frente
  m.peca(box(.09, m.Y(.97) - m.Y(.55), .012, 0, (m.Y(.97) + m.Y(.55)) / 2, .165), (p) => [['pelvis', 1]], AZ, 'tecido');
  m.peca(box(.1, .02, .016, 0, m.Y(.56), .166), 'pelvis', OURO, 'ouro');
  capa(m, { cor: AZ2, y1: .45, larg0: .17, larg1: .3, recuo: .14 });
  for (const s of [-1, 1]) m.peca(esf(.024, s * .12, m.Y(1.45), .04), 'spine_03', OURO, 'ouro');
  ombreira(m, 'l', { cor: '#d9d9e0', mt: 'prata', cor2: OURO, camadas: 2, r: .095 }); ombreira(m, 'r', { cor: '#d9d9e0', mt: 'prata', cor2: OURO, camadas: 2, r: .095 });
  // diadema com estrela
  { const hy = m.bp.Head.y; m.peca(anel(.1, .007, hy + .13, -.005, 1.12, Math.PI / 2 - .25), 'Head', OURO, 'ouro');
    const st = new G.OctahedronGeometry(.028, 0); st.scale(1, 1.3, .4); st.translate(0, hy + .15, .112); m.peca(st, 'Head', '#fff6c8', 'brilho'); }
  // medalhão da palmeira no peito
  m.peca(zc(new G.CylinderGeometry(.04, .04, .01, 20)).translate(0, m.Y(1.3), .16), 'spine_03', OURO, 'ouro');
  // cajado de palmeira (juíza debaixo da palmeira)
  { const pc = [[zc(new G.CylinderGeometry(.018, .022, 1.5, 8)).translate(0, 0, .3), '#7a5230', 'madeira'], [zc(new G.CylinderGeometry(.03, .03, .05, 10)).translate(0, 0, 1.02), OURO, 'ouro']];
    for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; const f = tubo([V(0, 0, 1.05), V(Math.cos(a) * .12, Math.sin(a) * .12, 1.13), V(Math.cos(a) * .22, Math.sin(a) * .22, 1.08)], .02, .008, 6, 4); f.scale(1, 1, 1); pc.push([f, k % 2 ? '#4f8a3a' : '#3f7a30', 'couro']); }
    pc.push([esf(.03, 0, 0, 1.08), '#8ad0ff', 'brilho']);
    naMao(m, 'r', pc); }
  cabelos.push(['long', '#3e2414']);
};

VARIANTES.gideao = (m, { body, tronco, cabelos }) => {
  const OL = '#5e6a33', OL2 = '#7b7a44', COURO = '#4a2c16', BR = '#a8743a';
  body.material.map = pintar(m, body.material.map, [
    [(c, b) => b === 'braco' && Math.abs(c.x) < .36, OL],
    [(c, b) => tronco(c, b), OL],
    [(c, b) => (b === 'quadril' || b === 'coxa') && c.y > .62, OL2],
    [(c, b) => b === 'pe' || (b === 'canela' && c.y < .2), COURO],
  ]);
  const BT = { cor: '#3c4420', mt: 'tecido', w: .006, h: .004 };
  m.casca((c, b) => b === 'tronco' || b === 'braco', .006, OL, 'tecido', BT, [{ eixo: 'y', min: 1.4, max: 1.5 }, { eixo: 'ax', max: .35 }]);
  m.casca((c, b) => b === 'coxa' || b === 'quadril', .006, OL, 'tecido', BT, [{ eixo: 'y', min: .6, max: .72 }]);
  m.casca((c, b) => tronco(c, b), .026, '#6a4a2a', 'lamela', { cor: BR, mt: 'bronze' }, [{ eixo: 'y', min: .975, max: 1.44 }, { eixo: 'ax', max: .2 }]);
  m.casca((c, b) => b === 'tronco' || b === 'quadril', .036, COURO, 'couro', { cor: BR, mt: 'bronze', w: .01 }, [{ eixo: 'y', min: .9, max: .985 }]);
  m.casca((c, b) => b === 'quadril' || b === 'coxa', .03, '#4a4a26', 'tiras', { cor: BR, mt: 'bronze', w: .012 }, [{ eixo: 'y', min: .69, max: .915 }]);
  m.casca((c, b) => b === 'antebraco' || b === 'mao', .015, COURO, 'couro', { cor: BR, mt: 'bronze', w: .012 }, [{ eixo: 'ax', min: .5, max: .685 }]);
  m.casca((c, b) => b === 'canela', .015, BR, 'bronze', { cor: OURO, w: .01 }, [{ eixo: 'y', min: .21, max: .5 }, { eixo: 'z', min: -.075 }]);
  m.casca((c, b) => b === 'pe' || b === 'canela', .011, '#3b2414', 'couro', { cor: '#2a180c', mt: 'couro', w: .012 }, [{ eixo: 'y', max: .215 }]);
  m.casca((c, b) => b === 'braco', .012, '#4a3a22', 'couro', null, [{ eixo: 'ax', min: .2, max: .38 }]);
  ombreira(m, 'l', { cor: '#6a4a2a', mt: 'couro', cor2: BR }); ombreira(m, 'r', { cor: '#6a4a2a', mt: 'couro', cor2: BR });
  joelheiras(m, BR);
  capa(m, { cor: '#4a3a22', y1: .6, larg1: .3, recuo: .18, rasgada: true });
  // capuz caído nos ombros
  m.peca(anel(.15, .045, 1.47, -.05, .85), 'spine_03', '#4a3a22', 'tecido');
  // faixa na testa
  m.peca(anel(.108, .012, 1.73, -.005, 1.12, Math.PI / 2 - .25), 'Head', OL, 'tecido');
  // trombeta (shofar) nas costas
  { const s = tubo([V(-.18, 1.0, -.2), V(-.05, 1.16, -.24), V(.12, 1.3, -.22), V(.2, 1.44, -.14)], .018, .055, 12, 8); m.peca(s, 'spine_03', '#d9c49a', 'pedra'); m.peca(anel(.05, .008, 0, 0, 1).translate(.2, 1.44, -.14), 'spine_03', BR, 'bronze'); }
  // cântaro com tocha na cintura (lado esquerdo)
  { const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new G.Vector2(.02 + Math.sin(t * Math.PI) * .07 + t * .02, t * .2)); } const j = new G.LatheGeometry(pts, 12); j.translate(.22, .7, .04); m.peca(j, (p) => [['pelvis', .6], ['thigh_l', .4]], '#a8542a', 'pedra');
    const f = new G.ConeGeometry(.04, .14, 7); f.translate(.22, .96, .04); m.peca(f, (p) => [['pelvis', .6], ['thigh_l', .4]], '#ff8a2a', 'brilhoF');
    const f2 = new G.ConeGeometry(.022, .1, 6); f2.translate(.22, .99, .04); m.peca(f2, (p) => [['pelvis', .6], ['thigh_l', .4]], '#ffe07a', 'brilhoF'); }
  // espada na mão direita
  naMao(m, 'r', [[box(.014, .055, .74, 0, 0, .44), '#e4e8ee', 'prata'], [box(.03, .17, .03, 0, 0, .07), BR, 'bronze'], [zc(new G.CylinderGeometry(.018, .018, .14, 8)), COURO, 'couro'], [esf(.025, 0, 0, -.08), BR, 'bronze']]);
  cabelos.push(['buzzed', '#4a2c18'], ['beard', '#4a2c18']);
};

// =============== TREVAS (vilões) ===============
VARIANTES.golias = (m, { body, tronco, cabelos }) => {
  const BR = '#8d6230', BRE = '#6a4520', RUBI = '#6a1414', PR = '#1c1410';
  body.material.map = pintar(m, body.material.map, [
    [(c, b) => b === 'braco' && Math.abs(c.x) < .38, RUBI],
    [(c, b) => tronco(c, b) || b === 'quadril' || (b === 'coxa' && c.y > .55), RUBI],
    [(c, b) => b === 'pe' || b === 'canela', PR],
  ]);
  body.material.normalMap = null;
  // couraça de escamas até os joelhos (1Sm 17:5)
  m.casca((c, b) => tronco(c, b), .034, BR, 'lamela', { cor: '#c89a4a', mt: 'bronze', w: .02 }, [{ eixo: 'y', min: .96, max: 1.46 }, { eixo: 'ax', max: .21 }]);
  m.casca((c, b) => b === 'quadril' || b === 'coxa', .036, BRE, 'lamela', { cor: '#c89a4a', mt: 'bronze', w: .016 }, [{ eixo: 'y', min: .6, max: .93 }]);
  m.casca((c, b) => b === 'tronco' || b === 'quadril', .05, PR, 'couro', { cor: '#c89a4a', mt: 'bronze', w: .014 }, [{ eixo: 'y', min: .88, max: .98 }]);
  m.casca((c, b) => b === 'braco', .018, BRE, 'lamela', null, [{ eixo: 'ax', min: .2, max: .42 }]);
  m.casca((c, b) => b === 'antebraco' || b === 'mao', .02, BR, 'bronze', { cor: '#c89a4a', w: .014 }, [{ eixo: 'ax', min: .47, max: .68 }]);
  // grevas de bronze (1Sm 17:6)
  m.casca((c, b) => b === 'canela', .022, BR, 'bronze', { cor: '#c89a4a', w: .014 }, [{ eixo: 'y', min: .17, max: .53 }]);
  m.casca((c, b) => b === 'pe' || b === 'canela', .012, PR, 'couro', { cor: '#0c0806', mt: 'couro', w: .012 }, [{ eixo: 'y', max: .175 }]);
  ombreira(m, 'l', { cor: BR, cor2: '#c89a4a', camadas: 4, r: .15 }); ombreira(m, 'r', { cor: BR, cor2: '#c89a4a', camadas: 4, r: .15 });
  for (const s of [-1, 1]) for (let k = 0; k < 2; k++) { const e = new G.ConeGeometry(.03, .14, 5); e.rotateZ(-s * (.4 + k * .5)); e.translate(s * (.25 + k * .06), 1.56 - k * .04, -.01); m.peca(e, 'upperarm_' + (s > 0 ? 'l' : 'r'), '#c89a4a', 'bronze'); }
  joelheiras(m, BR, 'bronze', '#c89a4a', .066);
  // elmo de bronze com cocar de penas (filisteu)
  { const hc = V(0, 1.69, -.01);
    m.peca(new G.SphereGeometry(.145, 16, 8, 0, Math.PI * 2, 0, Math.PI * .56).scale(1, 1.0, 1.12).translate(hc.x, hc.y, hc.z), 'Head', BR, 'bronze');
    m.peca(anel(.145, .018, 1.67, -.01, 1.12), 'Head', '#c89a4a', 'bronze');
    for (const s of [-1, 1]) m.peca(box(.022, .12, .1, s * .128, 1.61, .04), 'Head', BR, 'bronze');
    m.peca(box(.022, .09, .014, 0, 1.655, .165), 'Head', '#c89a4a', 'bronze');
    for (let k = 0; k < 17; k++) { const a = -Math.PI * .8 + k / 16 * Math.PI * 1.6; const p = new G.BoxGeometry(.03, .2, .008); p.translate(0, .1, 0); p.rotateX(-.32); p.rotateY(a); p.translate(Math.sin(a) * .14, 1.7, Math.cos(a) * .155 - .01); m.peca(p, 'Head', k % 2 ? '#b8894e' : '#6a1414', k % 2 ? 'bronze' : 'tecido'); }
    gema(m, 'Head', 0, 1.72, .165, '#ff2a3a', .02); }
  gema(m, 'spine_03', 0, 1.28, .185, '#ff2a3a', .03);
  capa(m, { cor: '#3a0c0c', y1: .5, larg0: .24, larg1: .4, recuo: .16, rasgada: true });
  // dardo de bronze nas costas (1Sm 17:6)
  { const d = new G.CylinderGeometry(.018, .018, 1.2, 6); d.rotateZ(.7); d.translate(0, 1.15, -.26); m.peca(d, 'spine_03', '#4a2c16', 'madeira'); const p = new G.ConeGeometry(.035, .14, 6); p.rotateZ(.7 + Math.PI); p.translate(-.42, .76, -.26); p.rotateZ(0); m.peca(p, 'spine_03', BR, 'bronze'); }
  // lança enorme, haste como eixo de tecelão (1Sm 17:7)
  { const pc = [[zc(new G.CylinderGeometry(.032, .036, 2.5, 8)).translate(0, 0, .55), '#4a2c16', 'madeira'],
    [zc(new G.ConeGeometry(.07, .36, 6)).translate(0, 0, 1.98), '#8a8f98', 'prata'],
    [zc(new G.CylinderGeometry(.045, .045, .08, 8)).translate(0, 0, 1.78), BR, 'bronze'],
    [zc(new G.CylinderGeometry(.042, .042, .05, 8)).translate(0, 0, -.2), BR, 'bronze'],
    [zc(new G.ConeGeometry(.04, .14, 6)).rotateX(Math.PI).translate(0, 0, -.77), BR, 'bronze']];
    naMao(m, 'r', pc); }
  cabelos.push(['beard', '#140c08']);
};

VARIANTES.farao = (m, { body, tronco, cabelos, olhos }) => {
  const LAP = '#1f3c8c', LIN = '#ece4d0', ROXO = '#3a1a4a';
  body.material.map = pintar(m, body.material.map, [
    [(c, b) => (b === 'quadril' || b === 'coxa') && c.y > .55, LIN],
    [(c, b) => b === 'pe', '#b8862a'],
  ]);
  // saiote de linho (chenti) + cinto de ouro
  m.casca((c, b) => b === 'quadril' || b === 'coxa', .028, LIN, 'tecido', { cor: OURO, w: .012 }, [{ eixo: 'y', min: .6, max: .95 }]);
  m.casca((c, b) => b === 'tronco' || b === 'quadril', .04, OURO, 'ouro', { cor: LAP, mt: 'couro', w: .01 }, [{ eixo: 'y', min: .92, max: .99 }]);
  // avental frontal listrado
  for (let k = 0; k < 5; k++) m.peca(box(.15 - k * .012, .06, .012, 0, .9 - k * .06, .17 + k * .004), 'pelvis', k % 2 ? LAP : OURO, k % 2 ? 'couro' : 'ouro');
  // colar largo (usekh) em faixas
  const fx = [[1.45, 1.5, OURO, 'ouro'], [1.41, 1.45, LAP, 'couro'], [1.37, 1.41, OURO, 'ouro'], [1.33, 1.37, '#c0392b', 'couro'], [1.3, 1.33, OURO, 'ouro']];
  fx.forEach(([a, b2, cor, mt], i) => m.casca((c, b) => b === 'tronco' || b === 'braco', .012 + i * .002, cor, mt, null, [{ eixo: 'y', min: a, max: b2 }, { eixo: 'ax', max: .24 }]));
  m.casca((c, b) => b === 'antebraco' || b === 'mao', .014, OURO, 'ouro', { cor: LAP, mt: 'couro', w: .01 }, [{ eixo: 'ax', min: .55, max: .67 }]);
  m.casca((c, b) => b === 'braco', .012, OURO, 'ouro', { cor: LAP, mt: 'couro', w: .008 }, [{ eixo: 'ax', min: .29, max: .34 }]);
  m.casca((c, b) => b === 'pe' || b === 'canela', .008, OURO, 'ouro', null, [{ eixo: 'y', max: .1 }]);
  capa(m, { cor: ROXO, y1: .4, larg0: .22, larg1: .4, recuo: .12 });
  for (const s of [-1, 1]) m.peca(esf(.03, s * .16, 1.44, .04), 'spine_03', OURO, 'ouro');
  // nemes (toucado listrado) + ureu + barba cerimonial
  { const hc = V(0, 1.68, -.02);
    m.peca(new G.SphereGeometry(.14, 18, 8, 0, Math.PI * 2, 0, Math.PI * .55).scale(1.08, 1.0, 1.12).translate(hc.x, hc.y, hc.z), 'Head', OURO, 'ouro');
    for (let k = 0; k < 5; k++) m.peca(new G.TorusGeometry(.152 - k * .012, .009, 5, 28, Math.PI * 1.25).rotateX(Math.PI / 2).rotateZ(0).rotateY(Math.PI * -.125 + Math.PI).scale(1.08, 1, 1.12).translate(0, 1.7 + k * .025, -.02), 'Head', LAP, 'couro');
    m.peca(anel(.15, .012, 1.68, -.02, 1.12), 'Head', LAP, 'couro');
    for (const s of [-1, 1]) { // abas laterais listradas
      for (let k = 0; k < 6; k++) { const g = new G.BoxGeometry(.1 - k * .004, .045, .03); g.rotateZ(s * .25); g.translate(s * (.14 + k * .006), 1.63 - k * .045, .02); m.peca(g, (p) => [['Head', 1 - k / 7], ['spine_03', k / 7]], k % 2 ? LAP : OURO, k % 2 ? 'couro' : 'ouro'); } }
    m.peca(box(.1, .2, .03, 0, 1.53, -.14), 'Head', OURO, 'ouro');
    const co = tubo([V(0, 1.7, .15), V(0, 1.77, .165), V(0, 1.81, .15)], .01, .016, 6, 5); m.peca(co, 'Head', OURO, 'ouro'); m.peca(esf(.022, 0, 1.815, .15, 1.3, .7, .8), 'Head', OURO, 'ouro'); gema(m, 'Head', 0, 1.815, .168, '#ff2a3a', .01);
    m.peca(new G.CylinderGeometry(.02, .014, .09, 8).translate(0, 1.5, .1), 'Head', LAP, 'couro'); }
  // cajado-serpente (Êx 7:10-12)
  { const pc = [[zc(new G.CylinderGeometry(.02, .022, 1.55, 8)).translate(0, 0, .35), '#2a1a10', 'madeira'], [zc(new G.CylinderGeometry(.034, .034, .06, 10)).translate(0, 0, -.43), OURO, 'ouro']];
    const esp = []; for (let i = 0; i <= 40; i++) { const t = i / 40; const a = t * Math.PI * 9; esp.push(V(Math.cos(a) * .035, Math.sin(a) * .035, -.2 + t * 1.2)); }
    pc.push([tubo(esp, .012, .016, 60, 5), '#2f7a4a', 'couro']);
    pc.push([tubo([V(.035, 0, 1.0), V(.02, .1, 1.08), V(0, .15, 1.18), V(0, .1, 1.27)], .02, .024, 10, 6), '#2f7a4a', 'couro']);
    pc.push([esf(.075, 0, .12, 1.18, 1, .35, 1).rotateX(0), '#256a3c', 'couro']);
    pc.push([esf(.035, 0, .09, 1.29, .9, .6, 1.3), '#2f7a4a', 'couro']);
    for (const s of [-1, 1]) pc.push([esf(.009, s * .02, .12, 1.31), '#ffd040', 'brilhoF']);
    naMao(m, 'r', pc); }
  cabelos.length = 0;
};

VARIANTES.jezabel = (m, { body, tronco, cabelos }) => {
  const CR = '#8a1030', CR2 = '#5a0a20', PT = '#1a0e16', VI = '#4a1a5a';
  body.material.map = pintar(m, body.material.map, [
    [(c, b) => b === 'braco' && Math.abs(c.x) < m.AX(.3), CR],
    [(c, b) => tronco(c, b) || b === 'quadril', CR],
    [(c, b) => b === 'coxa' || b === 'canela' || b === 'pe', PT],
    [(c, b) => b === 'antebraco' || b === 'mao', PT],
  ]);
  body.material.normalMap = null;
  m.casca((c, b) => tronco(c, b) || b === 'braco', .008, CR, 'tecido', { cor: OURO, w: .008, h: .005 }, [{ eixo: 'y', min: .95, max: 1.5 }, { eixo: 'ax', max: .3 }]);
  m.casca((c, b) => tronco(c, b), .024, PT, 'couro', { cor: OURO, w: .01 }, [{ eixo: 'y', min: .95, max: 1.2 }]);
  m.casca((c, b) => b === 'antebraco' || b === 'mao', .016, PT, 'couro', { cor: OURO, w: .01 }, [{ eixo: 'ax', min: .48, max: .66 }]);
  m.casca((c, b) => b === 'canela' || b === 'pe', .014, PT, 'couro', { cor: OURO, w: .01 }, [{ eixo: 'y', max: .5 }]);
  saia(m, { y0: m.Y(.97), y1: m.Y(.36), r0: .165, r1: .25, cor: CR2, borda: OURO, fenda: .9, z: -.03 });
  ombreira(m, 'l', { cor: PT, mt: 'obsid', cor2: OURO, camadas: 2, r: .095 }); ombreira(m, 'r', { cor: PT, mt: 'obsid', cor2: OURO, camadas: 2, r: .095 });
  // colar e cinto de correntes
  m.peca(anel(.1, .01, m.Y(1.45), .02, 1.1, Math.PI / 2 + .35), 'spine_03', OURO, 'ouro');
  gema(m, 'spine_03', 0, m.Y(1.36), .14, '#b040ff', .022);
  m.peca(anel(.175, .008, m.Y(.93), -.01, .85, Math.PI / 2 - .12), 'pelvis', OURO, 'ouro');
  capa(m, { cor: VI, y1: .38, larg0: .16, larg1: .34, recuo: .14, rasgada: true });
  // gola alta
  { const g = new G.CylinderGeometry(.13, .1, .12, 16, 1, true, Math.PI * .6, Math.PI * .8); g.rotateY(Math.PI); g.translate(0, m.Y(1.52), -.03); m.peca(g, 'spine_03', VI, 'tecido'); }
  // coroa pintada (2Rs 9:30)
  { const hy = m.bp.Head.y; m.peca(anel(.105, .014, hy + .14, -.01, 1.1, Math.PI / 2 - .2), 'Head', OURO, 'ouro');
    for (let k = 0; k < 9; k++) { const a = -Math.PI * .6 + k / 8 * Math.PI * 1.2; const c = new G.ConeGeometry(.016, k === 4 ? .09 : .055, 4); c.rotateX(-.2); c.translate(Math.sin(a) * .105, hy + .17 + (k === 4 ? .02 : 0), Math.cos(a) * .115 - .01); m.peca(c, 'Head', OURO, 'ouro'); }
    gema(m, 'Head', 0, hy + .155, .12, '#ff2a3a', .016); }
  // adagas envenenadas
  for (const sd of ['l', 'r']) naMao(m, sd, [[box(.01, .04, .34, 0, 0, .25), '#c8ccd4', 'prata'], [box(.004, .012, .3, 0, .018, .26), '#6aff4a', 'brilho'], [box(.025, .11, .025, 0, 0, .07), OURO, 'ouro'], [zc(new G.CylinderGeometry(.015, .015, .12, 8)), PT, 'couro']]);
  cabelos.push(['long', '#120a0e']);
};

VARIANTES.nabuco = (m, { body, tronco, cabelos }) => {
  const LAP = '#1c2f78', OU = '#d4a23e', PT = '#150f0c', RUB = '#7a1418';
  body.material.map = pintar(m, body.material.map, [
    [(c, b) => b === 'braco' && Math.abs(c.x) < .36, RUB],
    [(c, b) => tronco(c, b), RUB],
    [(c, b) => (b === 'quadril' || b === 'coxa') && c.y > .6, LAP],
    [(c, b) => b === 'pe' || (b === 'canela' && c.y < .2), PT],
  ]);
  m.casca((c, b) => b === 'tronco' || b === 'braco', .006, RUB, 'tecido', null, [{ eixo: 'y', min: 1.4, max: 1.5 }, { eixo: 'ax', max: .36 }]);
  m.casca((c, b) => tronco(c, b), .03, OU, 'lamela', { cor: '#f0c860' }, [{ eixo: 'y', min: .96, max: 1.45 }, { eixo: 'ax', max: .2 }]);
  m.casca((c, b) => b === 'tronco' || b === 'quadril', .04, LAP, 'couro', { cor: OURO, w: .012 }, [{ eixo: 'y', min: .89, max: .97 }]);
  m.casca((c, b) => b === 'quadril' || b === 'coxa', .032, LAP, 'tiras', { cor: OURO, mt: 'ouro', w: .014 }, [{ eixo: 'y', min: .6, max: .9 }]);
  m.casca((c, b) => b === 'antebraco' || b === 'mao', .016, OU, 'ouro', { cor: LAP, mt: 'couro', w: .012 }, [{ eixo: 'ax', min: .48, max: .685 }]);
  m.casca((c, b) => b === 'braco', .013, '#b08530', 'lamela', null, [{ eixo: 'ax', min: .2, max: .4 }]);
  m.casca((c, b) => b === 'canela', .016, OU, 'ouro', { cor: LAP, mt: 'couro', w: .012 }, [{ eixo: 'y', min: .2, max: .52 }]);
  m.casca((c, b) => b === 'pe' || b === 'canela', .01, PT, 'couro', { cor: OU, mt: 'ouro', w: .01 }, [{ eixo: 'y', max: .205 }]);
  // ombreiras com cabeça de leão (Babilônia)
  for (const sd of ['l', 'r']) { ombreira(m, sd, { cor: OU, mt: 'ouro', cor2: LAP, camadas: 3, r: .13 }); const b = m.bp['upperarm_' + sd], s = sd === 'l' ? 1 : -1;
    m.peca(esf(.05, b.x + s * .06, b.y + .05, b.z + .06, 1, .9, .9), 'upperarm_' + sd, OU, 'ouro');
    for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; const c = new G.ConeGeometry(.02, .06, 4); c.rotateX(Math.PI / 2); c.rotateZ(a); c.translate(b.x + s * .06 + Math.cos(a) * .045, b.y + .05 + Math.sin(a) * .045, b.z + .04); m.peca(c, 'upperarm_' + sd, '#b08530', 'ouro'); } }
  joelheiras(m, OU, 'ouro', LAP);
  capa(m, { cor: RUB, y1: .42, larg0: .24, larg1: .42, recuo: .14 });
  m.peca(anel(.16, .03, 1.47, -.06, .8), 'spine_03', '#e8dcc0', 'couro'); // gola de pele
  for (const s of [-1, 1]) m.peca(esf(.032, s * .16, 1.45, .05), 'spine_03', OU, 'ouro');
  gema(m, 'spine_03', 0, 1.26, .18, '#ff2a3a', .03);
  // coroa alta (tiara babilônica) com faixas de lápis-lazúli e rosetas
  { const hy = 1.75; const t = new G.CylinderGeometry(.13, .112, .2, 20, 1, false); t.scale(1, 1, 1.1); t.translate(0, hy + .06, -.01); m.peca(t, 'Head', OU, 'ouro');
    for (const y of [hy - .03, hy + .06, hy + .15]) m.peca(anel(.122, .012, y, -.01, 1.1), 'Head', LAP, 'couro');
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; m.peca(esf(.014, Math.sin(a) * .122, hy + .015, Math.cos(a) * .134 - .01), 'Head', '#f0c860', 'ouro'); }
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; const c = new G.ConeGeometry(.015, .05, 4); c.translate(Math.sin(a) * .125, hy + .185, Math.cos(a) * .137 - .01); m.peca(c, 'Head', OU, 'ouro'); }
    { const c = new G.ConeGeometry(.05, .12, 10); c.translate(0, hy + .22, -.01); m.peca(c, 'Head', OU, 'ouro'); m.peca(esf(.02, 0, hy + .29, -.01), 'Head', '#ff2a3a', 'brilho'); }
    gema(m, 'Head', 0, hy + .06, .13, '#ff2a3a', .02); }
  // espada larga com fio em brasa (fornalha)
  naMao(m, 'r', [[box(.016, .09, .8, 0, 0, .48), '#d8d0c0', 'prata'], [box(.004, .1, .72, 0, 0, .5), '#ff6a1a', 'brilho'], [box(.04, .22, .045, 0, 0, .08), OU, 'ouro'], [zc(new G.CylinderGeometry(.02, .02, .15, 8)), PT, 'couro'], [esf(.032, 0, 0, -.09), OU, 'ouro']]);
  cabelos.push(['long', '#0e0a08'], ['beard', '#0e0a08']);
};

// corpo base e escala de cada herói (1 = Davi)
export const VISUAL = {
  davi: { corpo: 'm', esc: 1 }, sansao: { corpo: 'm', esc: 1.04 }, debora: { corpo: 'f', esc: 1.04 }, gideao: { corpo: 'm', esc: 1 },
  golias: { corpo: 'm', esc: 1.3 }, farao: { corpo: 'm', esc: 1.02 }, jezabel: { corpo: 'f', esc: 1.04 }, nabuco: { corpo: 'm', esc: 1.06 },
};
export const CABELOS = ['simpleparted', 'long', 'beard', 'buzzed', 'buns'];
