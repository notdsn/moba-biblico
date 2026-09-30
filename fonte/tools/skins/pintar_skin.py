# Repinta SÓ a roupa (túnica, capa, armadura) da textura do Tripo para criar uma "veste" nova.
# Máscara em 2 camadas: (1) posição 3D de cada texel (rasterizando a malha no UV: cabeça/rosto/cabelo ficam de fora)
# (2) cor (pele detectada pela cor é preservada em qualquer altura). Acabamentos (barras, padrões) são desenhados em
# coordenadas 3D, então continuam certos através das costuras do UV.
import sys, numpy as np
from PIL import Image
sys.path.insert(0, 'tools/skins')
from classes import carregar
from bordas import bordas, distancia

def lum(t): return t[..., 0] * .299 + t[..., 1] * .587 + t[..., 2] * .114
def hexrgb(h): h = h.lstrip('#'); return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)], np.float32)

def tingir(out, tex, m, cor, forca=1.0, gama=1.0, brilho=1.0):
    """troca a cor mantendo o sombreado/detalhe original (luminância relativa à mediana da região)"""
    if not m.any(): return
    L = lum(tex); ref = np.median(L[m]) + 1e-4
    k = np.clip((L[m] / ref) ** gama, 0, 2.2)[:, None] * brilho
    c = np.clip(hexrgb(cor)[None, :] * k, 0, 1)
    out[m] = out[m] * (1 - forca) + c * forca

def ouro(out, tex, m, base='#e8b53a', gama=1.25, w=None):
    """dourado com brilho: luminância original puxada para um gradiente ouro escuro→claro (w = peso 0..1, borda suave)"""
    if w is not None: m = m & (w > 0)
    if not m.any(): return
    L = lum(tex)[m]; ref = np.median(L) + 1e-4; t = np.clip((L / ref) * .55, 0, 1.2)[:, None]
    esc, med, cla = hexrgb('#6a4210'), hexrgb(base), hexrgb('#fff0b0')
    c = np.where(t < .55, esc + (med - esc) * (t / .55), med + (cla - med) * np.clip((t - .55) / .65, 0, 1))
    c = np.clip(c, 0, 1)
    if w is not None: k = w[m][:, None]; out[m] = out[m] * (1 - k) + c * k
    else: out[m] = c

def hem2(Mx, Mz, My, m, bx=48, bz=10):
    """borda de baixo em função de (x, z): não engrossa a barra nas laterais da capa"""
    xb = np.clip((Mx * bx).astype(int), 0, bx - 1); zb = np.clip((Mz * bz).astype(int), 0, bz - 1); b = np.full((bx, bz), np.nan)
    for i in range(bx):
        for j in range(bz):
            s_ = m & (xb == i) & (zb == j)
            if s_.sum() > 25: b[i, j] = np.percentile(My[s_], 1.5)
    for j in range(bz):  # preenche buracos ao longo de x
        c = b[:, j]; ok = ~np.isnan(c)
        if ok.sum() >= 2: b[:, j] = np.interp(np.arange(bx), np.arange(bx)[ok], c[ok])
    for i in range(bx):
        c = b[i]; ok = ~np.isnan(c)
        if ok.sum() >= 1: b[i] = np.interp(np.arange(bz), np.arange(bz)[ok], c[ok])
        else: b[i] = np.nanmin(b)
    return b[xb, zb]

def suave(d, a, b, e=.003):
    """1 dentro da faixa [a,b] de d, com rampa de largura e nas bordas"""
    return np.clip(np.minimum(d - a, b - d) / e + .5, 0, 1)

def hem(Mx, My, m, bins=60, lado='min'):
    """altura da barra (borda de baixo) de uma região em função de x"""
    xb = np.clip((Mx * bins).astype(int), 0, bins - 1); b = np.full(bins, np.nan)
    for i in range(bins):
        s = m & (xb == i)
        if s.sum() > 30: b[i] = np.percentile(My[s], 1.5)
    # preenche buracos e suaviza
    idx = np.arange(bins); ok = ~np.isnan(b)
    if ok.sum() < 2: return np.zeros_like(My)
    b = np.interp(idx, idx[ok], b[ok]); b = np.convolve(np.pad(b, 3, mode='edge'), np.ones(7) / 7, 'valid')
    return np.interp(Mx * bins - .5, idx, b)

