from PIL import Image
import numpy as np, sys
K='/workspace/assets-src/'
A=K+'KayKit-Character-Pack-Adventures-1.0/addons/kaykit_character_pack_adventures/Characters/gltf/'
S=K+'KayKit-Character-Pack-Skeletons-1.0/addons/kaykit_character_pack_skeletons/Characters/gltf/'
def hx(h): return np.array([int(h[i:i+2],16) for i in (1,3,5)],float)
def recolor(src,dst,mapping,cw=128,ch=256):
    im=np.array(Image.open(src).convert('RGBA')).astype(float)
    for (r,c),(top,bot) in mapping.items():
        cell=im[r*ch:(r+1)*ch, c*cw:(c+1)*cw, :3]
        lum=cell.mean(axis=2)
        # relative shading: use per-row mean of the main strip to follow gradient, plus highlight strip ratio
        main=lum[:, :100].mean(axis=1, keepdims=True)
        ratio=np.clip(lum/np.maximum(main,1),0.6,1.6)
        t=np.linspace(0,1,ch)[:,None,None]
        grad=hx(top)*(1-t)+hx(bot)*t
        im[r*ch:(r+1)*ch, c*cw:(c+1)*cw, :3]=np.clip(grad*ratio[:,:,None],0,255)
    Image.fromarray(im.astype(np.uint8)).save(dst)
# Davi: cream linen tunic, brown wool hood/cape, leather
recolor(A+'rogue_texture.png','/tmp/tx/davi.png',{
 (1,0):('#f4ead2','#c9a877'),   # tunic
 (1,1):('#9a6a3e','#5a3a20'),   # hood/cape wool
 (0,1):('#7a4a26','#4a2a14'),   # hair
 (0,0):('#f1c29a','#c98a62'),   # skin
 (2,5):('#8a5a34','#5a3a1e'),   # arm wraps
 (2,3):('#b58a5a','#7a5634'),   # legs
 (1,7):('#6e4a2c','#3e2716'),   # boots
 (0,3):('#d9a441','#9a6a1e'),   # belt buckle -> gold
 (0,5):('#8a5a34','#5a3a1e'),
 (0,6):('#6e4a2c','#40291a'),
 (2,6):('#9a9a92','#5e5e58'),   # throwable -> stone
})
# Guardião: white-silver armor, gold trims, royal blue cape
recolor(A+'knight_texture.png','/tmp/tx/guardiao.png',{
 (0,3):('#f3f1ea','#b9b4a6'),
 (0,7):('#ffd66b','#c08a1e'),
 (0,4):('#ffd66b','#c08a1e'),
 (0,6):('#ffd66b','#b07818'),
 (1,0):('#3d7bff','#16307a'),
 (1,7):('#6a5a48','#3a2e24'),
 (1,2):('#e8e2d0','#a8a090'),
})
recolor(S+'skeleton_texture.png','/tmp/tx/sombra.png',{
 (1,1):('#4a3a5e','#1a1024'),   # bones -> dark purple obsidian
 (0,5):('#3a0d1e','#12040a'),   # cloak dark wine
 (0,6):('#2a2030','#100a14'),
 (0,7):('#5a1020','#200408'),
 (0,3):('#6a2040','#2a0a18'),
 (0,2):('#301828','#100810'),
})
print('ok')
