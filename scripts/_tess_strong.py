# Strengthened classic Tesseract pipeline. Techniques layered + measured by
# Tesseract's own per-word confidence (TSV) so we judge objectively, not by eye.
import fitz, cv2, numpy as np, subprocess, os, time, re, csv, io

TESS = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
PDF  = r"D:\Richard\upwork-files\08 - Lead Broker Willis Re.pdf"
OUT  = r"D:\Richard\_compress_test"
PAGES = [0, 6, 9]

def render(pg, dpi):
    d=fitz.open(PDF); p=d[pg]
    pix=p.get_pixmap(dpi=dpi, colorspace=fitz.csGRAY)  # render straight to gray
    img=np.frombuffer(pix.samples,dtype=np.uint8).reshape(pix.height,pix.width)
    d.close(); return img

def deskew(g):
    th=cv2.threshold(cv2.bitwise_not(g),0,255,cv2.THRESH_BINARY|cv2.THRESH_OTSU)[1]
    c=np.column_stack(np.where(th>0))
    if len(c)<100: return g
    a=cv2.minAreaRect(c)[-1]; a=-(90+a) if a<-45 else -a
    if abs(a)<0.1 or abs(a)>10: return g
    h,w=g.shape; M=cv2.getRotationMatrix2D((w//2,h//2),a,1.0)
    return cv2.warpAffine(g,M,(w,h),flags=cv2.INTER_CUBIC,borderMode=cv2.BORDER_REPLICATE)

def sauvola(g, win=25, k=0.2, R=128):
    g32=g.astype(np.float32)
    mean=cv2.boxFilter(g32,-1,(win,win),normalize=True)
    sqmean=cv2.boxFilter(g32*g32,-1,(win,win),normalize=True)
    std=cv2.sqrt(cv2.max(sqmean-mean*mean,0))
    thr=mean*(1+k*((std/R)-1))
    return np.where(g32>thr,255,0).astype(np.uint8)

def remove_lines_cc(binImg):
    # binImg: text black(0) on white(255). Invert -> text white.
    inv=cv2.bitwise_not(binImg)
    n,lab,stats,_=cv2.connectedComponentsWithStats(inv,connectivity=8)
    out=inv.copy(); H,W=inv.shape
    for i in range(1,n):
        x,y,w,h,area=stats[i]
        ar=w/max(1,h)
        # long thin horizontal OR vertical rules (lines), not text glyphs
        if (w>W*0.30 and h<6) or (h>H*0.20 and w<6):
            out[lab==i]=0
    return cv2.bitwise_not(out)

def upscale(g, factor):
    if factor<=1.0: return g
    return cv2.resize(g,None,fx=factor,fy=factor,interpolation=cv2.INTER_CUBIC)

def unsharp(g):
    blur=cv2.GaussianBlur(g,(0,0),3)
    return cv2.addWeighted(g,1.5,blur,-0.5,0)

def preprocess(pg, dpi=400, up=1.0, mode="sauvola"):
    g=render(pg,dpi); g=deskew(g)
    g=upscale(g,up)
    g=cv2.bilateralFilter(g,5,40,40)   # edge-preserving denoise
    g=unsharp(g)
    if mode=="sauvola": b=sauvola(g)
    else: b=cv2.threshold(g,0,255,cv2.THRESH_BINARY|cv2.THRESH_OTSU)[1]
    b=remove_lines_cc(b)
    out=os.path.join(OUT,f"_strong_{pg}.png"); cv2.imwrite(out,b); return out

CODE_FIX = {  # within a detected reference-code token only
}
def fix_codes(text):
    # Reference codes look like LSW307A, B080118299H22, LMA5139, AVN48B.
    # Within those tokens, OCR confuses O<->0, B<->8, I<->1, S<->5, Z<->2, Q<->0.
    def fix_umr(m):
        t=m.group(0)
        return t.replace('O','0').replace('Q','0').replace('I','1').replace('Z','2')
    # UMR-style: letter(s)+digits, length>=8 mixed
    text=re.sub(r'\bB[O0Q]\d{6,}[A-Z0-9]*\b', fix_umr, text)
    # market codes: (LSW|LMA|NMA|AVN|JCC|JC|CL) optional space then alnum
    def fix_mc(m):
        pre=m.group(1); rest=m.group(2).replace('O','0').replace('Q','0').replace('S','5').replace('I','1').replace('B','8')
        # keep trailing letter if it was a letter originally — only fix interior digits
        return f"{pre} {rest}" if ' ' in m.group(0) else pre+rest
    text=re.sub(r'\b(LSW|LMA|NMA|AVN|JCC|JC|CL|IUA)\s?([0-9OQSIB]{2,4}[A-Z]?)\b', fix_mc, text)
    return text

def strip_junk(text):
    # isolated line-bleed chars on their own / leading
    text=re.sub(r'(?m)^[\s\|\)\]\}\(<>"\'`~^]+$','',text)         # junk-only lines
    text=re.sub(r'(?m)^[\|\)\]\}]+\s*','',text)                    # leading bleed
    text=re.sub(r'[ \t]+\|[ \t]*$','',text,flags=re.M)            # trailing pipe
    text=re.sub(r'\n{3,}','\n\n',text)
    return text.strip()

def ocr_tsv(png, psm):
    base=png.replace(".png",f"_s{psm}")
    subprocess.run([TESS,png,base,"--oem","1","--psm",str(psm),"-l","eng",
                    "-c","preserve_interword_spaces=1","-c","tessedit_char_blacklist=|", "tsv"],
                   stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    rows=list(csv.DictReader(io.open(base+".tsv",encoding="utf-8",errors="replace"),delimiter="\t"))
    confs=[float(r["conf"]) for r in rows if r.get("conf") and r["conf"]!="-1" and r.get("text","").strip()]
    words=[r["text"] for r in rows if r.get("text","").strip()]
    return (sum(confs)/len(confs) if confs else 0), len(confs), " ".join(words)

for pg in PAGES:
    png=preprocess(pg, dpi=400, up=1.0, mode="sauvola")
    conf,nwords,raw = ocr_tsv(png, 6)
    cleaned = strip_junk(fix_codes(raw))
    junk=len(re.findall(r'[\|\)\]\}]',cleaned))
    print(f"\n### PAGE {pg}: meanConf={conf:.1f} words={nwords} strayJunk={junk}")
    # hard-token checks
    print(f"   UMR ok(B080118299H22): {'B080118299H22' in cleaned}")
    print(f"   codes: {re.findall(r'(?:LSW|LMA|AVN) ?[0-9]+[A-Z]?', cleaned)[:6]}")
    print(f"   sample: {cleaned[:280]!r}")
