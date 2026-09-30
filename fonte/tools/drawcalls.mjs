// lista quem gera draw calls (por grupo) numa partida em modo celular
import puppeteer, { KnownDevices } from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle'] });
const page = await browser.newPage(); await page.emulate(KnownDevices['iPhone 11 landscape']);
await page.goto(process.argv[2], { waitUntil: 'load' }); await page.waitForFunction('window.__pronto === true', { timeout: 240000 });
await page.evaluate(() => window.__tick(40 * 15, 1 / 15));
console.log(await page.evaluate(() => {
  const J = __jogo, R = J.renderer, cam = J.camera; const fr = new J.THREE.Frustum().setFromProjectionMatrix(new J.THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
  const grupos = {}; let sombra = 0;
  const raiz = (o) => { let p = o; const cad = []; while (p && p !== J.scene) { cad.push(p.name || p.type); p = p.parent; } return cad.slice(-2).reverse().join('/'); };
  J.scene.updateMatrixWorld(true);
  J.scene.traverseVisible(o => { if (!(o.isMesh || o.isSprite || o.isPoints || o.isLine)) return; const mats = Array.isArray(o.material) ? o.material.length : 1;
    let dentro = true; if (o.frustumCulled && o.geometry) { if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); const s = o.geometry.boundingSphere.clone().applyMatrix4(o.matrixWorld); dentro = fr.intersectsSphere(s); }
    const k = (o.material && !Array.isArray(o.material) ? (o.material.name || o.material.type) + " " + (o.geometry ? o.geometry.type : "") + " | " : "") + (o.isSkinnedMesh ? 'skin ' : o.isInstancedMesh ? 'inst ' : o.isSprite ? 'sprite ' : o.isPoints ? 'points ' : 'mesh ') + raiz(o);
    grupos[k] = grupos[k] || [0, 0, 0]; grupos[k][0] += mats; if (dentro) grupos[k][1] += mats; if (o.castShadow) { grupos[k][2] += mats; sombra += mats; } });
  const l = Object.entries(grupos).sort((a, b) => b[1][1] - a[1][1]).slice(0, 30).map(([k, v]) => `${v[1]}/${v[0]} (sombra ${v[2]}) ${k}`);
  return 'total sombra casters ' + sombra + '\n' + l.join('\n');
}));
await browser.close();
