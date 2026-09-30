# Rig + clipes dos monstros da selva (Leviatã, Beemote, Gigante de Pedra, Lobo). Mesmo padrão de tools/rig_dragao_blender.py:
# esqueleto simples por script, pesos por distância aos ossos (o "automático" do Blender falha nas malhas Tripo), clipes procedurais
# com ease e atraso por osso (follow-through). Uso: blender -b -P rig_monstros_blender.py -- <nome> (entrada /tmp/dr/<nome>_plano.glb)
import bpy, math, sys
from mathutils import Vector, Quaternion, Matrix
N = sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='/tmp/dr/%s_plano.glb' % N)
ob = [o for o in bpy.data.objects if o.type == 'MESH'][0]
bpy.context.view_layer.objects.active = ob; ob.select_set(True)
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
if N in ('lobo', 'leviata'): ob.rotation_euler[2] += math.pi / 2  # modelo de lado (cabeça em -X): vira para -Y (= +Z do glTF, a frente do jogo)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for o in list(bpy.data.objects):
    if o != ob: bpy.data.objects.remove(o)
arm = bpy.data.armatures.new('Esq'); ao = bpy.data.objects.new(N, arm); bpy.context.collection.objects.link(ao)
bpy.context.view_layer.objects.active = ao; bpy.ops.object.mode_set(mode='EDIT'); B = {}
def bone(n, h, t, p=None, conn=False):
    b = arm.edit_bones.new(n); b.head = Vector(h); b.tail = Vector(t)
    if p: b.parent = B[p]; b.use_connect = conn
    B[n] = b
def perna(n, pts, p):
    for i in range(len(pts) - 1): bone('%s%d' % (n, i + 1) if len(pts) > 2 else n, pts[i], pts[i + 1], p if i == 0 else '%s%d' % (n, i), i > 0)
if N == 'leviata':  # coluna vertical (a serpente enrolada sobe do chão até a cabeça), cabeça/mandíbula e cauda no chão
    zs = [0, .12, .26, .40, .54, .68, .82]
    for i in range(6): bone('col%d' % i, (0, 0, zs[i]), (0, 0, zs[i + 1]), 'col%d' % (i - 1) if i else None, i > 0)
    bone('cabeca', (0, -.08, .78), (0, -.36, .70), 'col5'); bone('mandibula', (0, -.12, .70), (0, -.34, .62), 'cabeca')
    bone('cauda1', (0, .12, .12), (0, .28, .14), 'col0'); bone('cauda2', (0, .28, .14), (0, .44, .16), 'cauda1', True)
elif N == 'gigante_pedra':
    bone('quadril', (0, 0, .30), (0, 0, .50)); bone('peito', (0, 0, .50), (0, 0, .68), 'quadril', True); bone('cabeca', (0, -.02, .68), (0, -.05, .88), 'peito', True)
    for s, L in ((1, 'E'), (-1, 'D')):
        perna('braco.' + L, [(s * .25, 0, .66), (s * .40, 0, .50), (s * .47, -.02, .28)], 'peito')
        perna('perna.' + L, [(s * .17, 0, .30), (s * .19, 0, .14), (s * .20, -.03, 0)], 'quadril')
    for b in list(B):  # nomes 'braco.E1' -> 'braco1.E' (espelho no Blender não importa aqui)
        pass
else:  # quadrúpedes: beemote (cabeça em -Y) e lobo (já girado)
    if N == 'beemote': q = dict(q0=(0, .22, .32), q1=(0, -.05, .36), p1=(0, -.25, .38), pc=(0, -.34, .40), cb=(0, -.49, .36), mj=((0, -.36, .30), (0, -.47, .26)), c=[(0, .30, .30), (.06, .40, .29), (.10, .49, .24)], pf=(.16, -.17), pt=(.16, .27), ph=.28)
    else: q = dict(q0=(0, .18, .40), q1=(0, -.05, .45), p1=(0, -.22, .50), pc=(0, -.30, .56), cb=(0, -.49, .47), mj=((0, -.32, .46), (0, -.46, .41)), c=[(0, .20, .38), (0, .33, .31), (0, .49, .30)], pf=(.10, -.29), pt=(.10, .19), ph=.36)
    bone('quadril', q['q0'], q['q1']); bone('peito', q['q1'], q['p1'], 'quadril', True); bone('pescoco', q['p1'], q['pc'], 'peito', True); bone('cabeca', q['pc'], q['cb'], 'pescoco', True)
    bone('mandibula', *q['mj'], 'cabeca'); bone('cauda1', q['c'][0], q['c'][1], 'quadril'); bone('cauda2', q['c'][1], q['c'][2], 'cauda1', True)
    for s, L in ((1, 'E'), (-1, 'D')):
        for nm, (x, y), par in (('pf', q['pf'], 'peito'), ('pt', q['pt'], 'quadril')):
            perna(nm + '.' + L, [(s * x, y, q['ph']), (s * x, y + .01, q['ph'] * .45), (s * x, y + .01, 0)], par)
