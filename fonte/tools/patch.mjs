import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {prune, meshopt, textureCompress} from '@gltf-transform/functions';
import {MeshoptEncoder, MeshoptDecoder} from 'meshoptimizer';
import fs from 'fs';
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const jobs={davi:{tex:'/tmp/tx/davi.png',drop:['Knife_Offhand','1H_Crossbow','2H_Crossbow','Knife']},
 guardiao:{tex:'/tmp/tx/guardiao.png',drop:['1H_Sword_Offhand','Badge_Shield','Rectangle_Shield','Spike_Shield','2H_Sword']},
 sombra:{tex:'/tmp/tx/sombra.png',drop:[]}, sombra_guerreiro:{tex:'/tmp/tx/sombra.png',drop:[]}};
for(const [n,j] of Object.entries(jobs)){
 const d=await io.read(`public/models/${n}.glb`);
 for(const node of d.getRoot().listNodes()) if(j.drop.includes(node.getName())) node.dispose();
 for(const t of d.getRoot().listTextures()){ t.setImage(fs.readFileSync(j.tex)); t.setMimeType('image/png'); }
 await d.transform(prune(), meshopt({encoder:MeshoptEncoder, level:'medium'}));
 await io.write(`public/models/${n}.glb`, d);
}
console.log('ok');
