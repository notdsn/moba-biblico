# Texturas da interface no estilo pintado à mão: madeira (botão LOJA / topo da loja) e pergaminho (janela da loja). Originais.
import numpy as np, random
from PIL import Image, ImageDraw, ImageFilter
OUT = '/workspace/moba-biblico/3d/public/ui/'
rnd = random.Random(4)
def ruido(W, H, e, s):
    n = np.random.default_rng(s).random((e, e)); return np.asarray(Image.fromarray((n * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)).astype(float) / 255
# madeira: tábuas horizontais
W, H = 512, 256; im = Image.new('RGB', (W, H)); d = ImageDraw.Draw(im)
tab = 4; th = H // tab
for i in range(tab):
    base = np.array([122, 74, 36]) * (0.9 + 0.2 * rnd.random())
    d.rectangle((0, i * th, W, (i + 1) * th), fill=tuple(int(v) for v in base))
    for _ in range(90):
        y = i * th + rnd.random() * th; x = rnd.random() * W; L = rnd.uniform(40, 200); c = base * rnd.uniform(.7, 1.25)
        d.line((x, y, x + L, y + rnd.uniform(-2, 2)), fill=tuple(int(min(255, v)) for v in c), width=rnd.randint(1, 4))
    d.line((0, i * th, W, i * th), fill=(52, 30, 14), width=4)
    d.line((0, i * th + 4, W, i * th + 4), fill=(170, 112, 60), width=2)
    for _ in range(2):
        x, y = rnd.random() * W, i * th + th * rnd.uniform(.3, .7); r = rnd.uniform(5, 10)
        d.ellipse((x - r * 1.6, y - r, x + r * 1.6, y + r), outline=(70, 40, 18), width=3)
im = im.filter(ImageFilter.GaussianBlur(.8))
a = np.asarray(im).astype(float) * (0.85 + 0.3 * ruido(W, H, 6, 1))[..., None]
Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(OUT + 'madeira.webp', quality=84)
# pergaminho: creme com manchas e bordas queimadas
W, H = 768, 432; base = np.array([240, 222, 176], float)
n1 = ruido(W, H, 8, 2)[..., None]; n2 = ruido(W, H, 30, 3)[..., None]
a = base * (0.88 + 0.12 * n1) * (0.95 + 0.07 * n2)
yy, xx = np.mgrid[0:H, 0:W]; dx = np.minimum(xx, W - 1 - xx) / W; dy = np.minimum(yy, H - 1 - yy) / H
borda = np.clip(1 - np.minimum(dx * 5.5, dy * 5.5 * H / W * 1.4), 0, 1) ** 2
a = a * (1 - .35 * borda[..., None]) + np.array([150, 95, 45]) * .35 * borda[..., None] * 0 
a = a * (1 - .28 * borda[..., None])
im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)); d = ImageDraw.Draw(im, 'RGBA')
for _ in range(700):
    x, y = rnd.random() * W, rnd.random() * H; L = rnd.uniform(8, 30); ang = rnd.uniform(0, 6.28)
    d.line((x, y, x + L * np.cos(ang), y + L * np.sin(ang)), fill=(150, 110, 60, rnd.randint(10, 28)), width=rnd.randint(1, 2))
for _ in range(14):
    x, y, r = rnd.random() * W, rnd.random() * H, rnd.uniform(20, 70)
    d.ellipse((x - r, y - r * .7, x + r, y + r * .7), fill=(170, 125, 70, rnd.randint(8, 18)))
im.filter(ImageFilter.GaussianBlur(.6)).save(OUT + 'pergaminho.webp', quality=84)
print('ok')
