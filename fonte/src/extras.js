// Extras estilo Wild Rift: névoa de guerra + moitas, sentinelas, avisos de objetivos, treino guiado,
// missões bíblicas / missão do dia / heróis do dia. Tudo barato para o iPhone 11 (contas a cada 0,1 s, malhas instanciadas).
import * as THREE from 'three';
import { CAMPOS, POCO_XZ, DRAG_XZ, MAPA_WR } from './selva_mapa.js';
import { selva } from './selva.js';
const qs = new URLSearchParams(location.search);
export const FOG_ON = qs.get('neblina') !== '0' && MAPA_WR;
let D = null;
export const EX = { moitas: [], sentinelas: [], pronto: false };
const VIS = { heroi: 12.5, minion: 8.5, torre: 13.5, nucleo: 13, sentinela: 10 };
export const SENT = { cd: 90, dur: 80, max: 2, raio: VIS.sentinela };

// ---------------- moitas (capim alto): esconde quem está dentro ----------------
function posMoitas() {
  const lz = D.laneZ, out = [], meia = [];
  meia.push([-7, lz(-7) + 9.5], [-7, lz(-7) - 9.5], [-36, lz(-36) + 8.5], [-36, lz(-36) - 8.5]);
  meia.push([POCO_XZ[0] - 9, POCO_XZ[1] * .55], [DRAG_XZ[0] - 9, DRAG_XZ[1] * .55], [POCO_XZ[0] - 4.1, POCO_XZ[1] + 14.9], [DRAG_XZ[0] - 4.1, DRAG_XZ[1] - 14.9]);
  for (const c of CAMPOS) if (c.lado === 'luz') { const dz = lz(c.x) - c.z, n = Math.abs(dz) || 1; meia.push([c.x + 2, c.z + Math.sign(dz) * Math.min(7, n * .45)]); }
  for (const [x, z] of meia) { out.push([x, z]); out.push([-x + 2, -z]); } // mapa simétrico em ponto (centro ~ x=1)
  const ok = (x, z) => !D.estruturas.some(e => Math.hypot(e.obj.position.x - x, e.obj.position.z - z) < 7.5) && !CAMPOS.some(c => Math.hypot(c.x - x, c.z - z) < 5.5);
  return out.filter(([x, z]) => ok(x, z)).map(([x, z]) => ({ x, z, r: 2.9 }));
}
function criarMoitas() {
  // moita = mancha densa e arredondada com borda nítida (estilo WR): 1 tufo grande no centro, 5 no anel interno e 7 menores na borda.
  // A área de esconder (posMoitas, r = 2,9 m) não muda; os tufos só desenham o contorno dela. Tudo num único InstancedMesh (1 draw call).
  EX.moitas = posMoitas();
  const geo = new THREE.SphereGeometry(1, 8, 5); const pa = geo.attributes.position, cols = new Float32Array(pa.count * 3);
  for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i); const n = 1 + .13 * Math.sin(x * 5.1 + z * 3.7) * Math.cos(y * 4.3 + x * 2.2); // contorno orgânico (folhagem), sem quinas
    pa.setXYZ(i, x * n, Math.max(-.35, y) * n * .68, z * n); const k = .45 + .55 * Math.min(1, Math.max(0, (y + .35) / 1.35)); cols[i * 3] = cols[i * 3 + 1] = cols[i * 3 + 2] = k; } // base mais escura (oclusão)
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3)); geo.computeVertexNormals(); geo.translate(0, .32, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .92 });
  const LAY = [[0, 0, 1.35]]; for (let i = 0; i < 5; i++) LAY.push([i / 5 * 6.283, .45, 1.08]); for (let i = 0; i < 7; i++) LAY.push([(i + .5) / 7 * 6.283, .8, .74]);
  const im = new THREE.InstancedMesh(geo, mat, EX.moitas.length * LAY.length); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3(); let k = 0;
  const cor = new THREE.Color();
  for (const b of EX.moitas) { const giro = Math.random() * 6.283; for (const [a0, rf, sc] of LAY) { const a = a0 + giro + (Math.random() - .5) * .35, r = b.r * rf * (.92 + Math.random() * .16), w = sc * (.9 + Math.random() * .22);
    p.set(b.x + Math.cos(a) * r, 0, b.z + Math.sin(a) * r); e.set((Math.random() - .5) * .2, Math.random() * 6.283, (Math.random() - .5) * .2); q.setFromEuler(e); s.set(w, w * (.85 + Math.random() * .3), w); m4.compose(p, q, s); im.setMatrixAt(k, m4);
    const tv = b.x > 8 ? 1 : 0; im.setColorAt(k, cor.setHSL(tv ? .3 + Math.random() * .03 : .26 + Math.random() * .03, tv ? .42 : .55, (rf > .7 ? .115 : .095) + Math.random() * .03)); k++; } } // verde-escuro de mata (um pouco mais frio do lado das Trevas)
  im.instanceMatrix.needsUpdate = true; im.castShadow = false; im.receiveShadow = false; im.computeBoundingSphere(); D.scene.add(im); EX.imMoitas = im;
}
export function moitaDe(p) { const M = EX.moitas; for (let i = 0; i < M.length; i++) { const m = M[i], dx = p.x - m.x, dz = p.z - m.z; if (dx * dx + dz * dz < m.r * m.r) return i; } return -1; }

