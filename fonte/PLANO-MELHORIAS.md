# Plano de melhorias — Luz x Trevas (estudo comparado com o Wild Rift)

Feito em 30/09/2026. Referência: Wild Rift no patch 7.3 ("Center Stage", set/2026) + o nosso `ESTUDO-WILDRIFT.md` de 29/09.
Nada aqui foi enviado ao site — é só estudo, plano e mocks (prints em `prints/plano-*.png`).

**Como ler cada item**
- **WR** = o que o Wild Rift faz
- **Nosso** = como está hoje no nosso jogo
- **Proposta** = o que eu faria
- **Esforço**: pequeno (umas horas) · médio (1–2 dias) · grande (3 dias ou mais)
- **Celular**: impacto no iPhone 11 (meta: 60 FPS)

Regras que valem pro plano todo: falar "Unidade" (nunca "célula"), manter o tema bíblico com respeito, e tudo leve no iPhone 11.

---

## 0. O que eu vi jogando uma partida inteira (e testando no iPhone 11 emulado)

Rodei uma partida completa, Davi (piloto automático) contra Golias (computador), além de prints da tela de escolha, do HUD em luta e do fim de jogo. Linha do tempo resumida:

| Tempo | O que aconteceu |
|---|---|
| 1:00 | Davi nível 3 e 2 tropas abatidas; Golias nível 4 e 6 tropas |
| 5:00 | Davi nível 8 e 22 tropas; nenhum abate de herói até aqui |
| 9:00 | Cai a 1ª torre das Trevas |
| 13:00 | Cai a 2ª torre das Trevas; os dois heróis já no nível 15 (máximo) |
| 18:26 | Núcleo das Trevas destruído → vitória da Luz |
| **Placar final** | **0 x 0 em abates de herói. Ninguém morreu na partida inteira.** |

O que ficou evidente:
1. **Ritmo lento e sem briga.** Foram 18,5 min num 1x1 e nenhum herói morreu. O computador quase não troca golpes: só pressiona a 1ª torre da Luz, que ficou em 1734/3500 da metade do jogo até o fim. No WR uma partida 5x5 dura 15–18 min, com dezenas de abates. Num 1x1 o ideal seria **8–12 min**.
2. **Ouro parado no bolso.** Os dois heróis passam muito tempo com 1.000–1.800 de ouro sem gastar, porque só dá pra comprar na base e o computador não volta pra comprar. Aos 18 min o Davi tinha só 2 itens completos.
3. **Ouro por tropa é baixo.** A tropa comum dá 20 e a bruta 35; no WR são 40 (atiradora) e 65 (corpo a corpo). Os itens completos custam 2.500–2.900. Resultado: a "curva de força" fica devagar.
4. **Nível 15 aos 13 min** e depois não há nada novo para ganhar (nem objetivo neutro, nem Dragão).
5. Nenhum erro de JavaScript em nenhuma cena (luta, loja, vitória, escolha).

Arestas que notei nos prints (iPhone 11 deitado):
- **"32 ms" no canto** é texto fixo e falso (o jogo é offline). Passa uma impressão errada.
- **O aviso "Nível N! Toque em + …" fica em cima da luta** e se repete a cada nível. Toma o centro de cima da tela.
- **A barra de vida da torre inimiga** (canto superior direito) fica colada no retrato do Golias. Ao lado do minimapa, a barra azul da torre aliada aparece "cortada".
- **Os números de dano todos iguais**: o rosa "-52" de dano sofrido e o dano causado se confundem, e o crítico quase não se destaca.
- **A fumaça da destruição do Núcleo** cobre tudo por alguns segundos e o herói sai cortado na borda.
- **Na tela de escolha** as descrições das habilidades ficam minúsculas no celular (lá pelos 7 px). Na escolha de lado, o 3º herói aparece cortado nas bordas dos cartões.
- **Chão da rota**: as pedras hexagonais se repetem muito e parecem "piso de banheiro" de perto. Faltam variação e desgaste.
- **As tropas aliadas amontoam em cima do herói** e escondem o Davi (falta separação entre as Unidades).
- **Os botões Recuar/Curar/Clarão** ficam pequenos, e o nome escrito embaixo fica ilegível no iPhone SE.
- **O minimapa não tem toque** (não dá pra tocar e ver outro ponto do mapa nem marcar sinal).

---

## 1. Sensação de golpe ("game feel")

### 1.1 Pausa de impacto (hit-stop)
- **WR**: nos golpes pesados (crítico, ultimate, abate) o jogo "congela" de 40 a 80 ms e o alvo pisca. Por isso o golpe parece ter peso.
- **Nosso**: não tem.
- **Proposta**: um `pausaImpacto(ms)` que diminui o `dt` só da lógica e das animações. A câmera e a interface continuam normais. Valores: 45 ms no crítico, 70 ms no ultimate que acerta herói, 90 ms no abate de herói. Nada em ataque básico comum, pra não ficar "travado".
- **Esforço**: pequeno. **Celular**: zero custo.

