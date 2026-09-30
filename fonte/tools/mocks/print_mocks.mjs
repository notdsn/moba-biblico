import puppeteer from 'puppeteer-core'; import path from 'path'; import { fileURLToPath } from 'url';
const dir = path.dirname(fileURLToPath(import.meta.url)); const out = path.resolve(dir, '../../prints');
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
const p = await b.newPage(); await p.setViewport({ width: 812, height: 375, deviceScaleFactor: 2 });
for (const [f, n] of [['carregamento', 'plano-carregamento'], ['ouro', 'plano-ouro'], ['dano', 'plano-dano'], ['skin', 'plano-skin'], ['fim', 'plano-fim']]) {
  await p.goto('file://' + path.join(dir, f + '.html'), { waitUntil: 'load' }); await p.evaluate(() => document.fonts.ready); await new Promise(r => setTimeout(r, 300));
  await p.screenshot({ path: path.join(out, n + '.png') }); console.log(n);
}
await b.close();
