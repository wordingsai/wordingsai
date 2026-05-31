# api/tess-probe.py  — TEMPORARY: prove the vendored Tesseract runs on Vercel.
# GET /api/tess-probe. Delete after the result.
from http.server import BaseHTTPRequestHandler
import json, os, shutil, subprocess, glob


def _probe() -> dict:
    info = {}
    here = os.path.dirname(os.path.abspath(__file__))
    vend = os.path.join(here, "_tess")
    info["fn_dir"] = here
    info["vendor_dir_exists"] = os.path.isdir(vend)
    info["cwd"] = os.getcwd()
    if not info["vendor_dir_exists"]:
        # search the deployment for _tess anywhere, and show the layout
        found = []
        for base in ("/var/task", os.getcwd(), here, "/var/task/api", "/"):
            try:
                for root, dirs, files in os.walk(base):
                    if root.count(os.sep) - base.count(os.sep) > 3:
                        dirs[:] = []
                        continue
                    if "_tess" in os.path.basename(root) or "tesseract" in [f for f in files]:
                        found.append(root)
            except Exception:
                pass
        info["search_found_tess"] = found[:10]
        try:
            info["ls_var_task"] = sorted(os.listdir("/var/task"))[:30]
            info["ls_fn_dir"] = sorted(os.listdir(here))[:30]
            if os.path.isdir("/var/task/api"):
                info["ls_var_task_api"] = sorted(os.listdir("/var/task/api"))[:30]
        except Exception as e:
            info["ls_err"] = str(e)
        # try the first found path
        for f in found:
            if os.path.isdir(os.path.join(f, "bin")):
                vend = f; info["vendor_dir_exists"] = True; break
        if not info["vendor_dir_exists"]:
            info["verdict"] = "VENDOR NOT SHIPPED — see search/ls above"
            return info
    for d in ("bin", "lib", "tessdata"):
        p = os.path.join(vend, d)
        info[f"{d}_files"] = sorted(os.listdir(p)) if os.path.isdir(p) else "MISSING"

    binp = os.path.join(vend, "bin", "tesseract")
    libp = os.path.join(vend, "lib")
    datap = os.path.join(vend, "tessdata")

    # copy to /tmp (proven exec-capable) and run
    try:
        tmp = "/tmp/_tess"
        os.makedirs(tmp + "/bin", exist_ok=True)
        os.makedirs(tmp + "/lib", exist_ok=True)
        shutil.copy(binp, tmp + "/bin/tesseract")
        for so in glob.glob(libp + "/*"):
            shutil.copy(so, tmp + "/lib/")
        os.chmod(tmp + "/bin/tesseract", 0o755)
        env = dict(os.environ)
        env["LD_LIBRARY_PATH"] = tmp + "/lib"
        env["TESSDATA_PREFIX"] = datap
        r = subprocess.run([tmp + "/bin/tesseract", "--version"],
                           capture_output=True, text=True, env=env, timeout=25)
        info["version_run"] = {"rc": r.returncode,
                               "out": (r.stdout or "")[:160],
                               "err": (r.stderr or "")[:240]}
        # real OCR: PIL draws text -> tesseract reads it
        from PIL import Image, ImageDraw
        img = Image.new("RGB", (700, 90), "white")
        ImageDraw.Draw(img).text((15, 30), "Asbestos Exclusion Clause LSW346", fill="black")
        img.save("/tmp/_t.png")
        r2 = subprocess.run([tmp + "/bin/tesseract", "/tmp/_t.png", "/tmp/_t_out",
                             "--tessdata-dir", datap, "-l", "eng", "--psm", "7"],
                            capture_output=True, text=True, env=env, timeout=30)
        txt = ""
        if os.path.exists("/tmp/_t_out.txt"):
            txt = open("/tmp/_t_out.txt", encoding="utf-8", errors="replace").read().strip()
        info["ocr_run"] = {"rc": r2.returncode, "text": txt, "err": (r2.stderr or "")[:160]}
        info["verdict"] = "TESSERACT RUNS + OCR OK" if txt else (
            "BINARY RUNS but OCR empty" if r.returncode == 0 else "FAILED")
    except Exception as e:
        info["verdict"] = f"FAIL: {type(e).__name__}: {e}"

    for mod in ("cv2", "numpy", "PIL", "fitz", "pytesseract"):
        try:
            info[f"import_{mod}"] = getattr(__import__(mod), "__version__", "ok")
        except Exception as e:
            info[f"import_{mod}"] = f"FAIL: {type(e).__name__}"
    return info


class handler(BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802
        body = json.dumps(_probe(), indent=2).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
