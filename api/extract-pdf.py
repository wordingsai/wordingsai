"""
Layout-aware PDF extraction using pdfplumber.

Vercel Python serverless function. Accepts a PDF (multipart/form-data or base64
JSON body), returns:
  - text:    full document text with layout preserved (extract_text(layout=True))
  - pages:   per-page {text, width, height, tables}
  - tables:  flattened list of all tables across all pages (markdown + raw rows)
  - meta:    page count, char count, parser version, ms

Endpoint: POST /api/extract-pdf

Multipart form field 'file' is accepted, or JSON body
  { "pdf_base64": "<base64 string>", "filename": "x.pdf" }

Layout preservation matters for insurance slips/schedules where premium tables,
cover-limit grids and endorsement schedules carry meaning in their spatial
arrangement that flat text loses.
"""
from __future__ import annotations

import base64
import hashlib
import io
import json
import os
import re
import subprocess
import tempfile
import threading
import time
import urllib.error
import urllib.request
import zipfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from http.server import BaseHTTPRequestHandler
from typing import Any
from urllib.parse import parse_qs, quote

import pdfplumber

try:
    import fitz  # PyMuPDF — render dirty pages to images for OCR
except Exception:  # pragma: no cover
    fitz = None  # type: ignore[assignment]


MAX_BYTES = 50 * 1024 * 1024  # 50 MB cap (matches upload UI limit)

# ── Gemma vision OCR (self-heal dirty/scanned pages) ─────────────────────────
# Richard's scanned reinsurance slips ship a DIRTY embedded text layer
# ("Vsbestos", "andWales", glued words, jumbled columns). pdfplumber reads that
# layer literally, so garbage in → garbage out. When a page's text looks dirty
# we re-OCR that page from its rendered image with Gemma vision, which reads the
# picture and is immune to the bad text layer. Gemma primary; Tesseract hybrid
# is a planned later patch.
OCR_MODEL = os.environ.get("OCR_MODEL", "gemma-4-31b-it")
OCR_DPI = int(os.environ.get("OCR_DPI", "200"))
OCR_MAX_WORKERS = int(os.environ.get("OCR_MAX_WORKERS", "6"))
OCR_MAX_PAGES = int(os.environ.get("OCR_MAX_PAGES", "40"))  # safety cap per call
_GEMINI_KEY = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or ""

_OCR_PROMPT = (
    "Transcribe all printed text in this image exactly as it appears, line by "
    "line, top to bottom. Preserve spelling, reference numbers and clause "
    "headings exactly. Output only the transcription, nothing else."
)
# A "glued" token: lowercase run, an uppercase, more lowercase, no space —
# e.g. "andWales", "Reinsurerthe". Rare in clean text, common in dirty OCR.
_GLUED_RE = re.compile(r"[a-z]{2,}[A-Z][a-z]{2,}")
_ALLOWED_RE = re.compile(r"""[A-Za-z0-9\s.,;:%/()\-'"&$£€@#*+=?!\[\]]""")


def _page_is_dirty(text: str) -> bool:
    """True if a page's pdfplumber text looks like a low-quality scanned layer
    (high glued-word or junk-char rate). Conservative: clean digital pages
    score ~0 and are left untouched."""
    t = (text or "").strip()
    if len(t) < 60:
        return True  # almost no text → image page, OCR it
    words = t.split()
    glued_ratio = len(_GLUED_RE.findall(t)) / max(1, len(words))
    junk = sum(1 for ch in t if not _ALLOWED_RE.match(ch))
    junk_ratio = junk / max(1, len(t))
    return glued_ratio > 0.06 or junk_ratio > 0.12


def _ocr_page_gemma(png_bytes: bytes, tries: int = 3) -> str:
    """OCR one rendered page image with Gemma vision. Uses thinkingLevel
    MINIMAL (the only suppression honored on the hosted API) and reads the
    NON-thought response part. Returns "" on failure (caller keeps plumber text)."""
    if not _GEMINI_KEY:
        return ""
    body = json.dumps({
        "contents": [{"role": "user", "parts": [
            {"inline_data": {"mime_type": "image/png",
                             "data": base64.b64encode(png_bytes).decode()}},
            {"text": _OCR_PROMPT}]}],
        "generationConfig": {"temperature": 0, "maxOutputTokens": 32768,
                             "thinkingConfig": {"thinkingLevel": "MINIMAL"}},
    }).encode()
    url = (f"https://generativelanguage.googleapis.com/v1beta/models/"
           f"{OCR_MODEL}:generateContent?key={_GEMINI_KEY}")
    for attempt in range(tries):
        try:
            req = urllib.request.Request(
                url, data=body, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=120) as resp:
                j = json.loads(resp.read())
            parts = (j.get("candidates", [{}])[0]
                     .get("content", {}).get("parts", []))
            txt = "\n".join(p["text"] for p in parts
                            if not p.get("thought") and p.get("text")).strip()
            if txt:
                return txt
        except urllib.error.HTTPError as e:  # type: ignore[attr-defined]
            if e.code in (429, 500, 503):
                time.sleep(4 * (attempt + 1))
                continue
            return ""
        except Exception:
            time.sleep(3 * (attempt + 1))
    return ""


