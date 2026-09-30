import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
const d=await io.read(process.argv[2]);
for(const n of d.getRoot().listNodes()){const m=n.getMesh(); if(!m) continue;
 const h={};
 for(const p of m.listPrimitives()){const uv=p.getAttribute('TEXCOORD_0'); if(!uv) continue; const idx=p.getIndices(); const cnt=idx?idx.getCount():uv.getCount();
  for(let i=0;i<cnt;i++){const v=idx?idx.getScalar(i):i; const [u,vv]=uv.getElement(v,[]); const c=Math.floor(Math.min(0.999,Math.max(0,vv))*4)+','+Math.floor(Math.min(0.999,Math.max(0,u))*8); h[c]=(h[c]||0)+1;}}
 console.log(n.getName().padEnd(26), Object.entries(h).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`r${k.split(',')[0]}c${k.split(',')[1]}:${v}`).join(' '));
}
