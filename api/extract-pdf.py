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
import io
import json
import os
import time
from http.server import BaseHTTPRequestHandler
from typing import Any
from urllib.parse import parse_qs

import pdfplumber


MAX_BYTES = 50 * 1024 * 1024  # 50 MB cap (matches upload UI limit)


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


def _extract(pdf_bytes: bytes) -> dict[str, Any]:
    t0 = time.time()
    out_pages: list[dict[str, Any]] = []
    out_tables: list[dict[str, Any]] = []
    full_text_parts: list[str] = []

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for idx, page in enumerate(pdf.pages, start=1):
            # Layout-preserving text (keeps column structure, indentation).
            page_text = page.extract_text(layout=True) or ""
            tables_raw = page.extract_tables() or []
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

    full_text = "".join(full_text_parts).strip()
    ms = int((time.time() - t0) * 1000)
    return {
        "text": full_text,
        "pages": out_pages,
        "tables": out_tables,
        "meta": {
            "page_count": len(out_pages),
            "char_count": len(full_text),
            "table_count": len(out_tables),
            "parser": "pdfplumber",
            "parser_version": pdfplumber.__version__,
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
                b64 = payload.get("pdf_base64")
                if not b64:
                    return self._send_json(400, {"error": "Missing pdf_base64"})
                pdf_bytes = base64.b64decode(b64)
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

            result = _extract(pdf_bytes)
            return self._send_json(200, result)
        except Exception as e:
            return self._send_json(
                500, {"error": "Extraction failed", "detail": str(e)}
            )

    def do_GET(self) -> None:  # noqa: N802
        return self._send_json(
            200,
            {
                "ok": True,
                "endpoint": "/api/extract-pdf",
                "method": "POST",
                "accepts": ["multipart/form-data (file=)", "application/json (pdf_base64)", "application/pdf raw"],
                "parser": "pdfplumber",
                "parser_version": pdfplumber.__version__,
            },
        )
