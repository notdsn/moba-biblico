import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions'; import { MeshoptDecoder } from 'meshoptimizer'; import sharp from 'sharp'; import { dequantize } from '@gltf-transform/functions';
await MeshoptDecoder.ready; const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read('public/models/selva/dragao.glb'); const r = doc.getRoot();
for (const t of r.listTextures()) { const im = sharp(Buffer.from(t.getImage())); const md = await im.metadata(); console.log(t.getName(), md.width, md.height); t.setImage(new Uint8Array(await im.png().toBuffer())).setMimeType('image/png'); }
for (const e of r.listExtensionsUsed()) if (/meshopt|webp|quantiz/i.test(e.extensionName)) e.dispose();
await doc.transform(dequantize()); const n = r.listNodes(); console.log(n.map(x => x.getName() + ' s' + x.getScale() + ' r' + x.getRotation()));
const p = r.listMeshes()[0].listPrimitives()[0].getAttribute('POSITION'); console.log('pos', p.getComponentType(), p.getNormalized(), p.getMinNormalized([]), p.getMaxNormalized([]));
await io.write('/tmp/dr/dragao_plano.glb', doc);
