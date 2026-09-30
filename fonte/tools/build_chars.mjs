// Gera os personagens humanos (proporções reais) a partir dos pacotes CC0 da Quaternius:
//  - corpo: Universal Base Characters (Superhero_Male)
//  - animações: Universal Animation Library 1 e 2 (mesmo esqueleto)
// Saída: public/models/heroi.glb (completo), soldado.glb (simplificado p/ tropas), cabelo.glb
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, resample, weld, simplify, meshopt, quantize } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
await MeshoptEncoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const Q = '/tmp/rts/assets/quaternius/';
const BODY = Q + 'Universal Base Characters[Standard]/Base Characters/Godot - UE/Superhero_Male_FullBody.gltf';
const HAIR = Q + 'Universal Base Characters[Standard]/Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)/';
const UAL1 = Q + 'Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb';
const UAL2 = Q + 'Universal Animation Library 2[Standard]/Unreal-Godot/UAL2_Standard.glb';
const CLIPS = {
  1: ['Idle_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Walk_Loop', 'Death01', 'Hit_Chest', 'Roll', 'Spell_Simple_Shoot', 'Sword_Attack', 'Sword_Idle', 'Punch_Cross'],
  2: ['OverhandThrow', 'Sword_Regular_A', 'Sword_Regular_B', 'Sword_Heavy_Combo', 'Shield_Dash', 'Idle_Shield_Loop', 'Zombie_Idle_Loop', 'Zombie_Walk_Fwd_Loop', 'Zombie_Scratch', 'Melee_Hook', 'Hit_Knockback'],
};

async function jpg(tex, size, q = 86) {
  const buf = await sharp(Buffer.from(tex.getImage())).resize(size, size).jpeg({ quality: q }).toBuffer();
  tex.setImage(new Uint8Array(buf)).setMimeType('image/jpeg').setURI(tex.getName() + '.jpg');
}
async function png(tex, size) {
  const buf = await sharp(Buffer.from(tex.getImage())).resize(size, size).png({ compressionLevel: 9, palette: false }).toBuffer();
  tex.setImage(new Uint8Array(buf)).setMimeType('image/png');
}

function copiarAnims(doc, src, nomes, pelvisK) {
  const nodes = new Map(doc.getRoot().listNodes().map(n => [n.getName(), n]));
  const buf = doc.getRoot().listBuffers()[0];
  for (const a of src.getRoot().listAnimations()) {
    if (!nomes.includes(a.getName())) continue;
    const na = doc.createAnimation(a.getName());
    for (const ch of a.listChannels()) {
      const nome = ch.getTargetNode()?.getName(); const path = ch.getTargetPath();
      const alvo = nodes.get(nome); if (!alvo) continue;
      if (path === 'scale') continue;
      if (path === 'translation' && nome !== 'pelvis') continue;   // mantém o comprimento dos ossos do corpo
      const s = ch.getSampler();
      const inp = doc.createAccessor().setType('SCALAR').setArray(s.getInput().getArray().slice()).setBuffer(buf);
      let arr = s.getOutput().getArray().slice();
      if (path === 'translation') for (let i = 0; i < arr.length; i++) arr[i] *= pelvisK;
      const out = doc.createAccessor().setType(s.getOutput().getType()).setArray(arr).setBuffer(buf);
      const ns = doc.createAnimationSampler().setInput(inp).setOutput(out).setInterpolation(s.getInterpolation());
      na.addSampler(ns).addChannel(doc.createAnimationChannel().setTargetNode(alvo).setTargetPath(path).setSampler(ns));
    }
  }
}

async function corpo(saida, { simpl = 0, tex = 1024, normal = true, anims = true, body = BODY }) {
  const doc = await io.read(body);
  const u1 = await io.read(UAL1), u2 = await io.read(UAL2);
  const pz = (d) => d.getRoot().listNodes().find(n => n.getName() === 'pelvis').getTranslation()[2];
  const k = pz(doc) / pz(u1);
  if (anims) { copiarAnims(doc, u1, CLIPS[1], k); copiarAnims(doc, u2, CLIPS[2], k); }
  for (const m of doc.getRoot().listMaterials()) {
    m.setMetallicRoughnessTexture(null).setMetallicFactor(0).setRoughnessFactor(.75);
    if (!normal || !/Superhero/.test(m.getName())) m.setNormalTexture(null);
  }
  // remove atributos extras (UV2..4, cores) para economizar
  for (const me of doc.getRoot().listMeshes()) for (const p of me.listPrimitives()) for (const s of ['TEXCOORD_1', 'TEXCOORD_2', 'TEXCOORD_3', 'COLOR_0', 'COLOR_1']) if (p.getAttribute(s)) p.setAttribute(s, null);
  await doc.transform(prune());
  for (const t of doc.getRoot().listTextures()) {
    const n = t.getName() || t.getURI();
    if (/Normal/.test(n)) await jpg(t, tex, 90); else if (/Eye/.test(n)) await jpg(t, 256); else await jpg(t, tex);
  }
  await doc.transform(weld());
  if (simpl) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: simpl, error: 0.004, lockBorder: true }));
  await doc.transform(resample(), dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await io.write(saida, doc);
}

async function cabelo(nome, saida) {
  const doc = await io.read(HAIR + nome + '.gltf');
  for (const m of doc.getRoot().listMaterials()) m.setNormalTexture(null).setMetallicRoughnessTexture(null).setMetallicFactor(0).setRoughnessFactor(.6);
  for (const me of doc.getRoot().listMeshes()) for (const p of me.listPrimitives()) for (const s of ['TEXCOORD_1', 'TEXCOORD_2', 'TEXCOORD_3', 'COLOR_0', 'COLOR_1']) if (p.getAttribute(s)) p.setAttribute(s, null);
  await doc.transform(prune());
  for (const t of doc.getRoot().listTextures()) await jpg(t, 512);
  await doc.transform(weld(), dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await io.write(saida, doc);
}

const O = 'public/models/';
await corpo(O + 'heroi.glb', { tex: 1024 });
await corpo(O + 'soldado.glb', { simpl: 0.45, tex: 512, normal: false, anims: false }); // animações vêm do heroi.glb
await corpo(O + 'heroi_f.glb', { tex: 1024, anims: false, body: BODY.replace('Male', 'Female') });
for (const h of ['Hair_SimpleParted', 'Hair_Long', 'Hair_Beard', 'Hair_Buzzed', 'Hair_Buns']) await cabelo(h, O + h.toLowerCase().replace('hair_', 'cabelo_') + '.glb');
console.log('ok');
