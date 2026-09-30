import puppeteer, { KnownDevices } from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle'] });
const page = await browser.newPage(); await page.emulate(KnownDevices['iPhone 11 landscape']);
await page.goto(process.argv[2], { waitUntil: 'load' }); await page.waitForFunction('window.__pronto === true', { timeout: 240000 });
console.log(await page.evaluate(() => { const J = __jogo, T = J.THREE; __tick(20, 1 / 30); const cam = J.camera; cam.updateMatrixWorld(); const fr = new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
  const g = {}; J.scene.traverseVisible(o => { if (!o.isMesh) return; if (o.frustumCulled) { if (o.isInstancedMesh || o.isSkinnedMesh) { if (!o.boundingSphere) o.computeBoundingSphere && o.computeBoundingSphere(); const s = (o.boundingSphere || o.geometry.boundingSphere).clone().applyMatrix4(o.matrixWorld); if (!fr.intersectsSphere(s)) return; } else if (!fr.intersectsObject(o)) return; }
    const tri = (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); const k = (o.isInstancedMesh ? 'inst ' : o.isSkinnedMesh ? 'skin ' : '') + (o.material.name || o.material.type).slice(0, 18) + (o.material.colorWrite === false ? ' (sombra)' : '') + (o.castShadow ? ' cs' : ''); g[k] = g[k] || [0, 0]; g[k][0]++; g[k][1] += tri; });
  return Object.entries(g).sort((a, b) => b[1][1] - a[1][1]).slice(0, 30).map(([k, v]) => `${k}: ${v[0]}x ${(v[1] / 1000).toFixed(0)}k`).join('\n'); }));
await browser.close();
