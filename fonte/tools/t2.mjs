import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage(); await page.setViewport({ width: 600, height: 300 });
await page.goto('http://localhost:8765/?cap', { waitUntil: 'load' }); await page.waitForFunction('window.__pronto === true', { timeout: 180000 });
console.log(await page.evaluate(() => { const r = []; __tick(5); r.push(__jogo.davi.atual.getClip().name); __jogo.atacar(); __tick(3); r.push(__jogo.davi.atual.getClip().name); __tick(30); r.push(__jogo.davi.atual.getClip().name); __jogo.habQ(); __tick(60); r.push(__jogo.davi.atual.getClip().name); return r.join(' > '); }));
await browser.close();
