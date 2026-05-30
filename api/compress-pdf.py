# api/compress-pdf.py
# Vercel Python Serverless Function: shrink large scanned-image PDFs while
# preserving an extractable text layer.
#
# These reinsurance contracts are full-page 150-DPI scans with a thin OCR text
# layer (~22-57 MB). We re-raster each page at a lower DPI as JPEG (the bulk of
# the bytes) and re-insert the original OCR words as an INVISIBLE text layer, so
# the compressed copy stays fully readable by pdfplumber while dropping ~75-90%
# of the size. The original is never modified here; the caller keeps it as the
# audit/source copy and stores this compressed rendition alongside it.
from http.server import BaseHTTPRequestHandler
import json
import os
import io
import time
import urllib.request
from urllib.parse import quote

MAX_BYTES = 60 * 1024 * 1024  # 60 MB input safety cap
DEFAULT_DPI = 110
DEFAULT_QUALITY = 55


def compress_pdf_bytes(pdf_bytes: bytes, dpi: int = DEFAULT_DPI,
                       quality: int = DEFAULT_QUALITY) -> dict:
    """Re-raster pages + re-insert invisible OCR text. Returns dict with the
    compressed bytes and page count. Pure function (no I/O) so it is unit
    testable with the exact production logic."""
    import fitz  # PyMuPDF
    from PIL import Image

    src = fitz.open(stream=pdf_bytes, filetype="pdf")
    out = fitz.open()
    try:
        for pg in src:
            pix = pg.get_pixmap(dpi=dpi, colorspace=fitz.csRGB, alpha=False)
            buf = io.BytesIO()
            Image.frombytes("RGB", (pix.width, pix.height), pix.samples).save(
                buf, format="JPEG", quality=quality, optimize=True)
            npg = out.new_page(width=pg.rect.width, height=pg.rect.height)
            npg.insert_image(pg.rect, stream=buf.getvalue())

            words = pg.get_text("words")
            if words:
                tw = fitz.TextWriter(npg.rect)
                wrote = False
                for w in words:
                    x0, y0, x1, y1, word = w[0], w[1], w[2], w[3], w[4]
                    fs = max(4.0, min(20.0, (y1 - y0) * 0.9))
                    try:
                        tw.append((x0, y1), word, fontsize=fs)
                        wrote = True
                    except Exception:
                        pass
                if wrote:
                    tw.write_text(npg, render_mode=3)  # 3 = invisible

        data = out.tobytes(garbage=4, deflate=True, use_objstms=1)
        page_count = out.page_count
    finally:
        out.close()
        src.close()
    return {"data": data, "pages": page_count}


def _download(url: str, headers: dict) -> bytes:
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=45) as resp:
        return resp.read(MAX_BYTES + 1)


def _fetch_pdf_bytes(payload: dict) -> tuple:
    """Returns (pdf_bytes, storage_path). Mirrors extract-pdf.py."""
    storage_path = payload.get("storage_path")
    if storage_path:
        base = os.environ.get("SUPABASE_URL", "").rstrip("/")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        bucket = os.environ.get("SUPABASE_STORAGE_BUCKET", "contracts")
        if not base or not key:
            raise RuntimeError("Supabase env not configured")
        obj_url = f"{base}/storage/v1/object/{bucket}/{quote(storage_path, safe='/')}"
        data = _download(obj_url, {
            "Authorization": f"Bearer {key}",
            "apikey": key,
            "User-Agent": "wordingsai-compress",
        })
        return data, storage_path

    pdf_url = payload.get("pdf_url")
    if pdf_url:
        return _download(pdf_url, {"User-Agent": "wordingsai-compress"}), None

    raise ValueError("No PDF source provided (need storage_path or pdf_url)")


def _upload(dest_path: str, data: bytes) -> int:
    base = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    bucket = os.environ.get("SUPABASE_STORAGE_BUCKET", "contracts")
    if not base or not key:
        raise RuntimeError("Supabase env not configured")
    url = f"{base}/storage/v1/object/{bucket}/{quote(dest_path, safe='/')}"
    req = urllib.request.Request(url, data=data, method="POST", headers={
        "Authorization": f"Bearer {key}",
        "apikey": key,
        "Content-Type": "application/pdf",
        "x-upsert": "true",
        "User-Agent": "wordingsai-compress",
    })
    with urllib.request.urlopen(req, timeout=45) as resp:
        return resp.status


def _derive_dest(storage_path: str) -> str:
    base = (storage_path or "file.pdf").split("/")[-1]
    return "compressed/" + base


def _json_response(handler, status, body):
    payload = json.dumps(body).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(payload)))
    handler.end_headers()
    handler.wfile.write(payload)


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        start = time.time()
        try:
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length) if length else b""
            payload = json.loads(raw.decode("utf-8")) if raw else {}
        except Exception as e:
            _json_response(self, 400, {"error": f"Bad request: {e}"})
            return

        try:
            pdf_bytes, storage_path = _fetch_pdf_bytes(payload)
            orig = len(pdf_bytes)
            if orig > MAX_BYTES:
                _json_response(self, 413, {"error": f"PDF exceeds {MAX_BYTES} bytes"})
                return

            dpi = int(payload.get("dpi", DEFAULT_DPI))
            quality = int(payload.get("quality", DEFAULT_QUALITY))
            res = compress_pdf_bytes(pdf_bytes, dpi=dpi, quality=quality)
            comp_bytes = res["data"]
            comp = len(comp_bytes)

            # Only keep the compressed copy if it is a meaningful win.
            if comp >= int(orig * 0.85):
                _json_response(self, 200, {
                    "skipped": True,
                    "reason": "compression did not reduce size enough",
                    "orig_bytes": orig,
                    "comp_bytes": comp,
                    "pages": res["pages"],
                })
                return

            dest_path = payload.get("dest_path") or _derive_dest(storage_path)
            _upload(dest_path, comp_bytes)

            _json_response(self, 200, {
                "skipped": False,
                "compressed_path": dest_path,
                "orig_bytes": orig,
                "comp_bytes": comp,
                "ratio": round(1 - comp / orig, 4),
                "pages": res["pages"],
                "compress_ms": int((time.time() - start) * 1000),
            })
        except Exception as e:
            _json_response(self, 500, {"error": str(e)})
