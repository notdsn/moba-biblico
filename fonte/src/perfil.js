// Perfil local (salvo no aparelho), vestes liberadas por objetivos, nota/medalhas do fim de partida,
// narrador (frases), dicas e versículos. Nada vai para servidor: tudo em localStorage.
const CHAVE = 'lxt.perfil';
const P = new URLSearchParams(location.search);
const SALVAR = P.get('perfil') !== '0';
// v2 (tela Perfil): nome, histórico das últimas 10 partidas e mais números por herói. Perfis v1 são completados, nunca apagados.
const vazio = () => ({ v: 2, nome: 'Peregrino', xp: 0, partidas: 0, vitorias: 0, heroi: {}, vestes: {}, equip: {}, vistas: {}, hist: [] });
const HEROI0 = () => ({ partidas: 0, vitorias: 0, abates: 0, torres: 0, cura: 0, controles: 0, semMorrer: 0, nucleos: 0, mortes: 0, assist: 0, pontos: 0, melhor: 0, tempo: 0 });
let mem = null;
export function perfil() {
  if (mem) return mem;
  try { mem = Object.assign(vazio(), JSON.parse(localStorage.getItem(CHAVE) || 'null') || {}); } catch (e) { mem = vazio(); }
  if (!Array.isArray(mem.hist)) mem.hist = []; if (typeof mem.nome !== 'string' || !mem.nome.trim()) mem.nome = 'Peregrino'; mem.v = 2;
  for (const id of Object.keys(mem.heroi)) mem.heroi[id] = Object.assign(HEROI0(), mem.heroi[id]);
  return mem;
}
export function salvarPerfil() { if (!SALVAR) return; try { localStorage.setItem(CHAVE, JSON.stringify(perfil())); } catch (e) { } }
export const statsHeroi = (id) => { const p = perfil(); return p.heroi[id] || (p.heroi[id] = HEROI0()); };
export const nomeJogador = () => perfil().nome;
export function mudarNome(n) { n = String(n || '').replace(/[<>&"]/g, '').trim().slice(0, 16); if (!n) return perfil().nome; perfil().nome = n; salvarPerfil(); return n; }
// apaga tudo deste aparelho (nível, números, histórico e vestes); só é chamado depois da confirmação
export function resetarPerfil() { try { localStorage.removeItem(CHAVE); } catch (e) { } mem = null; return perfil(); }
// XP da conta por partida: vitória/derrota + abates e assistências + nota
export const XP_NOTA = { 'S+': 60, S: 45, A: 30, B: 15, C: 5 };
export function xpPartida({ venceu, abates, assist, notaP }) {
  const partes = [[venceu ? 'Vitória' : 'Derrota', venceu ? 100 : 40], ['Abates', abates * 10], ['Assistências', assist * 4], ['Nota ' + notaP, XP_NOTA[notaP] || 0]].filter(p => p[1] > 0);
  return { total: partes.reduce((s, p) => s + p[1], 0), partes };
}

// ---------- Caminho do Peregrino (nível de conta) ----------
export const XP_CONTA = (n) => 150 + 50 * (n - 1);
export function nivelConta(xp = perfil().xp) { let n = 1, r = xp; while (r >= XP_CONTA(n)) { r -= XP_CONTA(n); n++; } return { nivel: n, resto: r, falta: XP_CONTA(n) }; }

// ---------- vestes (texturas repintadas: só a roupa muda; pele, rosto e cabelo ficam) ----------
// req: campo de statsHeroi + quantidade. tex: textura repintada por tools/skins/pintar_skin.py
export const VESTES = {
  davi: { padrao: 'Pastor de Belém', lista: [{ id: 'rei', nome: 'Rei de Israel', tex: 'models/tripo/skins/davi_rei.webp', campo: 'vitorias', n: 5, req: 'Vencer 5 partidas com Davi', verso: '“E ungiram Davi rei sobre Israel.” — 2Sm 5:3' }] },
  sansao: { padrao: 'O Nazireu', lista: [{ id: 'juiz', nome: 'Juiz de Dã', tex: 'models/tripo/skins/sansao_juiz.webp', campo: 'torres', n: 10, req: 'Derrubar 10 torres com Sansão', verso: '“E julgou a Israel vinte anos.” — Jz 16:31' }] },
  debora: { padrao: 'A Profetisa', lista: [{ id: 'palmeira', nome: 'Sob a Palmeira', tex: 'models/tripo/skins/debora_palmeira.webp', campo: 'cura', n: 5000, req: 'Curar 5.000 de vida com Débora', verso: '“Ela se assentava debaixo da palmeira de Débora.” — Jz 4:5' }] },
  gideao: { padrao: 'O Valente', lista: [{ id: 'tocha', nome: 'Tocha dos Trezentos', tex: 'models/tripo/skins/gideao_tocha.webp', campo: 'abates', n: 30, req: 'Fazer 30 abates com Gideão', verso: '“Espada do Senhor e de Gideão!” — Jz 7:20' }] },
  golias: { padrao: 'O Filisteu', lista: [{ id: 'bronze', nome: 'Bronze Polido', tex: 'models/tripo/skins/golias_bronze.webp', campo: 'vitorias', n: 5, req: 'Vencer 5 partidas com Golias', verso: '“Trazia na cabeça um capacete de bronze.” — 1Sm 17:5' }] },
  farao: { padrao: 'Rei do Egito', lista: [{ id: 'coroa', nome: 'Coroa Dupla', tex: 'models/tripo/skins/farao_coroa.webp', campo: 'controles', n: 50, req: 'Aplicar 50 lentidões ou raízes com Faraó', verso: '“Quem é o Senhor, para que eu ouça a sua voz?” — Êx 5:2' }] },
  jezabel: { padrao: 'Rainha Ímpia', lista: [{ id: 'sidom', nome: 'Rainha de Sidom', tex: 'models/tripo/skins/jezabel_sidom.webp', campo: 'semMorrer', n: 3, req: 'Vencer 3 partidas sem morrer com Jezabel', verso: '“Jezabel, filha de Etbaal, rei dos sidônios.” — 1Rs 16:31' }] },
  josue: { padrao: 'O Comandante', lista: [{ id: 'jerico', nome: 'Conquistador de Jericó', tex: null, campo: 'torres', n: 10, req: 'Derrubar 10 torres com Josué (arte da veste em breve)', verso: '“Eu e a minha casa serviremos ao Senhor.” — Js 24:15' }] },
  elias: { padrao: 'O Tisbita', lista: [{ id: 'manto', nome: 'Manto de Elias', tex: null, campo: 'vitorias', n: 5, req: 'Vencer 5 partidas com Elias (arte da veste em breve)', verso: '“Elias subiu ao céu num redemoinho.” — 2Rs 2:11' }] },
  acabe: { padrao: 'Rei de Samaria', lista: [{ id: 'marfim', nome: 'Casa de Marfim', tex: null, campo: 'vitorias', n: 5, req: 'Vencer 5 partidas com Acabe (arte em breve)', verso: '“A casa de marfim que edificou.” — 1Rs 22:39' }] },
  dalila: { padrao: 'De Soreque', lista: [{ id: 'prata', nome: 'Mil e Cem Moedas', tex: null, campo: 'abates', n: 30, req: 'Fazer 30 abates com Dalila (arte em breve)', verso: '“Cada um de nós te dará mil e cem moedas de prata.” — Jz 16:5' }] },
  herodes: { padrao: 'Rei da Judeia', lista: [{ id: 'purpura', nome: 'Manto de Púrpura', tex: null, campo: 'vitorias', n: 5, req: 'Vencer 5 partidas com Herodes (arte em breve)', verso: '“Herodes, vendo que fora iludido pelos magos…” — Mt 2:16' }] },
  hama: { padrao: 'O Agagita', lista: [{ id: 'anel', nome: 'Anel do Rei', tex: null, campo: 'vitorias', n: 5, req: 'Vencer 5 partidas com Hamã (arte em breve)', verso: '“O rei tirou o anel da sua mão e o deu a Hamã.” — Et 3:10' }] },
  ester: { padrao: 'Rainha da Pérsia', lista: [{ id: 'coroa', nome: 'Para um Tempo Como Este', tex: null, campo: 'cura', n: 8000, req: 'Curar 8.000 com Ester (arte em breve)', verso: '“Quem sabe se não foi para tal tempo como este?” — Et 4:14' }] },
  ninrode: { padrao: 'Rei de Sinar', lista: [{ id: 'babel', nome: 'Construtor de Babel', tex: null, campo: 'abates', n: 50, req: 'Abater 50 heróis com Ninrode (arte em breve)', verso: '“Poderoso caçador diante do Senhor.” — Gn 10:9' }] },
  sarai: { padrao: 'De Ur dos Caldeus', lista: [{ id: 'promessa', nome: 'Mãe das Nações', tex: null, campo: 'abates', n: 50, req: 'Abater 50 heróis com Sarai (arte em breve)', verso: '“Há coisa demasiado difícil para o Senhor?” — Gn 18:14' }] },
  moises: { padrao: 'Servo do Senhor', lista: [{ id: 'sinai', nome: 'Do Monte Sinai', tex: null, campo: 'controles', n: 50, req: 'Aplicar 50 controles com Moisés (arte em breve)', verso: '“O Senhor pelejará por vós.” — Êx 14:14' }] },
  golias2: { padrao: 'Irmão de Golias', lista: [{ id: 'tear', nome: 'Eixo de Tear', tex: null, campo: 'abates', n: 50, req: 'Abater 50 heróis com Lami (arte em breve)', verso: '“A haste da sua lança era como eixo de tecelão.” — 1Cr 20:5' }] },
  balaao: { padrao: 'Filho de Beor', lista: [{ id: 'jumenta', nome: 'Profeta de Petor', tex: null, campo: 'controles', n: 50, req: 'Aplicar 50 controles com Balaão (arte em breve)', verso: '“O Senhor abriu a boca da jumenta.” — Nm 22:28' }] },
  nabuco: { padrao: 'Rei de Babilônia', lista: [{ id: 'ouro', nome: 'Cabeça de Ouro', tex: 'models/tripo/skins/nabuco_ouro.webp', campo: 'nucleos', n: 5, req: 'Destruir 5 Núcleos com Nabucodonosor', verso: '“Tu és a cabeça de ouro.” — Dn 2:38' }] },
};
export const vesteDe = (id, vid) => (VESTES[id] && VESTES[id].lista.find(v => v.id === vid)) || null;
export function vesteLiberada(id, vid) { const p = perfil(); return !!(p.vestes[id] && p.vestes[id].includes(vid)); }
export function vesteEquipada(id) { const q = P.get('veste'); if (q) { const [h, v] = q.split(':'); if (h === id && vesteDe(id, v)) return v; } const v = perfil().equip[id]; return v && vesteLiberada(id, v) ? v : null; }
export function equipar(id, vid) { const p = perfil(); if (vid && !vesteLiberada(id, vid)) return false; p.equip[id] = vid || null; salvarPerfil(); return true; }
export function progressoVeste(id, v) { const s = statsHeroi(id); return { atual: Math.min(v.n, Math.floor(s[v.campo] || 0)), n: v.n }; }
// confere objetivos e devolve as vestes que acabaram de ser liberadas
export function conferirVestes() {
  const p = perfil(); const novas = [];
  for (const [id, V] of Object.entries(VESTES)) for (const v of V.lista) {
    const { atual, n } = progressoVeste(id, v);
    if (atual >= n && !vesteLiberada(id, v.id)) { (p.vestes[id] = p.vestes[id] || []).push(v.id); novas.push({ heroi: id, veste: v }); }
  }
  if (novas.length) salvarPerfil();
  return novas;
}

// ---------- nota, medalhas e MVP ----------
export function pontuacao(h, o) {
  const min = Math.max(1, o.tempo / 60);
  const kda = (h.abates + h.assist * .6) / Math.max(1, h.mortes);
  let s = 30 + Math.min(24, kda * 8) + Math.min(18, h.cs / min * 2.2) + Math.min(14, (h.stats.danoHerois / Math.max(1, o.danoTotal)) * 28) + Math.min(10, h.stats.torres * 3.5);
  if (o.venceu) s += 8; if (h.mortes === 0) s += 4;
  return Math.max(0, Math.min(100, Math.round(s)));
}
export function nota(s) { return s >= 92 ? 'S+' : s >= 80 ? 'S' : s >= 66 ? 'A' : s >= 52 ? 'B' : 'C'; }
export function medalhas(h, rival) {
  const m = [];
  if (h.stats.danoHerois >= rival.stats.danoHerois && h.stats.danoHerois > 0) m.push(['pedra', 'Matador de Gigantes', 'Mais dano a heróis']);
  if (h.cs > rival.cs) m.push(['trigo', 'Colheita Farta', 'Mais tropas abatidas']);
  if (h.stats.torres >= 2) m.push(['muro', 'Os Muros Caíram', `${h.stats.torres} torres derrubadas`]);
  if (h.stats.primeiro) m.push(['estrela', 'A Primeira Pedra', 'Primeiro abate da partida']);
  if (h.stats.danoSofrido > rival.stats.danoSofrido * 1.15) m.push(['escudo', 'Muralha', 'Mais dano sofrido']);
  if (h.mortes === 0 && h.abates > 0) m.push(['coroa', 'Invicto', 'Nenhuma morte na partida']);
  if (h.stats.cura > 1500) m.push(['folha', 'Bálsamo de Gileade', `${Math.round(h.stats.cura).toLocaleString('pt-BR')} de cura`]);
  return m.slice(0, 4);
}

// ---------- narrador ----------
export const NARRADOR = {
  dragao: ['O Dragão foi abatido!', 'Chama do Dragão: mais dano para o time'],
  dragaoSurge: ['O Dragão despertou', 'No poço do rio, ao sul'],
  beemote: ['O Beemote foi domado!', 'Invoque-o para derrubar uma torre'],
  beemoteSurge: ['O Beemote apareceu', 'No poço do rio, ao norte'],
  beemoteInv: ['O Beemote foi invocado!', 'Ele avança contra a torre'],
  leviata: ['O Leviatã foi abatido!', 'As tropas do time ficam mais fortes'],
  leviataSurge: ['O Leviatã emergiu!', 'No poço do rio, ao norte'],
  primeiro: ['A primeira pedra foi lançada!', 'Primeiro abate da batalha'],
  serie2: ['Duas vitórias seguidas!', 'A série começou'],
  serie3: ['Três vezes vencedor!', 'Ninguém o detém'],
  serie5: ['Imparável como Sansão!', 'Cinco abates sem cair'],
  serie8: ['Lendário!', '“Mil cairão ao teu lado” — Sl 91:7'],
  fimSerie: ['A série acabou!', 'O gigante caiu'],
  torre: ['Os muros caíram!', 'Js 6:20'],
  torreAliada: ['Nossa torre caiu!', 'Defenda o Núcleo'],
  nucleoExposto: ['O Núcleo está exposto!', 'Última defesa'],
  muralhas: ['As muralhas enfraquecem!', 'As estruturas recebem mais dano a cada minuto'],
};

// ---------- dicas e versículos (tela de carregamento) ----------
export const VERSOS = [
  '“O Senhor é a minha força e o meu escudo.” — Sl 28:7',
  '“Sê forte e corajoso; não temas.” — Js 1:9',
  '“Tudo posso naquele que me fortalece.” — Fp 4:13',
  '“A batalha é do Senhor.” — 1Sm 17:47',
  '“Não por força nem por violência, mas pelo meu Espírito.” — Zc 4:6',
  '“Se Deus é por nós, quem será contra nós?” — Rm 8:31',
  '“Os que esperam no Senhor renovam as suas forças.” — Is 40:31',
  '“A luz resplandece nas trevas.” — Jo 1:5',
];
export const DICAS = {
  geral: ['Fique atrás das suas tropas perto da torre inimiga: ela mira nas tropas primeiro.', 'Dê o último golpe nas tropas: só assim você ganha o ouro inteiro.', 'Com ouro sobrando, toque em Recuar e compre na base.', 'Toque no retrato do inimigo (canto de cima) para travar a mira nele.', 'Arraste um botão de habilidade para mirar; solte no X para cancelar.', 'Até os 5 minutos, cada pedaço da 1ª torre derrubado dá ouro extra.'],
  davi: ['A Funda Certeira atordoa se acertar de longe. Fique no limite do alcance!', 'Todo 4º ataque do Davi é crítico e deixa o alvo lento.'],
  sansao: ['Quanto menos vida, mais forte o Sansão bate.', 'Braço Forte lança o inimigo para o alto: emende as Colunas.'],
  debora: ['A Palmeira cura suas tropas: plante no meio da luta.', 'Acertar herói com habilidade dá escudo à Débora.'],
  gideao: ['Depois de cada habilidade, o próximo ataque do Gideão é mais forte.', 'A Trombeta amedronta: use para fugir ou para prender o inimigo na torre.'],
  golias: ['Golias recebe 15% menos dano de tudo.', 'Provoque com o Desafio e emende o Terremoto.'],
  farao: ['A Praga de Gafanhotos deixa lento: combine com as Trevas Espessas.', 'O Coração Endurecido dá escudo abaixo de 40% de vida.'],
  jezabel: ['As habilidades da Jezabel batem mais em quem está com menos da metade da vida.', 'O Decreto demora 1,5 s: use quando o inimigo não puder fugir.'],
  josue: ['Bata sempre no mesmo alvo: cada ataque do Josué tira armadura.', 'Sol, Detém-te congela as recargas: use antes da luta começar.'],
  elias: ['Acertar habilidades devolve mana ao Elias.', 'O Carro de Fogo cruza o mapa todo: mire nas rotas laterais.'],
  acabe: ['Ataque o alvo do Dardo para ganhar velocidade.', 'A Flecha de Ramote-Gileade acha sozinha o inimigo mais ferido do mapa.'],
  dalila: ['Cada habilidade que acerta rouba dano de ataque.', 'O Colo de Dalila salta até tropas e monstros: use para fugir ou entrar.'],
  herodes: ['Herodes fica mais resistente quando está sozinho.', 'Use o Sinédrio antes do combo: cada habilidade sai duas vezes.'],
  hama: ['O dano dos ataques do Hamã é sorteado: às vezes vem um golpe enorme.', 'A Forca puxa todos para o centro: emende com o Edito Real.'],
  ester: ['Use o Cetro Estendido atravessando aliados e inimigos ao mesmo tempo.', 'Se Perecer, Pereci: ative quando o inimigo for lançar o controle principal.'],
  ninrode: ['Ataque o mesmo alvo 3 vezes para marcá-lo como presa.', 'Arme armadilhas nas entradas da selva e nos arbustos.'],
  sarai: ['Faça a selva com a passiva: mais dano e ouro nos monstros.', 'Promessa de Isaque: cada abate reinicia tudo, então emende as lutas.'],
  moises: ['As Tábuas da Lei tiram escudos e buffs: guarde para a ult inimiga.', 'Abrir o Mar avisa 2 s antes: use em corredores e para separar o time inimigo.'],
  golias2: ['Puxe com a lança e fique perto: o 3º ataque varre todos à frente.', 'Queda do Gigante prende até quem está imparável.'],
  balaao: ['Amaldiçoe o inimigo antes da cura dele: a cura vira dano.', 'A Profecia mostra todos os inimigos do mapa por um instante.'],
  nabuco: ['Cada abate dá escudo ao Nabucodonosor.', 'Os Guardas da Babilônia ajudam a derrubar torres.'],
};
export const sortear = (l) => l[Math.floor(Math.random() * l.length)];
