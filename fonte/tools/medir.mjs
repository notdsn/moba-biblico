// mede draw calls, triângulos e tempo de quadro (CPU+swiftshader) numa partida com ondas, em modo celular (iPhone 11 horizontal)
import puppeteer, { KnownDevices } from 'puppeteer-core';
const url = process.argv[2], rotulo = process.argv[3] || '', movel = process.argv[4] !== 'pc';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle'] });
const page = await browser.newPage();
if (movel) await page.emulate(KnownDevices['iPhone 11 landscape'] || { viewport: { width: 896, height: 414, deviceScaleFactor: 2, isMobile: true, hasTouch: true, isLandscape: true }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
else await page.setViewport({ width: 1280, height: 600 });
const erros = []; page.on('pageerror', e => erros.push(e.message)); page.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
await page.goto(url, { waitUntil: 'load' }); await page.waitForFunction('window.__pronto === true', { timeout: 240000 });
// aquece: 40 s de jogo para ter ondas de tropas e lutas
await page.evaluate(() => window.__tick(40 * 15, 1 / 15));
const r = await page.evaluate(() => {
  const ms = [], msG = [], calls = [], tris = []; const gl = __jogo.renderer.getContext(); const px = new Uint8Array(4); let pr = __jogo.renderer.getPixelRatio();
  for (let i = 0; i < 90; i++) { const t = performance.now(); window.__tick(1, 1 / 30); ms.push(performance.now() - t); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); msG.push(performance.now() - t); const inf = window.__info(); calls.push(inf.calls); tris.push(inf.tris); }
  ms.sort((a, b) => a - b); msG.sort((a, b) => a - b); const med = a => a.reduce((s, x) => s + x, 0) / a.length;
  const inf = window.__info(); const un = __jogo.unidades.filter(u => u.vivo).length;
  let meshes = 0, vis = 0; __jogo.scene.traverse(o => { if (o.isMesh || o.isInstancedMesh || o.isSprite || o.isPoints) { meshes++; if (o.visible) vis++; } });
  return { calls: med(calls).toFixed(0), callsMax: Math.max(...calls), tris: (med(tris) / 1000).toFixed(0) + 'k', cpuMed: ms[45].toFixed(1), totalMed: msG[45].toFixed(1), totalP90: msG[81].toFixed(1), geos: inf.geos, tex: inf.tex, progs: inf.progs, unidades: un, objetos: meshes, pr: pr.toFixed(2), W: innerWidth, H: innerHeight, extra: window.__perf ? window.__perf() : null };
});
console.log(rotulo, JSON.stringify(r), erros.length ? 'ERROS ' + erros.slice(0, 3).join(' | ') : 'sem erros');
await browser.close();