### 1.2 Tremor de câmera
- **WR**: é bem leve e só aparece em grandes impactos. Tem opção de desligar.
- **Nosso**: `tremer()` já existe; em alguns poderes está forte demais, e não dá pra desligar.
- **Proposta**: 3 níveis fixos (leve 0,15 / médio 0,3 / forte 0,5), com queda rápida. Em Configurações: "Tremor da tela: ligado/reduzido/desligado".
- **Esforço**: pequeno. **Celular**: zero.

### 1.3 Clarão de acerto (hit flash)
- **WR**: o alvo fica branco por cerca de 1 quadro, e o crítico tem um brilho laranja.
- **Nosso**: `atualizarFlash` existe; na luta com vários inimigos ele quase não se vê.
- **Proposta**: clarão branco de 80 ms em todo acerto de herói. Dourado no crítico, roxo no mágico. Tudo pelo `emissive` do material (sem shader novo). Mock: `prints/plano-dano.png`.
- **Esforço**: pequeno. **Celular**: zero (uniform já existe).

### 1.4 Números de dano
- **WR**: branco = ataque, laranja = crítico (maior, com "!" e um "salto"), azul/roxo = mágico, verdadeiro em branco. O dano que você sofre aparece em vermelho, perto do seu herói. Números seguidos se juntam.
- **Nosso**: `Textos` com classes crit/mag/mal/info/ouro, mas os tamanhos são parecidos e o crítico não salta.
- **Proposta**:
  - crítico 1,6x maior, com "!" e animação de "pulo" (escala 1,4 → 1);
  - mágico em lilás; dano sofrido em vermelho, só em cima do próprio herói;
  - juntar números no mesmo alvo em 0,25 s ("-52" + "-48" vira "-100");
  - limite de 14 textos na tela.
  Mock: `prints/plano-dano.png`.
- **Esforço**: pequeno. **Celular**: até ajuda (menos elementos HTML na tela).

### 1.5 Empurrão (knockback) e peso
- **WR**: empurrão com curva (sai rápido e freia), e o alvo bate em parede.
- **Nosso**: Sansão Q e Golias E empurram, mas com velocidade constante.
- **Proposta**: curva "sai rápido e freia" (easeOutCubic), poeira no chão ao frear, e pausa de impacto de 40 ms.
- **Esforço**: pequeno. **Celular**: zero.

### 1.6 Avisos no chão (telegraphs)
- **WR**: toda área inimiga mostra antes, no chão, onde vai cair, com borda vermelha que "enche" até a hora do impacto. Aliado = azul, inimigo = vermelho.
- **Nosso**: parte dos poderes mostra anel; a cor não segue o time; o ESTUDO de 29/09 já pedia isso.
- **Proposta**: um único aviso por poder, com anel + preenchimento que cresce durante o `atraso`. Azul para aliado, vermelho para inimigo. Reaproveitar os anéis que já estão em pool.
- **Esforço**: médio. **Celular**: baixo (máx. 6 avisos, anéis já em pool).

---

## 2. Movimento e controle

### 2.1 Resposta do analógico
- **WR**: o herói vira quase na hora (virar em ~0,1 s) e o analógico tem zona morta pequena e "trava" o dedo onde tocou.
- **Nosso**: a virada já está suave (commit `54f200e`), mas o analógico é fixo no canto e não segue o dedo.
- **Proposta**: analógico "flutuante" (nasce onde o dedo toca na metade esquerda), zona morta de 8%, e opção "Analógico fixo" nas Configurações.
- **Esforço**: pequeno. **Celular**: zero.

### 2.2 Mirar arrastando (drag-to-aim) com "X" para cancelar
- **WR**: toque rápido = mira automática. Arrastar = mira manual com a linha/área. Arrastar até o "X" no topo cancela.
- **Nosso**: só toque (mira automática). Estava nos próximos passos do ESTUDO.
- **Proposta**: implementar o arrasto com indicador azul, e zona de cancelar em cima (ícone de "X" em pergaminho).
- **Esforço**: médio. **Celular**: zero.

### 2.3 Trava de alvo por retrato
- **WR**: tocar no retrato do inimigo (canto) faz os ataques e habilidades mirarem nele.
- **Nosso**: o retrato do Golias no canto não faz nada.
- **Proposta**: tocar no retrato = travar alvo por 4 s (anel dourado no pé do inimigo).
- **Esforço**: pequeno. **Celular**: zero.

### 2.4 Botões dedicados: "atacar tropa" e "atacar torre"
- **WR**: dois botõezinhos ao lado do ataque para o último golpe (last hit) na tropa e para a torre.
- **Nosso**: o ataque escolhe sozinho, e às vezes bate no herói quando se queria a tropa.
- **Proposta**: 2 botões pequenos (ícone de tropa e de torre) ao redor do ataque. O de tropa mira a tropa com menos vida.
- **Esforço**: pequeno. **Celular**: zero.

### 2.5 Cancelar animação e "andar-atacar"
- **WR**: o ataque básico pode ser cancelado andando, logo depois do disparo. Isso dá o "kite" dos atiradores.
- **Nosso**: o ataque trava o herói até o fim da animação.
- **Proposta**: liberar o movimento assim que o projétil/golpe sai (ponto de disparo), e não no fim da animação. Para o Davi isso muda muito.
- **Esforço**: pequeno. **Celular**: zero.