bpy.ops.object.mode_set(mode='OBJECT'); print('OSSOS', len(arm.bones))
# ---- pesos: distância aos ossos (top-3, 1/d^4); Leviatã: faixas de altura na coluna + cabeça/cauda por região ----
ob.parent = ao; mod = ob.modifiers.new('Esq', 'ARMATURE'); mod.object = ao
vg = ob.vertex_groups; G = {b.name: vg.new(name=b.name) for b in arm.bones}
segs = [(b.name, b.head_local.copy(), b.tail_local.copy()) for b in arm.bones]
def dseg(p, h, t): ab = t - h; u = max(0, min(1, (p - h).dot(ab) / ab.length_squared)); return ((h + ab * u) - p).length
for v in ob.data.vertices:
    p = v.co; cand = segs
    if N == 'leviata':
        if p.y < -.06 and p.z > .56: cand = [s for s in segs if s[0] in ('cabeca', 'mandibula', 'col5')]
        elif p.y > .16 and p.z < .32: cand = [s for s in segs if s[0] in ('cauda1', 'cauda2', 'col0')]
        else:  # faixa de altura: mistura suave entre os dois ossos da coluna mais próximos em z
            cand = None; zc = [(s[0], (s[1].z + s[2].z) / 2) for s in segs if s[0].startswith('col')]
            ws = [(n, 1 / (abs(p.z - z) + .03) ** 3) for n, z in zc]; ws.sort(key=lambda a: -a[1]); ws = ws[:2]; S = sum(w for _, w in ws)
            for n, w in ws: G[n].add([v.index], w / S, 'REPLACE')
    if cand is None: continue
    ds = sorted((dseg(p, h, t), n) for n, h, t in cand if not (('.E' in n and p.x < -.02) or ('.D' in n and p.x > .02)))
    top = ds[:3]; ws = [1 / (d + .012) ** 4 for d, _ in top]; S = sum(ws)
    for (d, n), w in zip(top, ws): G[n].add([v.index], w / S, 'REPLACE')
# ---- clipes ----
bpy.context.scene.render.fps = 30; PB = ao.pose.bones
for pb in PB: pb.rotation_mode = 'QUATERNION'
X, Y, Z = (1, 0, 0), (0, 1, 0), (0, 0, 1)
def ss(a, b, x): x = max(0, min(1, (x - a) / (b - a))); return x * x * (3 - 2 * x)
def cv(ks, t):
    if t <= ks[0][0]: return ks[0][1]
    for (a, va), (b, vb) in zip(ks, ks[1:]):
        if t <= b: return va + (vb - va) * ss(a, b, t)
    return ks[-1][1]
S2 = lambda t, T, ph=0: math.sin(2 * math.pi * t / T + ph)
def gravar(nome, dur, f):
    act = bpy.data.actions.new(nome); ao.animation_data_create(); ao.animation_data.action = act
    for fr in range(0, int(round(dur * 30)) + 1):
        R, loc = f(fr / 30)
        for pb in PB:
            r = pb.bone.matrix_local.to_quaternion(); q = Quaternion()
            for ax, a in R.get(pb.name, []): q = (r.inverted() @ Quaternion(Vector(ax), a) @ r) @ q
            pb.rotation_quaternion = q; pb.keyframe_insert('rotation_quaternion', frame=fr)
            if pb.name in loc: pb.location = pb.bone.matrix_local.to_3x3().inverted() @ Vector(loc[pb.name]); pb.keyframe_insert('location', frame=fr)
    act.use_fake_user = True; tr = ao.animation_data.nla_tracks.new(); tr.name = nome; tr.strips.new(nome, 0, act); ao.animation_data.action = None
