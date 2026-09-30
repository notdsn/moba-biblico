# bordas reais de uma peça de roupa: arestas (com vértices soldados por posição) que só pertencem a 1 triângulo da peça
import json, numpy as np
from scipy.spatial import cKDTree
def bordas(id, mascara_uv, S=1024, minimo=.25):
    d = json.load(open(f'/tmp/skins/{id}_uv.json'))
    P = np.array(d['P']).reshape(-1, 3); U = np.array(d['U']).reshape(-1, 2); I = np.array(d['I']).reshape(-1, 3)
    mn, mx = P.min(0), P.max(0); N = (P - mn) / (mx - mn)
    # solda vértices por posição
    q = np.round(P * 2000).astype(np.int64); _, sol = np.unique(q, axis=0, return_inverse=True); sol = sol.ravel()
    # triângulo pertence à peça se o centro UV cai na máscara
    c = U[I].mean(1); px = np.clip((c * S).astype(int), 0, S - 1)
    dentro = mascara_uv[px[:, 1], px[:, 0]]
    T = sol[I[dentro]]
    e = np.sort(np.concatenate([T[:, [0, 1]], T[:, [1, 2]], T[:, [2, 0]]]), axis=1)
    ue, cnt = np.unique(e, axis=0, return_counts=True)
    b = ue[cnt == 1]
    # posições (normalizadas) dos vértices soldados
    Pw = np.zeros((sol.max() + 1, 3)); Pw[sol] = N
    # descarta laços pequenos (buracos da máscara por ruído de cor): fica só com contornos longos
    from scipy.sparse import coo_matrix
    from scipy.sparse.csgraph import connected_components
    nV = sol.max() + 1; g = coo_matrix((np.ones(len(b)), (b[:, 0], b[:, 1])), shape=(nV, nV))
    _, lab = connected_components(g, directed=False)
    L = np.linalg.norm(Pw[b[:, 0]] - Pw[b[:, 1]], axis=1); comp = lab[b[:, 0]]
    tot = np.bincount(comp, weights=L, minlength=lab.max() + 1)
    b = b[tot[comp] > minimo]
    a, bb = Pw[b[:, 0]], Pw[b[:, 1]]
    pts = np.concatenate([a + (bb - a) * t for t in np.linspace(0, 1, 5)])
    return pts, dentro.sum(), len(b)
def distancia(pts, M):
    tr = cKDTree(pts); d, _ = tr.query(M.reshape(-1, 3), k=1, workers=-1); return d.reshape(M.shape[:2])