### 2.6 Separação entre Unidades
- **Nosso**: as tropas aliadas amontoam em cima do herói (visto no print).
- **Proposta**: empurrão suave entre Unidades (raio 0,6), e o herói tem prioridade de passagem.
- **Esforço**: pequeno. **Celular**: baixo (≈30 Unidades, grade simples).

---

## 3. Câmera, gráficos e luz

### 3.1 Câmera
- **WR**: câmera semi-travada que puxa um pouco na direção da mira. Pode arrastar o minimapa para olhar outro ponto. A ultimate de longo alcance afasta um pouco o zoom.
- **Nosso**: segue o herói fixo; não dá pra olhar longe.
- **Proposta**:
  - puxar a câmera 15% na direção da mira ao arrastar habilidade;
  - tocar/arrastar no minimapa move a câmera, e soltar volta ao herói;
  - na tela de morte a câmera segue quem te matou.
- **Esforço**: médio. **Celular**: zero.

### 3.2 Luz e ambiente
- **WR**: cada lado tem uma "temperatura" de cor, o rio brilha, e as bases são bem distintas.
- **Nosso**: o lado da Luz é bonito e verde, e o das Trevas roxo/rosa. Mas o meio da rota não tem transição e o piso se repete.
- **Proposta**:
  - piso com 3 variações de pedra + manchas de terra/grama (decal, sem textura nova grande);
  - uma "faixa do meio" (rio ou vale) marcando a metade do mapa;
  - luz dourada suave do lado da Luz e névoa roxa do lado das Trevas, só pela cor do fog e do ambiente por posição da câmera.
- **Esforço**: médio. **Celular**: baixo. Fica tudo na mesma textura atlas (1 draw call), e a troca de cor é só uniform.

### 3.3 Fumaça da destruição do Núcleo
- **Nosso**: a fumaça cobre a tela por segundos.
- **Proposta**: fumaça menor e mais rápida + câmera que afasta e gira 10° no momento da queda (é o "momento de glória").
- **Esforço**: pequeno. **Celular**: melhora (menos partículas grandes).

---

## 4. Mapa, rota, mato e visão

### 4.1 Mato (brush)
- **WR**: moitas onde o herói some para o inimigo. Isso cria emboscadas e decisões.
- **Nosso**: não tem mato; é só a rota.
- **Proposta**: 4 moitas (2 de cada lado) nas laterais da rota. Quem está dentro fica meio transparente pra si, e invisível pro inimigo até atacar. Bíblico: "moita de junco" (Êx 2:3). O computador precisa "lembrar" a última posição vista.
- **Esforço**: médio. **Celular**: baixo (4 malhas instanciadas).

### 4.2 Selva e objetivo neutro (equivalente a Dragão/Barão)
- **WR**:
  - dragões elementais a partir de 5:00, com bônus de time que acumulam (escudo, roubo de vida, velocidade, +5% de dano);
  - o Dragão Ancião depois de 3 dragões;
  - o Barão aos 12:00, que dá bônus ao time e tropas fortalecidas por 120 s.
- **Nosso**: não tem nada neutro; aos 13 min não há mais o que disputar.
- **Proposta** (respeitosa, sem colocar Deus como "monstro"):
  - **Leão de Timna** (Jz 14:5) aos 3:00, em uma clareira lateral. Quem derrota ganha a **"Força de Nazireu"**: +8% de dano por 90 s.
  - **Urso da Floresta** (1Sm 17:36, "o teu servo feriu o leão e o urso") como segundo neutro, aos 6:00. Dá escudo de 8% da vida.
  - **Leviatã** (Jó 41) a partir de 10:00, ao lado do meio. O time que derrota ganha a **"Arca da Aliança"** por 120 s: as tropas do time ganham escudo e +50% de dano em estruturas, e o "Recuar" fica em 2 s.
  - Todo neutro tem aviso 30 s antes: "O Leviatã desperta em 30 segundos!".
- **Esforço**: grande (novo modelo Tripo por monstro, IA simples de "acampamento"). **Celular**: médio. Precisa só de 1 monstro vivo por vez, usar LOD e desligar a sombra quando fora da tela.

### 4.3 Torres
- **WR** (7.3): tropas de cerco fortes. Derrubar torre dá +dano às tropas aliadas. Há placas de ouro na torre externa (ouro ao bater nela).
- **Nosso**: 2 torres + Núcleo; a torre dá +150 ao cair.
- **Proposta**: **"placas" na 1ª torre**: +40 de ouro a cada 20% de vida tirada até 5:00. Isso premia quem pressiona e acelera o jogo. Mostrar as placas como 5 "pedras" na barra de vida da torre.
- **Esforço**: pequeno. **Celular**: zero.

---

## 5. Inteligência do computador (bot)

