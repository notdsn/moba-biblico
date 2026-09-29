# Créditos e licenças — Prévia 3D "Luz x Trevas"

Todos os modelos 3D usados nesta prévia são **CC0 (domínio público)**. Nada foi gerado por IA.
As fontes são **SIL Open Font License 1.1**. O código (Three.js) é **MIT**.

## Personagens — proporções humanas (CC0 1.0 — https://creativecommons.org/publicdomain/zero/1.0/)

Autor: **Quaternius** (https://quaternius.com). Licença CC0 declarada no `License.txt` de cada pacote. O crédito não é obrigatório, mas fica registrado.

| Uso no jogo | Arquivo original | Pacote / fonte |
|---|---|---|
| Corpo de **Davi**, dos **Guardiões** e das **Sombras** | `Base Characters/Godot - UE/Superhero_Male_FullBody.gltf` (+ texturas `T_Superhero_Male_*`, olhos, sobrancelhas) | Universal Base Characters [Standard] — https://quaternius.com/packs/universalbasecharacters.html · https://quaternius.itch.io/universal-base-characters |
| Cabelo do Davi | `Hairstyles/Rigged to Head Bone/glTF/Hair_SimpleParted.gltf` | mesmo pacote acima |
| Animações (parado, corrida, arremesso da funda, feitiço, rolamento, ataques de espada, escudo, morte, andar de “zumbi” das Sombras) | `UAL1_Standard.glb`: Idle_Loop, Jog_Fwd_Loop, Sprint_Loop, Walk_Loop, Death01, Hit_Chest, Roll, Spell_Simple_Shoot, Sword_Attack, Sword_Idle, Punch_Cross · `UAL2_Standard.glb`: OverhandThrow, Sword_Regular_A/B, Sword_Heavy_Combo, Shield_Dash, Idle_Shield_Loop, Zombie_Idle_Loop, Zombie_Walk_Fwd_Loop, Zombie_Scratch, Melee_Hook, Hit_Knockback | Universal Animation Library 1 e 2 [Standard] — https://quaternius.com/packs/universalanimationlibrary.html · https://quaternius.com/packs/universalanimationlibrary2.html |

Os arquivos originais foram obtidos da cópia pública (CC0) incluída no repositório https://github.com/lluancarlo/ReadyToStrategize (pasta `assets/quaternius/`), idêntica às versões “Standard” gratuitas distribuídas pelo autor.

### O que foi criado por nós em cima da base (designs originais, não são cópias de campeões da Riot)
Pipeline: `tools/build_chars.mjs` (junta corpo + animações, reduz texturas, simplifica a malha das tropas, compressão meshopt) e `src/equip.js` (monta os trajes em tempo de carregamento).
- **Davi — guerreiro de Israel**: túnica vermelho-terracota, **couraça lamelar de bronze** (escamas desenhadas em shader), **ombreiras** em placas sobrepostas com aro de ouro, talabarte de couro na diagonal, **medalhão de ouro** com pedra vermelha no peito, cinto largo com rebites dourados, saiote de tiras de couro (ptéruges), **braçadeiras**, **grevas** e **joelheiras** de bronze, botas/sandálias de couro, **capa carmesim** com broches, tiara de ouro, **escudo redondo** nas costas, **espada curta** na cintura, bolsa de pedras e a **funda** na mão direita (cordas + bolsa + pedra).
- **Guardiões**: couraça de prata com sol dourado no peito, elmo com crista azul e aro de ouro, protetores de rosto, ombreiras, braçadeiras, grevas e joelheiras de prata, saiote azul, capa azul, **escudo azul com sol dourado** e espada. Um pouco menores que o herói (escala 0,81 do Davi).
- **Sombras**: o mesmo corpo, escurecido, com **rachaduras vermelhas brilhantes** (shader), carapaças de obsidiana com bordas incandescentes, chifres, espinhos nos ombros, garras, manto esfarrapado e **olhos vermelhos brilhantes**. Postura curvada (animações de “zumbi”). A Sombra Bruta é maior e usa um gancho de soco. São criaturas das trevas genéricas — **nenhuma figura bíblica aparece como inimiga**.
- Armaduras “de casca” são geradas a partir da própria malha do corpo (recortadas por planos, com frisos dourados nas bordas), por isso acompanham a animação; peças rígidas (ombreiras, elmo, escudo, funda, capa) ficam presas aos ossos. Tudo de um personagem é desenhado em poucos draw calls.

## Cenário (CC0 1.0)

Autor: **Kay Lousberg — KayKit** (www.kaylousberg.com).

| Uso no jogo | Arquivo original | Pacote / fonte |
|---|---|---|
| Árvores, pinheiros dourados, rochas | `tree_single_*`, `trees_*`, `rock_single_*` | KayKit Medieval Hexagon Pack 1.0 — https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0 |
| Árvores secas, pinheiros, lanternas, pilares, arco, cercas quebradas | `tree_dead_*`, `tree_pine_*`, `lantern_standing`, `post_lantern`, `pillar`, `arch`, `fence_broken` | KayKit Halloween Bits 1.0 — https://github.com/KayKit-Game-Assets/KayKit-Halloween-Bits-1.0 |

(Os personagens KayKit “chibi” da versão anterior — Rogue_Hooded, Knight, Skeleton_Minion, Skeleton_Warrior — **não são mais usados**.)

## Feito do zero neste projeto (sem licença de terceiros)
- Torre da Luz (mármore, ouro, chama azul em shader), Torre das Trevas (obsidiana com veios vermelhos e cristal vermelho flutuante), nexos das duas bases.
- Chão, caminho de pedras, tufos de grama com vento, névoa, partículas, projéteis, coluna de luz da ultimate, círculos de runas.
- HUD em HTML/CSS: joystick, botões de habilidade (ícones SVG próprios), minimapa, placar, barras, loja.

## Fontes tipográficas (SIL Open Font License 1.1)
- **Cinzel** — Natanael Gama — https://fonts.google.com/specimen/Cinzel
- **Nunito** — Vernon Adams, Cyreal, Jacques Le Bailly — https://fonts.google.com/specimen/Nunito

## Bibliotecas
- **Three.js** r186 — MIT — https://threejs.org (inclui GLTFLoader, EffectComposer, UnrealBloomPass, SkeletonUtils, decodificador meshopt — MIT)
- **Vite** — MIT (apenas para gerar o build)
- **glTF-Transform** e **meshoptimizer** — MIT (apenas no pipeline de conversão, `tools/`)
