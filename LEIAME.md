# Luz x Trevas — Prévia 3D (Three.js)

Prévia jogável de uma partida estilo Wild Rift com tema bíblico. Não é o jogo completo.

## Rodar
```
npm install
npx vite build          # gera dist/
python3 -m http.server 8765 -d dist   # ou qualquer servidor estático
```
Abra `http://<ip-do-computador>:8765/` no celular (mesma rede Wi-Fi), na horizontal.
Desenvolvimento: `npx vite --host`.

## Controles
- Celular: joystick à esquerda (move o Davi); à direita: Ataque (funda), Funda Certeira, Salmo de Coragem, Passo do Pastor, e a ultimate Fé que Derruba Gigantes. Feitiços: Recuar, Curar, Clarão.
- Teclado: WASD/setas, Espaço/J = ataque, 1–4 (ou Q, E, R, F) = habilidades.

## Parâmetros de URL (para testes)
- `?q=baixa` — qualidade reduzida para celulares fracos.
- `?cap&cena=1|2|3` — modo de captura determinística usado nos prints e no vídeo.

## Estrutura
- `src/main.js` — renderizador, câmera, combate, habilidades, HUD, minimapa.
- `src/world.js` — mapa, torres, vegetação, iluminação local.
- `src/units.js` — unidades (clonagem com esqueleto, animações, dano).
- `src/equip.js` — trajes e armaduras de Davi, Guardiões e Sombras sobre o corpo humano da Quaternius.
- `lab.html` — bancada de testes dos personagens (só no modo de desenvolvimento: `npx vite` → `/lab.html`).
- `src/vfx.js` — partículas, ondas de choque, coluna de luz, números de dano.
- `tools/` — `build_chars.mjs` (gera heroi.glb, soldado.glb e cabelo a partir dos pacotes Quaternius), conversão dos cenários (convert.mjs, patch.mjs) e captura (print.mjs, video.mjs).