### 5.1 Troca de golpes e abates
- **Nosso**: numa partida inteira de 18 min o computador **não matou nem morreu nenhuma vez**. Ele fica em torno das tropas e nunca insiste.
- **WR**: os bots do modo "Contra IA" trocam golpes quando você erra posição, fogem com pouca vida, e dão "ultimate" quando dá pra matar.
- **Proposta**: uma "pontuação de luta" simples, calculada a cada 0,3 s:
  - fatores: minha vida %, vida % do rival, meu nível − nível dele, se estou ou não sob a torre dele, se tenho a ultimate;
  - acima de X = atacar e usar habilidades; abaixo de Y = recuar;
  - uso da ultimate quando o dano estimado ≥ vida do alvo.
  - 3 dificuldades (Fácil/Normal/Difícil) mudam só os limites e o tempo de reação (0,6 / 0,35 / 0,2 s).
- **Esforço**: médio. **Celular**: zero (a lógica já custa ~0,1 ms).

### 5.2 Voltar pra comprar
- **Nosso**: o bot fica com 1.600 de ouro no bolso sem comprar.
- **Proposta**: voltar à base quando o ouro ≥ custo do próximo item e a onda estiver empurrada, ou quando a vida < 35%.
- **Esforço**: pequeno. **Celular**: zero.

### 5.3 Build do bot
- **Nosso**: o Golias termina com componentes soltos (cota, manto, cinto) ocupando espaço.
- **Proposta**: bot segue a mesma "build recomendada" da LOJA e completa um item antes de começar outro.
- **Esforço**: pequeno. **Celular**: zero.

---

## 6. Equilíbrio, economia e ritmo da partida

### 6.1 Ouro
| | WR | Nosso hoje | Proposta |
|---|---|---|---|
| Ouro inicial | 500 | 500 | 500 |
| Ouro passivo | 3,5/s (a partir de 0:20) | 3/s | 3/s (ok) |
| Tropa comum / bruta | 40 / 65 (cerco 85) | 20 / 35 | **30 / 50** + tropa de cerco 70 a cada 3ª onda |
| Abate de herói | 300 (+recompensa por série) | 300 | 300 + recompensa **"Fim da série"** (até +300) |
| Torre | 175 local + 75 global | 150 | 200 + placas (item 4.3) |
| Item completo | ~2.500–3.400 | 2.500–2.900 | manter |

- **Esforço**: pequeno (só números). **Celular**: zero.

### 6.2 Ondas de tropas
- **WR**: 6 tropas a cada 30 s (3 corpo a corpo + 3 atiradoras) e cerco a cada 2–3 ondas. Aos 14 min surgem as super tropas.
- **Nosso**: 4 tropas a cada 25 s (limite de 14 vivas por lado).
- **Proposta**: 4 tropas + **1 "Aríete"** (tropa de cerco, bom tema bíblico: cerco de Jericó) a cada 3ª onda. Tropas ficam 5% mais fortes a cada 3 min. O Aríete dá +50% de dano em torre.
- **Esforço**: médio (modelo Tripo do Aríete). **Celular**: baixo (+1 Unidade a cada 75 s).

### 6.3 Ritmo alvo (1x1)
- **Meta**:
  - 1º abate de herói até 3:00;
  - 1ª torre cai perto de 5:00;
  - partida acaba entre 8 e 12 min.
- **Como**: ouro de tropa maior (6.1), placas (4.3), IA que briga (5.1), neutro aos 3:00 (4.2), e **Núcleo com 3.000 de vida** (hoje 4.500) + regeneração do Núcleo parada depois que a 2ª torre cai.
- **Esforço**: pequeno. **Celular**: zero.

### 6.4 Tempo de renascer
- **Nosso**: 6 + 1,5 × nível (nível 15 = 28,5 s).
- **WR**: começa ~6 s e passa de 40 s no fim.
- **Proposta**: manter até nível 10, mas somar +1 s por minuto depois dos 10 min, pra partida ter "final".
- **Esforço**: pequeno.

### 6.5 Nível máximo
- Nível 15 aos 13 min está ok (igual ao WR). O problema é o que vem depois. Resolve com o neutro 4.2 e com "Poder Máximo": no nível 15, a ultimate ganha um efeito extra pequeno (ex.: Davi "Fé que Derruba Gigantes" deixa uma coluna de luz 1 s a mais).

---

## 7. Habilidades fracas ou repetidas (com sugestões bíblicas)

Hoje há **4 habilidades de "me dou escudo/buff"** quase iguais:
- Davi W: cura + escudo + velocidade de ataque;
- Sansão W: escudo + velocidade de ataque;
- Gideão E: escudo + velocidade;
- Débora E: cura + velocidade + escudo em tropas.

E **2 projéteis de veneno** quase iguais: Faraó Q e Jezabel Q.

