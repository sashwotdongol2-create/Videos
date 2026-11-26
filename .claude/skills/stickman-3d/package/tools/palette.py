# measure colour palettes: RicksClips videos vs our draft (day / night / interior split by luma), k-means swatches
import subprocess, sys, json, colorsys, numpy as np
from pathlib import Path
from PIL import Image, ImageDraw
OUT = Path(sys.argv[1]); OUT.mkdir(exist_ok=True)
def frames(v, fps="1"):
    r = subprocess.run(["ffmpeg","-v","error","-i",v,"-vf",f"fps={fps},scale=90:160","-f","rawvideo","-pix_fmt","rgb24","-"],capture_output=True)
    a = np.frombuffer(r.stdout,np.uint8); return a.reshape(-1,160,90,3)
def hsv(a):
    f=a.reshape(-1,3)/255.0; mx=f.max(1); mn=f.min(1); v=mx; s=np.where(mx>0,(mx-mn)/np.maximum(mx,1e-6),0)
    d=np.maximum(mx-mn,1e-6); r,g,b=f.T
    h=np.where(mx==r,((g-b)/d)%6,np.where(mx==g,(b-r)/d+2,(r-g)/d+4))*60
    return h,s,v
def kmeans(px,k=8,it=12):
    rng=np.random.default_rng(0); c=px[rng.choice(len(px),k,replace=False)].astype(float)
    for _ in range(it):
        d=((px[:,None,:]-c[None])**2).sum(2); l=d.argmin(1)
        c=np.array([px[l==i].mean(0) if (l==i).any() else c[i] for i in range(k)])
    n=np.bincount(l,minlength=k); o=np.argsort(-n); return c[o],n[o]/n.sum()
def stats(F,name):
    res={}
    L=F.reshape(len(F),-1,3).mean((1,2))
    cats={"night":F[L<70],"day":F[L>=70]}
    for cn,G in cats.items():
        if len(G)<3: continue
        px=G.reshape(-1,3); sub=px[np.random.default_rng(1).choice(len(px),min(60000,len(px)),replace=False)].astype(float)
        h,s,v=hsv(sub.astype(np.uint8))
        c,w=kmeans(sub,10)
        hist=np.histogram(h[s>0.25],bins=12,range=(0,360))[0]; hist=hist/hist.sum()
        res[cn]=dict(frames=len(G),meanL=float(sub.mean()),sat=float(s.mean()*100),sat_p75=float(np.percentile(s,75)*100),
            val=float(v.mean()*100),dark_frac=float((v<0.15).mean()),bright_frac=float((v>0.85).mean()),
            hue_hist=[round(float(x),3) for x in hist],swatches=[["#%02x%02x%02x"%tuple(int(x) for x in cc),round(float(ww),3)] for cc,ww in zip(c,w)])
    return res
srcs=json.loads(sys.argv[2]); allres={}
for name,vids in srcs.items():
    F=np.concatenate([frames(v) for v in vids]); allres[name]=stats(F,name)
json.dump(allres,open(OUT/"palette.json","w"),indent=1)
# swatch sheet
rows=[(n,c) for n in allres for c in allres[n]]
im=Image.new("RGB",(900,60*len(rows)+10),(30,30,30)); d=ImageDraw.Draw(im)
for i,(n,c) in enumerate(rows):
    r=allres[n][c]; y=10+i*60; d.text((5,y+5),f"{n}/{c}",fill=(255,255,255)); d.text((5,y+25),f"sat {r['sat']:.0f} val {r['val']:.0f} dark {r['dark_frac']:.2f}",fill=(200,200,200))
    x=220
    for hx,w in r["swatches"]:
        ww=int(w*660); d.rectangle([x,y,x+ww,y+50],fill=hx); x+=ww
im.save(OUT/"palette_sheet.png")
for n in allres:
    for c in allres[n]: r=allres[n][c]; print(n,c,"frames",r["frames"],"sat %.1f p75 %.1f val %.1f dark %.2f"%(r["sat"],r["sat_p75"],r["val"],r["dark_frac"]))
