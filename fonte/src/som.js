// Sons dos poderes, sintetizados na hora com WebAudio (nenhum arquivo para baixar).
// Cada herói tem um "timbre" próprio: pedra/ouro (Davi), rocha/rugido (Sansão), vento/sino (Débora), metal/trombeta e fogo (Gideão),
// bronze/terremoto (Golias), sibilo/zumbido (Faraó), encanto/veneno (Jezabel), metal/fornalha (Nabucodonosor).
let ctx = null, mestre = null, ruido = null, ligado = true;
export function somLigado(v) { ligado = v; }
export function destravarSom() {
  if (ctx || !ligado) { if (ctx && ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ctx = new AC(); mestre = ctx.createDynamicsCompressor(); const g = ctx.createGain(); g.gain.value = .55; mestre.connect(g); g.connect(ctx.destination);
  ruido = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate); const d = ruido.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
const env = (g, t, a, d, v = 1) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
function tom(saida, t, { tipo = 'sine', f0 = 440, f1 = null, a = .005, d = .3, v = .5, det = 0 }) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = tipo; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + a + d); if (det) o.detune.value = det;
  env(g, t, a, d, v); o.connect(g); g.connect(saida); o.start(t); o.stop(t + a + d + .05);
}
function chiado(saida, t, { filtro = 'lowpass', f0 = 1200, f1 = null, q = 1, a = .005, d = .3, v = .5 }) {
  const s = ctx.createBufferSource(); s.buffer = ruido; s.loop = true; const fl = ctx.createBiquadFilter(); fl.type = filtro; fl.Q.value = q; fl.frequency.setValueAtTime(f0, t); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + a + d);
  const g = ctx.createGain(); env(g, t, a, d, v); s.connect(fl); fl.connect(g); g.connect(saida); s.start(t, Math.random()); s.stop(t + a + d + .05);
}
const R = {
  // Davi
  funda: (o, t) => { chiado(o, t, { filtro: 'bandpass', f0: 600, f1: 2400, q: 3, a: .01, d: .18, v: .35 }); tom(o, t, { tipo: 'triangle', f0: 900, f1: 1800, d: .12, v: .12 }); },
  pedraRacha: (o, t) => { chiado(o, t, { filtro: 'highpass', f0: 1800, a: .001, d: .07, v: .7 }); chiado(o, t + .01, { f0: 500, f1: 120, a: .002, d: .25, v: .5 }); tom(o, t, { f0: 140, f1: 60, d: .18, v: .4 }); },
  harpa: (o, t) => { [523, 659, 784, 1047, 1319].forEach((f, i) => tom(o, t + i * .07, { tipo: 'triangle', f0: f, d: .9, v: .16 })); },
  pastor: (o, t) => chiado(o, t, { filtro: 'bandpass', f0: 400, f1: 1600, q: 1.5, a: .05, d: .25, v: .35 }),
  coro: (o, t) => { [262, 330, 392, 523].forEach(f => { tom(o, t, { tipo: 'sawtooth', f0: f, a: .3, d: 1.2, v: .05, det: 6 }); tom(o, t, { tipo: 'sine', f0: f * 2, a: .3, d: 1.2, v: .06 }); }); R.boom(o, t + .78); },
  // Sansão
  queixada: (o, t) => { chiado(o, t, { filtro: 'bandpass', f0: 300, f1: 900, q: 1, a: .01, d: .15, v: .5 }); tom(o, t + .05, { f0: 110, f1: 55, d: .2, v: .5 }); },
  rugido: (o, t) => { chiado(o, t, { filtro: 'lowpass', f0: 250, f1: 900, q: 6, a: .08, d: .55, v: .7 }); tom(o, t, { tipo: 'sawtooth', f0: 70, f1: 95, a: .08, d: .5, v: .15 }); },
  boom: (o, t) => { tom(o, t, { f0: 90, f1: 32, a: .003, d: .5, v: .8 }); chiado(o, t, { f0: 900, f1: 80, a: .002, d: .45, v: .55 }); },
  desmorona: (o, t) => { for (let i = 0; i < 6; i++) { chiado(o, t + i * .09, { f0: 700 - i * 60, f1: 90, a: .003, d: .3, v: .45 }); tom(o, t + i * .09, { f0: 80 + Math.random() * 30, f1: 35, d: .3, v: .4 }); } },
  // Débora
  vento: (o, t) => chiado(o, t, { filtro: 'bandpass', f0: 500, f1: 2600, q: 4, a: .06, d: .45, v: .35 }),
  sino: (o, t) => { [1175, 1568, 2093].forEach((f, i) => tom(o, t + i * .05, { f0: f, d: 1.1, v: .12 })); },
  julgamento: (o, t) => { tom(o, t, { tipo: 'triangle', f0: 1760, f1: 440, a: .01, d: .35, v: .18 }); R.boom(o, t + .28); chiado(o, t + .28, { filtro: 'highpass', f0: 3000, a: .005, d: .5, v: .25 }); },
  // Gideão
  trombeta: (o, t) => { [233, 294, 349].forEach((f, i) => { tom(o, t + i * .02, { tipo: 'sawtooth', f0: f * .97, f1: f, a: .04, d: .6, v: .09 }); tom(o, t + .02, { tipo: 'square', f0: f * 2, a: .04, d: .5, v: .03 }); }); },
  cantaro: (o, t) => { chiado(o, t, { filtro: 'highpass', f0: 2500, a: .001, d: .12, v: .7 }); for (let i = 0; i < 4; i++) tom(o, t + .02 + i * .03, { tipo: 'triangle', f0: 2000 + Math.random() * 2000, d: .08, v: .1 }); R.fogo(o, t + .06); },
  fogo: (o, t) => { chiado(o, t, { filtro: 'lowpass', f0: 300, f1: 2500, q: .7, a: .03, d: .5, v: .6 }); tom(o, t, { f0: 70, f1: 45, d: .4, v: .35 }); },
  orvalho: (o, t) => { for (let i = 0; i < 6; i++) tom(o, t + i * .06 + Math.random() * .03, { f0: 1800 + Math.random() * 1400, f1: 900, d: .12, v: .08 }); },
  espada: (o, t) => { tom(o, t, { tipo: 'triangle', f0: 1400, f1: 2800, a: .01, d: .25, v: .12 }); R.trombeta(o, t); R.boom(o, t + .1); },
  // Golias
  lancaPesada: (o, t) => { chiado(o, t, { filtro: 'bandpass', f0: 200, f1: 700, q: 2, a: .02, d: .22, v: .55 }); R.boom(o, t + .22); },
  grito: (o, t) => { tom(o, t, { tipo: 'sawtooth', f0: 110, f1: 85, a: .05, d: .5, v: .2, det: -10 }); tom(o, t, { tipo: 'sawtooth', f0: 165, f1: 120, a: .05, d: .45, v: .12 }); chiado(o, t, { filtro: 'bandpass', f0: 700, q: 3, a: .05, d: .45, v: .2 }); },
  pisao: (o, t) => { tom(o, t, { f0: 70, f1: 28, a: .002, d: .4, v: .9 }); chiado(o, t, { f0: 400, f1: 60, a: .002, d: .5, v: .55 }); },
  terremoto: (o, t) => { chiado(o, t, { f0: 180, f1: 60, q: 2, a: .1, d: 1.4, v: .8 }); for (let i = 0; i < 4; i++) tom(o, t + i * .12, { f0: 55, f1: 30, a: .01, d: .35, v: .6 }); },
  // Faraó
  sibilo: (o, t) => chiado(o, t, { filtro: 'highpass', f0: 4500, f1: 6500, q: 1, a: .04, d: .5, v: .35 }),
  zumbido: (o, t) => { for (let i = 0; i < 3; i++) tom(o, t + i * .03, { tipo: 'sawtooth', f0: 180 + i * 17, f1: 210 + i * 11, a: .1, d: 1.6, v: .05 }); },
  trevas: (o, t) => { tom(o, t, { tipo: 'sawtooth', f0: 55, f1: 41, a: .2, d: 1.1, v: .15 }); chiado(o, t, { f0: 200, f1: 80, a: .2, d: 1, v: .3 }); },
  praga: (o, t) => { tom(o, t, { tipo: 'square', f0: 300 + Math.random() * 400, f1: 80, d: .2, v: .06 }); chiado(o, t, { f0: 800, f1: 150, a: .003, d: .22, v: .35 }); },
  // Jezabel
  lamina: (o, t) => chiado(o, t, { filtro: 'bandpass', f0: 5000, f1: 1500, q: 5, a: .003, d: .16, v: .45 }),
  encanto: (o, t) => { [988, 1175, 1480, 1976].forEach((f, i) => tom(o, t + i * .06, { f0: f, d: .5, v: .1 })); },
  veneno: (o, t) => { chiado(o, t, { filtro: 'bandpass', f0: 900, f1: 300, q: 8, a: .02, d: .5, v: .35 }); },
  gongo: (o, t) => { [98, 147, 233].forEach(f => tom(o, t, { f0: f, a: .005, d: 1.6, v: .25 })); chiado(o, t, { filtro: 'highpass', f0: 3500, a: .002, d: .4, v: .25 }); },
  // Nabucodonosor
  metal: (o, t) => { [523, 1109, 1661, 2489].forEach(f => tom(o, t, { tipo: 'triangle', f0: f, a: .001, d: .45, v: .09 })); chiado(o, t, { filtro: 'highpass', f0: 2000, a: .001, d: .08, v: .5 }); },
  corneta: (o, t) => { tom(o, t, { tipo: 'sawtooth', f0: 147, a: .08, d: .7, v: .12 }); tom(o, t + .2, { tipo: 'sawtooth', f0: 220, a: .06, d: .6, v: .1 }); },
  punho: (o, t) => { R.metal(o, t); R.pisao(o, t + .02); },
  // interface
  moeda: (o, t) => { tom(o, t, { tipo: 'triangle', f0: 1976, d: .09, v: .14 }); tom(o, t + .06, { tipo: 'triangle', f0: 2637, d: .22, v: .12 }); },
  nivel: (o, t) => { [523, 659, 784, 1047].forEach((f, i) => tom(o, t + i * .06, { tipo: 'triangle', f0: f, d: .35, v: .12 })); },
  ultPronta: (o, t) => { tom(o, t, { tipo: 'sine', f0: 880, f1: 1320, a: .02, d: .5, v: .14 }); [1320, 1760].forEach((f, i) => tom(o, t + .12 + i * .08, { tipo: 'triangle', f0: f, d: .6, v: .08 })); },
  ping: (o, t) => { tom(o, t, { tipo: 'sine', f0: 880, f1: 1320, a: .01, d: .12, v: .12 }); tom(o, t + .13, { tipo: 'sine', f0: 1320, a: .01, d: .18, v: .1 }); },
  anuncio: (o, t) => { [[392, 0], [523, .12], [659, .24], [784, .36]].forEach(([f, d]) => { tom(o, t + d, { tipo: 'sawtooth', f0: f, a: .02, d: d > .3 ? .9 : .2, v: .07 }); tom(o, t + d, { tipo: 'triangle', f0: f * 2, a: .02, d: d > .3 ? .9 : .2, v: .06 }); }); tom(o, t + .36, { f0: 98, f1: 60, a: .01, d: .8, v: .35 }); },
  anuncioMal: (o, t) => { [[392, 0], [370, .16], [294, .32]].forEach(([f, d]) => tom(o, t + d, { tipo: 'sawtooth', f0: f, a: .03, d: .45, v: .07 })); tom(o, t + .32, { f0: 70, f1: 40, d: .7, v: .35 }); },
  cancelar: (o, t) => tom(o, t, { tipo: 'triangle', f0: 500, f1: 260, d: .12, v: .1 }),
  fornalha: (o, t) => { chiado(o, t, { filtro: 'lowpass', f0: 200, f1: 1500, q: 1.2, a: .3, d: 2.2, v: .7 }); tom(o, t, { f0: 50, f1: 70, a: .3, d: 2, v: .3 }); },
};
let ouvinte = null; export function ouvinteSom(v) { ouvinte = v; }
// toca um som com volume pela distância até o herói do jogador (0 além de ~40 m)
export function som(nome, pos, vol = 1) {
  if (!ctx || !ligado || ctx.state !== 'running' || !R[nome]) return;
  let k = vol; if (pos && ouvinte) { const d = Math.hypot(pos.x - ouvinte.x, pos.z - ouvinte.z); k *= Math.max(0, Math.min(1, 1.15 - d / 34)); } if (k < .03) return;
  const g = ctx.createGain(); g.gain.value = k; g.connect(mestre); R[nome](g, ctx.currentTime + .01); setTimeout(() => g.disconnect(), 3500);
}
export const SONS = Object.keys(R);
export const estadoSom = () => ctx ? ctx.state : 'sem-contexto';
