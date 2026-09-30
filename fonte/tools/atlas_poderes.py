# monta o atlas de partículas dos poderes (4x4 células de 256 px, RGBA) a partir das texturas aditivas do Tripo (fundo preto)
# + formas desenhadas aqui (coração, folha, gafanhoto, lasca, espinho, nota, risco, caco de cântaro).
# uso: python3 tools/atlas_poderes.py <pasta img do Tripo> <saída .webp>
import sys, math, random
from PIL import Image, ImageDraw, ImageFilter
src, out = sys.argv[1], sys.argv[2]
C, S = 256, 4  # célula, supersample
atlas = Image.new('RGBA', (C * 4, C * 4), (0, 0, 0, 0))
def poe(i, im): atlas.paste(im, ((i % 4) * C, (i // 4) * C))
def aditiva(nome):  # preto -> transparente: alfa = canal máximo, cor "despremultiplicada"
    im = Image.open(f'{src}/{nome}.png').convert('RGB').resize((C, C), Image.LANCZOS); px = im.load(); o = Image.new('RGBA', (C, C)); po = o.load()
    for y in range(C):
        for x in range(C):
            r, g, b = px[x, y]; m = max(r, g, b)
            po[x, y] = (0, 0, 0, 0) if m < 3 else (min(255, r * 255 // m), min(255, g * 255 // m), min(255, b * 255 // m), m)
    return o
def tela(): return Image.new('RGBA', (C * S, C * S), (0, 0, 0, 0))
def fim(im, blur=0):
    im = im.resize((C, C), Image.LANCZOS)
    return im.filter(ImageFilter.GaussianBlur(blur)) if blur else im
# 0 brilho redondo (o mesmo perfil do texBrilho)
g = Image.new('RGBA', (C, C)); p = g.load()
for y in range(C):
    for x in range(C):
        d = math.hypot(x - 127.5, y - 127.5) / 128; a = max(0, 1 - d); a = a * a * (3 - 2 * a)
        p[x, y] = (255, 255, 255, int(255 * a))
poe(0, g)
for i, n in enumerate(['luz', 'fogo', 'faisca', 'fumaca_trevas', 'raio', 'cura', 'anel_impacto']): poe(1 + i, aditiva(n))
W = C * S
# 8 coração
im = tela(); d = ImageDraw.Draw(im); pts = []
for k in range(200):
    t = k / 200 * 2 * math.pi; x = 16 * math.sin(t) ** 3; y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
    pts.append((W / 2 + x * W / 38, W / 2 - y * W / 38 - W * .03))
d.polygon(pts, fill=(255, 255, 255, 255)); poe(8, fim(im, .6))
# 9 folha (com nervura)
im = tela(); d = ImageDraw.Draw(im); pts = []
for k in range(101):
    t = k / 100; w = math.sin(t * math.pi) ** .8 * W * .2; pts.append((W * .12 + t * W * .76, W / 2 - w))
for k in range(100, -1, -1):
    t = k / 100; w = math.sin(t * math.pi) ** .8 * W * .2; pts.append((W * .12 + t * W * .76, W / 2 + w))
d.polygon(pts, fill=(255, 255, 255, 255)); d.line([(W * .1, W / 2), (W * .86, W / 2)], fill=(170, 170, 170, 255), width=W // 60)
for k in range(1, 6):
    x = W * (.18 + k * .12); d.line([(x, W / 2), (x + W * .07, W / 2 - W * .1)], fill=(190, 190, 190, 255), width=W // 110); d.line([(x, W / 2), (x + W * .07, W / 2 + W * .1)], fill=(190, 190, 190, 255), width=W // 110)
poe(9, fim(im.rotate(35, resample=Image.BICUBIC), .5))
# 10 gafanhoto (silhueta: corpo, cabeça, asas translúcidas, patas)
im = tela(); d = ImageDraw.Draw(im); u = W / 100
d.ellipse([30 * u, 44 * u, 78 * u, 56 * u], fill=(255, 255, 255, 255)); d.ellipse([72 * u, 42 * u, 86 * u, 55 * u], fill=(255, 255, 255, 255))
d.polygon([(40 * u, 46 * u), (70 * u, 44 * u), (55 * u, 18 * u), (38 * u, 24 * u)], fill=(255, 255, 255, 150)); d.polygon([(42 * u, 54 * u), (72 * u, 56 * u), (57 * u, 82 * u), (40 * u, 76 * u)], fill=(255, 255, 255, 150))
for a, b in [((50, 55), (40, 70)), ((40, 70), (30, 66)), ((60, 55), (66, 72)), ((66, 72), (58, 80)), ((82, 45), (94, 34)), ((82, 45), (96, 40))]:
    d.line([(a[0] * u, a[1] * u), (b[0] * u, b[1] * u)], fill=(255, 255, 255, 255), width=int(2.2 * u))
poe(10, fim(im, .4))
# 11 lasca de pedra (poligonal com face clara/escura)
im = tela(); d = ImageDraw.Draw(im); random.seed(3)
pts = [(W / 2 + math.cos(a) * W * r, W / 2 + math.sin(a) * W * r) for a, r in [(k / 7 * 6.283 + random.uniform(-.25, .25), random.uniform(.26, .42)) for k in range(7)]]
d.polygon(pts, fill=(200, 200, 200, 255)); d.polygon([pts[0], pts[1], pts[2], (W / 2, W / 2)], fill=(255, 255, 255, 255)); d.polygon([pts[4], pts[5], (W / 2, W / 2)], fill=(140, 140, 140, 255))
poe(11, fim(im, .5))
# 12 espinho (ramo curvo com espinhos)
im = tela(); d = ImageDraw.Draw(im); pts = []
for k in range(41):
    t = k / 40; pts.append((W * (.1 + .8 * t), W * (.62 - .25 * math.sin(t * math.pi))))
d.line(pts, fill=(255, 255, 255, 255), width=W // 28)
for k in range(2, 39, 6):
    x, y = pts[k]; s = 1 if (k // 6) % 2 else -1; d.polygon([(x - W * .03, y), (x + W * .03, y), (x + W * .01, y - s * W * .14)], fill=(255, 255, 255, 255))
poe(12, fim(im, .4))
# 13 onda sonora / nota (três arcos + nota musical)
im = tela(); d = ImageDraw.Draw(im)
for k, a in enumerate([255, 200, 140]):
    r = W * (.18 + k * .12); d.arc([W * .3 - r, W / 2 - r, W * .3 + r, W / 2 + r], -50, 50, fill=(255, 255, 255, a), width=W // 22)
d.ellipse([W * .12, W * .56, W * .26, W * .68], fill=(255, 255, 255, 255)); d.line([(W * .25, W * .62), (W * .25, W * .3)], fill=(255, 255, 255, 255), width=W // 40); d.line([(W * .25, W * .3), (W * .33, W * .36)], fill=(255, 255, 255, 255), width=W // 40)
poe(13, fim(im, .6))
# 14 risco (rastro alongado, horizontal, com cabeça brilhante)
g = Image.new('RGBA', (C, C)); p = g.load()
for y in range(C):
    for x in range(C):
        t = x / (C - 1); w = .03 + .09 * t; dy = abs(y - 127.5) / 128
        a = max(0, 1 - dy / w) * (t ** 1.4) * min(1, (1 - t) * 12); p[x, y] = (255, 255, 255, int(255 * min(1, a)))
poe(14, g)
# 15 caco de cântaro (barro curvo com borda)
im = tela(); d = ImageDraw.Draw(im)
d.pieslice([W * .08, W * .1, W * .92, W * .94], 200, 290, fill=(255, 255, 255, 255)); d.pieslice([W * .26, W * .28, W * .74, W * .76], 190, 300, fill=(0, 0, 0, 0))
d.arc([W * .08, W * .1, W * .92, W * .94], 200, 290, fill=(180, 180, 180, 255), width=W // 30)
poe(15, fim(im.rotate(-20, resample=Image.BICUBIC), .4))
atlas.save(out, 'WEBP', quality=86, method=6)
atlas.resize((512, 512), Image.LANCZOS).save(out.replace('.webp', '_512.webp'), 'WEBP', quality=86, method=6)
prev = Image.new('RGB', atlas.size, (30, 30, 36)); prev.paste(atlas, (0, 0), atlas); prev.save('/tmp/atlas_prev.png')
print('ok')
