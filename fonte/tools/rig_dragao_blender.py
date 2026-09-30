import bpy, math
from mathutils import Vector, Quaternion, Matrix
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='/tmp/dr/dragao_plano.glb')
ob=[o for o in bpy.data.objects if o.type=='MESH'][0]
bpy.context.view_layer.objects.active=ob; ob.select_set(True)
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM'); bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
for o in list(bpy.data.objects):
    if o!=ob: bpy.data.objects.remove(o)
# ---- esqueleto (Blender: X lado, -Y frente/cabeça, Z cima) ----
arm=bpy.data.armatures.new('Esq'); ao=bpy.data.objects.new('Dragao',arm); bpy.context.collection.objects.link(ao)
bpy.context.view_layer.objects.active=ao; bpy.ops.object.mode_set(mode='EDIT')
B={}
def bone(n,h,t,p=None,conn=False):
    b=arm.edit_bones.new(n); b.head=Vector(h); b.tail=Vector(t); b.roll=0
    if p: b.parent=B[p]; b.use_connect=conn
    B[n]=b; return b
bone('quadril',(0,.02,.2),(0,-.12,.25))
bone('peito',(0,-.12,.25),(0,-.26,.33),'quadril',True)
bone('pescoco1',(0,-.26,.33),(0,-.33,.40),'peito',True)
bone('pescoco2',(0,-.33,.40),(0,-.385,.43),'pescoco1',True)
bone('cabeca',(0,-.385,.43),(0,-.49,.41),'pescoco2',True)
bone('mandibula',(0,-.39,.37),(0,-.47,.34),'cabeca')
c=[(0,.02,.2),(.02,.12,.15),(.03,.24,.12),(.04,.36,.08),(.04,.49,.12)]
for i in range(4): bone('cauda%d'%(i+1),c[i],c[i+1],'quadril' if i==0 else 'cauda%d'%i, i>0)
for s,L in ((1,'E'),(-1,'D')):
    w=[(s*.13,-.24,.40),(s*.28,-.22,.52),(s*.40,-.20,.52),(s*.48,-.15,.42)]
    for i in range(3): bone('asa%d.%s'%(i+1,L),w[i],w[i+1],'peito' if i==0 else 'asa%d.%s'%(i,L), i>0)
    bone('perna_f.'+L,(s*.12,-.27,.22),(s*.12,-.29,.01),'peito')
    bone('perna_t.'+L,(s*.13,.0,.18),(s*.13,.02,.01),'quadril')
bpy.ops.object.mode_set(mode='OBJECT')
print('OSSOS',len(arm.bones))
# ---- pesos automáticos ----
bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); ao.select_set(True); bpy.context.view_layer.objects.active=ao
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
vg=ob.vertex_groups; semPeso=sum(1 for v in ob.data.vertices if not any(g.weight>1e-3 for g in v.groups)); print('SEM_PESO',semPeso,len(ob.data.vertices))
if semPeso>len(ob.data.vertices)*.02:  # heat falhou (malha Tripo não fechada): pesos por distância aos ossos, simples
    for g in list(vg): vg.remove(g)
    segs=[(b.name,ao.matrix_world@b.head_local,ao.matrix_world@b.tail_local) for b in arm.bones]
    G={n:vg.new(name=n) for n,_,_ in segs}
    for v in ob.data.vertices:
        p=v.co; ds=[]
        for n,h,t in segs:
            if n.startswith('asa') and abs(p.x)<.15: continue
            if n.startswith('asa') and (p.x>0)!=(h.x>0): continue
            ab=t-h; u=max(0,min(1,(p-h).dot(ab)/ab.length_squared)); ds.append((((h+ab*u)-p).length,n))
        ds.sort(); top=ds[:3]; ws=[1/(d+.01)**4 for d,_ in top]; S=sum(ws)
        for (d,n),w in zip(top,ws): G[n].add([v.index],w/S,'REPLACE')
    print('PESOS: distancia')
# ---- animações ----
scn=bpy.context.scene; scn.render.fps=30
PB=ao.pose.bones
for pb in PB: pb.rotation_mode='QUATERNION'
def Q(pb,axis,ang):  # rotação num eixo do espaço do esqueleto -> espaço local do osso
    r=pb.bone.matrix_local.to_quaternion(); return r.inverted()@Quaternion(Vector(axis),ang)@r
