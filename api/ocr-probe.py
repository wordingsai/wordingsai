# api/ocr-probe.py
# TEMPORARY diagnostic endpoint: discover whether Tesseract can run in Vercel's
# Python serverless runtime. Reports the runtime environment so we know if a
# vendored binary is needed. Safe/read-only. Delete after the OCR decision.
from http.server import BaseHTTPRequestHandler
import json
import os
import sys
import platform
import shutil
import subprocess
import glob


def _probe() -> dict:
    info = {}
    # 1. runtime identity (so we know which prebuilt binary we'd need)
    info["python"] = sys.version.split()[0]
    info["platform"] = platform.platform()
    try:
        u = os.uname()
        info["uname"] = {"sysname": u.sysname, "machine": u.machine, "release": u.release}
    except Exception as e:
        info["uname"] = f"n/a: {e}"
    info["cwd"] = os.getcwd()
    info["PATH"] = os.environ.get("PATH", "")

    # 2. is a tesseract binary anywhere on PATH?
    info["which_tesseract"] = shutil.which("tesseract")

    # 3. scan common locations for any vendored/system tesseract
    cands = []
    for pat in ("/usr/bin/tesseract", "/usr/local/bin/tesseract", "/opt/**/tesseract",
                "/var/task/**/tesseract", os.path.join(os.getcwd(), "**", "tesseract")):
        try:
            cands += glob.glob(pat, recursive=True)
        except Exception:
            pass
    info["found_binaries"] = list(dict.fromkeys(cands))[:10]

    # 4. can we even import the wrappers / image libs?
    for mod in ("pytesseract", "cv2", "PIL", "fitz"):
        try:
            m = __import__(mod)
            info[f"import_{mod}"] = getattr(m, "__version__", "ok")
        except Exception as e:
            info[f"import_{mod}"] = f"FAIL: {type(e).__name__}: {e}"

    # 5. try actually running tesseract --version (proves it executes)
    binpath = info["which_tesseract"] or (info["found_binaries"][0] if info["found_binaries"] else None)
    if binpath:
        try:
            out = subprocess.run([binpath, "--version"], capture_output=True, text=True, timeout=20)
            info["tesseract_version"] = (out.stdout or out.stderr).splitlines()[:2]
        except Exception as e:
            info["tesseract_version"] = f"exec FAIL: {e}"
    else:
        info["tesseract_version"] = "no binary to run"

    # 6. can we write + chmod + exec a file here? (tells us if a vendored binary
    #    could be made executable at runtime — Lambda /tmp is writable)
    try:
        p = "/tmp/_exectest.sh"
        with open(p, "w") as f:
            f.write("#!/bin/sh\necho exec_ok\n")
        os.chmod(p, 0o755)
        r = subprocess.run([p], capture_output=True, text=True, timeout=10)
        info["can_exec_tmp"] = r.stdout.strip() or r.stderr.strip()
    except Exception as e:
        info["can_exec_tmp"] = f"FAIL: {e}"

    return info


class handler(BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802
        body = json.dumps(_probe(), indent=2).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
