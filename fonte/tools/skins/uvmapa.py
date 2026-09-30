# rasteriza a malha do Tripo no espaço UV: para cada texel guarda altura (0 pés..1 topo), lado x e frente z normalizados
import json, sys, numpy as np
from PIL import Image
def mapa(id, S=1024):
    d = json.load(open(f'/tmp/skins/{id}_uv.json'))
    P = np.array(d['P']).reshape(-1, 3); U = np.array(d['U']).reshape(-1, 2); I = np.array(d['I']).reshape(-1, 3)
    mn, mx = P.min(0), P.max(0); N = (P - mn) / (mx - mn)
    out = np.full((S, S, 3), -1.0, np.float32)
    uv = U * S
    for t in I:
        a, b, c = uv[t]; x0, y0 = np.floor(np.minimum(np.minimum(a, b), c)).astype(int); x1, y1 = np.ceil(np.maximum(np.maximum(a, b), c)).astype(int)
        x0, y0 = max(x0 - 1, 0), max(y0 - 1, 0); x1, y1 = min(x1 + 1, S - 1), min(y1 + 1, S - 1)
        if x1 < x0 or y1 < y0: continue
        xs, ys = np.meshgrid(np.arange(x0, x1 + 1) + .5, np.arange(y0, y1 + 1) + .5)
        den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
        if abs(den) < 1e-9: continue
        w0 = ((b[1] - c[1]) * (xs - c[0]) + (c[0] - b[0]) * (ys - c[1])) / den
        w1 = ((c[1] - a[1]) * (xs - c[0]) + (a[0] - c[0]) * (ys - c[1])) / den
        w2 = 1 - w0 - w1; e = -0.08
        m = (w0 >= e) & (w1 >= e) & (w2 >= e)
        if not m.any(): continue
        val = w0[..., None] * N[t[0]] + w1[..., None] * N[t[1]] + w2[..., None] * N[t[2]]
        yy, xx = np.nonzero(m); out[yy + y0, xx + x0] = val[yy, xx]
    np.save(f'/tmp/skins/{id}_mapa.npy', out)
    return out
if __name__ == '__main__':
    for id in sys.argv[1].split(','):
        o = mapa(id); v = np.clip(o[..., 1], 0, 1); cov = (o[..., 0] >= 0)
        im = np.zeros((1024, 1024, 3), np.uint8); im[..., 0] = (v * 255).astype(np.uint8); im[..., 2] = ((1 - v) * 255 * cov).astype(np.uint8)
        Image.fromarray(im).save(f'/tmp/skins/{id}_altura.png'); print(id, cov.mean())
