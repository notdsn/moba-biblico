// Prepara um modelo grande (ex.: Tripo ~10k polígonos, texturas 4K) para o celular:
//   texturas -> no máximo 1024 px em WebP (ou KTX2/UASTC se o `toktx` estiver instalado e --ktx2),
//   remove dados não usados, junta/soldas vértices e comprime a malha com meshopt.
// Uso: node tools/comprimir_modelo.mjs entrada.glb public/models/saida.glb [--max 1024] [--ktx2] [--lod 0.35]
//   --lod 0.35 gera também saida_lod1.glb com ~35% dos triângulos (para registrar como LOD distante).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, resample, textureCompress, meshopt, simplify } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { execSync } from 'node:child_process';
import { consertarCapa } from './capa.mjs';
const [ent, sai, ...args] = process.argv.slice(2);
if (!ent || !sai) { console.log('uso: node tools/comprimir_modelo.mjs entrada.glb saida.glb [--max 1024] [--ktx2] [--lod 0.35]'); process.exit(1); }
const opt = (n, d) => { const i = args.indexOf(n); return i < 0 ? d : args[i + 1]; };
const SIMP = opt('--simp', null), CORTAR = opt('--cortar', null); // --simp 0.3: simplifica a malha principal; --cortar "idle.001:0:3,slash.001:0:3.7": corta clipes (mantém os tempos)
const MAX = +opt('--max', 1024), KTX2 = args.includes('--ktx2'), LOD = opt('--lod', null), MR = +opt('--mr', MAX / 2);
// canais de animação constantes e iguais à pose de repouso (escala 1, translação dos ossos) não fazem nada: remove
const limparCanais = () => (doc) => { let n = 0; for (const a of doc.getRoot().listAnimations()) for (const c of a.listChannels()) {
  const node = c.getTargetNode(), path = c.getTargetPath(); const o = c.getSampler().getOutput(); const k = o.getElementSize(); const rest = path === 'rotation' ? node.getRotation() : path === 'scale' ? node.getScale() : path === 'translation' ? node.getTranslation() : null; if (!rest) continue;
  const v = []; let igual = true; for (let i = 0; i < o.getCount() && igual; i++) { o.getElement(i, v); for (let j = 0; j < k; j++) if (Math.abs(v[j] - rest[j]) > 1e-4) { igual = false; break; } }
  if (igual) { c.dispose(); n++; } }
  for (const a of doc.getRoot().listAnimations()) for (const s of a.listSamplers()) if (!s.listParents().some(p => p.propertyType === 'AnimationChannel')) s.dispose();
  console.log('canais constantes removidos:', n); };