def L(pb,v): return pb.bone.matrix_local.to_3x3().inverted()@Vector(v)
X,Y,Z=(1,0,0),(0,1,0),(0,0,1)
def ss(a,b,x):  # smoothstep
    x=max(0,min(1,(x-a)/(b-a))); return x*x*(3-2*x)
def curva(ks,t):  # [(tempo,valor)] com ease entre chaves
    if t<=ks[0][0]: return ks[0][1]
    for (a,va),(b,vb) in zip(ks,ks[1:]):
        if t<=b: return va+(vb-va)*ss(a,b,t)
    return ks[-1][1]
TB=2.4  # batida lenta e pesada
def batida(t): f=2*math.pi*t/TB; return math.sin(f+.6*math.sin(f))  # desce rápido, sobe devagar
def pose(t, atk=0,atkT=0, hit=0, morte=0, surge=0, look=1, asaK=1):
    """atk/hit/morte/surge = curvas já avaliadas (0..1) com atrasos por osso"""
    R={}; loc={}
    # asas: batida contínua com atraso nas pontas (follow-through)
    for s,Ls in ((1,'E'),(-1,'D')):
        for i,(amp,lag) in enumerate(((.5,0),(.32,.18),(.28,.34))):
            a=batida(t-lag)*amp*asaK
            a+=(-.5*surge(t-lag*.5) if surge else 0)            # abre bem alto no rugido
            a+=(.35*atk(t-.05-lag*.6)[1] if atk else 0)          # no preparo sobe as asas
            a+=(-.25*hit(t-lag*.6) if hit else 0)
            if morte: a=a*(1-morte(t))+ (.9 if i==0 else .5)*morte(t-lag)   # dobra as asas caindo
            R['asa%d.%s'%(i+1,Ls)]=[(Y,s*a)]
            if i==0: R['asa1.'+Ls].append((Z,s*.12*math.sin(2*math.pi*t/TB+1.2)*asaK))
    # corpo: respira e flutua junto com a batida (sobe na descida da asa)
    br=math.sin(2*math.pi*t/TB*2)*.02
    zf=.018*math.sin(2*math.pi*t/TB-1.1)
    R['quadril']=[(X,br*.5)]; R['peito']=[(X,br)]
    loc['quadril']=(0,0,zf)
    # olhando em volta
    yaw=look*(.22*math.sin(2*math.pi*t/(TB*2))+.06*math.sin(2*math.pi*t/TB*3+1)); pit=look*.07*math.sin(2*math.pi*t/(TB*2)*2+.5)
    R['pescoco1']=[(Z,yaw*.4),(X,pit*.5)]; R['pescoco2']=[(Z,yaw*.35),(X,pit*.5)]; R['cabeca']=[(Z,yaw*.4),(X,pit)]; R['mandibula']=[(X,0)]
    # cauda: onda com atraso em cada osso
    for i in range(4): R['cauda%d'%(i+1)]=[(Z,.13*(1+i*.3)*math.sin(2*math.pi*t/TB*2-i*.7)),(X,.05*math.sin(2*math.pi*t/TB-i*.5))]
    for L_ in 'ED':
        R['perna_f.'+L_]=[(X,.12*math.sin(2*math.pi*t/TB-1.8))]; R['perna_t.'+L_]=[(X,-.1*math.sin(2*math.pi*t/TB-2.0))]
    if atk:
        # atk(t) -> (preparo, abre asas, bote); cada osso com atraso
        for n,(kx,lag) in {'quadril':(.10,0),'peito':(.25,.03),'pescoco1':(.35,.06),'pescoco2':(.3,.09),'cabeca':(.35,.12)}.items():
            pr,_,bo=atk(t-lag); R[n].append((X,kx*pr-kx*1.6*bo))
        pr,_,bo=atk(t-.12); R['mandibula'].append((X,.6*bo+.15*pr))
        for i in range(4): pr,_,bo=atk(t-.1-i*.07); R['cauda%d'%(i+1)].append((X,-.18*pr+.22*bo))
        pr,_,bo=atk(t); lz=loc['quadril']; loc['quadril']=(0,lz[1]+ .03*pr-.08*bo, lz[2]+.03*pr-.02*bo)
    if hit:
        for n,(kx,kz,lag) in {'quadril':(.08,.05,0),'peito':(.16,.08,.02),'pescoco1':(.2,.12,.05),'pescoco2':(.15,.1,.07),'cabeca':(.2,.15,.09)}.items():
            h=hit(t-lag); R[n]+= [(X,kx*h),(Z,kz*h)]
        for i in range(4): R['cauda%d'%(i+1)].append((Z,-.25*hit(t-.08-i*.06)))
        lz=loc['quadril']; loc['quadril']=(0,lz[1]+.04*hit(t),lz[2])
    if surge:
        for n,(kx,lag) in {'peito':(.3,.0),'pescoco1':(.35,.05),'pescoco2':(.3,.1),'cabeca':(.45,.15)}.items(): R[n].append((X,kx*surge(t-lag)))
        rugido=surge(t-.2)*ss(.9,1.1,t)*(1-ss(1.7,2.0,t)); R['mandibula'].append((X,.7*rugido)); R['cabeca'].append((Z,.05*math.sin(t*40)*rugido))
        lz=loc['quadril']; loc['quadril']=(0,0,lz[2]-.12*(1-ss(0,.9,t)))
    if morte:
        m=morte(t)
        for n,(kx,lag) in {'quadril':(-.15,0),'peito':(-.2,.05),'pescoco1':(-.5,.12),'pescoco2':(-.4,.18),'cabeca':(-.3,.24)}.items(): R[n].append((X,kx*morte(t-lag)))
        for i in range(4): R['cauda%d'%(i+1)].append((Z,.25*morte(t-.1-i*.08)))
        R['quadril'].append((Y,1.0*morte(t-.15)))  # tomba de lado
        loc['quadril']=(0,0,loc['quadril'][2]*(1-m)-.2*curva([(0,0),(.35,-.15),(1.1,1)],t))
    return R,loc
