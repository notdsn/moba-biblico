# Gera versões "pintadas à mão" (estilo dos modelos Tripo) das texturas CC0 do chão, a partir das originais.
# Filtro Kuwahara (pinceladas "a óleo") + cores quentes simplificadas + manchas grandes + pinceladas curtas.
# Tudo feito com a textura repetida 3x3 para continuar emendando sem costura. Uso: python3 tools/pintar_texturas.py
import numpy as np, random
from PIL import Image, ImageDraw, ImageFilter
BASE = '/workspace/moba-biblico/3d/public/tex/'
def box(a, r):
    # média em janela (2r+1)^2 via imagem integral, a: HxWxC
    p = np.pad(a, ((r + 1, r), (r + 1, r), (0, 0)), mode='wrap').cumsum(0).cumsum(1)
    k = 2 * r + 1
    return (p[k:, k:] - p[:-k, k:] - p[k:, :-k] + p[:-k, :-k]) / (k * k)
def kuwahara(img, r):
    a = img.astype(np.float64); H, W, _ = a.shape
    m = box(a, r // 2 if r > 1 else 1); m2 = box(a * a, r // 2 if r > 1 else 1)
    v = (m2 - m * m).sum(2); h = r // 2 + (r % 2)
    best = None; bv = None
    for dy in (-h, h):
        for dx in (-h, h):
            mm = np.roll(m, (dy, dx), (0, 1)); vv = np.roll(v, (dy, dx), (0, 1))
            if best is None: best, bv = mm.copy(), vv.copy()
            else: sel = vv < bv; best[sel] = mm[sel]; bv[sel] = vv[sel]
    return best
def ruido(W, H, esc, seed):
    rng = np.random.default_rng(seed); n = rng.random((esc, esc))
    im = Image.fromarray((n * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)
    # emenda: recria com repetição
    big = Image.fromarray((np.tile(n, (3, 3)) * 255).astype(np.uint8)).resize((W * 3, H * 3), Image.BICUBIC)
    return np.asarray(big.crop((W, H, 2 * W, 2 * H))).astype(np.float64) / 255
def pintar(nome, saida, paleta, r=5, blend=.55, quente=(1.08, 1.0, .86), pinc=(900, 3, 9), niveis=10, seed=1, contraste=1.0, clarear=1.0, sat=.35):
    im = Image.open(BASE + nome).convert('RGB'); W, H = im.size; a = np.asarray(im).astype(np.float64)
    k = kuwahara(a, r)
    k = np.clip((k - k.mean((0, 1))) * contraste + k.mean((0, 1)), 0, 255)
    # simplifica tons (visual pintado) e esquenta
    q = np.round(k / (256 / niveis)) * (256 / niveis)
    k = k * .55 + q * .45
    k = k * np.array(quente) * clarear
    # manchas grandes de cor da paleta (variação pintada)
    n1 = ruido(W, H, 5, seed)[..., None]; n2 = ruido(W, H, 11, seed + 1)[..., None]
    c0, c1 = np.array(paleta[0], float), np.array(paleta[1], float)
    tint = c0 * (1 - n1) + c1 * n1
    lum = k.mean(2, keepdims=True) / 128
    k = k * (1 - blend) + tint * lum * blend
    k = k * (.92 + .16 * n2)
    out = Image.fromarray(np.clip(k, 0, 255).astype(np.uint8))
    # pinceladas curtas, claras e escuras, desenhadas com emenda (3x3)
    big = Image.new('RGBA', (W * 3, H * 3), (0, 0, 0, 0)); d = ImageDraw.Draw(big); rnd = random.Random(seed)
    n, w0, w1 = pinc
    for _ in range(n):
        x, y = rnd.random() * W, rnd.random() * H; L = rnd.uniform(6, 22); ang = rnd.uniform(-.6, .6) + (rnd.random() < .5) * 3.14
        claro = rnd.random() < .5; col = tuple(int(v) for v in (c1 * 1.25 if claro else c0 * .6)) + (rnd.randint(28, 60),)
        for ox in (0, W, 2 * W):
            for oy in (0, H, 2 * H):
                d.line((x + ox, y + oy, x + ox + L * np.cos(ang), y + oy + L * np.sin(ang)), fill=col, width=rnd.randint(w0, w1))
    big = big.filter(ImageFilter.GaussianBlur(1.2)).crop((W, H, 2 * W, 2 * H))
    out = Image.alpha_composite(out.convert('RGBA'), big).convert('RGB').filter(ImageFilter.SMOOTH)
    # o jogo tinge o chão pela cor dos vértices (Luz/Trevas): a textura fica quase neutra (creme quente), com o brilho médio da original
    o = np.asarray(out).astype(np.float64); g = o.mean(2, keepdims=True)
    o = g * np.array(quente) * (1 - sat) + o * sat
    o *= a.mean() / max(1, o.mean())
    out = Image.fromarray(np.clip(o, 0, 255).astype(np.uint8))
    out.save(BASE + 'pintado/' + saida, quality=88); print('ok', saida, out.size)
# grama: verdes quentes/oliva, amarelo-sol nas manchas claras
pintar('grama_d.jpg', 'grama_d.jpg', [(70, 120, 45), (170, 175, 70)], r=6, blend=.6, quente=(1.06, 1.02, .8), seed=3, clarear=1.05)
# terra da trilha: ocre e marrom-avermelhado
pintar('terra_d.jpg', 'terra_d.jpg', [(120, 80, 48), (205, 160, 100)], r=6, blend=.55, quente=(1.1, 1.0, .82), seed=5)
# pedras da rota: cinza quente (arenito), com bordas mais simples
pintar('pedra_d.jpg', 'pedra_d.jpg', [(120, 100, 82), (215, 195, 160)], r=5, blend=.5, quente=(1.08, 1.0, .88), seed=7, niveis=8, pinc=(500, 2, 6))
# mármore das torres da Luz: creme quente
pintar('marmore_d.jpg', 'marmore_d.jpg', [(215, 200, 175), (245, 235, 212)], r=4, blend=.45, quente=(1.05, 1.0, .92), seed=9, pinc=(300, 2, 5), sat=.6)
# obsidiana das Trevas: roxo pintado
pintar('obsidiana_d.jpg', 'obsidiana_d.jpg', [(45, 25, 60), (120, 70, 150)], r=4, blend=.5, quente=(1.0, .95, 1.05), seed=11, pinc=(300, 2, 5), sat=.25)
