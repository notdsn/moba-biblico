import numpy as np, sys
from PIL import Image
from scipy import ndimage
def carregar(id):
    tex = np.array(Image.open(f'/tmp/skins/{id}_base.webp').convert('RGB')).astype(np.float32) / 255
    M = np.load(f'/tmp/skins/{id}_mapa.npy')
    cov = M[..., 0] >= 0
    # espalha as coordenadas 3D para as bordas (gutter) — evita costura na hora de repintar
    idx = ndimage.distance_transform_edt(~cov, return_distances=False, return_indices=True)
    M2 = M[idx[0], idx[1]]
    import colorsys
    r, g, b = tex[..., 0], tex[..., 1], tex[..., 2]
    mx = tex.max(-1); mn = tex.min(-1); v = mx; s = np.where(mx > 1e-4, (mx - mn) / np.maximum(mx, 1e-4), 0)
    d = mx - mn + 1e-6
    hh = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    return tex, M2, cov, hh, s, v
if __name__ == '__main__':
    id = sys.argv[1]
    tex, M, cov, H, S, V = carregar(id)
    y = M[..., 1]; x = M[..., 0]
    vermelho = ((H < 12) | (H > 340)) & (S > .5) & (V > .25)
    cinza = (S < .2) & (V > .2) & (V < .8)
    pele = (H > 6) & (H < 24) & (S > .42) & (S < .8) & (V > .58)
    cabeca = y > .86
    dbg = tex.copy() * .3
    dbg[vermelho] = [1, 0, 0]; dbg[cinza & ~cabeca] = [.7, .7, .7]; dbg[pele] = [1, .8, .6]; dbg[cabeca & ~vermelho] = [0, 1, 0]
    resto = ~(vermelho | cinza | pele | cabeca)
    dbg[resto] = [.1, .2, 1]
    Image.fromarray((dbg * 255).astype(np.uint8)).save(f'/workspace/moba-biblico/3d/public/dbg_{id}.png')