| Herói | Hoje | Proposta nova | Por quê |
|---|---|---|---|
| **Sansão W** | Força do Leão (escudo + vel. ataque) | **Portas de Gaza** (Jz 16:3): arranca as portas da cidade e as usa como escudo à frente por 2,5 s (bloqueia projéteis), depois arremessa e empurra | Tira a repetição e dá jogo de "bloquear a funda do Davi" |
| **Gideão E** | Velo de Orvalho (escudo + vel.) | **Cântaros Escondidos** (Jz 7:16): fica oculto por 1,5 s (as tochas dentro dos cântaros). O próximo golpe saindo do oculto amedronta 0,5 s | Assassino precisa de entrada surpresa. Combina com o mato (4.1) |
| **Davi W** | Salmo de Coragem (cura + escudo + vel.) | **Harpa que Acalma** (1Sm 16:23): remove lentidão/atordoamento de si e cura ao longo de 2 s (sem escudo). Mantém a velocidade de ataque | Deixa o Davi com "fuga" de controle, bem de atirador |
| **Jezabel Q** | Adaga Envenenada (igual ao Faraó Q) | **Cartas em Nome do Rei** (1Rs 21:8): carta selada em linha que **silencia** por 1 s e marca o alvo (a ultimate causa +15% nele) | Controle diferente e combo com a ultimate |
| **Faraó Q** | Cajado-Serpente (veneno) | Manter, mas a serpente **pula para um 2º alvo** (como as serpentes do Êx 7:12, que se multiplicam) | Identidade própria |
| **Golias W** | Desafio do Filisteu (provoca + armadura) | Ok, já é única. Só aumentar o raio visível do aviso | — |
| **Nabucodonosor E** | Carga Imperial (avanço + atordoa) | Ok. Diferenciar do Sansão E trocando o atordoar por **"Estátua"** (Dn 3:1): deixa uma estátua dourada no ponto final que bloqueia a passagem por 2 s | Evita "mais um avanço que atordoa" |
| **Débora E** | Cântico (cura + vel. + escudo) | Manter, mas **só em aliados e tropas** (não nela). Débora vira a "suporte" de verdade | Diferencia do Davi W |

- **Esforço**: médio por herói (a parte visual reaproveita `poderes.js`). **Celular**: igual ao atual, cada poder novo com os mesmos limites (QM=.6, máx. 9 anéis).

---

## 8. Tela de carregamento (versus)

- **WR**: tela "VS" com as artes dos 10 heróis em cartões verticais, nome do jogador, título, skin, borda de ranque e dica embaixo; a barra de carregar é por jogador.
- **Nosso**: logo "LUZ x TREVAS", uma barra e uma linha de texto.
- **Proposta**:
  - lado esquerdo: cartão vertical do herói do jogador (arte, nome, título, skin, nome "Edson");
  - lado direito: o do computador;
  - no meio: "VS" dourado;
  - embaixo: uma **dica de jogo** alternando com um **versículo curto** (ex.: "O Senhor é a minha força e o meu escudo" — Sl 28:7). A lista de dicas/versículos fica num arquivo.
  - A barra de carregamento vira a borda do cartão que "enche".
  - Mock: `prints/plano-carregamento.png`.
- **Esforço**: pequeno (as artes saem dos próprios modelos, como na tela de escolha). **Celular**: zero durante a partida. As artes podem ser as mesmas imagens da escolha (webp ~40 KB cada).

---

## 9. HUD e informação na tela

### 9.1 Limpezas rápidas
- Tirar o **"32 ms" falso** (ou trocar por um relógio real do dispositivo).
- Aviso "Nível N!" só **uma vez** (depois só o "+" piscando no botão).
- Afastar a barra de vida da torre do retrato do inimigo.
- Botões Recuar/Curar/Clarão 20% maiores, com o nome só no primeiro minuto.
- **Esforço**: pequeno. **Celular**: zero.

### 9.2 "Ultimate pronta" e subir de nível
- **WR**: o botão da ultimate ganha um brilho circular e um som ao ficar pronta. Ao subir de nível há um brilho dourado no herói e um "+" nos botões.
- **Nosso**: só o texto no topo.
- **Proposta**: anel dourado girando no botão da ultimate + som "shofar curto". Um feixe de luz de 0,4 s no herói ao subir de nível.
- **Esforço**: pequeno. **Celular**: zero (CSS + 1 anel já em pool).

### 9.3 Barra de abates (kill feed) e narrador
- **WR**: faixa no topo com os dois retratos e um ícone. Narrador: "Primeiro Abate", "Abate Duplo/Triplo/Quádruplo/Penta", "Fim da série", "Lendário", "Ace".
- **Nosso**: o banner `#abate` existe, mas não tem narrador nem frases.
- **Proposta** (frases em português com sabor bíblico, voz sintetizada ou só texto + som):

| Evento | Frase |
|---|---|
| Primeiro abate | **"Primeiro sangue na batalha!"** ou **"A primeira pedra foi lançada!"** |
| 2 seguidos | **"Duas vitórias!"** |
| 3 seguidos | **"Três vezes vencedor!"** |
| Série de 5 | **"Imparável como Sansão!"** |
| Série de 8 | **"Lendário! Mil caíram ao teu lado"** (Sl 91:7) |
| Fim da série de alguém | **"A série acabou! O gigante caiu"** |
| Torre | **"Os muros caíram!"** (Js 6:20) |
| Núcleo | **"Vitória! A Luz prevaleceu"** / **"Derrota… mas a luz ainda brilha"** |

- **Esforço**: pequeno. **Celular**: zero (texto + som sintetizado).

### 9.4 Minimapa e sinais (pings)
- **WR**:
  - 4 botões de sinal: Atacar / Perigo / A caminho / Contexto;
  - segurar abre o minimapa;
  - dá pra arrastar o sinal até a habilidade ("ultimate em X s");
  - cada sinal tem som, e há limite contra spam.