// ---------------- névoa de guerra ----------------
let fogT = 0; const TIMES = ['luz', 'trevas'];
export function atualizarFog(dt) {
  fogT -= dt; if (fogT > 0) return; fogT = .1; const t = D.estado.tempo; const src = { luz: [], trevas: [] };
  for (const u of D.unidades) if (u.vivo && src[u.time]) { u._moita = moitaDe(u.obj.position); src[u.time].push(u.obj.position.x, u.obj.position.z, VIS[u.tipo] || 8, u._moita); }
  for (const e of D.estruturas) if (e.vivo && src[e.time] && !e.inativa) src[e.time].push(e.obj.position.x, e.obj.position.z, VIS[e.tipo] || 12, -1);
  for (const w of EX.sentinelas) if (w.vivo) src[w.time].push(w.pos.x, w.pos.z, VIS.sentinela, -2); // sentinela enxerga dentro da moita
  const ve = (x, z, mi, T) => { const S = src[T]; for (let i = 0; i < S.length; i += 4) { const dx = x - S[i], dz = z - S[i + 1], d2 = dx * dx + dz * dz, r = S[i + 2]; if (d2 > r * r) continue; if (mi < 0 || S[i + 3] === mi || S[i + 3] === -2 || d2 < 2.5) return true; } return false; };
  for (const u of D.unidades) { if (!u.vivo || !src[u.time]) continue; const f = u.fogVis || (u.fogVis = {}); const p = u.obj.position;
    for (const T of TIMES) f[T] = T === u.time || !FOG_ON || (u.revelado > t && u.revelaPara === T) || (!(u.nuvemT > t) && ve(p.x, p.z, u._moita, T)); } // nuvemT: Coluna de Nuvem do Moisés
  for (const w of EX.sentinelas) if (w.vivo) w.vis = w.time === D.jogadorTime() || ve(w.pos.x, w.pos.z, -1, D.jogadorTime());
}
// esconde no mundo o que o time do jogador não vê
export function aplicarFogVisual() {
  if (!FOG_ON) return; const jt = D.jogadorTime();
  for (const u of D.unidades) { if (!u.vivo || !u.fogVis || u.time === jt) continue; const v = u.fogVis[jt] !== false; if (u.obj.visible !== v) u.obj.visible = v; }
  for (const w of EX.sentinelas) if (w.vivo) { w.g.visible = !!w.vis; w.anel.visible = w.time === jt; }
}
export const vistoPor = (u, time) => !u.fogVis || u.time === time || u.fogVis[time] !== false;

