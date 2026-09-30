import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {prune, dedup, resample} from '@gltf-transform/functions';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
const K='/workspace/assets-src/';
const A=K+'KayKit-Character-Pack-Adventures-1.0/addons/kaykit_character_pack_adventures/Characters/gltf/';
const S=K+'KayKit-Character-Pack-Skeletons-1.0/addons/kaykit_character_pack_skeletons/Characters/gltf/';
const H=K+'KayKit-Medieval-Hexagon-Pack-1.0/addons/kaykit_medieval_hexagon_pack/Assets/gltf/';
const W=K+'KayKit-Halloween-Bits-1.0/addons/kaykit_halloween_bits/Assets/gltf/';
const keep=new Set(['Idle','Running_A','Running_B','Throw','1H_Ranged_Shoot','Spellcast_Shoot','Spellcast_Raise','Spellcast_Long','Hit_A','Death_A','Cheer','1H_Melee_Attack_Chop','1H_Melee_Attack_Slice_Diagonal','Walking_A','Unarmed_Idle','Walking_D_Skeletons','Idle_Combat','Running_C','Jump_Full_Short','Unarmed_Melee_Attack_Punch_A','Dodge_Forward','Death_C_Skeletons','Spawn_Ground_Skeletons','Taunt','Hit_B','Death_B']);
const chars={davi:A+'Rogue_Hooded.glb',davi2:A+'Rogue.glb',guardiao:A+'Knight.glb',mago:A+'Mage.glb',sombra:S+'Skeleton_Minion.glb',sombra_guerreiro:S+'Skeleton_Warrior.glb',sombra_mago:S+'Skeleton_Mage.glb'};
for(const [n,f] of Object.entries(chars)){
  const d=await io.read(f);
  for(const a of d.getRoot().listAnimations()) if(!keep.has(a.getName())) a.dispose();
  await d.transform(resample(),prune(),dedup());
  await io.write('public/models/'+n+'.glb',d);
}
const props={};
const walk=async(dir,names)=>{for(const x of names) props[x.split('/').pop()]=dir+x+'.gltf';};
await walk(H+'decoration/nature/',['tree_single_A','tree_single_B','trees_A_small','trees_A_medium','trees_B_medium','trees_B_large','rock_single_A','rock_single_B','rock_single_C','rock_single_D','rock_single_E','hills_A_trees','mountain_A_grass_trees','waterplant_A']);
await walk(H+'decoration/props/',['flag_blue','flag_red','flag_yellow','barrel','crate_A_small','tent','sack']);
await walk(H+'buildings/neutral/',['fence_wood_straight','fence_stone_straight','building_destroyed']);
await walk(W,['tree_dead_large','tree_dead_medium','tree_dead_small','post_lantern','lantern_standing','arch','pillar','fence_broken','bone_A','skull','tree_pine_yellow_large','tree_pine_orange_medium','shrine']);
for(const [n,f] of Object.entries(props)){const d=await io.read(f); await d.transform(prune(),dedup()); await io.write('public/models/'+n+'.glb',d);}
console.log('ok');
