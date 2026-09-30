import puppeteer from 'puppeteer-core';
const [,, url, out, w = 2400, h = 1080, ticks = 60, extra = ''] = process.argv;
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--use-gl=angle', `--window-size=${w},${h}`] });
const page = await browser.newPage();
page.on('console', m => console.log('[pg]', m.type(), m.text()));
page.on('pageerror', e => console.log('[err]', e.message));
await page.setViewport({ width: +w, height: +h, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('window.__pronto === true', { timeout: 180000 });
const t0 = Date.now();
await page.evaluate((n) => window.__tick(n, 1/30), +ticks);
if (extra) await page.evaluate(extra);
console.log('ticks ms', Date.now() - t0);
await new Promise(r => setTimeout(r, 400));
await page.screenshot({ path: out });
await browser.close();