// ---------------- sentinelas (amuleto com recarga) ----------------
let geoS, matS;
function criarPoolSentinelas() {
  geoS = new THREE.CylinderGeometry(.12, .2, 1.3, 6); geoS.translate(0, .65, 0); const geoO = new THREE.OctahedronGeometry(.32); geoO.translate(0, 1.55, 0);
  matS = { luz: new THREE.MeshBasicMaterial({ color: 0x9fe6ff, toneMapped: false }), trevas: new THREE.MeshBasicMaterial({ color: 0xff6a88, toneMapped: false }) };
  const matP = new THREE.MeshStandardMaterial({ color: 0x5a4a36, roughness: .9 });
  const matA = new THREE.MeshBasicMaterial({ color: 0x9fe6ff, transparent: true, opacity: .18, depthWrite: false, toneMapped: false });
  const geoA = new THREE.RingGeometry(SENT.raio - .25, SENT.raio, 48); geoA.rotateX(-Math.PI / 2);
  for (let i = 0; i < 8; i++) { const g = new THREE.Group(); g.add(new THREE.Mesh(geoS, matP)); const o = new THREE.Mesh(geoO, matS.luz); g.add(o); g.userData.o = o; g.position.set(0, -50, 0); D.scene.add(g);
    const anel = new THREE.Mesh(geoA, matA); anel.position.set(0, -50, 0); D.scene.add(anel); EX.sentinelas.push({ vivo: false, g, anel, pos: g.position, time: 'luz', t: 0 }); }
}
export function porSentinela(h) {
  const t = D.estado.tempo; if (!h.vivo || (h.sentCd || 0) > t) return false;
  const minhas = EX.sentinelas.filter(w => w.vivo && w.dono === h).sort((a, b) => a.t - b.t); if (minhas.length >= SENT.max) minhas[0].vivo = false, esconder(minhas[0]);
  const w = EX.sentinelas.find(w => !w.vivo); if (!w) return false;
  const f = new THREE.Vector3(Math.sin(h.obj.rotation.y), 0, Math.cos(h.obj.rotation.y));
  w.vivo = true; w.g.visible = w.anel.visible = true; w.dono = h; w.time = h.time; w.t = t; w.fim = t + SENT.dur; w.g.position.copy(h.obj.position).addScaledVector(f, 1.6).setY(0); w.anel.position.copy(w.g.position).setY(.06); w.g.userData.o.material = matS[h.time];
  h.sentCd = t + SENT.cd; if (h.bot) h.sentPostas = (h.sentPostas || 0) + 1; if (D.som) try { D.som('ping', null, .4); } catch (e) { }
  return true;
}
function esconder(w) { w.g.position.set(0, -50, 0); w.anel.position.set(0, -50, 0); }
// guardadas embaixo do mapa continuavam visíveis: 8 × (poste + cristal + anel) = 24 draw calls por quadro à toa. Ficam visíveis só no aquecimento de shaders (t < 1 s) e quando postas.
function atualizarSentinelas(dt) { const t = D.estado.tempo; for (const w of EX.sentinelas) { if (!w.vivo) { if (w.g.visible && t > 1) w.g.visible = w.anel.visible = false; continue; } if (t >= w.fim) { w.vivo = false; esconder(w); continue; } w.g.userData.o.rotation.y += dt * 1.5; w.g.userData.o.position.y = Math.sin(t * 2 + w.t) * .08; } }
// bots: põem sentinela nas moitas do rio / entradas dos poços (dificuldade decide quanto)
const PONTOS_SENT = () => EX.moitas.filter(m => Math.abs(m.x) < 30);
// suporte (bot): ponto de sentinela ainda sem visão aliada, perto de p (moitas do rio/selva)
export function pontoSentinela(h, p, raio) { if (!(D.DIF.sentinela) || (h.sentCd || 0) > D.estado.tempo) return null; let best = null, bd = raio; for (const m of PONTOS_SENT()) { const d = Math.hypot(m.x - p.x, m.z - p.z); if (d > bd) continue; if (EX.sentinelas.some(w => w.vivo && w.time === h.time && Math.hypot(w.pos.x - m.x, w.pos.z - m.z) < 8)) continue; bd = d; best = m; } return best; }
export function botSentinela(h) {
  const ch = D.DIF.sentinela || 0; if (!ch || (h.sentCd || 0) > D.estado.tempo || !h.vivo) return;
  if ((h._sentTry || 0) > D.estado.tempo) return; h._sentTry = D.estado.tempo + 2;
  const p = h.obj.position; for (const m of PONTOS_SENT()) { if (Math.hypot(m.x - p.x, m.z - p.z) > 5) continue; if (EX.sentinelas.some(w => w.vivo && w.time === h.time && Math.hypot(w.pos.x - m.x, w.pos.z - m.z) < 8)) continue; if (Math.random() < ch) porSentinela(h); return; }
}

