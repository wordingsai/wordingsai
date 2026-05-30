/**
 * Server-side PDF compression caller.
 *
 * Invokes the `api/compress-pdf.py` serverless function, which re-rasters the
 * large scanned contract PDFs at a lower DPI (JPEG) while re-inserting the OCR
 * words as an invisible text layer — typically 72-85% smaller with the text
 * layer fully intact (pdfplumber still reads it). The original is never touched.
 *
 * Mirrors `extractWithPdfplumber` in extract-gcp.ts for base-URL resolution.
 */

export interface CompressResult {
  compressedPath: string;
  origBytes: number;
  compBytes: number;
  ratio: number;
  pages: number;
}

function resolveBaseUrl(): string {
  return (
    process.env.PDF_EXTRACT_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"
  );
}

/**
 * Compress a contract PDF stored in Supabase. Returns null on any failure or if
 * the function decides compression is not worthwhile (caller treats null as
 * "no compressed rendition" and keeps using the original). Never throws.
 */
export async function compressContractPdf(
  storagePath: string,
  opts: { destPath?: string; dpi?: number; quality?: number } = {},
): Promise<CompressResult | null> {
  try {
    const base = resolveBaseUrl();
    const res = await fetch(`${base}/api/compress-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storage_path: storagePath,
        dest_path: opts.destPath,
        dpi: opts.dpi,
        quality: opts.quality,
      }),
    });

    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      console.error(`[compress-pdf] failed ${res.status}: ${msg}`);
      return null;
    }

    const data = await res.json();
    if (data?.skipped || !data?.compressed_path) {
      console.log(
        `[compress-pdf] skipped for ${storagePath}: ${data?.reason ?? "no path"}`,
      );
      return null;
    }

    return {
      compressedPath: String(data.compressed_path),
      origBytes: Number(data.orig_bytes ?? 0),
      compBytes: Number(data.comp_bytes ?? 0),
      ratio: Number(data.ratio ?? 0),
      pages: Number(data.pages ?? 0),
    };
  } catch (err) {
    console.error(`[compress-pdf] error for ${storagePath}:`, err);
    return null;
  }
}
