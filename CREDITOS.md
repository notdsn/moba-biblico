# Créditos e licenças — Prévia 3D "Luz x Trevas"

Todos os modelos 3D usados nesta prévia são **CC0 (domínio público)**. Nada foi gerado por IA.
As fontes são **SIL Open Font License 1.1**. O código (Three.js) é **MIT**.

## Personagens — proporções humanas (CC0 1.0 — https://creativecommons.org/publicdomain/zero/1.0/)

Autor: **Quaternius** (https://quaternius.com). Licença CC0 declarada no `License.txt` de cada pacote. O crédito não é obrigatório, mas fica registrado.

| Uso no jogo | Arquivo original | Pacote / fonte |
|---|---|---|
| Corpo masculino de **Davi, Sansão, Gideão, Golias, Faraó, Nabucodonosor**, dos **Guardiões** e das **Sombras** | `Base Characters/Godot - UE/Superhero_Male_FullBody.gltf` (+ texturas `T_Superhero_Male_*`, olhos, sobrancelhas) | Universal Base Characters [Standard] — https://quaternius.com/packs/universalbasecharacters.html · https://quaternius.itch.io/universal-base-characters |
| Corpo feminino de **Débora** e **Jezabel** | `Base Characters/Godot - UE/Superhero_Female_FullBody.gltf` (+ texturas `T_Superhero_Female_*`) | mesmo pacote acima |
| Cabelos e barbas dos heróis | `Hairstyles/Rigged to Head Bone/glTF/Hair_SimpleParted.gltf`, `Hair_Long.gltf`, `Hair_Beard.gltf`, `Hair_Buzzed.gltf`, `Hair_Buns.gltf` | mesmo pacote acima |
| Animações dos 8 heróis e das tropas (parado, corrida, arremesso da funda, feitiço, rolamento, ataques de espada, escudo, morte, andar de “zumbi” das Sombras) | `UAL1_Standard.glb`: Idle_Loop, Jog_Fwd_Loop, Sprint_Loop, Walk_Loop, Death01, Hit_Chest, Roll, Spell_Simple_Shoot, Sword_Attack, Sword_Idle, Punch_Cross · `UAL2_Standard.glb`: OverhandThrow, Sword_Regular_A/B, Sword_Heavy_Combo, Shield_Dash, Idle_Shield_Loop, Zombie_Idle_Loop, Zombie_Walk_Fwd_Loop, Zombie_Scratch, Melee_Hook, Hit_Knockback | Universal Animation Library 1 e 2 [Standard] — https://quaternius.com/packs/universalanimationlibrary.html · https://quaternius.com/packs/universalanimationlibrary2.html |

Os arquivos originais foram obtidos da cópia pública (CC0) incluída no repositório https://github.com/lluancarlo/ReadyToStrategize (pasta `assets/quaternius/`), idêntica às versões “Standard” gratuitas distribuídas pelo autor.

### O que foi criado por nós em cima da base (designs originais, não são cópias de campeões da Riot)
Pipeline: `tools/build_chars.mjs` (junta corpo + animações, reduz texturas, simplifica a malha das tropas, compressão meshopt) e `src/equip.js` + `src/herois3d.js` (montam os trajes em tempo de carregamento).
- **Davi — guerreiro de Israel**: túnica vermelho-terracota, **couraça lamelar de bronze**, ombreiras em placas, medalhão, saiote de tiras de couro, braçadeiras, grevas, **capa carmesim**, tiara de ouro, escudo redondo nas costas, espada curta e a **funda** na mão.
- **Sansão** (Luz): cabelo longo de nazireu, **pele de leão** sobre os ombros, correntes quebradas nos pulsos e a **queixada de jumento** como arma.
- **Débora** (Luz, corpo feminino): profetisa-juíza de branco e azul, diadema com estrela, medalhão da palmeira e **cajado de palmeira**.
- **Gideão** (Luz): couro verde, capuz, **shofar** (trombeta de chifre) nas costas, **cântaro com tocha** na cintura e espada.
- **Golias** (Trevas): gigante (escala 1,3), **couraça de escamas de bronze** até os joelhos, elmo filisteu com cocar de penas, grevas, dardo de bronze nas costas e a **lança enorme** “como o eixo do tecelão” (1Sm 17:5-7).
- **Faraó** (Trevas): nemes listrado azul e dourado com **ureu (naja)** e barba cerimonial, colar largo, saiote de linho e o **cajado-serpente** (Êx 7:10-12).
- **Jezabel** (Trevas, corpo feminino): rainha em vermelho escuro e preto, gola alta, colar e cinto de correntes, coroa, manto e **adagas envenenadas**.
- **Nabucodonosor** (Trevas): rei babilônico com **coroa alta** de lápis-lazúli e rosetas, ombreiras com cabeça de leão, armadura dourada, capa real e **espada larga em brasa** (a fornalha).
- **Guardiões**: couraça de prata com sol dourado no peito, elmo com crista azul e aro de ouro, protetores de rosto, ombreiras, braçadeiras, grevas e joelheiras de prata, saiote azul, capa azul, **escudo azul com sol dourado** e espada. Um pouco menores que o herói (escala 0,81 do Davi).
- **Sombras**: o mesmo corpo, escurecido, com **rachaduras vermelhas brilhantes** (shader), carapaças de obsidiana com bordas incandescentes, chifres, espinhos nos ombros, garras, manto esfarrapado e **olhos vermelhos brilhantes**. Postura curvada (animações de “zumbi”). A Sombra Bruta é maior e usa um gancho de soco. São criaturas das trevas genéricas; do lado das Trevas, as únicas figuras bíblicas são os vilões jogáveis (Golias, Faraó, Jezabel e Nabucodonosor).
- Armaduras “de casca” são geradas a partir da própria malha do corpo (recortadas por planos, com frisos dourados nas bordas), por isso acompanham a animação; peças rígidas (ombreiras, elmo, escudo, funda, capa) ficam presas aos ossos. Tudo de um personagem é desenhado em poucos draw calls.

## Cenário (CC0 1.0)

Autor: **Kay Lousberg — KayKit** (www.kaylousberg.com).

| Uso no jogo | Arquivo original | Pacote / fonte |
|---|---|---|
| Árvores, pinheiros dourados, rochas | `tree_single_*`, `trees_*`, `rock_single_*` | KayKit Medieval Hexagon Pack 1.0 — https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0 |
| Árvores secas, pinheiros, lanternas, pilares, arco, cercas quebradas | `tree_dead_*`, `tree_pine_*`, `lantern_standing`, `post_lantern`, `pillar`, `arch`, `fence_broken` | KayKit Halloween Bits 1.0 — https://github.com/KayKit-Game-Assets/KayKit-Halloween-Bits-1.0 |

(Os personagens KayKit “chibi” da versão anterior — Rogue_Hooded, Knight, Skeleton_Minion, Skeleton_Warrior — **não são mais usados**.)

## Texturas do cenário (CC0 1.0)

Fonte: **ambientCG** (https://ambientcg.com), por Lennart Demes. Todas CC0 (domínio público). O crédito não é obrigatório, mas fica registrado.
Os arquivos foram reduzidos (512–1024 px, JPG) e os mapas de cor foram "neutralizados" (sem tom próprio, brilho médio ~0,55) para servir de **mapa de detalhe**: a cor final continua vindo da paleta do jogo.

| Arquivo no jogo (`public/tex/`) | Uso | Asset original no ambientCG |
|---|---|---|
| `grama_d.jpg`, `grama_n.jpg` | chão de grama (detalhe + relevo) | **Grass004** — https://ambientcg.com/view?id=Grass004 |
| `terra_d.jpg`, `terra_n.jpg` | terra batida nas bordas da rota e nas bases | **Ground054** — https://ambientcg.com/view?id=Ground054 |
| `pedra_d.jpg`, `pedra_n.jpg` | pedras do caminho (rota) | **Rock030** — https://ambientcg.com/view?id=Rock030 |
| `marmore_d.jpg`, `marmore_n.jpg` | mármore das torres, Núcleo e base da Luz | **Marble012** — https://ambientcg.com/view?id=Marble012 |
| `obsidiana_d.jpg` | veios da obsidiana das torres, Núcleo e base das Trevas | **Marble006** — https://ambientcg.com/view?id=Marble006 |
| `rocha_n.jpg` | relevo da obsidiana | **Rock035** — https://ambientcg.com/view?id=Rock035 |

## Feito do zero neste projeto (sem licença de terceiros)
- Torre da Luz (mármore, ouro, chama azul em shader), Torre das Trevas (obsidiana com veios vermelhos e cristal vermelho flutuante), **Núcleos** e fontes das duas bases.
- Chão, caminho de pedras, tufos de grama com vento, névoa, partículas, projéteis, coluna de luz da ultimate, círculos de runas.
- HUD em HTML/CSS: joystick, botões de habilidade, tela de escolha de heróis, LOJA com árvore de receitas, tela de Vitória/Derrota. Ícones de habilidades e itens em SVG próprios; retratos renderizados dos próprios modelos 3D.
- Kits dos heróis, itens e textos (referências bíblicas) escritos para este projeto.

## Fontes tipográficas (SIL Open Font License 1.1)
- **Cinzel** — Natanael Gama — https://fonts.google.com/specimen/Cinzel
- **Nunito** — Vernon Adams, Cyreal, Jacques Le Bailly — https://fonts.google.com/specimen/Nunito

## Bibliotecas
- **Three.js** r186 — MIT — https://threejs.org (inclui GLTFLoader, EffectComposer, UnrealBloomPass, SkeletonUtils, decodificador meshopt — MIT)
- **Vite** — MIT (apenas para gerar o build)
- **glTF-Transform** e **meshoptimizer** — MIT (apenas no pipeline de conversão, `tools/`)

## Modelos Tripo
- Heróis Davi, Sansão, Débora e Gideão; vilões Golias, Faraó, Jezabel e Nabucodonosor; tropas Guardião (Luz) e Sombra (Trevas); torres, Núcleos, fonte, árvore, pedra e coluna; e os 19 ícones de item da LOJA: gerados pelo Edson no Tripo AI (plano Pro, uso comercial).
- Texturas `tex/pintado/*`: derivadas das texturas CC0 do ambientCG (filtro pintado feito por `tools/pintar_texturas.py`).
- Texturas de UI `ui/madeira.webp` e `ui/pergaminho.webp`: originais, geradas processualmente (`tools/pintar_ui.py`).

## VFX realistas (Parte C)
Texturas processadas em `vfx/realista/` (flipbooks WebP/KTX2) e malhas em `models/vfx/`. Fontes e licenças arquivo por arquivo: `vfx/realista/LICENCAS.md` (CC0, Fab Standard License e SEAMPROOF compradas — só arquivos processados, sem os pacotes brutos; imagens Tripo do autor).
