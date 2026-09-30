# Ícones do ataque básico — prompts para o Tripo (Image, 1 imagem por herói = 8 imagens da cota grátis)

Base (colar antes de cada um):
`hand-painted stylized mobile MOBA basic attack icon, single round medallion filling the whole square, dramatic rim light, painterly brush strokes, rich saturated colors, dark navy background, centered subject, same style as a Wild Rift ability icon, no text, no letters, no words, no labels, full-bleed dark background filling the whole square, no white margins, no white ring, no border frame`

| herói | assunto |
|---|---|
| davi | a leather shepherd's sling mid-swing launching a glowing smooth river stone with a golden light trail |
| sansao | a massive bone donkey jawbone weapon smashing forward with a shockwave of dust and golden sparks |
| debora | a prophetess wooden staff topped with a small palm-leaf banner, glowing with soft blue holy light |
| gideao | a bronze short sword crossed with a burning torch breaking out of a clay jar, orange fire sparks |
| golias | a giant bronze spear tip and heavy sword blade, huge and brutal, with red-orange embers |
| farao | a golden Egyptian crook-and-flail scepter with a coiled cobra, green-gold magic glow |
| jezabel | a curved poisoned dagger with purple-pink smoke and dripping green venom |
| nabuco | an ornate Babylonian golden scepter with a lion head, blazing furnace fire behind it |

Salvar como `~/Downloads/icones_atk/<heroi>.png` e rodar:
`python3 tools/atlas_ataques.py ~/Downloads/icones_atk [heroi=0.06 ...]` (o número recorta mais a borda de quem vier com anel/margem),
depois trocar `const ATK_TRIPO = false` para `true` em src/main.js.