def ad(R, n, ax, a): R.setdefault(n, []).append((ax, a))
if N == 'leviata':
    COL = ['col%d' % i for i in range(6)]
    def base(t, amp=1):  # ondulação: onda subindo pela coluna (atraso por osso), cabeça balança, cauda serpenteia
        R = {}; T = 3.2
        for i, n in enumerate(COL): ad(R, n, X, amp * .07 * S2(t, T, -i * .7)); ad(R, n, Y, amp * .09 * S2(t, T / 2 * 2, -i * .6 + 1)); ad(R, n, Z, amp * .05 * S2(t, T, -i * .5))
        ad(R, 'cabeca', Z, amp * .25 * S2(t, T, -4)); ad(R, 'cabeca', X, amp * .1 * S2(t, T / 2, -3.5)); ad(R, 'mandibula', X, .06 + .05 * S2(t, T / 2))
        ad(R, 'cauda1', Z, .3 * S2(t, T / 2, 0)); ad(R, 'cauda2', Z, .45 * S2(t, T / 2, -.9)); return R, {}
    def atk(t):  # enrola para trás -> bote subindo -> golpe para baixo (onda cabeça->cauda) -> chicote da cauda -> volta
        R, loc = base(t, .5)
        rec = cv([(0, 0), (.55, 1), (.72, -.2), (.9, -1), (1.25, -.8), (1.8, 0)], None) if False else None
        for i, n in enumerate(COL):
            lag = (5 - i) * .045  # o golpe começa na cabeça e desce até a cauda
            k = cv([(0, 0), (.55, 1), (.70, .3), (.86 + lag, -1), (1.2 + lag, -.7), (1.8, 0)], t)
            ad(R, n, X, -k * (.11 + i * .035))  # >0 recua (enrola para trás), <0 bate para a frente/baixo
            ad(R, n, Y, .06 * math.sin(t * 9 - i * .8) * ss(.6, .8, t) * (1 - ss(1.2, 1.7, t)))
        k = cv([(0, 0), (.55, .8), (.70, -.4), (.86, -.6), (1.3, -.3), (1.8, 0)], t)
        ad(R, 'cabeca', X, -k * .45); ad(R, 'mandibula', X, .7 * cv([(0, .05), (.5, .6), (.8, .75), (.95, .1), (1.8, .05)], t))
        loc['col0'] = (0, .05 * cv([(0, 0), (.55, 1), (.86, -1.4), (1.8, 0)], t), .04 * cv([(0, 0), (.6, 1), (.86, -.5), (1.8, 0)], t))
        wh = cv([(0, 0), (.8, 0), (.95, 1), (1.1, -.8), (1.3, .5), (1.6, 0)], t)  # chicote da cauda depois do golpe
        ad(R, 'cauda1', Z, .8 * wh); ad(R, 'cauda2', Z, 1.1 * cv([(0, 0), (.86, 0), (1.02, 1), (1.18, -.9), (1.4, .5), (1.7, 0)], t)); ad(R, 'col0', Z, .25 * wh)
        return R, loc
    def hit(t):
        R, loc = base(t, .6); h = cv([(0, 0), (.07, 1), (.55, 0)], t) * (1 + .3 * math.sin(t * 24) * (1 - ss(0, .55, t)))
        for i, n in enumerate(COL): ad(R, n, X, .07 * i * cv([(0, 0), (.07 + i * .02, 1), (.55, 0)], t))
        ad(R, 'cabeca', X, .3 * h); ad(R, 'cabeca', Z, .2 * h); return R, loc
    def morte(t):  # afunda: a coluna desaba e o corpo some na água
        R, loc = base(t, .3 * (1 - ss(0, 1, t)))
        for i, n in enumerate(COL): ad(R, n, X, -cv([(0, 0), (.3, .15), (1.4 + i * .05, -.28 - i * .02)], t)); ad(R, n, Y, .12 * cv([(0, 0), (1.4, 1)], t))
        ad(R, 'cabeca', X, -.4 * ss(.3, 1.4, t)); ad(R, 'mandibula', X, .5 * ss(0, .4, t))
        loc['col0'] = (0, 0, -cv([(0, 0), (.25, .05), (2.0, -.55)], t)); return R, loc
    CL = [('Idle', 6.4, base), ('Attack', 1.8, atk), ('Hit', .6, hit), ('Death', 2.0, morte)]