# ── Tesseract OCR (free, offline first pass for the hybrid engine) ────────────
# Vercel's Python runtime = AWS Lambda Amazon Linux 2 (x86-64) with NO system
# tesseract binary, and includeFiles is unreliable for @vercel/python. So we
# fetch a prebuilt AL2-x86 tesseract bundle (bweigel/aws-lambda-tesseract-layer
# v5.3.9 — verified ELF x86-64) into /tmp (exec-capable) on cold start, verify
# its SHA256, and point the loader at the vendored .so libs + tessdata. The whole
# path is fail-safe: any failure returns "" so the caller falls back to Gemma.
OCR_ENGINE = os.environ.get("OCR_ENGINE", "gemma").lower()  # gemma|tesseract|hybrid
TESS_BUNDLE_URL = os.environ.get(
    "TESS_BUNDLE_URL",
    "https://github.com/bweigel/aws-lambda-tesseract-layer/releases/download/"
    "v5.3.9/tesseract-al2-x86.zip",
)
# SHA256 of the bytes we inspected — run exactly that binary, not whatever a URL
# happens to serve later. Set TESS_BUNDLE_SHA256="" to skip the check.
TESS_BUNDLE_SHA256 = os.environ.get(
    "TESS_BUNDLE_SHA256",
    "3a0db40839b7d83f16816a1d35b6daccd0a01713653eb21668c8c064b18a0eff",
)
TESS_DIR = os.environ.get("TESS_DIR", "/tmp/tess")
TESS_LANG = os.environ.get("TESS_LANG", "eng")
TESS_PSM = os.environ.get("TESS_PSM", "6")  # 6 = assume a uniform block of text
_tess_lock = threading.Lock()
_tess_bin: str | None = None  # resolved binary path; None once tried & failed
_tess_tried = False


def _tess_env() -> dict[str, str]:
    """Process env with the vendored loader + tessdata paths prepended."""
    env = dict(os.environ)
    env["LD_LIBRARY_PATH"] = (
        os.path.join(TESS_DIR, "lib") + ":" + env.get("LD_LIBRARY_PATH", "")
    )
    env["TESSDATA_PREFIX"] = os.path.join(TESS_DIR, "tesseract", "share", "tessdata")
    return env


def _ensure_tesseract() -> str | None:
    """Download + unpack the AL2 tesseract bundle into /tmp on first use and
    return the path to the binary. Cached across warm invocations (the container
    keeps /tmp). Returns None on any failure so callers fall back to Gemma."""
    global _tess_bin, _tess_tried
    if _tess_tried:
        return _tess_bin
    with _tess_lock:
        if _tess_tried:
            return _tess_bin
        _tess_tried = True
        binpath = os.path.join(TESS_DIR, "bin", "tesseract")
        try:
            if not os.path.exists(binpath):
                os.makedirs(TESS_DIR, exist_ok=True)
                req = urllib.request.Request(
                    TESS_BUNDLE_URL, headers={"User-Agent": "wordingsai-extract"}
                )
                with urllib.request.urlopen(req, timeout=90) as resp:
                    data = resp.read()
                if TESS_BUNDLE_SHA256:
                    if hashlib.sha256(data).hexdigest() != TESS_BUNDLE_SHA256:
                        _tess_bin = None
                        return None
                zpath = os.path.join(TESS_DIR, "bundle.zip")
                with open(zpath, "wb") as f:
                    f.write(data)
                with zipfile.ZipFile(zpath) as z:
                    z.extractall(TESS_DIR)
                try:
                    os.remove(zpath)
                except Exception:
                    pass
            os.chmod(binpath, 0o755)
            # Self-check: the binary must actually run on this runtime (glibc /
            # libstdc++ resolution). If `--version` fails, disable tesseract.
            chk = subprocess.run(
                [binpath, "--version"], capture_output=True, timeout=20,
                env=_tess_env(),
            )
            if chk.returncode != 0:
                _tess_bin = None
                return None
            _tess_bin = binpath
            return _tess_bin
        except Exception:
            _tess_bin = None
            return None


