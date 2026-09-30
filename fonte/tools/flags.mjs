// confere se cada ?flag ainda carrega sem erro de JavaScript
import puppeteer, { KnownDevices } from 'puppeteer-core';
const B = process.argv[2] || 'http://localhost:5199/';
const F = ['?cap&cena=luta', '?cap&cena=loja', '?cap&cena=vitoria', '?cap&cena=video', '?cap&cena=sel', '?cap&cena=vs', '?cap&cena=fim', '?cap&cena=skin', '?cap&cena=galeria',
  '?q=baixa&heroi=sansao&vs=farao', '?modelos=antigos&heroi=davi&vs=golias', '?poderes=antigos&heroi=gideao&vs=jezabel', '?som=0&heroi=debora&vs=nabuco', '?fps&heroi=davi', '?auto&cap&heroi=davi&vs=golias',
  '?lado=trevas', '?heroi=farao&vs=sansao&lado=trevas', '?davi=grok&heroi=davi', '?aneis&heroi=davi', '?medir&cap&heroi=davi', '?estilo=antigo&heroi=davi', '?dif=dificil&heroi=davi', '?dif=facil&heroi=golias',
  '?veste=davi:rei&heroi=davi', '?perfil=0&heroi=davi', '?cap&heroi=jezabel&veste=jezabel:sidom&cena=luta'];
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 0, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle'] });
const res = [];
for (const f of F) {
  const p = await b.newPage(); await p.emulate(KnownDevices['iPhone 11 landscape']); const er = []; p.on('pageerror', e => er.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) er.push(m.text().slice(0, 140)); });
  let ok = true; try { await p.goto(B + f, { waitUntil: 'load', timeout: 60000 }); await p.waitForFunction('window.__pronto === true', { timeout: 200000 }); await new Promise(r => setTimeout(r, 2500)); } catch (e) { ok = false; er.push('timeout: ' + e.message.slice(0, 80)); }
  res.push(`${ok && !er.length ? 'OK ' : 'ERRO'} ${f}${er.length ? ' → ' + er.join(' | ') : ''}`); console.log(res.at(-1)); await Promise.race([p.close(), new Promise(r => setTimeout(r, 4000))]);
}
await Promise.race([b.close(), new Promise(r => setTimeout(r, 4000))]); process.exit(0);