// ---------------- objetivos: contagem no minimapa e aviso para o time ----------------
const NOME_OBJ = { dragao: 'Dragão', leviata: 'Leviatã', beemote: 'Beemote' };
function atualizarObjetivos() {
  const t = D.estado.tempo;
  for (const m of selva.monstros) { if (!NOME_OBJ[m.sub] || m.modo === 'arauto') continue;
    const vivo = m.vivo && m.estadoM !== 'morrendo';
    if (!vivo && m.nasceEm != null && m.nasceEm > t) { const r = m.nasceEm - t; if (r <= 60 && !m._av60) { m._av60 = true; banner(`${NOME_OBJ[m.sub]} em 1:00`); } if (r <= 30 && !m._av30) { m._av30 = true; banner(`${NOME_OBJ[m.sub]} em 0:30`); } }
    if (vivo && !m._avVivo) { m._avVivo = true; if (t > 5) banner(`${NOME_OBJ[m.sub]} apareceu!`); }
    if (!vivo) m._avVivo = false; if (vivo) m._av60 = m._av30 = false; }
}
let banEl = null, banT = 0;
export function banner(txt) { if (!banEl) { banEl = document.createElement('div'); banEl.id = 'avisoObj'; document.getElementById('hud').appendChild(banEl); } banEl.textContent = txt; banEl.className = 'on'; banT = 3.2; }

// ---------------- treino guiado (português simples) ----------------
export const TREINO = qs.get('treino') === '1';
const PASSOS = [
  { t: 'Use o círculo da esquerda para andar. Ande um pouco.', ok: (s) => s.andou > 6 },
  { t: 'Último golpe: espere a vida da tropa inimiga ficar bem baixa e toque em atacar. Pegue 5 tropas.', ok: (s, h) => h.cs - s.cs0 >= 5 },
  { t: 'O botão "Tropa" ataca sempre a tropa mais fraca. Use-o para pegar mais 3 tropas.', ok: (s, h) => h.cs - s.cs0 >= 8 },
  { t: 'Torres atiram em quem chega perto. Entre só junto com suas tropas. Derrube a primeira torre inimiga.', ok: () => D.estruturas.some(e => e.tipo === 'torre' && e.time !== D.jogadorTime() && !e.vivo && !e.inativa) },
  { t: 'Agora a selva: siga a seta até um campo de monstros e derrote um monstro.', ok: (s) => s.monstros > 0, alvo: true },
  { t: 'Coloque uma sentinela (botão Sentinela) perto do rio. Ela mostra quem se esconde.', ok: () => EX.sentinelas.some(w => w.vivo && w.time === D.jogadorTime()) },
  { t: 'Muito bem! Você terminou o treino. Agora é só jogar uma partida de verdade.', ok: () => false },
];
const TR = { i: 0, andou: 0, cs0: 0, monstros: 0, el: null, ult: null };
export function monstroAbatidoPor(h) { if (D && h === D.jogador()) TR.monstros++; }
function atualizarTreino(dt) {
  const h = D.jogador(); if (!h) return;
  if (!TR.el) { TR.el = document.createElement('div'); TR.el.id = 'treino'; document.getElementById('hud').appendChild(TR.el); TR.cs0 = h.cs; TR.ult = h.obj.position.clone(); }
  TR.andou += h.obj.position.distanceTo(TR.ult); TR.ult.copy(h.obj.position);
  const P = PASSOS[TR.i]; if (P.ok(TR, h) && TR.i < PASSOS.length - 1) { TR.i++; if (TR.i === 2) TR.cs0 = h.cs - 5; if (D.som) try { D.som('moeda'); } catch (e) { } }
  const txt = `<b>Treino ${Math.min(TR.i + 1, PASSOS.length)}/${PASSOS.length}</b>${PASSOS[TR.i].t}`; if (TR.el._t !== txt) { TR.el.innerHTML = txt; TR.el._t = txt; }
  if (PASSOS[TR.i].alvo) { const c = CAMPOS.filter(c => c.lado === h.time && c.m && c.m.some(m => m.vivo)).sort((a, b) => Math.hypot(a.x - h.obj.position.x, a.z - h.obj.position.z) - Math.hypot(b.x - h.obj.position.x, b.z - h.obj.position.z))[0]; if (c) selva.marcas.push({ tipo: 'ajuda', pos: new THREE.Vector3(c.x, 0, c.z), ate: D.estado.tempo + .15, t0: D.estado.tempo }); }
}

