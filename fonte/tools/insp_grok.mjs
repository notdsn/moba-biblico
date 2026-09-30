import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/core';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
const d=await io.read(process.argv[2]); const r=d.getRoot();
console.log('ext used', r.listExtensionsUsed().map(e=>e.extensionName));
console.log('asset', JSON.stringify(r.getAsset()));
for (const s of r.listScenes()) { const b=getBounds(s); console.log('scene bounds', b.min.map(v=>v.toFixed(3)), b.max.map(v=>v.toFixed(3))); }
const par=n=>r.listNodes().find(p=>p.listChildren().includes(n));
for (const n of r.listNodes()) { const p=par(n); console.log('node', n.getName(), 'parent', p?p.getName():'-', 'T', n.getTranslation().map(v=>+v.toFixed(3)), 'R', n.getRotation().map(v=>+v.toFixed(3)), 'S', n.getScale().map(v=>+v.toFixed(3)), n.getMesh()?'MESH':'', n.getSkin()?'SKIN':''); }
for (const m of r.listMeshes()) for (const p of m.listPrimitives()) { console.log('prim', m.getName(), 'verts', p.getAttribute('POSITION').getCount(), 'idx', p.getIndices()?.getCount()/3, 'attrs', p.listSemantics().join(','), 'mat', p.getMaterial()?.getName()); const w=p.getAttribute('WEIGHTS_0'), j=p.getAttribute('JOINTS_0'); if (w) { let bad=0, used=new Set(); const a=[],b=[]; for (let i=0;i<w.getCount();i++){ w.getElement(i,a); j.getElement(i,b); const s=a.reduce((x,y)=>x+y,0); if (Math.abs(s-1)>.01) bad++; a.forEach((x,k)=>{ if(x>0) used.add(b[k]); }); } console.log('  weights not normalized:', bad, 'joints used:', [...used].sort((x,y)=>x-y).join(',')); } }
for (const s of r.listSkins()) console.log('skin joints', s.listJoints().length, s.listJoints().map(j=>j.getName()).join(','), 'skeleton', s.getSkeleton()?.getName());
for (const m of r.listMaterials()) console.log('mat', m.getName(), 'base', m.getBaseColorFactor(), 'tex', m.getBaseColorTexture()?.getImage()?.byteLength, m.getBaseColorTexture()?.getMimeType(), 'metal', m.getMetallicFactor(), 'rough', m.getRoughnessFactor(), 'normal', !!m.getNormalTexture(), 'alpha', m.getAlphaMode(), 'double', m.getDoubleSided());
for (const t of r.listTextures()) { console.log('tex', t.getName(), t.getMimeType(), t.getSize(), t.getImage()?.byteLength); }
for (const a of r.listAnimations()) { let dur=0; const tg=new Set(); for (const c of a.listChannels()) { const s=c.getSampler(); const inp=s.getInput(); dur=Math.max(dur, inp.getMax([])[0]); tg.add(c.getTargetNode().getName()+'.'+c.getTargetPath()); } console.log('anim', a.getName(), 'dur', dur.toFixed(2), 'channels', a.listChannels().length, 'keys', a.listChannels()[0]?.getSampler().getInput().getCount(), 'interp', a.listSamplers()[0]?.getInterpolation(), [...tg].slice(0,60).join(' ')); }
// orientação (olhos), movimento de raiz e continuidade dos loops
{
  const prims = r.listMeshes()[0].listPrimitives(); const pos = prims[0].getAttribute('POSITION'); const v=[];
  for (const p of prims) { if (!/Eye|Iris|Pupil/.test(p.getMaterial().getName())) continue; const idx = p.getIndices(); let z=0,y=0,n=0; for (let i=0;i<idx.getCount();i++){ pos.getElement(idx.getScalar(i), v); z+=v[2]; y+=v[1]; n++; } console.log('face', p.getMaterial().getName(), 'meanZ', (z/n).toFixed(3), 'meanY', (y/n).toFixed(3)); }
  // tamanho de mão direita / sling
  for (const a of r.listAnimations()) for (const c of a.listChannels()) { if (c.getTargetPath()!=='translation') continue; const o=c.getSampler().getOutput(); const n=o.getCount(), f=[],l=[]; o.getElement(0,f); o.getElement(n-1,l); let mn=[9,9,9], mx=[-9,-9,-9]; const e=[]; for(let i=0;i<n;i++){o.getElement(i,e); for(let k=0;k<3;k++){mn[k]=Math.min(mn[k],e[k]); mx[k]=Math.max(mx[k],e[k]);}} console.log('rootmotion', a.getName(), c.getTargetNode().getName(), 'first', f.map(x=>x.toFixed(3)), 'last', l.map(x=>x.toFixed(3)), 'range', mn.map((x,k)=>(mx[k]-x).toFixed(3))); }
  for (const a of r.listAnimations()) { let maxd=0, who=''; for (const c of a.listChannels()) { if (c.getTargetPath()!=='rotation') continue; const o=c.getSampler().getOutput(); const n=o.getCount(), f=[], l=[]; o.getElement(0,f); o.getElement(n-1,l); const dot=Math.abs(f.reduce((s,x,i)=>s+x*l[i],0)); const d=2*Math.acos(Math.min(1,dot))*57.3; if(d>maxd){maxd=d; who=c.getTargetNode().getName();} } console.log('loop gap', a.getName(), maxd.toFixed(1)+'°', who); }
}
