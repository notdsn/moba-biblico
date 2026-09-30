# Luz x Trevas — Partida 3D (Three.js)

Partida 1x1 estilo Wild Rift com tema bíblico, jogável no navegador do celular (na horizontal) ou no computador. Você escolhe um lado e um herói; o adversário é um herói do outro lado controlado pelo computador.

## Rodar
```
npm install
npx vite build          # gera dist/
python3 -m http.server 8765 -d dist   # ou qualquer servidor estático
```
Abra `http://<ip-do-computador>:8765/` no celular (mesma rede Wi-Fi), na horizontal.
Desenvolvimento: `npx vite --host`.

## Partida
- **Escolha**: primeiro o lado (Luz ou Trevas), depois o herói. O adversário é sorteado entre os heróis do outro lado.
- **Mapa**: uma rota; cada lado tem **2 torres**, um **Núcleo** e a **fonte** da base (cura rápida, atira em inimigos e libera a LOJA).
- **Tropas**: ondas de 4 (Guardiões da Luz / Sombras das Trevas) a cada 25 s, saindo do Núcleo.
- **Ouro e experiência**: tropas (20/35 de ouro), herói (300), torre (150) e renda passiva. Nível máximo 15; cada nível dá um ponto de habilidade (toque no **+** do botão). A ultimate abre nos níveis 5, 9 e 13 (máx. 3 pontos); as outras vão até 5.
- **Torres**: exigem ordem (torre externa → interna → Núcleo) e priorizam o herói que ataca um herói aliado debaixo delas, com dano crescente.
- **Morte**: tempo de espera que cresce com o nível; renasce na fonte. **Recuar** (4 s canalizando) volta para a base.
- **Fim**: quando um Núcleo cai, aparece **Vitória** ou **Derrota** com placar, tempo, níveis, A/M/A, tropas, ouro e itens.

## Heróis
- **Davi** (Luz · Atirador) — passiva *Pastor Valente*; Funda Certeira (tiro longo que para no 1º inimigo e atordoa se acertar de longe), Salmo de Coragem, Passo do Pastor; ult *Fé que Derruba Gigantes*. Build: Sandálias do Peregrino → Arco de Jônatas → Lâmina de Eúde → Espada de Golias → Armadura de Saul.
- **Sansão** (Luz · Lutador · Tanque) — passiva *Voto de Nazireu*; Queixada de Jumento (arco que empurra), Força do Leão, Braço Forte (avanço que arremessa para o alto); ult *Derrubar as Colunas* (faixa longa com aviso no chão e arremesso). Build: Sandálias do Peregrino → Espada de Golias → Armadura de Saul → Escudo da Fé → Couraça da Justiça.
- **Débora** (Luz · Maga · Suporte) — passiva *Juíza de Israel*; Lança Profética (atravessa a fila), Palmeira da Justiça (cura tropas aliadas), Cântico de Vitória (escudo nos aliados); ult *As Estrelas Pelejaram*. Build: Sandálias do Peregrino → Cetro de Ester → Harpa de Davi → Cajado de Arão → Escudo da Fé.
- **Gideão** (Luz · Assassino · Lutador) — passiva *Valente Guerreiro*; Trombeta de Guerra (medo em área), Cântaro Quebrado (fogo que queima), Velo de Orvalho; ult *Espada do Senhor e de Gideão* (salto com medo). Build: Sandálias do Peregrino → Lâmina de Eúde → Espada de Golias → Arco de Jônatas → Armadura de Saul.
- **Golias** (Trevas · Tanque) — passiva *Gigante de Gate*; Lança de Tecelão (estocada em linha), Desafio do Filisteu (provoca), Pisão do Gigante (racha o chão e arremessa para longe); ult *Terremoto de Gate*. Build: Sandálias do Peregrino → Armadura de Saul → Couraça da Justiça → Escudo da Fé → Espada de Golias.
- **Faraó** (Trevas · Mago · Controlador) — passiva *Coração Endurecido*; Cajado-Serpente (veneno), Praga de Gafanhotos, Trevas Espessas (raiz); ult *As Dez Pragas* (chuva de pragas + veneno). Build: Sandálias do Peregrino → Cajado de Arão → Cetro de Ester → Harpa de Davi → Escudo da Fé.
- **Jezabel** (Trevas · Assassina · Maga) — passiva *Coroa Pintada*; Adaga Envenenada, Olhos Pintados (encanto: o alvo anda até ela), Passo Sombrio; ult *Decreto de Jezreel*. Build: Sandálias do Peregrino → Cetro de Ester → Cajado de Arão → Harpa de Davi → Couraça da Justiça.
- **Nabucodonosor** (Trevas · Lutador) — passiva *Rei de Babilônia*; Golpe Real, Guarda da Babilônia (invoca 2 guardas), Carga Imperial (avanço que atordoa); ult *Fornalha Ardente* (zona que queima). Build: Sandálias do Peregrino → Espada de Golias → Lâmina de Eúde → Armadura de Saul → Escudo da Fé.

