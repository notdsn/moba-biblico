import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.emulate({ viewport: { width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true, isLandscape: true }, userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36' });
const erros = []; page.on('pageerror', e => erros.push(e.message)); page.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
await page.goto('http://localhost:8765/', { waitUntil: 'load' }); await page.waitForFunction('window.__pronto === true', { timeout: 180000 });
await new Promise(r => setTimeout(r, 1500));
const p0 = await page.evaluate(() => { const p = __jogo.davi.obj.position; return [p.x, p.z]; });
// joystick: toque e arrasta para a direita
const cdp = await page.target().createCDPSession();
const t = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
await t('touchStart', 110, 300); for (let i = 0; i < 10; i++) { await t('touchMove', 110 + i * 6, 300); await new Promise(r => setTimeout(r, 30)); }
await new Promise(r => setTimeout(r, 2500));
const p1 = await page.evaluate(() => { const p = __jogo.davi.obj.position; return [p.x, p.z]; });
await t('touchEnd');
// ataque
const b = await page.$('#bAtaque'); const bb = await b.boundingBox();
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bb.x + bb.width / 2, y: bb.y + bb.height / 2, id: 2 }] });
await new Promise(r => setTimeout(r, 200)); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
const q = await page.$('#bQ'); const qb = await q.boundingBox();
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: qb.x + qb.width / 2, y: qb.y + qb.height / 2, id: 3 }] });
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await new Promise(r => setTimeout(r, 1500));
const info = await page.evaluate(() => ({ anim: __jogo.davi.atual && __jogo.davi.atual.getClip().name, cdQ: document.querySelector('#bQ .cd').className, fps: document.getElementById('fps').textContent, info: __info(), pr: 0 }));
console.log('antes', p0, 'depois', p1, info, 'erros', erros);
await page.screenshot({ path: 'prints/teste_celular.png' });
await browser.close();
