# monta a folha de uma veste: padrão x nova (retratos de corpo) + print da partida
import sys
from PIL import Image, ImageDraw, ImageFont
nome_p, nome_v, out = sys.argv[1], sys.argv[2], sys.argv[3]
a = Image.open('/tmp/veste_a.png').convert('RGBA'); b = Image.open('/tmp/veste_b.png').convert('RGBA'); j = Image.open('/tmp/veste_jogo.png').convert('RGB')
H = 720; j = j.resize((int(j.width * H / j.height), H))
W = 2 * 330 + j.width + 40
im = Image.new('RGB', (W, H + 70), (20, 16, 30)); d = ImageDraw.Draw(im)
f = ImageFont.truetype('public/fonts/cinzel-700.woff2', 30) if False else None
try: f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 19)
except: f = ImageFont.load_default()
for i, (img, t) in enumerate([(a, nome_p), (b, nome_v)]):
    fundo = Image.new('RGBA', (330, H), (42, 34, 58, 255) if i == 0 else (58, 30, 80, 255)); s = img.resize((int(img.width * (H - 20) / img.height), H - 20)); fundo.alpha_composite(s, ((330 - s.width) // 2, 10))
    im.paste(fundo.convert('RGB'), (10 + i * 340, 60)); d.text((20 + i * 340, 18), t, fill=(255, 226, 150) if i else (220, 220, 230), font=f)
im.paste(j, (2 * 340 + 20, 60)); d.text((2 * 340 + 30, 18), 'Em partida (iPhone 11)', fill=(220, 220, 230), font=f)
im.save(out); print(out, im.size)