- **Nosso**: minimapa só de ver.
- **Proposta**: como é 1x1 contra o computador, o sinal serve mais pra **tocar no minimapa e olhar**. Deixar a roda de sinais para quando houver 2x2 ou 3x3 (ver 13.2).
- **Esforço**: pequeno (olhar) / médio (sinais). **Celular**: zero.

### 9.5 "+ouro" ao abater tropa
- **WR**: moedinha amarela "+20" que sobe do corpo da tropa quando você dá o último golpe, com o som "tlim". O total no canto pulsa.
- **Nosso**: já tem um "+N" simples em texto.
- **Proposta**: moeda dourada desenhada + "+30" em Cinzel dourado, subindo com curva. O contador de ouro do canto pulsa. Se a tropa morrer sem ser o seu golpe (dividido), o texto fica cinza e menor. Som "tlim" curto.
- **Mock**: `prints/plano-ouro.png`.
- **Esforço**: pequeno. **Celular**: zero (HTML já usado).

### 9.6 Animação de voltar (recall)
- **WR**: 8 s com animação própria de cada campeão/skin.
- **Nosso**: 4 s de canal com anel.
- **Proposta**: cada herói ajoelha e ora (anim. já existente "Idle" + pose) e sobe luz dourada em espiral (Luz) ou fumaça roxa (Trevas). Manter 4 s (bom para 1x1).
- **Esforço**: pequeno. **Celular**: baixo.

---

## 10. Loja

- **WR**:
  - itens recomendados em destaque;
  - botão "compra rápida" no HUD, que mostra o próximo item da build com o preço, e 1 toque compra;
  - compras aparecem na tela de morte.
- **Nosso**: LOJA com build recomendada, mas só compra na base, abrindo o menu.
- **Proposta**:
  - **botão de compra rápida** embaixo do ouro (ícone do próximo item + preço). Acende quando dá pra comprar e você está na base ou morto;
  - **"Comprar ao chegar"**: toque fora da base deixa o item "reservado", e ao voltar compra sozinho;
  - mostrar "faltam N" em cima do ícone.
- **Esforço**: pequeno. **Celular**: zero.

---

## 11. Progressão, recompensas e skins

### 11.1 Skins liberadas por objetivos (salvo no aparelho)
- **WR**: skins por loja/passe; tem missões e "Wild Pass".
- **Nosso**: não tem progressão; o localStorage só guarda o FPS.
- **Proposta**: tudo local (`localStorage['lxt.perfil']`), sem compra.

  | Skin | Como liberar |
  |---|---|
  | **Davi — Rei de Israel** (coroa + manto roxo) | Vencer 5 partidas com Davi |
  | **Sansão — Juiz de Dã** | Derrubar 10 torres com Sansão |
  | **Débora — Sob a Palmeira** | Curar 5.000 de vida no total |
  | **Gideão — Tocha dos Trezentos** | 30 abates com Gideão |
  | **Golias — Armadura de Bronze Polido** | Vencer 5 com Golias |
  | **Faraó — Coroa Dupla** | 50 lentidões/raízes aplicadas |
  | **Jezabel — Rainha de Sidom** | Vencer 3 sem morrer |
  | **Nabucodonosor — Rei da Babilônia Dourada** | Destruir 5 Núcleos |

  As skins podem ser **recolorações** do mesmo modelo Tripo: troca de cor na textura (tipo o `tools/recolor.py`) + 1 acessório. Não precisa de modelo novo.
- Ao liberar: tela "Nova veste liberada!" com o herói girando e raios de luz. Mock: `prints/plano-skin.png`.
- **Esforço**: médio. **Celular**: zero na luta; só uma textura trocada.

### 11.2 Perfil e "Caminho do Peregrino" (passe local grátis)
- Nível de conta que sobe com XP de partida (vitória 100, derrota 60, +5 por abate).
- A cada nível, uma recompensa: moldura de retrato, frase de vitória, emote ("Aleluia!", "Amém!"), borda de minimapa.
- **Esforço**: médio. **Celular**: zero.

### 11.3 Missões diárias locais
- 3 por dia, ex.: "Dê 40 últimos golpes", "Derrube 2 torres", "Vença com um herói das Trevas".
- **Esforço**: pequeno. **Celular**: zero.

---

## 12. Fim de partida

- **WR** (7.3):
  - estatísticas em abas (dano, dano sofrido, ouro, tropas, tempo de controle, torres, objetivos);
  - notas S/A/B por papel;
  - MVP para quem venceu, SVP para quem perdeu, e "Derrota Honrosa";
  - medalhas.
- **Nosso**: tabela simples (nível, A/M/A, tropas, ouro, itens) + "Jogar de novo".
- **Proposta**:
  - **nota** (S+, S, A, B, C) calculada por dano, abates, tropas/min, torres, mortes;
  - **medalhas** tipo "Matador de Gigantes" (mais dano), "Muralha" (mais dano sofrido), "Colheita" (mais tropas), "Os Muros Caíram" (mais torres);
  - **MVP** com o retrato grande;
  - gráfico simples de ouro ao longo do tempo (linha Luz x linha Trevas, desenhado em canvas);
  - barra de **XP de conta** enchendo + progresso da skin ("Davi — Rei de Israel: 3/5 vitórias");
  - botões **Jogar de novo** / **Trocar herói** / **Ver estatísticas**.
  - Mock: `prints/plano-fim.png`.
