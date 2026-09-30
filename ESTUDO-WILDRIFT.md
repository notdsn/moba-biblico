# Estudo: o que aprender com o Wild Rift (e como adaptar do nosso jeito)

Estudo feito em 29/09/2026 com fontes públicas: tabelas de atributos da LoL Wiki (Wild Rift), comentários de desenvolvedores da Riot (reunidos no devtrackers.gg), análises e guias (Game Haus, TheGamer, Reddit r/wildrift) e o guia de estilo de VFX / "Clarity in League" da Riot. **Não copiamos nada**: nomes, modelos, texturas, ícones e efeitos do nosso jogo são originais ou CC0. O estudo serve só para pegar os *princípios* (escala, ritmo, legibilidade).

## 1. O que o Wild Rift faz

| Tema | Wild Rift (valores públicos) | Como estava o nosso |
|---|---|---|
| **Câmera** | Fixa, mais perto que no PC, sem zoom. A Riot conta que escolheu o tamanho da câmera **junto com os alcances**: os tiros mais longos (tipo um "gancho") não passam da borda da tela. Com a câmera mais aberta, os efeitos curtos ficariam pequenos demais. | Câmera próxima: ~1,8 s andando até a borda da tela, contra ~3 s no WR. |
| **Tamanho / espaço** | Campeão com raio ~65 unidades. Corpo a corpo luta a ~175, atiradores a ~550. Sobram uns 3 corpos de espaço entre os dois lados na rota. | Raio 0,75 (≈ 42 u). Proporção parecida. |
| **Velocidade** | 325–355 u/s. Aceleração instantânea, virada rápida, parada seca: o movimento é "responsivo", não escorrega. | 6,0 u/s (≈ 340 u/s na nossa escala). Já estava no ponto. |
| **Alcance do ataque** | Corpo a corpo 175–200. À distância 525–625 (ex.: 525, 550, 625). | Corpo a corpo 2,4–3,2 (≈ 140–180 u). Davi 7,5 (≈ 425 u). |
| **Mira no celular** | Toque rápido = conjura mirando sozinho no inimigo mais perto. Arrastar = mira manual com linha no chão. Arrastar até o "X" cancela. Avanço no toque vai na direção do movimento ou do inimigo. | Só o toque rápido com mira automática. |
| **Identidade do kit** | Cada campeão mistura **1–2 tiros de habilidade** (erráveis), **1 efeito garantido** (alvo) e **1 mobilidade ou defesa** (avanço, escudo). Os controles têm formas diferentes: atordoar, arremessar (knock-up), empurrar, medo, encanto, raiz, provocação. | Quase tudo era "área + dano + lento/atordoar". Os heróis pareciam iguais. |
| **Cores e formas** | Aliado em tons **ciano→roxo**, inimigo em **rosa→laranja**. "O barulho visual acompanha o impacto": controle forte tem aviso (telegraph), cor viva e contorno bem claro. Cada campeão tem **uma cor primária** e uma secundária, com uma "língua de formas" própria (arcos, linhas, anéis, nuvens). | Muitas habilidades usavam o mesmo anel dourado. |

## 2. O que mudamos agora (feito nesta rodada)

1. **Câmera 10% mais aberta** (`CAM_OFF` 11,6/10,4 → 12,8/11,4). Dá para ver as linhas de habilidade inteiras e a luta respira mais.
2. **Alcances pensados para a tela**. O tiro mais longo (Funda Certeira, 15) cabe na tela. Linhas longas (Colunas, 10) têm aviso no chão antes de acertar.
3. **Cada herói com mecânica própria e cor própria**:

| Herói | Cor primária / forma | Assinatura |
|---|---|---|
| **Davi** | dourado · pedra pequena e rápida | *Funda Certeira*: tiro de habilidade longo que **para no 1º inimigo**. Acertou de longe (>60% do alcance) → **atordoa**. Recompensa a mira. |
| **Sansão** | laranja/pedra · arcos e blocos | *Queixada* em arco que **empurra**. *Braço Forte*: avanço que **arremessa para o alto**. *Derrubar as Colunas*: **faixa longa** com aviso de 0,8 s, colunas caindo e **arremesso de 1,3 s**. |
| **Débora** | ciano/verde-palmeira · anéis suaves | Lança que **atravessa** a fila. *Palmeira* que **cura aliados e tropas** na área. *Cântico*: **escudo nos aliados** próximos. É a única suporte de verdade. |
| **Gideão** | amarelo-trombeta/laranja-tocha · ondas sonoras | *Trombeta*: ondas amarelas ao redor que **amedrontam** (o inimigo foge). *Cântaro*: explosão que **queima** por 3 s. Ult: salto com **medo em área**. |
| **Golias** | bronze/terra · linhas pesadas e rachaduras | *Lança de Tecelão*: **estocada em linha** longa. *Desafio*: **provoca**. *Pisão do Gigante*: chão racha e **arremessa para longe**. Ult: terremoto. |
| **Faraó** | verde-serpente/roxo-trevas · nuvens | Serpente que **envenena**. Zona de gafanhotos. *Trevas Espessas*: **enraíza** (não anda, mas ataca). *Dez Pragas*: chuva de pragas + veneno. |
| **Jezabel** | magenta/roxo · corações e véus | Adaga venenosa. *Olhos Pintados*: tiro rosa que **encanta** (o alvo anda até ela). Passo Sombrio (teleporte). *Decreto*: execução marcada. |
| **Nabucodonosor** | vermelho-fogo/ouro · coroas e fornalha | *Guarda da Babilônia*: **invoca 2 guardas** por 10 s. *Carga Imperial*: o único avanço com **atordoar**. *Fornalha*: zona que **queima** quem fica. |

4. **Leitura de controle (CC)**: cada estado tem texto e partícula próprios. *Arremessado* = sobe e cai com poeira. *Amedrontado* = faíscas amarelas e fuga. *Encantado* = corações rosa e caminhada até a fonte. *Enraizado* = fumaça escura nos pés.
5. **Aviso no chão** para habilidades em linha (retângulo que "enche" até o impacto), como o WR faz com CC forte.

## 3. Próximos passos sugeridos (não feitos ainda)

- **Arrastar para mirar** (linha no chão + "X" para cancelar) nos botões de tiro de habilidade. Hoje só temos o toque rápido com mira automática.
- **Travar alvo pelo retrato** do herói inimigo (tocar na foto do inimigo para focar nele).
- **Indicadores por time**: nossas áreas em tons ciano, as do inimigo em rosa/laranja, sem mudar a cor própria de cada herói.
- **Câmera semi-travada** opcional (arrastar a tela para olhar à frente).
- Subir o alcance do ataque do Davi para ~8,5 (≈ 480 u), se ele parecer curto demais depois dos testes com a câmera nova.

## Fontes
- LoL Wiki — módulos de dados do Wild Rift (velocidade de movimento e alcance de ataque dos campeões).
- devtrackers.gg — respostas de desenvolvedores do Wild Rift sobre o tamanho fixo da câmera e os alcances.
- Game Haus — análise da câmera e dos controles do Wild Rift. TheGamer / Reddit r/wildrift — mira rápida, mira manual e cancelamento.
- Riot Games — "VFX Style Guide" (2017) e "Clarity in League" (hierarquia de cores, cores de aliado/inimigo, telegraph de CC).