## LOJA
- Aberta pelo botão de ouro. **Compra só na base (perto da fonte) ou enquanto estiver morto**; fora disso ela abre só para consulta.
- Abas **Recomendado** (build do herói, com os componentes do próximo item), **Ataque**, **Defesa** e **Habilidade**.
- **Componentes** (400–500) se combinam em **itens completos** (2.500–2.900), como no Wild Rift: a árvore de receita mostra os componentes, quais você já tem e o custo que falta. Vender (também só na base) devolve 70%.
- Até 6 espaços. Itens completos têm passivas (roubo de vida, escudo, cura, lentidão etc.).

## Bot
Segue a rota com as tropas, farma, luta quando está em vantagem, usa as habilidades e a ultimate, respeita a torre inimiga (só entra quando as tropas estão tanqueando), foge e usa Curar/Clarão com pouca vida, recua para a base para curar e comprar, e renasce após morrer.

## Controles
- Celular: joystick à esquerda; à direita: Ataque, 3 habilidades + ultimate (com **+** para evoluir), feitiços Recuar, Curar e Clarão. Mira automática no alvo mais próximo.
- Teclado: WASD/setas, Espaço/J = ataque, 1–4 (ou Q, E, R, F) = habilidades, H = recuar, C = curar, X = clarão, B = LOJA.

## Parâmetros de URL (para testes)
- `?heroi=davi&vs=golias` — começa direto a partida com esses heróis (ids: davi, sansao, debora, gideao, golias, farao, jezabel, nabuco).
- `?q=baixa` — qualidade reduzida para celulares fracos (sem MSAA/SMAA, sem mapas de relevo, sombras menores).

## iPhone / Safari
- `viewport-fit=cover`: minimapa, LOJA, joystick, placar, painel, habilidades e feitiços respeitam `env(safe-area-inset-*)` (notch, Dynamic Island e barra de início), na horizontal e na vertical.
- Altura em `100dvh` (barra do Safari não corta o HUD); zoom de pinça/toque duplo, seleção de texto e menu de toque longo desligados (`public/ios.js`).
- Na vertical aparece a tela "Gire o celular". No iPhone (fora do modo app) aparece uma dica para **Compartilhar → Adicionar à Tela de Início**, que abre o jogo em tela cheia (o Safari do iOS não tem API de tela cheia); `manifest.webmanifest` + metas `apple-mobile-web-app-*`.
- Resolução limitada no celular (até 1,5× e ~1,1 milhão de pixels) para manter o desempenho em telas DPR 3.
- Teste: `node tools/iphone.mjs <url> <saida.png> "iPhone 11" land|port 1 896 414 2` (Playwright WebKit; simula as áreas seguras).

## Gráficos
- Antisserrilhado: MSAA (4× no PC, 2× no celular) + SMAA no PC; nada disso no `?q=baixa`.
- Texturas CC0 do ambientCG (grama, terra, pedra da rota, mármore, obsidiana) usadas como **mapas de detalhe** sobre a paleta do jogo, com mapas de relevo (normal maps).
- Sombras suaves (PCF com raio), luz hemisférica quente/roxa para sombreamento mais macio, câmera 10% mais aberta.
- Estudo de referência: `ESTUDO-WILDRIFT.md`.
- `?auto` — o computador controla também o seu herói (demonstração).
- `?cap&cena=sel|luta|loja|vitoria` — modo de captura determinística usado nos prints e no vídeo.

## Estrutura
- `src/main.js` — partida: heróis, tropas, torres, combate, habilidades, bot, LOJA, escolha de heróis, HUD, fim de jogo.
- `src/dados.js` — dados dos heróis (atributos, passivas, habilidades), itens, receitas e builds; ícones SVG.
- `src/world.js` — mapa, torres, Núcleos, fontes, vegetação, iluminação local.
- `src/units.js` — unidades (clonagem com esqueleto, animações).
- `src/equip.js` e `src/herois3d.js` — trajes e armaduras dos 8 heróis e das tropas sobre os corpos humanos da Quaternius.
- `src/vfx.js` — partículas, ondas de choque, projéteis, números de dano.
- `lab.html` — bancada de testes dos personagens (só no modo de desenvolvimento).
- `tools/` — `build_chars.mjs` (gera heroi.glb, heroi_f.glb, soldado.glb e cabelos a partir dos pacotes Quaternius), conversão dos cenários e captura/testes (print.mjs, video2.mjs, sim.mjs, fluxo.mjs).