- **Esforço**: médio. **Celular**: zero (tela fora da luta).

---

## 13. Modos e fator "quero jogar de novo"

### 13.1 Dificuldade do computador (Fácil/Normal/Difícil)
- Ver 5.1. **Esforço**: pequeno depois do 5.1.

### 13.2 2x2 com aliado controlado pelo computador
- **WR**: 5x5, e agora 3v3v3 e 1v1 (Rift Trials).
- **Proposta**: começar pelo 2x2 (você + 1 aliado bot contra 2 bots). É o passo que mais aumenta a variedade.
- **Esforço**: grande. **Celular**: médio. Isso dobra os heróis na tela (+~60k triângulos e +10 draw calls, ainda dentro da folga de 55 → ~70).

### 13.3 Modo "Arena rápida" (5 min)
- Sem torres externas, Núcleo com 1.500, heróis começam no nível 6. Bom pra 5 minutos no ônibus.
- **Esforço**: pequeno.

### 13.4 Desafio do dia
- Um confronto fixo por dia (ex.: "Davi x Golias no Difícil") com recompensa de XP extra.
- **Esforço**: pequeno.

---

## 14. Primeiros passos (tutorial e onboarding)

- **WR**:
  - tutoriais guiados (andar, atacar, habilidades, torres, loja);
  - "Treino" com bonecos, controle de nível e ouro;
  - dicas durante a partida nas primeiras vezes.
- **Nosso**: não tem tutorial; a 1ª partida já é contra o bot.
- **Proposta**:
  - **"Campo de Treino de Siló"**: 5 passos de 30 s cada, com setas e o texto em balão de pergaminho:
    1. andar;
    2. atacar um boneco;
    3. usar a funda (Q);
    4. subir habilidade (+);
    5. derrubar uma torre fraca e voltar à base para comprar.
  - Liberado sozinho na 1ª vez (e sempre pelo menu).
  - **Treino livre** (`?treino`): bonecos, botões "Nível +1", "+1000 de ouro", "Recarregar habilidades".
  - **Dicas contextuais** nas 3 primeiras partidas: "Fique atrás das suas tropas perto da torre inimiga", "Você tem ouro! Volte à base (botão Recuar)".
- **Esforço**: médio. **Celular**: zero.

---

## 15. Menus e Configurações

- **Nosso**: engrenagem com só "Contador de FPS".
- **Proposta** (tudo salvo no aparelho), em 4 grupos:
  - **Controles**: analógico fixo/flutuante; tamanho dos botões (90–130%); mira por arrasto liga/desliga; prioridade de alvo (menor vida / mais perto / herói primeiro).
  - **Imagem**: qualidade Automática/Alta/Baixa (hoje só por `?q=baixa`); 30/60 FPS; tremor da tela.
  - **Som**: volume geral, efeitos, música, narrador.
  - **Acessibilidade**: ver seção 16.
- Botão **"Sair da partida"** com confirmação, e pausa real (o jogo é offline, então pode pausar).
- **Esforço**: médio. **Celular**: zero.

---

## 16. Acessibilidade

- **Modo daltônico**: aliado azul × inimigo **laranja** (em vez de vermelho), e anéis com padrão tracejado para inimigo.
- **Texto maior** (100/115/130%), porque no iPhone SE as descrições ficam pequenas demais.
- **Reduzir efeitos**: menos tremor, sem clarão de tela cheia, menos partículas (liga junto o `QM` mais baixo).
- **Vibração** (Android, e iOS quando suportado) em impacto forte, opcional.
- **Legenda do narrador** sempre em texto (já é o padrão proposto).
- **Esforço**: pequeno a médio. **Celular**: "reduzir efeitos" até **melhora** o FPS.

---

## 17. Som e música

- **WR**: música tema no menu, trilha leve na partida que sobe perto de lutas e do fim, sons de interface (tocar, comprar, subir de nível), narrador, e sons diferentes para cada sinal.
- **Nosso**: só sons sintetizados das habilidades (`src/som.js`), sem música e sem interface.
- **Proposta**:
  - **Sons de interface** sintetizados no mesmo `som.js`: toque de botão, comprar ("tlim" de moedas), subir de nível (harpa 3 notas), ultimate pronta (shofar curto), torre caindo (pedra desmoronando);
  - **Música**: 2 faixas curtas em loop (menu e partida), em estilo "harpa + tambor + flauta" do Oriente Médio antigo. Arquivo `.m4a` ~600 KB cada, tocado só depois do primeiro toque (regra do iOS);
  - **Mixagem**: "abaixar" a música 40% quando o narrador fala.
- **Esforço**: médio (a música precisa ser criada ou vir de licença livre). **Celular**: baixo (1 elemento de áudio; a síntese já roda hoje).

---

## 18. Texto em português

- Padronizar os termos:
  - "tropas" (nunca "minions");
  - "Unidade" (nunca "célula");
  - "ultimate" vira **"Poder Supremo"** ou "Ult"; hoje aparece "Ult" na escolha;
  - "A/M/A" vira "Abates/Mortes/Assist." com ícones.