// ---------------- missões bíblicas, missão do dia, heróis do dia (localStorage, nunca apaga nada) ----------------
const DIARIAS = [
  { id: 'cs40', txt: 'Dê o último golpe em 40 tropas numa partida', ok: (h) => h.cs >= 40, xp: 80 },
  { id: 'torre2', txt: 'Derrube 2 torres numa partida', ok: (h) => h.stats.torres >= 2, xp: 80 },
  { id: 'vitoria', txt: 'Vença uma partida', ok: (h, v) => v, xp: 100 },
  { id: 'abates3', txt: 'Faça 3 abates numa partida', ok: (h) => h.abates >= 3, xp: 80 },
  { id: 'sent3', txt: 'Coloque 3 sentinelas numa partida', ok: (h) => (h.sentPostas || 0) >= 3, xp: 60 },
  { id: 'monstro6', txt: 'Derrote 6 monstros da selva', ok: (h) => (h.monstrosAbatidos || 0) >= 6, xp: 80 },
];
const diaN = () => { const d = new Date(); return d.getFullYear() * 1000 + Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5); };
export function missaoDoDia() { return DIARIAS[diaN() % DIARIAS.length]; }
export function heroisDoDia(todos) { const n = diaN(), l = [...todos]; const out = []; let s = n; while (out.length < 3 && l.length) { s = (s * 1103515245 + 12345) & 0x7fffffff; out.push(l.splice(s % l.length, 1)[0]); } return out; }
// chamado no fim da partida com o perfil já carregado: devolve partes extras de XP
export function bonusFim(p, h, venceu, todos) {
  const partes = []; const d = missaoDoDia(); const hoje = diaN();
  p.diaria = p.diaria && p.diaria.dia === hoje ? p.diaria : { dia: hoje, id: d.id, feita: false };
  if (!p.diaria.feita && d.ok(h, venceu)) { p.diaria.feita = true; partes.push(['Missão do dia', d.xp]); }
  if (heroisDoDia(todos).includes(h.id)) partes.push(['Herói do dia', 30]);
  return partes;
}

export function iniciarExtras(deps) { D = deps; criarMoitas(); criarPoolSentinelas(); EX.pronto = true; }
export function atualizarExtras(dt) {
  if (!EX.pronto) return; atualizarFog(dt); atualizarSentinelas(dt); atualizarObjetivos();
  if (banEl && banT > 0) { banT -= dt; if (banT <= 0) banEl.className = ''; }
  if (TREINO) atualizarTreino(dt);
}
// minimapa: sentinelas (as que o time vê)
export function desenharExtrasMM(g, mmPos) { const jt = D.jogadorTime(); for (const w of EX.sentinelas) { if (!w.vivo || !w.vis) continue; const [x, y] = mmPos(w.pos.x, w.pos.z); g.fillStyle = w.time === jt ? '#9fe6ff' : '#ff6a88'; g.beginPath(); g.moveTo(x, y - 4); g.lineTo(x + 3, y); g.lineTo(x, y + 4); g.lineTo(x - 3, y); g.closePath(); g.fill(); } }
