# detecção de pele adaptativa: amostra a cor do rosto (frente da cabeça) e marca texels parecidos (distância em Lab)
import numpy as np
def lab(t):
    a = np.where(t > .04045, ((t + .055) / 1.055) ** 2.4, t / 12.92)
    X = a @ np.array([[.4124, .2126, .0193], [.3576, .7152, .1192], [.1805, .0722, .9505]], np.float32)
    X = X / np.array([.9505, 1, 1.089], np.float32); f = np.where(X > .008856, np.cbrt(X), 7.787 * X + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)
def pele_auto(tex, M, cov, y0=.78, y1=.85, lim=16, amostra=None):
    x, y, z = M[..., 0], M[..., 1], M[..., 2]
    if amostra is None:
        zc = np.percentile(z[cov & (y > y0) & (y < y1)], 85)
        amostra = cov & (y > y0) & (y < y1) & (np.abs(x - .5) < .04) & (z >= zc)
    L = lab(tex); ref = np.median(L[amostra], 0)
    d = np.sqrt(((L - ref) * np.array([.45, 1, 1])) ** 2).sum(-1) ** .5 if False else np.sqrt((((L - ref) * np.array([.45, 1, 1])) ** 2).sum(-1))
    return d < lim, ref
