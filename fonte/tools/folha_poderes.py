# junta os tiles de tools/poderes_print.mjs: prints/poderes-<herói>.png (2x2, com rótulos) e prints/poderes-todos.png (8x4)
import sys, json
from PIL import Image, ImageDraw, ImageFont
src, dst = sys.argv[1], sys.argv[2]
H = ['davi', 'sansao', 'debora', 'gideao', 'golias', 'farao', 'jezabel', 'nabuco']
NOMES = json.load(open(sys.argv[3])) if len(sys.argv) > 3 else {}
try: F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22); f2 = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 15)
except Exception: F = f2 = ImageFont.load_default()
def rot(im, txt, fonte):
    d = ImageDraw.Draw(im); w = d.textlength(txt, font=fonte); d.rectangle([0, 0, w + 16, fonte.size + 12], fill=(20, 14, 8)); d.text((8, 5), txt, fill=(255, 225, 150), font=fonte)
todos = Image.new('RGB', (4 * 480, 8 * 270), (0, 0, 0))
for i, h in enumerate(H):
    s = Image.new('RGB', (1920, 1080))
    for j, k in enumerate('qwer'):
        try: im = Image.open(f'{src}/{h}_{k}.png').convert('RGB')
        except FileNotFoundError: continue
        # recorta o miolo da ação (sem HUD das bordas) e amplia um pouco
        c = im.crop((130, 60, 890, 488)).resize((960, 540), Image.LANCZOS)
        t = c.copy(); rot(t, f"{k.upper()} · {NOMES.get(h + '.' + k, '')}", F); s.paste(t, ((j % 2) * 960, (j // 2) * 540))
        m = c.resize((480, 270), Image.LANCZOS); rot(m, f"{h.upper()} {k.upper()} · {NOMES.get(h + '.' + k, '')}", f2); todos.paste(m, (j * 480, i * 270))
    s.save(f'{dst}/poderes-{h}.png')
todos.save(f'{dst}/poderes-todos.png')