elif N == 'gigante_pedra':
    def base(t, amp=1):
        R = {}; T = 3.0; b = S2(t, T)
        ad(R, 'peito', X, .03 * b * amp); ad(R, 'cabeca', Z, .12 * S2(t, T * 2) * amp); ad(R, 'cabeca', X, -.03 * b)
        for s, L in ((1, 'E'), (-1, 'D')): ad(R, 'braco.%s1' % L, Y, s * (.05 * S2(t, T, -.6)) * amp); ad(R, 'braco.%s2' % L, X, .06 * S2(t, T, -1.1) * amp)
        return R, {'quadril': (0, 0, .006 * b)}
    def walk(t):  # passo pesado: pernas alternadas, tronco balança e afunda na pisada, braços em oposição
        R, loc = base(t, .4); T = 1.3; ph = 2 * math.pi * t / T
        for s, L, o in ((1, 'E', 0), (-1, 'D', math.pi)):
            ad(R, 'perna.%s1' % L, X, .45 * math.sin(ph + o)); ad(R, 'perna.%s2' % L, X, -.5 * max(0, math.sin(ph + o + 1.2)))
            ad(R, 'braco.%s1' % L, X, -.3 * math.sin(ph + o)); ad(R, 'braco.%s2' % L, X, -.2 * max(0, math.sin(ph + o - .5)))
        pis = abs(math.cos(ph)) ** 6; ad(R, 'quadril', Y, .07 * math.sin(ph)); ad(R, 'peito', Y, -.04 * math.sin(ph - .5)); ad(R, 'cabeca', X, .05 * pis)
        loc['quadril'] = (0, 0, .025 * abs(math.sin(ph)) - .02 * pis); return R, loc
    def atk(t):  # ergue os dois braços e esmaga o chão
        R, loc = base(t, .3); k = cv([(0, 0), (.45, 1), (.55, 1.05), (.62, -.5), (.9, -.45), (1.4, 0)], t)
        for s, L in ((1, 'E'), (-1, 'D')): ad(R, 'braco.%s1' % L, X, 1.6 * max(0, k) - .9 * max(0, -k)); ad(R, 'braco.%s2' % L, X, .6 * cv([(0, 0), (.45, .8), (.62, -.1), (1.4, 0)], t - .04))
        ad(R, 'peito', X, .25 * max(0, k) - .45 * max(0, -k)); ad(R, 'cabeca', X, .15 * k)
        loc['quadril'] = (0, 0, -.05 * max(0, -k)); return R, loc
    def hit(t):
        R, loc = base(t, .4); h = cv([(0, 0), (.08, 1), (.6, 0)], t); ad(R, 'peito', X, .2 * h); ad(R, 'cabeca', X, .25 * cv([(0, 0), (.12, 1), (.6, 0)], t))
        for L in 'ED': ad(R, 'braco.%s1' % L, X, .3 * cv([(0, 0), (.14, 1), (.6, 0)], t))
        return R, loc
    def morte(t):  # cai para trás, pesado
        R, loc = base(t, 0); k = cv([(0, 0), (.3, -.1), (1.3, 1)], t)
        ad(R, 'quadril', X, .9 * k); ad(R, 'peito', X, .3 * cv([(0, 0), (.4, -.1), (1.4, 1)], t)); ad(R, 'cabeca', X, .3 * cv([(0, 0), (1.5, 1)], t))
        for L in 'ED': ad(R, 'perna.%s1' % L, X, -.8 * k); ad(R, 'braco.%s1' % L, X, -1.2 * cv([(0, 0), (1.5, 1)], t))
        loc['quadril'] = (0, .1 * k, -.2 * k); return R, loc
    CL = [('Idle', 6.0, base), ('Walk', 1.3, walk), ('Attack', 1.4, atk), ('Hit', .6, hit), ('Death', 1.8, morte)]
