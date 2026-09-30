import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage(); await page.setViewport({ width: 1200, height: 540 });
await page.goto('http://localhost:8765/?cap', { waitUntil: 'load' }); await page.waitForFunction('window.__pronto === true', { timeout: 180000 });
await page.evaluate(() => { const r = window.__jogo; }); 
await page.evaluate(() => { window.__tick(5); });
console.log(await page.evaluate(() => { window.__jogo; return JSON.stringify(window.__info()); }));
await browser.close();