def topo(Mx, My, m, bins=60):
    """altura da borda de cima (gola) de uma região em função de x"""
    return -hem(Mx, -My, m, bins)

def chamas(Mx, Mz, d, alt=.05, k=38):
    """línguas de fogo subindo da barra: peso 1 abaixo de uma borda ondulada"""
    onda = alt * (.55 + .45 * np.abs(np.sin(Mx * k + np.sin(Mz * 17) * 1.3)) * (.6 + .4 * np.sin(Mx * k * .37 + 1.7)))
    return np.clip((onda - d) / .004 + .5, 0, 1) * (d > -1)

def folhas(Mx, My, Mz, passo=.09):
    """ramos de palmeira estilizados: espinha vertical + folíolos em V, numa grade 3D"""
    a = Mx / passo; col = np.round(a); fx = (a - col) * passo; b = My / passo + (col % 2) * .5; fy = (b - np.round(b)) * passo
    esp = np.clip((.0024 - np.abs(fx)) / .0015 + .5, 0, 1) * (np.abs(fy) < passo * .38)
    fol = np.clip((.0022 - np.abs(np.abs(fx) * .9 - (fy + passo * .3) * .55)) / .0015 + .5, 0, 1) * (np.abs(fx) < passo * .3) * (np.abs(fy) < passo * .4)
    return np.maximum(esp, fol * (np.round((fy + 1) / .012) % 2 == 0) * 0 + fol)

def grega(Mx, My, d, alt=.03, passo=.022):
    """faixa de meandro (grega) dentro de uma barra de altura alt acima da borda"""
    u = (Mx / passo) % 2; v = np.clip(d / alt, 0, 1)
    padrao = ((v < .25) | (v > .75) | ((u < .25) & (v > .25)) | ((u > 1) & (u < 1.25)) | ((v > .45) & (v < .55) & (u > .25) & (u < 1.25) & (u > .5)))
    return (padrao & (d >= 0) & (d <= alt)).astype(np.float32)

def estrelas(Mx, My, Mz, passo=.07, r=.0062):
    """padrão bordado: losangos pequenos numa grade 3D (desencontrada), contínuo nas costuras — devolve peso suave"""
    b = My / passo; linha = np.round(b); a = Mx / passo + (linha % 2) * .5
    fx = np.abs(a - np.round(a)) * passo; fy = np.abs(b - np.round(b)) * passo
    return np.clip((r * 1.4 - (fx + fy)) / .0025 + .5, 0, 1)