else:
    pesado = N == 'beemote'
    def base(t, amp=1):
        R = {}; T = 2.6 if pesado else 1.8; b = S2(t, T)
        ad(R, 'peito', X, .025 * b * amp); ad(R, 'quadril', X, -.015 * b * amp)
        ad(R, 'pescoco', Z, .12 * S2(t, T * 2) * amp); ad(R, 'cabeca', Z, .15 * S2(t, T * 2, -.5) * amp); ad(R, 'cabeca', X, .05 * S2(t, T, 1) * amp)
        ad(R, 'mandibula', X, (0 if pesado else .05 + .04 * S2(t, T / 2)))
        ad(R, 'cauda1', Z, .2 * S2(t, T / 2 if not pesado else T)); ad(R, 'cauda2', Z, .3 * S2(t, T / 2 if not pesado else T, -.9))
        return R, {}
    def walk(t):  # trote (lobo: pares diagonais, rápido) / passo pesado (beemote)
        R, loc = base(t, .5); T = 1.2 if pesado else .6; ph = 2 * math.pi * t / T; A = .4 if pesado else .6
        for nm, o in (('pf.E', 0), ('pt.D', 0), ('pf.D', math.pi), ('pt.E', math.pi)):
            ad(R, nm + '1', X, A * math.sin(ph + o)); ad(R, nm + '2', X, -A * .8 * max(0, math.sin(ph + o + 1.3)))
        ad(R, 'peito', Y, .05 * math.sin(ph)); ad(R, 'cabeca', X, .06 * math.sin(2 * ph - .8)); ad(R, 'cauda1', X, .1 * math.sin(2 * ph - 1))
        loc['quadril'] = (0, 0, (.02 if pesado else .03) * abs(math.sin(ph)) - (.01 if pesado else 0)); return R, loc
    def atk(t):  # beemote: abaixa a cabeça e dá a cabeçada com o corpo todo; lobo: agacha e dá o bote mordendo
        R, loc = base(t, .3); pr = cv([(0, 0), (.45, 1), (.58, 0)], t); bo = cv([(0, 0), (.42, 0), (.58, 1), (.78, .8), (1.3, 0)], t)
        ad(R, 'quadril', X, .08 * pr - .1 * bo); ad(R, 'peito', X, .15 * pr - .2 * bo)
        ad(R, 'pescoco', X, (.3 if pesado else .25) * pr + (-.55 if pesado else -.35) * bo); ad(R, 'cabeca', X, (.2 * pr - .5 * bo) if pesado else (-.1 * pr + .25 * bo))
        ad(R, 'mandibula', X, (.25 if pesado else .7) * cv([(0, 0), (.4, .6), (.58, 1), (.66, 0), (1.3, 0)], t))
        for L in 'ED': ad(R, 'pt.%s1' % L, X, -.25 * pr + .3 * bo); ad(R, 'pf.%s1' % L, X, .2 * pr - .45 * bo)
        ad(R, 'cauda1', X, .3 * pr - .2 * bo); ad(R, 'cauda2', X, .4 * cv([(0, 0), (.5, 1), (.7, -.6), (1.3, 0)], t - .08))
        loc['quadril'] = (0, .06 * pr - (.14 if pesado else .12) * bo, -.03 * pr); return R, loc
    def hit(t):
        R, loc = base(t, .5); h = cv([(0, 0), (.07, 1), (.5, 0)], t) * (1 + .25 * math.sin(t * 26) * (1 - ss(0, .5, t)))
        ad(R, 'peito', X, .12 * h); ad(R, 'pescoco', X, .2 * h); ad(R, 'cabeca', Z, .2 * h); ad(R, 'cauda1', Z, -.3 * cv([(0, 0), (.12, 1), (.5, 0)], t))
        loc['quadril'] = (0, .04 * h, 0); return R, loc
    def morte(t):  # tomba de lado
        R, loc = base(t, 0); k = cv([(0, 0), (.25, -.1), (1.2, 1)], t)
        ad(R, 'quadril', Y, 1.45 * k); ad(R, 'pescoco', X, -.3 * cv([(0, 0), (1.4, 1)], t)); ad(R, 'cabeca', X, .4 * cv([(0, 0), (1.5, 1)], t))
        for nm in ('pf.E1', 'pf.D1', 'pt.E1', 'pt.D1'): ad(R, nm, X, .3 * cv([(0, 0), (1.5, 1)], t))
        loc['quadril'] = (0, 0, -(.12 if pesado else .18) * k); return R, loc
    CL = [('Idle', 5.2 if pesado else 3.6, base), ('Walk', 1.2 if pesado else .6, walk), ('Attack', 1.3, atk), ('Hit', .5, hit), ('Death', 1.6, morte)]
for nome, dur, f in CL: gravar(nome, dur, f)
bpy.ops.export_scene.gltf(filepath='/tmp/dr/%s_rig_bruto.glb' % N, export_format='GLB', export_animation_mode='NLA_TRACKS', export_skins=True, export_def_bones=False, export_optimize_animation_size=True)
