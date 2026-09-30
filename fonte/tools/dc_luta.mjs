// draw calls/triângulos por quadro no celular (iPhone 11 emulado) numa luta no meio da rota e em 4 pontos do mapa
import puppeteer, { KnownDevices } from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle'] });
const page = await browser.newPage(); await page.emulate(KnownDevices['iPhone 11 landscape']); const errs = [];
page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(process.argv[2], { waitUntil: 'load' }); await page.waitForFunction('window.__pronto === true', { timeout: 240000 });
const r = await page.evaluate(() => { const J = __jogo, R = J.renderer, out = [];
  R.info.autoReset = false; const P = J.jogador;
  for (const x of [null, -45, -19, 1, 21, 50]) { if (x !== null) { P.obj.position.set(x, 0, J.laneZ(x)); } __tick(20, 1 / 30); let c = 0, t = 0; for (let k = 0; k < 6; k++) { R.info.reset(); __tick(1, 1 / 30); c += R.info.render.calls; t += R.info.render.triangles; } out.push(`${x === null ? 'luta' : 'x=' + x}: ${(c / 6).toFixed(0)} calls, ${(t / 6 / 1000).toFixed(0)}k tri`); }
  return out.join(' | '); });
console.log(r, '| erros:', errs.join(' ; ') || 'nenhum'); await browser.close();