def gravar(nome,dur,**kw):
    act=bpy.data.actions.new(nome); ao.animation_data_create(); ao.animation_data.action=act
    for fr in range(0,int(dur*30)+1):
        R,loc=pose(fr/30,**kw)
        for pb in PB:
            q=Quaternion()
            for ax,a in R.get(pb.name,[]): q=Q(pb,ax,a)@q
            pb.rotation_quaternion=q; pb.keyframe_insert('rotation_quaternion',frame=fr)
            if pb.name in loc: pb.location=L(pb,loc[pb.name]); pb.keyframe_insert('location',frame=fr)
    act.use_fake_user=True
    tr=ao.animation_data.nla_tracks.new(); tr.name=nome; tr.strips.new(nome,0,act); ao.animation_data.action=None
AT=1.3
def atk(t):  # preparo 0-.45 (recua), bote .45-.62, volta até 1.3
    pr=curva([(0,0),(.45,1),(.6,0)],t); bo=curva([(0,0),(.42,0),(.6,1),(.8,.85),(AT,0)],t); return (pr,0,bo)
hit=lambda t: curva([(0,0),(.07,1),(.5,0)],t)*(1+.25*math.sin(t*25)*(1-ss(0,.5,t)))
morte=lambda t: curva([(0,0),(.25,-.15),(1.2,1)],t)
surge=lambda t: curva([(0,-.6),(.6,-.3),(1.0,1),(1.7,1),(2.2,0)],t)
gravar('Idle',TB*2)
gravar('Attack',AT,atk=atk)
gravar('Hit',.6,hit=hit)
gravar('Death',1.8,morte=morte,asaK=.5)
gravar('Spawn',2.2,surge=surge)
bpy.ops.export_scene.gltf(filepath='/tmp/dr/dragao_rig_bruto.glb',export_format='GLB',export_animation_mode='NLA_TRACKS',export_skins=True,export_image_format='AUTO',export_def_bones=False,export_optimize_animation_size=True,use_selection=False)
bpy.ops.wm.save_as_mainfile(filepath='/tmp/dr/dragao_rig.blend')
