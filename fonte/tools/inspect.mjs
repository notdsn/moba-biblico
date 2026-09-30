import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const f of process.argv.slice(2)){
 const d=await io.read(f); const r=d.getRoot();
 console.log('==',f.split('/').pop());
 console.log(' meshes:',r.listMeshes().map(m=>m.getName()).join(', '));
 console.log(' nodes w/ mesh:',r.listNodes().filter(n=>n.getMesh()).map(n=>n.getName()+(n.getSkin()?'[S]':'')+'<'+(r.listNodes().find(p=>p.listChildren().includes(n))?.getName())).join(', '));
 console.log(' anims:',r.listAnimations().length, r.listAnimations().map(a=>a.getName()).join(', '));
 console.log(' mats:',r.listMaterials().map(m=>m.getName()).join(', '));
}
