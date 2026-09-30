// mede a suavidade da corrida: anda 4 s (dt de 1/60 com variação de ±30%) e mede o passo angular do braço/pernas por quadro
// (picos = trancos) e o deslize dos pés. Uso: node tools/suavidade.mjs <url>
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle'] });
const p = await b.newPage(); await p.setViewport({ width: 800, height: 400 }); await p.goto(process.argv[2], { waitUntil: 'load' }); await p.waitForFunction('window.__pronto === true', { timeout: 240000 });
console.log(await p.evaluate(() => { const J = __jogo, T = J.THREE, h = J.jogador; J.bot.bot = false; J.bot.obj.position.set(60, 0, 0);
  h.obj.position.set(-50, 0, J.laneZ(-50)); J.input = null; __tick(10, 1 / 60);
  const ossos = {}; h.modelo.traverse(o => { if (o.isBone && /(RightArm|LeftUpLeg|Spine2)$/.test(o.name)) ossos[o.name.replace(/.*:|mixamorig/, '')] = o; });
  const q0 = {}, passos = {}; for (const k in ossos) { passos[k] = []; q0[k] = new T.Quaternion(); }
  const qq = new T.Quaternion(); let r = 1; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  const trocas = []; let ult = null; const dts = [];
  for (let i = 0; i < 240; i++) { const x = i < 30 ? 0 : 1; J.input = x ? { x: 1, y: 0 } : null; const dt = (1 / 60) * (1 + (rnd() - .5) * .6); dts.push(dt); __tick(1, dt);
    const a = h.atual && h.atual.getClip().name; if (a !== ult) { trocas.push(i + ':' + a); ult = a; }
    for (const k in ossos) { ossos[k].getWorldQuaternion(qq); qq.premultiply(new T.Quaternion().copy(h.obj.quaternion).invert()); if (i > 0) passos[k].push(q0[k].angleTo(qq) * 57.3 / (dts[i] * 60)); q0[k].copy(qq); } }
  const out = []; for (const k in passos) { const v = passos[k].slice(40).sort((a, b) => a - b); const med = v[v.length >> 1], max = v[v.length - 1], p99 = v[Math.floor(v.length * .99)]; out.push(`${k}: mediana ${med.toFixed(2)}°/q, p99 ${p99.toFixed(2)}, máx ${max.toFixed(2)} (máx/mediana ${(max / med).toFixed(1)}x)`); }
  return out.join(' | ') + ' | trocas: ' + trocas.join(', ');
}));
await b.close();
