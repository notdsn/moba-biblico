import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions'; import { MeshoptDecoder } from 'meshoptimizer';
await MeshoptDecoder.ready; const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
for (const f of process.argv.slice(2)) { const r = (await io.read(f)).getRoot(); for (const m of r.listMeshes()) for (const p of m.listPrimitives()) console.log(f.split('/').pop(), p.listSemantics().join(','), 'verts', p.getAttribute('POSITION').getCount(), 'mat', p.getMaterial()?.getName()); }
