import puppeteer from 'puppeteer-core';
const base = process.argv[2] || 'http://localhost:5199/';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
await page.emulate({ viewport: { width: 844, height: 390, deviceScaleFactor: 1, isMobile: true, hasTouch: true, isLandscape: true }, userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36' });
const erros = []; page.on('pageerror', e => erros.push(e.message)); page.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
const cdp = await page.target().createCDPSession();
const esp = ms => new Promise(r => setTimeout(r, ms));
const toque = async (sel, id = 3) => { const el = await page.$(sel); if (!el) { console.log('SEM', sel); return; } const b = await el.boundingBox(); const x = b.x + b.width / 2, y = b.y + b.height / 2; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id }] }); await esp(80); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await esp(250); };
await page.goto(base, { waitUntil: 'load' }); await page.waitForFunction('window.__pronto === true', { timeout: 180000 });
await page.waitForSelector('.lado.trevas', { timeout: 60000 });
await page.screenshot({ path: '/tmp/fl_lados.png' });
await toque('.lado.trevas'); await toque('.card[data-id=farao]'); await toque('#selOk');
await esp(1500);
console.log('partida', await page.evaluate(() => `${__jogo.jogador.id}/${__jogo.jogador.time} vs ${__jogo.bot.id}/${__jogo.bot.time} x=${__jogo.jogador.obj.position.x.toFixed(1)}`));
// loja na base
await toque('#loja'); await esp(400);
console.log('loja aberta', await page.evaluate(() => getComputedStyle(document.getElementById('lojaPainel')).display + ' ' + document.getElementById('lojaPainel').className));
await toque('#lojaPainel .bComprar'); await esp(300);
console.log('itens', await page.evaluate(() => __jogo.jogador.itens.join(',') + ' ouro ' + Math.round(__jogo.jogador.ouro)));
await toque('#lojaPainel .fechar');
// + da habilidade Q e usar
await toque('#bQ .mais'); await toque('#bQ');
console.log('Q', await page.evaluate(() => `nv ${__jogo.jogador.hab.q.nv} usos ${__jogo.jogador.usos || 0} pontos ${__jogo.jogador.pontos}`));
// joystick: arrasta para a esquerda (rota, lado das Trevas)
const p0 = await page.evaluate(() => __jogo.jogador.obj.position.x);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 110, y: 300, id: 1 }] });
for (let i = 0; i < 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 110 - i * 6, y: 300, id: 1 }] }); await esp(30); }
await esp(3000);
const p1 = await page.evaluate(() => __jogo.jogador.obj.position.x);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
console.log('joystick dx', (p1 - p0).toFixed(2));
// loja fora da base deve estar bloqueada
await toque('#loja'); await esp(300); await toque('#lojaPainel .bComprar');
console.log('itens fora da base', await page.evaluate(() => __jogo.jogador.itens.join(',') + ' aviso: ' + document.getElementById('aviso').textContent));
await page.screenshot({ path: '/tmp/fl_fim.png' });
console.log('FPS', await page.evaluate(() => document.getElementById('fps').textContent), JSON.stringify(await page.evaluate(() => __info())));
console.log('ERROS', erros.join(' | '));
await browser.close();
