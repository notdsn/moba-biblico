import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage(); await page.setViewport({ width: 1200, height: 540 });
await page.goto('http://localhost:8765/?cap' + (process.argv[2]||''), { waitUntil: 'load' }); await page.waitForFunction('window.__pronto === true', { timeout: 180000 });
console.log(await page.evaluate(() => { const r = {}; let n = 0; window.__jogo.scene.traverse(o => { if (o.isMesh || o.isPoints) { n++; const g = o.geometry; let t = (g.index ? g.index.count : g.attributes.position.count) / 3; if (o.isInstancedMesh) t *= o.count; const k = (o.isInstancedMesh ? 'INST ' : o.isSkinnedMesh ? 'SKIN ' : '') + (o.material.type) + ' ' + (o.name || '').slice(0, 20); r[k] = (r[k] || 0) + t; } }); return n + ' meshes\n' + Object.entries(r).sort((a, b) => b[1] - a[1]).slice(0, 15).map(e => e[0] + ': ' + Math.round(e[1])).join('\n'); }));
await page.evaluate(() => window.__tick(3)); console.log(await page.evaluate(() => JSON.stringify(window.__info())));
await browser.close();
