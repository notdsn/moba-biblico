import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {getBounds} from '@gltf-transform/core';
import {MeshoptDecoder} from 'meshoptimizer'; await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
for(const f of process.argv.slice(2)){const d=await io.read(f); const b=getBounds(d.getRoot().listScenes()[0]); console.log(f.split('/').pop().padEnd(28), b.min.map(x=>x.toFixed(2)).join(','),' | ',b.max.map(x=>x.toFixed(2)).join(','));}
