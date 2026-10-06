// confere o VK: nível, KTX2, texturas carregadas e malhas do manifest. node tools/probeVK.mjs <url> [mobile]
import puppeteer, { KnownDevices } from 'puppeteer-core';
const [,, url, mob] = process.argv;
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 0, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle'] });
const p = await b.newPage(); if (mob) await p.emulate(KnownDevices['iPhone 11 landscape']); else await p.setViewport({ width: 1280, height: 720 });
const erros = []; p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error' || /\[vfx/.test(m.text())) erros.push(m.text().slice(0, 200)); });
const reqs = []; p.on('request', r => { const u = r.url(); if (/vfx\/realista|models\/vfx/.test(u)) reqs.push(u.replace(/^.*?(vfx\/realista|models\/vfx)/, '$1')); });
await p.goto(url, { waitUntil: 'load', timeout: 120000 }); await p.waitForFunction('window.__pronto === true', { timeout: 240000 });
const r = await p.evaluate(() => { const V = __jogo.VK; return V ? { nivel: V.nivel, ktx: V.ktx, keys: Object.keys(V).length, malhas: V.malhas, texs: V.texs.length, herois: __jogo.herois.map(h => h.id) } : null; });
console.log(JSON.stringify(r)); console.log('REQS', reqs.length, reqs.join(' ')); console.log('ERROS', erros.join(' | ') || 'nenhum'); await b.close();
