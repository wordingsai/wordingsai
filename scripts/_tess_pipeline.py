# Classic pre-LLM OCR pipeline: proper image preprocessing -> Tesseract LSTM.
# Goal: close the gap to Gemma via engineering (deskew, denoise, line removal, binarize).
import fitz, cv2, numpy as np, subprocess, os, time, re

TESS = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
PDF  = r"D:\Richard\upwork-files\08 - Lead Broker Willis Re.pdf"
OUT  = r"D:\Richard\_compress_test"
PAGES = [0, 6]   # cover-with-table page + the dirty multi-column page
DPI  = 300

def render(pg, dpi):
    d = fitz.open(PDF); p = d[pg]
    pix = p.get_pixmap(dpi=dpi)
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
    if pix.n == 4: img = cv2.cvtColor(img, cv2.COLOR_RGBA2BGR)
    elif pix.n == 1: img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    else: img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
    d.close()
    return img

def deskew(gray):
    inv = cv2.bitwise_not(gray)
    th = cv2.threshold(inv, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]
    coords = np.column_stack(np.where(th > 0))
    if len(coords) < 100: return gray
    angle = cv2.minAreaRect(coords)[-1]
    angle = -(90 + angle) if angle < -45 else -angle
    if abs(angle) < 0.1 or abs(angle) > 10: return gray
    (h, w) = gray.shape
    M = cv2.getRotationMatrix2D((w//2, h//2), angle, 1.0)
    return cv2.warpAffine(gray, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)

def remove_lines(bin_img):
    # bin_img: text=black(0) on white(255). Work on inverted (text=white).
    inv = cv2.bitwise_not(bin_img)
    # horizontal rules
    hk = cv2.getStructuringElement(cv2.MORPH_RECT, (40, 1))
    hor = cv2.morphologyEx(inv, cv2.MORPH_OPEN, hk, iterations=1)
    # vertical rules (the | and ) bleed)
    vk = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 40))
    ver = cv2.morphologyEx(inv, cv2.MORPH_OPEN, vk, iterations=1)
    lines = cv2.add(hor, ver)
    cleaned = cv2.subtract(inv, lines)
    return cv2.bitwise_not(cleaned)

def preprocess(pg):
    img = render(pg, DPI)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = deskew(gray)
    gray = cv2.fastNlMeansDenoising(gray, None, h=10, templateWindowSize=7, searchWindowSize=21)
    binImg = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]
    binImg = remove_lines(binImg)
    out = os.path.join(OUT, f"_pp_{pg}.png")
    cv2.imwrite(out, binImg)
    return out

def tess(png, psm, oem=1):
    base = png.replace(".png", f"_p{psm}")
    t0 = time.time()
    subprocess.run([TESS, png, base, "--oem", str(oem), "--psm", str(psm), "-l", "eng"],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    ms = int((time.time()-t0)*1000)
    txt = open(base+".txt", encoding="utf-8", errors="replace").read() if os.path.exists(base+".txt") else ""
    return ms, txt

for pg in PAGES:
    png = preprocess(pg)
    print(f"\n################ PAGE {pg} (preprocessed 300dpi+deskew+denoise+lineremoval) ################")
    for psm in (4, 6):   # 4=single column of variable sizes, 6=uniform block
        ms, txt = tess(png, psm)
        # junk char metric: stray | ) [ that bleed from lines
        junk = len(re.findall(r'[\|\)\[]{1,}', txt))
        mojibake = txt.count("Compafi") + txt.count("Ã")
        print(f"  PSM {psm}: {ms}ms chars={len(txt)} strayLineChars={junk} mojibake={mojibake}")
    # show PSM 6 output sample
    _, sample = tess(png, 6)
    print("  --- PSM6 sample (first 900) ---")
    print("\n".join("   "+l for l in sample[:900].splitlines()))