await MeshoptEncoder.ready; await MeshoptSimplifier.ready;
// --permissivo: deixa o simplificador colapsar arestas nas costuras de UV (o atlas do Tripo é muito picado e trava em ~45%)
const SIMP_PERM = { ...MeshoptSimplifier, simplify: (i, p, st, alvo, err, fl = []) => MeshoptSimplifier.simplify(i, p, st, alvo, err, [...fl, 'Permissive']) };
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const info = (d) => { const r = d.getRoot(); let tri = 0; for (const m of r.listMeshes()) for (const p of m.listPrimitives()) tri += (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3; return `${tri | 0} tri, ${r.listTextures().length} texturas (${r.listTextures().map(t => (t.getSize() || []).join('x')).join(', ')})`; };
const doc = await io.read(ent); console.log('entrada:', info(doc));
const cortar = () => (d) => { if (!CORTAR) return; for (const it of CORTAR.split(',')) { const [nome, t0, t1] = it.split(':'); const a = d.getRoot().listAnimations().find(x => x.getName() === nome); if (!a) { console.log('aviso: sem clipe', nome); continue; }
  for (const s of a.listSamplers()) { const i = s.getInput(), o = s.getOutput(); const k = o.getElementSize(); const ti = [], vo = []; const v = [];
    for (let j = 0; j < i.getCount(); j++) { const t = i.getScalar(j); if (t < +t0 - 1e-4 || t > +t1 + 1e-4) continue; ti.push(t); o.getElement(j, v); vo.push(...v); }
    if (ti.length < 2) continue; const ni = d.createAccessor().setType('SCALAR').setArray(new Float32Array(ti)); const no = d.createAccessor().setType(o.getType()).setArray(new Float32Array(vo)); s.setInput(ni).setOutput(no); }
  console.log('cortado', nome, t0, '-', t1); } };
const CAPA = opt('--capa', null); // --capa davi|debora: tira o peso de braço/perna dos vértices da capa (ver tools/capa.mjs)
if (CAPA) await consertarCapa(doc, CAPA);
await doc.transform(dedup(), cortar(), resample(), limparCanais(), prune(), weld());
if (SIMP) { await doc.transform(simplify({ simplifier: args.includes('--permissivo') ? SIMP_PERM : MeshoptSimplifier, ratio: +SIMP, error: +opt('--simperr', .01) })); console.log('malha principal simplificada:', info(doc)); }
// --sem-normal: tira o mapa de normais (tropas pequenas na tela: quase não aparece e economiza ~100 KB)
if (args.includes('--sem-normal')) { for (const m of doc.getRoot().listMaterials()) m.setNormalTexture(null); await doc.transform(prune()); }
// --sem-mr: tira o mapa de metal/rugosidade (tropas usam material fosco uniforme no jogo)
if (args.includes('--sem-mr')) { for (const m of doc.getRoot().listMaterials()) m.setMetallicRoughnessTexture(null).setMetallicFactor(.15).setRoughnessFactor(.62); await doc.transform(prune()); }
let temKtx = false; try { execSync('toktx --version', { stdio: 'ignore' }); temKtx = true; } catch { }
if (KTX2 && !temKtx) console.log('aviso: toktx não encontrado, usando WebP');
if (KTX2 && temKtx) {
  // reduz com sharp e depois converte cada textura para KTX2 (UASTC para normal, ETC1S para cor)
  await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'png', resize: [MAX, MAX] }));
  const { ktx2 } = await import('./ktx2_toktx.mjs'); await ktx2(doc);
} else {
  // metal/rugosidade não precisa de detalhe: metade do tamanho
  await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [MR, MR], quality: 82, slots: /metallicRoughness/ }));
  await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [MAX, MAX], quality: 86, slots: /^(?!metallicRoughness)/ }));
}
const salvar = async (d, arq) => { await d.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' })); await io.write(arq, d); console.log('salvo:', arq, info(d)); };
// LOD1 sem UV/texturas: a cor da textura é "assada" nos vértices (COLOR_0), assim o LOD de longe continua colorido
// (a textura é reduzida a 128 px antes, o que já faz a média da região; nas costuras de UV a cor é a média, para os vértices se soldarem)
async function assarCores(d) { for (const m of d.getRoot().listMeshes()) for (const p of m.listPrimitives()) { const t = p.getMaterial()?.getBaseColorTexture(), uv = p.getAttribute('TEXCOORD_0'); if (!t || !uv) continue;
  const S = 128; const { data } = await sharp(Buffer.from(t.getImage())).resize(S, S).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = uv.getCount(), cor = new Float32Array(n * 4), e = [];
  for (let i = 0; i < n; i++) { uv.getElement(i, e); const x = Math.min(S - 1, Math.max(0, Math.floor(((e[0] % 1) + 1) % 1 * S))), y = Math.min(S - 1, Math.max(0, Math.floor(((e[1] % 1) + 1) % 1 * S))); const o = (y * S + x) * 3;
    for (let c = 0; c < 3; c++) cor[i * 4 + c] = data[o + c] / 255; cor[i * 4 + 3] = 1; }
  // costuras de UV: vértices na mesma posição recebem a mesma cor (média), senão o weld não junta e o simplify trava
  const pos = p.getAttribute('POSITION'), grupos = new Map(); for (let i = 0; i < n; i++) { pos.getElement(i, e); const k = e.map(v => Math.round(v * 1e4)).join(); if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(i); }
  for (const g of grupos.values()) { if (g.length < 2) continue; for (let c = 0; c < 3; c++) { let sm = 0; for (const i of g) sm += cor[i * 4 + c]; const v = sm / g.length; for (const i of g) cor[i * 4 + c] = v; } }
  // glTF: COLOR_0 é linear (a textura é sRGB); guarda em 16 bits normalizados
  const lin = new Uint16Array(n * 4); for (let i = 0; i < n * 4; i++) { const v = cor[i]; lin[i] = Math.round(65535 * ((i & 3) === 3 ? 1 : v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4))); }
  p.setAttribute('COLOR_0', d.createAccessor().setType('VEC4').setArray(lin).setNormalized(true)); p.setAttribute('TEXCOORD_0', null); } }
// LOD1: só a malha simplificada + pele. Sem animações (usa o esqueleto do modelo principal) e sem texturas (usa o material principal).
if (LOD) { const d2 = await io.read(ent); if (CAPA) await consertarCapa(d2, CAPA); for (const a of d2.getRoot().listAnimations()) { for (const c of a.listChannels()) c.dispose(); for (const s of a.listSamplers()) { s.getInput()?.dispose(); s.getOutput()?.dispose(); s.dispose(); } a.dispose(); } await assarCores(d2); for (const m of d2.getRoot().listMaterials()) { m.setBaseColorTexture(null).setNormalTexture(null).setMetallicRoughnessTexture(null); }
  await d2.transform(dedup(), prune(), weld(), simplify({ simplifier: MeshoptSimplifier, ratio: +LOD, error: +opt('--loderr', .01) })); await salvar(d2, sai.replace(/\.glb$/, '_lod1.glb')); }
await salvar(doc, sai);
