import puppeteer from 'puppeteer-core';
import fs from 'fs';
const W = +(process.argv[2] || 1600), H = +(process.argv[3] || 720), FPS = 30, DUR = +(process.argv[4] || 13);
fs.rmSync('/tmp/frames', { recursive: true, force: true }); fs.mkdirSync('/tmp/frames');
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage(); await page.setViewport({ width: W, height: H });
page.on('pageerror', e => console.log('[err]', e.message));
await page.goto('http://localhost:8765/?cap&cena=3', { waitUntil: 'load' }); await page.waitForFunction('window.__pronto === true', { timeout: 180000 });
// roteiro: [segundo, código]
const roteiro = [
  [0, "__jogo.input = {x: 1, y: 0.28}"],
  [2.0, "__jogo.input = null"],
  [2.7, "__jogo.atacar()"], [3.4, "__jogo.atacar()"], [4.1, "__jogo.atacar()"],
  [4.9, "__jogo.habQ()"],
  [6.0, "__jogo.atacar()"],
  [6.8, "__jogo.habW()"],
  [8.0, "__jogo.input = {x: 0.9, y: -0.1}"], [8.25, "__jogo.habE()"], [8.7, "__jogo.input = null"],
  [9.2, "__jogo.habR()"],
  [11.0, "__jogo.atacar()"], [11.7, "__jogo.atacar()"], [12.4, "__jogo.atacar()"],
];
await page.evaluate(() => window.__tick(20, 1 / 30));
const N = DUR * FPS; let ri = 0; const t0 = Date.now();
for (let f = 0; f < N; f++) {
  const t = f / FPS;
  while (ri < roteiro.length && roteiro[ri][0] <= t) { await page.evaluate(roteiro[ri][1]); ri++; }
  await page.evaluate(() => window.__tick(1, 1 / 30));
  await page.screenshot({ path: `/tmp/frames/f${String(f).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 92 });
  if (f % 30 === 0) console.log('frame', f, ((Date.now() - t0) / 1000).toFixed(0) + 's');
}
await browser.close();
