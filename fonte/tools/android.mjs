// Teste Android (Chrome emulado): vários aparelhos, deitado/em pé, toque/joystick, mira arrastando, Voltar, tela cheia, áudio, desempenho
import puppeteer from 'puppeteer-core'; import fs from 'fs';
const BASE = process.argv[2] || 'http://localhost:5199/'; const SO = process.argv[3]; // filtro opcional de aparelho
const UA = (m) => `Mozilla/5.0 (Linux; Android 14; ${m}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36`;
const APS = [
  { id: 'pixel7', nome: 'Pixel 7', w: 915, h: 412, dpr: 2.625, ua: UA('Pixel 7') },
  { id: 's20', nome: 'Galaxy S20 / A-series', w: 800, h: 360, dpr: 3, ua: UA('SM-G981B') },
  { id: 'basico', nome: 'Básico 360x640', w: 640, h: 360, dpr: 2, ua: UA('SM-A032M') },
].filter(a => !SO || a.id === SO);
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 0, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle', '--autoplay-policy=document-user-activation-required'] });
const rel = {}; const esp = (ms) => new Promise(r => setTimeout(r, ms));
for (const a of APS) {
  const R = rel[a.id] = { aparelho: a.nome, erros: [] };
  const p = await b.newPage(); p.on('pageerror', e => R.erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') R.erros.push(m.text().slice(0, 160)); });
  await p.setUserAgent(a.ua); await p.setViewport({ width: a.w, height: a.h, deviceScaleFactor: a.dpr, isMobile: true, hasTouch: true, isLandscape: true });
  // 1) seleção -> Confirmar (toque) -> tela VS -> partida
  await p.goto(BASE + '?lado=luz&heroi=davi&cena=sel&dif=normal', { waitUntil: 'load' }); await p.waitForFunction('window.__pronto === true', { timeout: 240000 });
  await p.waitForSelector('#selOk'); await esp(400); await p.screenshot({ path: `prints/android-${a.id}-selecao.png` });
  const ok = await p.$('#selOk'); const bb = await ok.boundingBox(); await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await esp(900); await p.screenshot({ path: `prints/android-${a.id}-vs.png` });
  R.telaCheia = await p.evaluate(() => !!document.fullscreenElement); R.orientacao = await p.evaluate(() => screen.orientation ? screen.orientation.type : '?');
  await p.waitForFunction('window.__jogo && __jogo.estado.iniciado', { timeout: 60000 }); await esp(2500);
  R.audio = await p.evaluate(() => __jogo.estadoSom());
  R.rtFloat = await p.evaluate(() => __jogo.RT_FLOAT);
  R.gl = await p.evaluate(() => { const gl = __jogo.renderer.getContext(); return { webgl2: gl instanceof WebGL2RenderingContext, astc: !!gl.getExtension('WEBGL_compressed_texture_astc'), etc: !!gl.getExtension('WEBGL_compressed_texture_etc'), maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE) }; });
  // 2) joystick por toque: arrasta para a direita e segura
  const x0 = await p.evaluate(() => __jogo.jogador.obj.position.x);
  const jx = a.w * .16, jy = a.h * .72; const cli = await p.target().createCDPSession();
  const toque = (type, pts) => cli.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  await toque('touchStart', [{ x: jx, y: jy, id: 1 }]); for (let i = 1; i <= 8; i++) { await toque('touchMove', [{ x: jx + i * 8, y: jy - i * 2, id: 1 }]); await esp(30); }
  await esp(1500); await p.screenshot({ path: `prints/android-${a.id}-joystick.png` });
  const x1 = await p.evaluate(() => __jogo.jogador.obj.position.x); await toque('touchEnd', []);
  // zona morta: toque parado (sem arrastar) não anda
  await toque('touchStart', [{ x: jx, y: jy, id: 2 }]); await toque('touchMove', [{ x: jx + 2, y: jy, id: 2 }]); await esp(600); const len = await p.evaluate(() => __jogo.jogador.ctrl.len); await toque('touchEnd', []);
  R.joystick = { andou: +(x1 - x0).toFixed(2), zonaMortaLen: +len.toFixed(3) };
  // 3) mira arrastando no botão 1 (Q) com o dedo; mostra a zona de cancelar
  await p.evaluate(() => { const j = __jogo.jogador; j.hab.q.nv = 1; j.hab.q.cd = 0; j.mana = j.manaMax; });
  const q = await (await p.$('#bQ')).boundingBox(); const qx = q.x + q.width / 2, qy = q.y + q.height / 2;
  await toque('touchStart', [{ x: qx, y: qy, id: 3 }]); for (let i = 1; i <= 6; i++) { await toque('touchMove', [{ x: qx - i * 14, y: qy - i * 7, id: 3 }]); await esp(30); }
  await esp(200); R.miraVisivel = await p.evaluate(() => document.getElementById('cancelaMira').classList.contains('on')); await p.screenshot({ path: `prints/android-${a.id}-mira.png` });
  await toque('touchEnd', []); await esp(300); R.miraUsou = await p.evaluate(() => __jogo.jogador.hab.q.cd > 0);
  // 4) botão Voltar do Android -> pausa e pergunta
  await p.goBack({ timeout: 3000 }).catch(() => { }); await esp(500);
  R.voltar = await p.evaluate(() => ({ menu: document.getElementById('sairMenu').classList.contains('on'), pausado: !!__jogo.estado.pausado, url: location.search }));
  await p.screenshot({ path: `prints/android-${a.id}-voltar.png` });
  await p.evaluate(() => __jogo.menuSair(false));
  // 5) barra de endereço aparecendo (altura menor) e recorte de câmera (área segura de 32 px à esquerda)
  await p.setViewport({ width: a.w, height: a.h - 56, deviceScaleFactor: a.dpr, isMobile: true, hasTouch: true, isLandscape: true }); await esp(700);
  await p.screenshot({ path: `prints/android-${a.id}-barra.png` });
  await p.setViewport({ width: a.w, height: a.h, deviceScaleFactor: a.dpr, isMobile: true, hasTouch: true, isLandscape: true });
  await p.evaluate(() => { document.documentElement.style.setProperty('--sl', '32px'); document.documentElement.style.setProperty('--st', '0px'); dispatchEvent(new Event('resize')); }); await esp(700);
  await p.screenshot({ path: `prints/android-${a.id}-deitado.png` });
  R.hudFora = await p.evaluate(() => [...document.querySelectorAll('#hud > *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && getComputedStyle(e).display !== 'none' && (r.left < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.top < -1); }).map(e => e.id || e.className));
  // 6) desempenho (quadro atual)
  R.perf = await p.evaluate(() => { const i = __jogo.renderer.info.render; return { calls: i.calls, tris: i.triangles, pr: __jogo.renderer.getPixelRatio() }; });
  // 7) em pé: aviso de girar com botão de tela cheia
  await p.setViewport({ width: a.h, height: a.w, deviceScaleFactor: a.dpr, isMobile: true, hasTouch: true, isLandscape: false }); await esp(600);
  await p.screenshot({ path: `prints/android-${a.id}-empe.png` });
  R.girar = await p.evaluate(() => { const g = document.getElementById('girar'); const bt = document.getElementById('girarBtn'); return { aviso: getComputedStyle(g).display !== 'none', botao: getComputedStyle(bt).display !== 'none' }; });
  const gb = await (await p.$('#girarBtn')).boundingBox(); if (gb) { await p.touchscreen.tap(gb.x + gb.width / 2, gb.y + gb.height / 2); await esp(500); }
  R.telaCheiaBotao = await p.evaluate(() => !!document.fullscreenElement);
  fs.writeFileSync('/tmp/top10/android.json', JSON.stringify(rel, null, 1)); console.log(a.id, JSON.stringify(R));
  await Promise.race([p.close(), esp(5000)]);
}
await Promise.race([b.close(), esp(5000)]); process.exit(0);