def davi_rei(id='davi'):
    tex, M, cov, H, S, V = carregar(id); out = tex.copy()
    x, y, z = M[..., 0], M[..., 1], M[..., 2]
    cabeca = y > .86
    pele = (H > 6) & (H < 24) & (S > .42) & (S < .8) & (V > .58)
    vermelho = ((H < 12) | (H > 340)) & (S > .5) & (V > .2) & ~cabeca
    roupa = ~cabeca & ~pele & ~vermelho
    metal = roupa & (H > 27) & (H < 58) & (S > .35) & (V > .5)
    from scipy import ndimage
    metal = ndimage.binary_opening(metal, iterations=1)
    linho = roupa & (S < .44) & (V > .3) & (y > .3) & (y < .47)
    couro = roupa & ~metal & ~linho
    torso = y > .5
    # 1) capa: púrpura real
    tingir(out, tex, vermelho, '#4e1670', gama=1.1, brilho=1.0)
    # barra dourada larga + filete fino na capa, a partir da borda de baixo de cada "coluna" x
    hb = hem(x, y, vermelho, bins=90); d = y - hb
    pts, _, _ = bordas(id, vermelho); db = distancia(pts, M)  # contorno real da peça (gola/capuz)
    ht = topo(x, y, vermelho & (y > .55), bins=60); dt = ht - y  # gola: barra dourada na borda de cima da capa
    ouro(out, tex, vermelho, w=np.maximum.reduce([suave(d, -1, .022), suave(d, .033, .040, .002), suave(db, -1, .012) * (y > .6), suave(dt, -1, .014) * (y > .6), suave(dt, .02, .026, .002) * (y > .6)]))
    # bordado de losangos dourados espalhados na capa (acima da barra)
    ouro(out, tex, vermelho & (d > .06), base='#f0c34a', w=estrelas(x, y, z))
    # 2) couraça (couro do tronco) vira armadura dourada polida; tachas e fivelas ouro claro
    ouro(out, tex, couro & torso, base='#c28a26')
    ouro(out, tex, metal, base='#ffd45a')
    # 3) couro de baixo (tiras da saia, braçadeiras, botas): couro púrpura escuro com tachas douradas
    tingir(out, tex, couro & ~torso, '#34143f', gama=1.1)
    # 4) túnica de linho: branco-marfim com barra dourada
    tingir(out, tex, linho, '#efe6d2', gama=.9, brilho=1.0)
    hl = hem(x, y, linho); ouro(out, tex, linho, w=suave(y - hl, -1, .016))
    return out

from scipy import ndimage
def limpa(m, it=1):
    """tira pontinhos soltos e fecha furinhos da máscara (no espaço da textura)"""
    return ndimage.binary_closing(ndimage.binary_opening(m, iterations=it), iterations=it)

def sem_barba(M, y0=.74, r=.1):
    """exclui barba e cabelo comprido: faixa central acima do peito"""
    x, y = M[..., 0], M[..., 1]; return ~((y > y0) & (np.abs(x - np.median(x)) < r))

def sansao_juiz(id='sansao'):
    tex, M, cov, H, S, V = carregar(id); out = tex.copy(); x, y, z = M[..., 0], M[..., 1], M[..., 2]
    corpo = (y < .86) & sem_barba(M, .72, .11)
    metal = corpo & (H > 28) & (H < 60) & (S > .25) & (V > .55)
    couro = corpo & ~metal & (V < .37) & ((H < 45) | (H > 340))
    couro = limpa(couro); metal = limpa(metal)
    # couro de juiz: azul-noite (Dã) com tachas e fivelas de prata
    tingir(out, tex, couro, '#23305e', gama=1.15, brilho=1.05)
    tingir(out, tex, metal, '#dfe4ee', gama=1.3); out[metal] = out[metal] * .85 + lum(tex)[metal][:, None] * .15
    # saia/tanga: barra de prata + grega de prata
    saia = couro & (y > .3) & (y < .5); hs = hem(x, y, saia, bins=50); ds = y - hs
    w = np.maximum(suave(ds, -1, .012), grega(x, y, ds - .018, alt=.026) * .95)
    pr = saia & (w > 0); cor = np.clip(hexrgb('#e8ecf4')[None] * (lum(tex)[pr] / (np.median(lum(tex)[pr]) + 1e-4) * .9)[:, None] ** .5, 0, 1)
    out[pr] = out[pr] * (1 - w[pr][:, None]) + cor * w[pr][:, None]
    return out

