# agrupa (k-means em Lab) os texels do corpo para escolher quais grupos são roupa
import sys, numpy as np; sys.path.insert(0, 'tools/skins')
from PIL import Image, ImageDraw
from classes import carregar; from pele import lab
from scipy.cluster.vq import kmeans2
PAL = np.array([[1,0,0],[0,1,0],[0,0,1],[1,1,0],[1,0,1],[0,1,1],[1,.5,0],[.5,0,1],[1,1,1],[.3,.3,.3]], np.float32)
def grupos(id, k=10, seed=1):
    tex, M, cov, H, S, V = carregar(id); L = lab(tex)
    np.random.seed(seed); idx = np.flatnonzero(cov.ravel()); amo = np.random.choice(idx, 30000)
    F = L.reshape(-1, 3) * np.array([.6, 1, 1]); c, _ = kmeans2(F[amo], k, minit='++', seed=seed)
    d = ((F[:, None, :] - c[None]) ** 2).sum(-1); g = d.argmin(1).reshape(L.shape[:2])
    return g, c, tex, M, cov
if __name__ == '__main__':
    id = sys.argv[1]; g, c, tex, M, cov = grupos(id)
    dbg = PAL[g] * .8 + tex * .2; dbg[M[..., 1] > .86] *= .4
    Image.fromarray((np.clip(dbg, 0, 1) * 255).astype(np.uint8)).save(f'public/dbg_{id}.png')
    for i in range(len(c)):
        m = (g == i) & cov; print(id, i, 'cor', PAL[i], 'média', (tex[m].mean(0) * 255).astype(int) if m.any() else '-', 'n', m.sum())
