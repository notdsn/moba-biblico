// Prints em WebKit (Playwright) com emulação de iPhone. Uso: node tools/iphone.mjs <url> <saida.png> <aparelho> <land|port> [simularNotch=1]
import { webkit, devices } from 'playwright';
const [,, url, out, nome = 'iPhone 11', ori = 'land', notch = '1', vw, vh, dpr] = process.argv;
const dev = devices[nome + (ori === 'land' ? ' landscape' : '')] || devices[nome];
const b = await webkit.launch();
const o = { ...dev }; if (vw) { o.viewport = { width: +vw, height: +vh }; o.screen = { width: +vw, height: +vh }; } if (dpr) o.deviceScaleFactor = +dpr;
const ctx = await b.newContext(o);
if (process.env.DICA !== '1') await ctx.addInitScript(() => { try { sessionStorage.setItem('dicaIos', '1'); } catch (e) {} });
const p = await ctx.newPage(); const errs = [];
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
await p.goto(url, { waitUntil: 'load', timeout: 120000 });
// WebKit headless não tem notch: simulamos as áreas seguras do aparelho (valores reais do iOS)
const ins = { 'iPhone SE (3rd gen)': { land: [0, 0, 0, 0], port: [20, 0, 0, 0] }, 'iPhone 11': { land: [0, 48, 21, 48], port: [48, 0, 34, 0] }, 'iPhone 13': { land: [0, 47, 21, 47], port: [47, 0, 34, 0] }, 'iPhone SE': { land: [0, 0, 0, 0], port: [20, 0, 0, 0] } }[nome] || { land: [0, 0, 0, 0], port: [0, 0, 0, 0] };
const [t, r, bt, l] = ins[ori];
if (notch === '1' && !/SE/.test(nome)) await p.evaluate(() => { window.__temNotch = true; });
if (notch === '1') await p.evaluate(([t, r, bt, l, ori]) => {
  const s = document.documentElement.style; s.setProperty('--st', t + 'px'); s.setProperty('--sr', r + 'px'); s.setProperty('--sb', bt + 'px'); s.setProperty('--sl', l + 'px');
  // desenho do notch e da barra de início, só para visualizar no print
  const d = document.createElement('div'); d.style.cssText = 'position:fixed;z-index:99;background:#000;pointer-events:none;border-radius:' + (ori === 'land' ? '0 18px 18px 0' : '0 0 18px 18px') + ';' + (ori === 'land' ? 'left:0;top:50%;width:30px;height:210px;transform:translateY(-50%)' : 'top:0;left:50%;height:30px;width:210px;transform:translateX(-50%)'); if (t + l > 0 && !/SE/.test(document.title + '$'.slice(1)) && window.__temNotch) document.body.appendChild(d);
  const h = document.createElement('div'); h.style.cssText = 'position:fixed;z-index:99;left:50%;bottom:8px;width:' + (ori === 'land' ? 220 : 134) + 'px;height:5px;border-radius:3px;background:rgba(255,255,255,.85);transform:translateX(-50%);pointer-events:none'; if (bt > 0) document.body.appendChild(h);
  window.dispatchEvent(new Event('resize'));
}, [t, r, bt, l, ori]);
if (ori === 'land') { await p.waitForFunction('window.__pronto === true', null, { timeout: 180000 }).catch(() => errs.push('nao ficou pronto')); await p.evaluate(() => window.__tick && window.__tick(30, 1 / 30)).catch(() => {}); }
await p.waitForTimeout(process.env.DICA === "1" ? 2500 : +(process.env.ESPERA || 1500));
await p.screenshot({ path: out });
console.log(out, o.viewport, 'dpr', o.deviceScaleFactor, 'ERROS:', errs.join(' | ') || 'nenhum');
await b.close();
