// mostra onde estão os bytes de um .glb (texturas x malha x animação)
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions'; import { MeshoptDecoder } from 'meshoptimizer';
await MeshoptDecoder.ready; const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
for (const f of process.argv.slice(2)) { const r = (await io.read(f)).getRoot();
  const tex = r.listTextures().map(t => `${t.getName().slice(0, 18)} ${t.getMimeType()} ${(t.getImage().byteLength / 1024).toFixed(0)}KB`);
  let anim = 0, keys = 0; for (const a of r.listAnimations()) for (const s of a.listSamplers()) { anim += s.getInput().getByteLength() + s.getOutput().getByteLength(); keys += s.getInput().getCount(); }
  console.log(f.split('/').pop(), '| texturas:', tex.join(', '), '| animação (sem compressão)', (anim / 1024).toFixed(0) + 'KB', keys, 'chaves', r.listAnimations().map(a => a.getName() + ':' + a.listChannels().length).join(' ')); }
