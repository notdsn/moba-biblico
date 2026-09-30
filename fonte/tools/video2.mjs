import puppeteer from 'puppeteer-core';
import fs from 'fs';
const W = 1280, H = 576, FPS = 30;
const out = '/tmp/frames2'; fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out);
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', `--window-size=${W},${H}`] });
let f = 0; const t0 = Date.now();
async function segmento(url, dur, roteiro, pre = 20) {
  const page = await browser.newPage(); await page.setViewport({ width: W, height: H });
  page.on('pageerror', e => console.log('[err]', e.message));
  await page.goto(url, { waitUntil: 'load' }); await page.waitForFunction('window.__pronto === true', { timeout: 180000 });
  await page.evaluate((n) => window.__tick(n, 1 / 30), pre);
  let ri = 0;
  for (let k = 0; k < dur * FPS; k++, f++) {
    const t = k / FPS;
    while (ri < roteiro.length && roteiro[ri][0] <= t) { await page.evaluate(roteiro[ri][1]); ri++; }
    await page.evaluate(() => window.__tick(1, 1 / 30));
    await page.screenshot({ path: `${out}/f${String(f).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 90 });
    if (f % 30 === 0) console.log('frame', f, ((Date.now() - t0) / 1000).toFixed(0) + 's');
  }
  await page.close();
}
const J = "__jogo.jogador", B = "__jogo.bot";
await segmento('http://localhost:8765/?cap&heroi=davi&vs=golias&cena=luta', 10, [
  [0, `__jogo.input = {x: 1, y: -0.15}`], [0.8, `__jogo.input = null`],
  [1.0, `__jogo.atacar(${J})`], [1.7, `__jogo.usarHab(${J},'q')`], [2.4, `__jogo.atacar(${J})`],
  [3.3, `__jogo.usarHab(${J},'w')`], [3.8, `__jogo.atacar(${J})`], [4.6, `__jogo.atacar(${J})`],
  [5.4, `__jogo.input = {x: -1, y: 0.2}`], [5.55, `__jogo.usarHab(${J},'e')`], [5.9, `__jogo.input = null`],
  [6.4, `__jogo.atacar(${J})`], [7.2, `__jogo.usarHab(${J},'r')`], [8.4, `__jogo.atacar(${J})`], [9.2, `__jogo.atacar(${J})`],
]);
await segmento('http://localhost:8765/?cap&heroi=davi&vs=golias&cena=vitoria', 3.5, [], 2);
await browser.close();
console.log('ok', f, ((Date.now() - t0) / 1000).toFixed(0) + 's');