def gideao_tocha(id='gideao'):
    tex, M, cov, H, S, V = carregar(id); out = tex.copy(); x, y, z = M[..., 0], M[..., 1], M[..., 2]
    corpo = y < .86
    amarelo = corpo & (H > 36) & (H < 60) & (S > .55) & (V > .5)
    laranja = corpo & (H > 14) & (H <= 36) & (S > .8) & (V > .6)
    couro = corpo & (V < .5) & (S > .3) & ((H < 40) | (H > 340)) & ~amarelo & ~laranja
    amarelo, laranja, couro = limpa(amarelo), limpa(laranja), limpa(couro)
    tunica = amarelo | laranja
    # túnica carmesim-escuro com chamas subindo da barra; armadura de couro vira ferro fuliginoso
    tingir(out, tex, tunica, '#7c1512', gama=1.0, brilho=1.0)
    hb = hem(x, y, tunica & (y < .5), bins=70); d = y - hb
    w = chamas(x, z, d, alt=.075) * (y < .5)
    fogo = tunica & (w > 0); t = np.clip(d[fogo] / .075, 0, 1)[:, None]
    cor = hexrgb('#ffd24a')[None] * (1 - t) + hexrgb('#e2461a')[None] * t
    out[fogo] = out[fogo] * (1 - w[fogo][:, None]) + np.clip(cor * (lum(tex)[fogo] / np.median(lum(tex)[fogo] + 1e-4))[:, None] ** .4, 0, 1) * w[fogo][:, None]
    tingir(out, tex, couro, '#2e2826', gama=1.2, brilho=1.1)
    # filetes de brasa nas bordas da armadura
    pts, _, _ = bordas(id, couro & (y > .5)); db = distancia(pts, M)
    wb = suave(db, -1, .006) * (y > .5) * couro
    br = wb > 0; out[br] = out[br] * (1 - wb[br][:, None]) + hexrgb('#ff7a22')[None] * wb[br][:, None]
    return out

def golias_bronze(id='golias'):
    tex, M, cov, H, S, V = carregar(id); out = tex.copy(); x, y, z = M[..., 0], M[..., 1], M[..., 2]
    corpo = y < .86
    pele = (H > 4) & (H < 26) & (S > .52) & (V > .22) & (V < .62)
    pele = limpa(pele, 2)
    armadura = corpo & ~pele
    brilho = armadura & (V > .55) & (S > .3)
    ouro(out, tex, armadura, base='#b8702c', gama=1.2)
    ouro(out, tex, brilho, base='#ffc766')
    # ornamento: losangos de bronze claro espalhados nas placas
    ouro(out, tex, armadura & ~brilho & (y > .35), base='#ffd98a', w=estrelas(x, y, z, passo=.09, r=.006) * .9)
    return out

def nabuco_ouro(id='nabuco'):
    tex, M, cov, H, S, V = carregar(id); out = tex.copy(); x, y, z = M[..., 0], M[..., 1], M[..., 2]
    corpo = y < .86
    manto = corpo & ((H < 14) | (H > 340)) & (S > .7) & (V > .25)
    dourado = corpo & (H >= 22) & (H < 55) & (S > .45) & (V > .45)
    escuro = corpo & (V < .3) & ~manto & sem_barba(M, .72, .1)
    manto, dourado, escuro = limpa(manto), limpa(dourado), limpa(escuro)
    # manto azul-lápis (Porta de Ishtar) com estrelas de ouro; peças escuras viram ouro; frisos ouro claro
    tingir(out, tex, manto, '#1d3c93', gama=1.05, brilho=1.05)
    ouro(out, tex, manto, base='#f3c64a', w=estrelas(x, y, z, passo=.06, r=.007))
    hb = hem(x, y, manto & (y < .5), bins=60); d = y - hb
    ouro(out, tex, manto & (y < .5), w=np.maximum(suave(d, -1, .016), suave(d, .026, .032, .002)))
    ouro(out, tex, escuro, base='#c9922e'); ouro(out, tex, dourado, base='#ffd45a')
    return out