def _preprocess_for_tess(png_bytes: bytes) -> bytes:
    """Pillow-only page-image cleanup (cv2/OpenCV is NOT available on Vercel):
    grayscale → autocontrast → unsharp. Best-effort; returns input on failure."""
    try:
        from PIL import Image, ImageFilter, ImageOps

        im = Image.open(io.BytesIO(png_bytes))
        im = ImageOps.grayscale(im)
        im = ImageOps.autocontrast(im, cutoff=1)
        im = im.filter(ImageFilter.UnsharpMask(radius=1.5, percent=150, threshold=3))
        buf = io.BytesIO()
        im.save(buf, format="PNG")
        return buf.getvalue()
    except Exception:
        return png_bytes


# Reference-code repair: OCR confuses O/0, I/1, S/5, B/8 inside short codes like
# LSW357A. Only applied to the code token, never to body prose.
_CODE_FIX_RE = re.compile(
    r"\b(LSW|LMA|NMA|AVN|JCC|JC|CL|IUA|LsW|Lsw)\s?([0-9OQISB]{2,4}[A-Za-z]?)\b"
)
_JUNK_LINE_RE = re.compile(r"(?m)^[\s|)\]}<>'\"`~^*_.]+$")


def _postprocess_ocr(text: str) -> str:
    """Code-aware repair + junk-line strip on raw tesseract output."""
    def _mc(m: re.Match[str]) -> str:
        pre = m.group(1).upper()
        rest = (
            m.group(2).upper().replace("O", "0").replace("Q", "0")
            .replace("I", "1").replace("S", "5").replace("B", "8")
        )
        return f"{pre}{rest}"

    text = _CODE_FIX_RE.sub(_mc, text)
    text = _JUNK_LINE_RE.sub("", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def _ocr_page_tesseract(png_bytes: bytes) -> str:
    """OCR one rendered page image with the vendored tesseract binary. Returns ""
    on any failure (caller falls back to Gemma / keeps the pdfplumber text)."""
    binp = _ensure_tesseract()
    if not binp:
        return ""
    imgpath = outbase = None
    try:
        img = _preprocess_for_tess(png_bytes)
        with tempfile.NamedTemporaryFile(
            suffix=".png", dir="/tmp", delete=False
        ) as tf:
            tf.write(img)
            imgpath = tf.name
        outbase = imgpath + "_out"
        # --tessdata-dir explicitly: tesseract 4/5 changed TESSDATA_PREFIX
        # semantics, so we point straight at the folder holding eng.traineddata.
        tessdata = os.path.join(TESS_DIR, "tesseract", "share", "tessdata")
        subprocess.run(
            [binp, imgpath, outbase, "-l", TESS_LANG, "--oem", "1",
             "--psm", TESS_PSM, "--tessdata-dir", tessdata],
            capture_output=True, timeout=90, env=_tess_env(),
        )
        txtpath = outbase + ".txt"
        if not os.path.exists(txtpath):
            return ""
        with open(txtpath, encoding="utf-8", errors="ignore") as f:
            return _postprocess_ocr(f.read())
    except Exception:
        return ""
    finally:
        for p in (imgpath, (outbase + ".txt") if outbase else None):
            if p:
                try:
                    os.remove(p)
                except Exception:
                    pass


def _ocr_page(engine: str, png_bytes: bytes, current_text: str) -> tuple[str, str]:
    """Dispatch one dirty page to the chosen OCR engine. Returns
    (text, method_used). For hybrid: tesseract first (free); if its result is
    weak, let Gemma heal and keep whichever is longer."""
    if engine == "tesseract":
        return _ocr_page_tesseract(png_bytes), "tesseract"
    if engine == "hybrid":
        t = _ocr_page_tesseract(png_bytes)
        # Accept the free tesseract pass only if it's solid: decent length and
        # not itself dirty. Otherwise fall through to Gemma.
        if t and len(t) >= max(80, len(current_text)) and not _page_is_dirty(t):
            return t, "tesseract"
        g = _ocr_page_gemma(png_bytes)
        if g and (not t or len(g) >= len(t)):
            return g, "gemma"
        return (t, "tesseract") if t else (g, "gemma")
    return _ocr_page_gemma(png_bytes), "gemma"


def _table_to_markdown(table: list[list[str | None]]) -> str:
    """Convert a pdfplumber-extracted table (list of rows) to GitHub markdown."""
    if not table:
        return ""
    # Normalize: replace None with "" and strip
    cleaned = [[(c or "").strip().replace("\n", " ") for c in row] for row in table]
    if not cleaned or not cleaned[0]:
        return ""
    header = cleaned[0]
    body = cleaned[1:] if len(cleaned) > 1 else []
    lines = []
    lines.append("| " + " | ".join(header) + " |")
    lines.append("| " + " | ".join("---" for _ in header) + " |")
    for row in body:
        # Pad row to header length
        padded = row + [""] * (len(header) - len(row))
        lines.append("| " + " | ".join(padded[: len(header)]) + " |")
    return "\n".join(lines)


def _is_real_table(table: list[list[str | None]]) -> bool:
    """Heuristic to drop false-positive tables (aligned text that isn't a
    grid). Require >= 2 rows, >= 2 columns, and at least 25% non-empty cells.
    """
    if not table or len(table) < 2 or not table[0] or len(table[0]) < 2:
        return False
    cells = [c for row in table for c in row]
    if not cells:
        return False
    non_empty = sum(1 for c in cells if (c or "").strip())
    return non_empty / len(cells) >= 0.25


# Only treat ruled grids as tables (avoids columns of aligned text being
# mis-read as tables). Mirrors the ParkerJones extraction approach.
_TABLE_SETTINGS = {
    "vertical_strategy": "lines_strict",
    "horizontal_strategy": "lines_strict",
}


def _extract(pdf_bytes: bytes, engine: str | None = None) -> dict[str, Any]:
    t0 = time.time()
    engine = (engine or OCR_ENGINE or "gemma").lower()
    if engine not in ("gemma", "tesseract", "hybrid"):
        engine = "gemma"
    out_pages: list[dict[str, Any]] = []
    out_tables: list[dict[str, Any]] = []
    full_text_parts: list[str] = []

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for idx, page in enumerate(pdf.pages, start=1):
            # Layout-preserving text (keeps column structure, indentation).
            page_text = page.extract_text(layout=True) or ""
            try:
                tables_raw = page.extract_tables(_TABLE_SETTINGS) or []
            except Exception:
                tables_raw = page.extract_tables() or []
            tables_raw = [t for t in tables_raw if _is_real_table(t)]
            tables_md = [_table_to_markdown(t) for t in tables_raw]

            out_pages.append(
                {
                    "page": idx,
                    "width": page.width,
                    "height": page.height,
                    "text": page_text,
                    "tables": tables_md,
                }
            )

            for ti, (raw, md) in enumerate(zip(tables_raw, tables_md), start=1):
                out_tables.append(
                    {
                        "page": idx,
                        "table_index": ti,
                        "rows": raw,
                        "markdown": md,
                    }
                )

            full_text_parts.append(f"\n\n--- PAGE {idx} ---\n\n{page_text}")

    # ── OCR self-heal: re-OCR dirty/scanned pages from their rendered image ──
    # pdfplumber gave us each page's text above; pages whose text looks like a
    # bad scanned layer get re-OCR'd. Clean digital pages are left exactly as-is
    # (zero OCR calls, no cost). Engine: gemma (default), tesseract (free,
    # offline), or hybrid (tesseract first, Gemma heals the weak pages).
    ocr_pages = 0
    ocr_method = ""
    ocr_counts: dict[str, int] = {}
    page_texts = [p["text"] for p in out_pages]
    # gemma needs an API key; tesseract/hybrid only need a renderer (tesseract
    # bootstraps its own binary and degrades to Gemma/plumber if that fails).
    can_run = fitz is not None and (engine != "gemma" or bool(_GEMINI_KEY))
    if can_run:
        dirty_idx = [i for i, txt in enumerate(page_texts) if _page_is_dirty(txt)]
        # safety cap: never fire more than OCR_MAX_PAGES pages in one invocation
        dirty_idx = dirty_idx[:OCR_MAX_PAGES]
        if dirty_idx:
            ocr_method = engine
            workers = (
                OCR_MAX_WORKERS if engine == "gemma"
                else int(os.environ.get("TESS_MAX_WORKERS", "2"))
            )
            try:
                doc = fitz.open(stream=pdf_bytes, filetype="pdf")
                rendered: dict[int, bytes] = {}
                for i in dirty_idx:
                    try:
                        pix = doc[i].get_pixmap(dpi=OCR_DPI)
                        rendered[i] = pix.tobytes("png")
                    except Exception:
                        pass
                doc.close()
                with ThreadPoolExecutor(max_workers=max(1, workers)) as ex:
                    futs = {
                        ex.submit(_ocr_page, engine, rendered[i], page_texts[i]): i
                        for i in rendered
                    }
                    for fut in as_completed(futs):
                        i = futs[fut]
                        try:
                            txt, method = fut.result()
                        except Exception:
                            txt, method = "", ""
                        # Only adopt OCR text if it actually beats the dirty layer
                        # (longer + non-empty), so a flaky call can't make a page
                        # worse than pdfplumber already had it.
                        if txt and len(txt) > len(page_texts[i]):
                            page_texts[i] = txt
                            out_pages[i]["text"] = txt
                            out_pages[i]["ocr"] = True
                            out_pages[i]["ocr_via"] = method
                            ocr_pages += 1
                            ocr_counts[method] = ocr_counts.get(method, 0) + 1
            except Exception as e:
                # OCR is best-effort: on any failure keep the pdfplumber text.
                ocr_method = f"{engine} (error: {type(e).__name__})"

    # Rebuild the flat full-text from the (possibly OCR-healed) per-page text.
    full_text = "".join(
        f"\n\n--- PAGE {i + 1} ---\n\n{page_texts[i]}"
        for i in range(len(page_texts))
    ).strip()
    ms = int((time.time() - t0) * 1000)
    return {
        "text": full_text,
        "pages": out_pages,
        "tables": out_tables,
        "meta": {
            "page_count": len(out_pages),
            "char_count": len(full_text),
            "table_count": len(out_tables),
            "parser": "pdfplumber+ocr" if ocr_pages else "pdfplumber",
            "parser_version": pdfplumber.__version__,
            "ocr_engine": engine,
            "ocr_pages": ocr_pages,
            "ocr_counts": ocr_counts,
            "ocr_model": ocr_method,
            "extract_ms": ms,
        },
    }


def _parse_multipart(body: bytes, content_type: str) -> bytes | None:
    """Minimal multipart parser — pulls out the 'file' field bytes."""
    # Find boundary
    if "boundary=" not in content_type:
        return None
    boundary = content_type.split("boundary=")[1].strip().strip('"').encode()
    sep = b"--" + boundary

    parts = body.split(sep)
    for part in parts:
        if b"name=\"file\"" not in part:
            continue
        # Split header from body
        if b"\r\n\r\n" not in part:
            continue
        _, file_body = part.split(b"\r\n\r\n", 1)
        # Trim trailing \r\n and possibly trailing -- for final boundary
        file_body = file_body.rstrip(b"\r\n-")
        return file_body
    return None


class handler(BaseHTTPRequestHandler):
    def _send_json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:  # noqa: N802 (BaseHTTPRequestHandler convention)
        try:
            # Optional per-request OCR engine override (?engine=tesseract|hybrid|
            # gemma). Defaults to the OCR_ENGINE env var. Lets us A/B engines
            # without redeploying or changing the production default.
            engine_override: str | None = None
            if "?" in self.path:
                engine_override = (
                    parse_qs(self.path.split("?", 1)[1]).get("engine") or [None]
                )[0]

            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0:
                return self._send_json(400, {"error": "Empty body"})
            if length > MAX_BYTES:
                return self._send_json(
                    413,
                    {"error": f"File too large (max {MAX_BYTES // 1024 // 1024} MB)"},
                )
            raw = self.rfile.read(length)
            content_type = self.headers.get("Content-Type", "")

            pdf_bytes: bytes | None = None
            if content_type.startswith("application/json"):
                payload = json.loads(raw.decode("utf-8"))
                engine_override = engine_override or payload.get("engine")
                storage_path = payload.get("storage_path")
                pdf_url = payload.get("pdf_url")
                b64 = payload.get("pdf_base64")
                if storage_path:
                    # Preferred: download the object straight from Supabase
                    # Storage with the service-role key (apikey auth). This avoids
                    # signed URLs, which this project's key cannot mint -- it is
                    # the new sb_secret_ format that downloads objects fine but
                    # returns "Invalid Compact JWS" on createSignedUrl. The body
                    # stays tiny, so large PDFs never hit the ~4.5 MB serverless
                    # request-body limit that base64 bodies blow past.
                    base = (os.environ.get("SUPABASE_URL") or "").rstrip("/")
                    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""
                    bucket = os.environ.get("SUPABASE_STORAGE_BUCKET") or "contracts"
                    if not base or not key:
                        return self._send_json(
                            500, {"error": "Supabase storage env not configured"}
                        )
                    obj_url = (
                        f"{base}/storage/v1/object/{bucket}/"
                        f"{quote(storage_path, safe='/')}"
                    )
                    req = urllib.request.Request(
                        obj_url,
                        headers={
                            "Authorization": f"Bearer {key}",
                            "apikey": key,
                            "User-Agent": "wordingsai-extract",
                        },
                    )
                    with urllib.request.urlopen(req, timeout=45) as resp:
                        pdf_bytes = resp.read(MAX_BYTES + 1)
                    if pdf_bytes and len(pdf_bytes) > MAX_BYTES:
                        return self._send_json(
                            413,
                            {"error": f"File too large (max {MAX_BYTES // 1024 // 1024} MB)"},
                        )
                elif pdf_url:
                    # Fetch a pre-signed/public URL server-side. Same tiny-body
                    # benefit as storage_path; kept as a fallback path.
                    req = urllib.request.Request(
                        pdf_url, headers={"User-Agent": "wordingsai-extract"}
                    )
                    with urllib.request.urlopen(req, timeout=45) as resp:
                        pdf_bytes = resp.read(MAX_BYTES + 1)
                    if pdf_bytes and len(pdf_bytes) > MAX_BYTES:
                        return self._send_json(
                            413,
                            {"error": f"File too large (max {MAX_BYTES // 1024 // 1024} MB)"},
                        )
                elif b64:
                    pdf_bytes = base64.b64decode(b64)
                else:
                    return self._send_json(
                        400,
                        {"error": "Missing storage_path, pdf_url or pdf_base64"},
                    )
            elif content_type.startswith("multipart/form-data"):
                pdf_bytes = _parse_multipart(raw, content_type)
                if not pdf_bytes:
                    return self._send_json(
                        400, {"error": "Multipart 'file' field not found"}
                    )
            else:
                # Assume raw PDF bytes
                pdf_bytes = raw

            if not pdf_bytes or len(pdf_bytes) < 4 or not pdf_bytes.startswith(b"%PDF"):
                return self._send_json(400, {"error": "Not a valid PDF"})

            result = _extract(pdf_bytes, engine=engine_override)
            return self._send_json(200, result)
        except Exception as e:
            return self._send_json(
                500, {"error": "Extraction failed", "detail": str(e)}
            )

    def do_GET(self) -> None:  # noqa: N802
        # Diagnostic: ?selftest=tess downloads + runs the vendored tesseract and
        # reports its version, confirming the binary works on this runtime.
        if "selftest=tess" in self.path:
            binp = _ensure_tesseract()
            info: dict[str, Any] = {
                "tesseract_available": bool(binp),
                "bin": binp,
                "ocr_engine": OCR_ENGINE,
            }
            if binp:
                try:
                    out = subprocess.run(
                        [binp, "--version"], capture_output=True, timeout=20,
                        env=_tess_env(),
                    )
                    info["version"] = (
                        (out.stdout or out.stderr).decode("utf-8", "ignore")
                        .splitlines()[:3]
                    )
                except Exception as e:
                    info["error"] = f"{type(e).__name__}: {e}"
            else:
                # Surface WHY bootstrap failed (missing GLIBCXX/.so, bad SHA, no
                # network) so a broken runtime is diagnosable in one call.
                rawbin = os.path.join(TESS_DIR, "bin", "tesseract")
                info["bin_exists"] = os.path.exists(rawbin)
                if os.path.exists(rawbin):
                    try:
                        out = subprocess.run(
                            [rawbin, "--version"], capture_output=True, timeout=20,
                            env=_tess_env(),
                        )
                        info["rc"] = out.returncode
                        info["stderr"] = out.stderr.decode("utf-8", "ignore")[:600]
                    except Exception as e:
                        info["run_error"] = f"{type(e).__name__}: {e}"
            return self._send_json(200, info)
        return self._send_json(
            200,
            {
                "ok": True,
                "endpoint": "/api/extract-pdf",
                "method": "POST",
                "accepts": ["multipart/form-data (file=)", "application/json (pdf_base64)", "application/pdf raw"],
                "parser": "pdfplumber",
                "parser_version": pdfplumber.__version__,
                "ocr_engine": OCR_ENGINE,
            },
        )