## Desempenho (meta: 60 FPS no iPhone 11)
- **Menos draw calls**: as peças estáticas das torres, dos Núcleos e das fontes foram juntadas por material. As rochas e os pinheiros recoloridos agora compartilham material, o que permite juntar a vegetação por trecho do mapa. A névoa e o brilho do chão viraram 2 `InstancedMesh`, no lugar de 30 planos.
- **Sombras no celular**: um mapa de 1024 px redesenhado em quadros alternados. As tropas usam sombra "blob" (uma `InstancedMesh`) em vez de sombra real.
- **Resolução dinâmica**: abaixo de 55 FPS a resolução cai 0,1 (mínimo 0,75x no celular). Com 59 FPS ou mais por 3 s, ela volta a subir.
- **Culling**: personagens fora da câmera não são desenhados nem projetam sombra (esfera folgada), e a animação deles roda a 10 Hz.
- **Pools**: os projéteis são reaproveitados. As partículas usam buffers fixos com limite (750/340 no celular, 500/220 no `?q=baixa`).
- **Contador de FPS**: pela engrenagem (fica salvo no aparelho) ou por `?fps`. Mostra FPS, ms, draw calls, triângulos e resolução.
- **Modelos novos (Tripo)**: rode `node tools/comprimir_modelo.mjs entrada.glb public/models/nome.glb --max 1024 --lod 0.35`. As texturas saem em WebP de até 1024 px (ou KTX2 com `--ktx2` e o `toktx` instalado), a malha é comprimida com meshopt e sai também um `_lod1.glb`. No carregamento, `reduzirTexturas()` ainda reduz a 1024 px qualquer textura maior. O KTX2Loader já está ligado (transcoder em `public/basis/`). `juntarLOD()` pendura o LOD no mesmo esqueleto.

## Modelos Tripo (heróis) e estilo pintado
- Davi, Sansão, Débora e Gideão usam por padrão os modelos feitos no Tripo Pro (`public/models/tripo/<id>.glb` + `<id>_lod1.glb`), comprimidos com `node tools/comprimir_modelo.mjs` (WebP 1024, MR 512, meshopt, LOD1 ~35%).
- Clipes originais: `idle.001`, `run.001`, `slash.001`, `fall.001` → mapeados em `aliasTripo` (main.js) para Idle / Run (+Dash/Roll) / Attack e Cast (trechos do slash, re-temporizados) / Death.
- Vilões (golias, farao, jezabel, nabuco) seguem o mesmo caminho dos heróis. Tropas (`guardiao`, `sombra`; o bruto é a Sombra tingida) ficam abaixo de 600 KB: textura 512, sem normal map nem MR, malha simplificada, clipes cortados, LOD1 com cor assada nos vértices (troca a 19 m no celular) e o mixer atualizado a 15–31 Hz quando longe ou no celular.
- Props do Tripo (`public/models/tripo/props/`): torres, Núcleos e fonte são peças únicas (a torre em ruína é achatada); árvore, pedra e coluna são `InstancedMesh` por trecho de 16 m e por lado da rota, com cor por instância (Luz/Trevas). Árvores e pedras longe da câmera usam o `_lod1` com cor nos vértices; a sombra das árvores vem da malha LOD. O Núcleo das Trevas veio com 2 milhões de triângulos e foi reduzido a 14 mil.
- Ícones de item: atlas `public/ui/itens_tripo.webp` (5×4, 256 px cada), usado por `iconeItem()` (LOJA, inventário, árvore de receita, build recomendada).
- `tools/dc_luta.mjs <url>` mede draw calls e triângulos por quadro no iPhone 11 emulado; `vitrine.html?m=tripo/props/arvore,...` mostra modelos lado a lado.
- Celular (60 FPS no iPhone 11): resolução máx. 1,3x (~750 mil px), resolução dinâmica que desce em 0,5 s e só sobe após 8 s estáveis (sem ficar realocando buffers), sem bloom, só heróis projetam sombra (tropas usam sombra-blob), props com textura 512, árvores em 3 níveis (4,6k / 1,2k / 0,6k tri; o nível alto só no fundo da rota), trechos longe além da névoa não são desenhados, 1000 tufos de grama, shaders pré-compilados ao carregar. `?q=baixa` é ainda mais leve (árvores e pedras sempre no nível baixo, 700 tufos).
- Corrida suave: `fecharLoop()` fecha a emenda dos clipes em loop (o run do Tripo pulava ~19° no braço a cada ciclo), velocidade do clipe acompanha a velocidade real em todo quadro, joystick filtrado, histerese entre parado e correndo, o seu herói anima em todo quadro. `node tools/suavidade.mjs <url>` mede os trancos.
- `?modelos=antigos` volta aos modelos antigos (heróis, vilões, tropas, props e ícones) **e** ao visual antigo; `?estilo=antigo` mantém os modelos Tripo, mas volta ao visual antigo.
- Estilo pintado: `public/tex/pintado/*` (gerado por `tools/pintar_texturas.py`), `public/ui/madeira.webp` / `pergaminho.webp` (`tools/pintar_ui.py`), CSS `html.pintado`, luzes mais quentes, bloom/saturação mais suaves.
