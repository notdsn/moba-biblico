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
- **Davi** (Luz · Atirador) — passiva *Pastor Valente*; Funda Certeira, Salmo de Coragem, Passo do Pastor; ult *Fé que Derruba Gigantes*. Build: Sandálias do Peregrino → Arco de Jônatas → Lâmina de Eúde → Espada de Golias → Armadura de Saul.
- **Sansão** (Luz · Lutador · Tanque) — passiva *Voto de Nazireu*; Queixada de Jumento, Força do Leão, Investida; ult *Derrubar as Colunas*. Build: Sandálias do Peregrino → Espada de Golias → Armadura de Saul → Escudo da Fé → Couraça da Justiça.
- **Débora** (Luz · Maga · Suporte) — passiva *Juíza de Israel*; Lança Profética, Palmeira da Justiça, Cântico de Vitória; ult *As Estrelas Pelejaram*. Build: Sandálias do Peregrino → Cetro de Ester → Harpa de Davi → Cajado de Arão → Escudo da Fé.
- **Gideão** (Luz · Assassino · Lutador) — passiva *Valente Guerreiro*; Trombeta de Guerra, Cântaro Quebrado, Velo de Orvalho; ult *Espada do Senhor e de Gideão*. Build: Sandálias do Peregrino → Lâmina de Eúde → Espada de Golias → Arco de Jônatas → Armadura de Saul.
- **Golias** (Trevas · Tanque) — passiva *Gigante de Gate*; Lança de Tecelão, Desafio do Filisteu, Investida do Gigante; ult *Terremoto de Gate*. Build: Sandálias do Peregrino → Armadura de Saul → Couraça da Justiça → Escudo da Fé → Espada de Golias.
- **Faraó** (Trevas · Mago · Controlador) — passiva *Coração Endurecido*; Cajado-Serpente, Praga de Gafanhotos, Trevas Espessas; ult *As Dez Pragas*. Build: Sandálias do Peregrino → Cajado de Arão → Cetro de Ester → Harpa de Davi → Escudo da Fé.
- **Jezabel** (Trevas · Assassina · Maga) — passiva *Coroa Pintada*; Adaga Envenenada, Véu de Sedução, Passo Sombrio; ult *Decreto de Jezreel*. Build: Sandálias do Peregrino → Cetro de Ester → Cajado de Arão → Harpa de Davi → Couraça da Justiça.
- **Nabucodonosor** (Trevas · Lutador) — passiva *Rei de Babilônia*; Golpe Real, Estátua de Ouro, Carga Imperial; ult *Fornalha Ardente*. Build: Sandálias do Peregrino → Espada de Golias → Lâmina de Eúde → Armadura de Saul → Escudo da Fé.

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
- `?q=baixa` — qualidade reduzida para celulares fracos.
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