def debora_palmeira(id='debora'):
    tex, M, cov, H, S, V = carregar(id); out = tex.copy(); x, y, z = M[..., 0], M[..., 1], M[..., 2]
    corpo = y < .86
    capa = corpo & (H > 130) & (H < 200) & (S > .25) & (V > .15)
    faixa = corpo & (H >= 180) & (H < 215) & (S > .6)
    creme = corpo & (S < .3) & (V > .5) & ~capa
    capa, faixa = limpa(capa), limpa(faixa); capa = capa & ~faixa
    # capa cor de tâmara/terracota com ramos de palmeira dourados; faixa verde-oliva; linho marfim
    tingir(out, tex, capa, '#8f3a22', gama=1.05, brilho=1.05)
    ouro(out, tex, capa, base='#e3b04a', w=folhas(x, y, z) * .9)
    hb = hem(x, y, capa, bins=80); d = y - hb
    ouro(out, tex, capa, w=np.maximum(suave(d, -1, .02), suave(d, .03, .036, .002)))
    tingir(out, tex, faixa, '#5d7a22', gama=1.0)
    tingir(out, tex, creme, '#f1e7cf', gama=.9)
    return out

def farao_coroa(id='farao'):
    tex, M, cov, H, S, V = carregar(id); out = tex.copy(); x, y, z = M[..., 0], M[..., 1], M[..., 2]
    corpo = y < .86
    dourado = corpo & (H >= 31) & (H < 55) & (S > .5) & (V > .4)
    roxo = corpo & (H > 270) & (H < 345) & (S > .3)
    turquesa = corpo & (H > 150) & (H < 210) & (S > .3)
    dourado, roxo, turquesa = limpa(dourado), limpa(roxo), limpa(turquesa)
    # Coroa Dupla (Alto e Baixo Egito): calça de linho branco, túnica vermelha (deshret), frisos de ouro e lápis
    tingir(out, tex, roxo, '#ece5d3', gama=.8, brilho=1.0)
    hb = hem(x, y, roxo, bins=50); d = y - hb
    ouro(out, tex, roxo, w=suave(d, -1, .014))
    tronco = dourado & (y > .42)
    L = lum(tex); frisos = tronco & (L > np.percentile(L[tronco], 70))
    tingir(out, tex, tronco & ~frisos, '#a21c1a', gama=1.1, brilho=1.1)
    ouro(out, tex, frisos, base='#ffd45a')
    ouro(out, tex, dourado & ~tronco, base='#f0c040')
    tingir(out, tex, turquesa, '#1f47a8', gama=1.0, brilho=1.1)
    return out

def jezabel_sidom(id='jezabel'):
    tex, M, cov, H, S, V = carregar(id); out = tex.copy(); x, y, z = M[..., 0], M[..., 1], M[..., 2]
    corpo = y < .86
    roxo = corpo & (H > 235) & (H < 335) & (S > .45)
    dourado = corpo & (H >= 22) & (H < 55) & (S > .45) & (V > .45)
    roxo, dourado = limpa(roxo), limpa(dourado)
    # vinho-carmesim com filigrana de ouro e barra larga bordada
    tingir(out, tex, roxo, '#8a0f2e', gama=1.1, brilho=1.05)
    ouro(out, tex, roxo & (y < .55), base='#f0c34a', w=estrelas(x, y, z, passo=.055, r=.006))
    hb = hem(x, y, roxo, bins=90); d = y - hb
    ouro(out, tex, roxo, w=np.maximum.reduce([suave(d, -1, .025), suave(d, .036, .043, .002), grega(x, y, d - .05, alt=.03) * (d < .085)]))
    ouro(out, tex, dourado, base='#ffd45a')
    return out

SKINS = {'davi_rei': davi_rei, 'sansao_juiz': sansao_juiz, 'gideao_tocha': gideao_tocha, 'golias_bronze': golias_bronze, 'nabuco_ouro': nabuco_ouro, 'debora_palmeira': debora_palmeira, 'farao_coroa': farao_coroa, 'jezabel_sidom': jezabel_sidom}
if __name__ == '__main__':
    nome = sys.argv[1]; o = SKINS[nome]()
    im = Image.fromarray((np.clip(o, 0, 1) * 255).astype(np.uint8))
    im.save(f'public/models/tripo/skins/{nome}.webp', quality=88, method=6)
    im.save(f'/tmp/skins/{nome}.png'); print('ok', nome)