- A escolha de herói tem descrições longas demais para o celular. Deixar **uma linha curta** + "ver mais".
- Revisar as maiúsculas: "EMPURRA", "LANÇA PARA O ALTO", "AMEDRONTAM" funcionam como destaque. Melhor usar **negrito dourado** do que caixa alta.
- Versículos: sempre com a referência (ex.: "Jz 7:20") e numa tradução de domínio público (Almeida Revista e Corrigida 1898/Almeida antiga).
- **Esforço**: pequeno. **Celular**: zero.

---

## 19. Desempenho (manter os 60 FPS do iPhone 11)

- Hoje: ~55 draw calls e ~330 mil triângulos sem poderes; em luta real 60–71 draw calls; lógica ~0,1 ms/quadro.
- Tudo neste plano foi pensado para caber nisso. Regras:
  - toda UI nova em HTML/CSS (fora do WebGL), com no máximo 14 textos flutuando;
  - efeitos novos usam os pools de anéis e partículas que já existem (QM=.6 no celular);
  - neutros e Aríete: 1 malha com LOD, sombra só perto da câmera;
  - skins = troca de textura (sem aumentar triângulos);
  - mato = 1 malha instanciada;
  - música = 1 elemento `<audio>`.
- **Orçamento**: no máximo **75 draw calls** e **400 mil triângulos** em luta, medidos com `tools/poderes_dc.mjs` antes de cada envio.

---

## 20. Pequenos bugs e arestas encontrados

| # | Onde | Problema | Correção | Esforço |
|---|---|---|---|---|
| 1 | HUD | "32 ms" é texto fixo | tirar ou trocar por relógio | pequeno |
| 2 | HUD | aviso "Nível N!" repete e cobre o topo | mostrar só 1 vez | pequeno |
| 3 | HUD | barra da torre inimiga colada no retrato do Golias | descer 3 unidades de tela | pequeno |
| 4 | Luta | tropas aliadas escondem o herói | separação (2.6) | pequeno |
| 5 | Bot | 0 abates em 18 min | IA de luta (5.1) | médio |
| 6 | Bot | ouro parado 1.000–1.800 | voltar pra comprar (5.2) | pequeno |
| 7 | Bot | build com componentes soltos | completar item (5.3) | pequeno |
| 8 | Fim | fumaça do Núcleo cobre a tela | fumaça menor + câmera (3.3) | pequeno |
| 9 | Escolha | textos minúsculos no celular | texto curto + "ver mais" | pequeno |
| 10 | Escolha de lado | 3º herói cortado nas bordas do cartão | recortar/centralizar os 2 principais | pequeno |
| 11 | Ritmo | 18,5 min num 1x1 | seção 6 | pequeno |

---

## 21. Os 10 para fazer primeiro

Escolhidos por **maior efeito na diversão ÷ menor esforço**, sem pesar no iPhone 11:

1. **IA do computador que briga, recua e volta pra comprar** (5.1 + 5.2 + 5.3). Hoje a partida inteira termina 0 x 0; é o que mais tira a graça. *(médio)*
2. **Economia e ritmo** (6.1 + 6.3 + 4.3 placas). Tropas 30/50, Núcleo 3.000, placas na 1ª torre; meta de 8–12 min. *(pequeno)*
3. **Sensação de golpe**: pausa de impacto, clarão de acerto, números de dano com crítico que "pula" (1.1 + 1.3 + 1.4). *(pequeno)*
4. **"+ouro" com moeda e "tlim"** + compra rápida no HUD (9.5 + 10). *(pequeno)*
5. **Limpeza do HUD**: tirar o "32 ms", aviso de nível 1 vez, barra da torre, botões maiores, ultimate pronta brilhando (9.1 + 9.2). *(pequeno)*
6. **Narrador em texto + som**: "A primeira pedra foi lançada!", "Os muros caíram!" (9.3). *(pequeno)*
7. **Tela de carregamento VS** com arte, nome, dica e versículo (8). *(pequeno)*
8. **Tela de fim com nota, medalhas, MVP e progresso** (12). *(médio)*
9. **Skins por objetivo + perfil local** (recolorações; 11.1 + 11.2). *(médio)*
10. **Controle**: mirar arrastando com "X", trava pelo retrato, andar-atacar, analógico flutuante (2.1–2.5). *(médio)*

Logo depois: trocar as habilidades repetidas (7), o Leão de Timna / Leviatã (4.2), o Campo de Treino de Siló (14), música e sons de interface (17), e Configurações/acessibilidade (15–16).

---

## Mocks (prints)
- `prints/plano-carregamento.png`: tela de carregamento VS
- `prints/plano-ouro.png`: "+ouro" ao abater tropa e compra rápida
- `prints/plano-dano.png`: números de dano, crítico e clarão de acerto
- `prints/plano-skin.png`: tela "Nova veste liberada!"
- `prints/plano-fim.png`: tela de fim com nota, medalhas e MVP

Os HTML dos mocks estão em `tools/mocks/*.html` (abrir com `node tools/mocks/print_mocks.mjs`).
