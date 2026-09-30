# Ícones do botão de ataque básico (Tripo): ~/Downloads/icones_atk/<heroi>.png -> public/ui/ataques_tripo.webp (atlas 4x2 de 192 px)
# + folha de contato prints/ataques-folha.png. Recorta em círculo; INSET por herói tira anel/margem branca.
import sys, os
from PIL import Image, ImageDraw, ImageFont
H = ['davi', 'sansao', 'debora', 'gideao', 'golias', 'farao', 'jezabel', 'nabuco']
src = os.path.expanduser(sys.argv[1] if len(sys.argv) > 1 else '~/Downloads/icones_atk')
INSET = {h: .025 for h in H}; INSET.update({k.split('=')[0]: float(k.split('=')[1]) for k in sys.argv[2:]})
N, SS = 192, 4
mask = Image.new('L', (N * SS, N * SS), 0); ImageDraw.Draw(mask).ellipse((0, 0, N * SS - 1, N * SS - 1), fill=255); mask = mask.resize((N, N), Image.LANCZOS)
atl = Image.new('RGBA', (N * 4, N * 2), (0, 0, 0, 0))
for i, h in enumerate(H):
    f = next((os.path.join(src, n) for n in (h + '.png', h + '_ataque.png', h + '_atk.png') if os.path.exists(os.path.join(src, n))), None)
    if not f: sys.exit('faltando: ' + h)
    im = Image.open(f).convert('RGB'); w, hh = im.size; s = min(w, hh); x0, y0 = (w - s) // 2, (hh - s) // 2; k = int(s * INSET[h])
    im = im.crop((x0 + k, y0 + k, x0 + s - k, y0 + s - k)).resize((N, N), Image.LANCZOS).convert('RGBA'); im.putalpha(mask)
    atl.paste(im, ((i % 4) * N, (i // 4) * N))
atl.save('public/ui/ataques_tripo.webp', quality=86, method=6)
fs = Image.new('RGB', (4 * 230 + 20, 2 * 250 + 20), (20, 18, 28)); d = ImageDraw.Draw(fs)
try: fnt = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 18)
except Exception: fnt = None
for i, h in enumerate(H):
    x, y = 20 + (i % 4) * 230, 20 + (i // 4) * 250
    fs.paste(atl.crop(((i % 4) * N, (i // 4) * N, (i % 4 + 1) * N, (i // 4 + 1) * N)), (x + 9, y), atl.crop(((i % 4) * N, (i // 4) * N, (i % 4 + 1) * N, (i // 4 + 1) * N)))
    d.text((x + 105, y + 205), h, fill=(240, 220, 160), font=fnt, anchor='mt')
fs.save('prints/ataques-folha.png'); print('ok: public/ui/ataques_tripo.webp e prints/ataques-folha.png — ligue ATK_TRIPO em src/main.js')
