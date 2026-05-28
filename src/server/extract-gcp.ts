/**
 * Document extraction for WordingsAI.
 *
 * The file name "extract-gcp" is retained for import-compat with the rest of the
 * codebase, but this implementation has nothing to do with GCP anymore.
 *
 * Strategy:
 *   1. For PDFs: split into 5-page chunks (Vercel 60s + Gemini inline limits)
 *   2. For each chunk: call Gemini 2.5 Flash multimodal with the PDF bytes as
 *      inlineData. Gemini sees the page visually, so layout + OCR + table
 *      structure are preserved in one pass. Works for both clean digital PDFs
 *      AND scanned PDFs with hand-applied highlights (Richard's actual workflow).
 *   3. For images: same Gemini multimodal call, single shot.
 *
 * The returned `rawText` is layout-preserved markdown-ish text. Tables come back
 * as markdown tables. Field labels stay aligned with their values. Section
 * headings are preserved. The downstream heuristic structuring functions in
 * `lib/contract-structuring.ts` then parse this into the StructuredContract
 * format that the rule engine consumes.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { PDFDocument } from "pdf-lib";
import {
  downloadFromSupabase,
  extractPathFromSupabaseUrl,
} from "@/lib/supabase/storage";

const MAX_PAGES_PER_CHUNK = 5;
const GEMINI_MODEL = "gemini-2.5-flash";
const MAX_OUTPUT_TOKENS = 16384;
const PER_CHUNK_CONCURRENCY = 3;

const EXTRACTION_PROMPT = `You are a verbatim insurance contract OCR + layout extractor.

Extract ALL text from this document, preserving the original layout. Critical rules:

1. Keep field labels (Reinsured, UMR, Period, Class of Business, Type, Limits, Conditions, etc.) aligned with their values. Use two columns when the original is two-column.
2. Render tables as proper markdown tables with | separators and a --- header row.
3. Preserve section headings (Risk Details, Premium, Conditions, Notices, etc.) on their own lines.
4. Keep clause references (LSW316, LMA 3100, LSW334A, etc.) intact, verbatim.
5. Preserve numbered/bulleted lists exactly as they appear.
6. Include page numbers and section breaks where visible.
7. Do NOT summarise. Do NOT paraphrase. Do NOT add commentary. Do NOT skip content.
8. Return only the extracted text.`;

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

export type GCPExtractionResult = {
  rawText: string;
  structuredJSON?: any;
  method: "GEMINI_MULTIMODAL" | "GEMINI_MULTIMODAL_CHUNKED";
};

/**
 * Split a PDF buffer into <= MAX_PAGES_PER_CHUNK page sub-PDFs.
 * Each chunk is independently sendable to Gemini inline.
 */
export async function splitPdfIntoChunks(
  pdfBuffer: Buffer,
  limit?: number,
): Promise<Buffer[]> {
  const srcDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const totalPages = srcDoc.getPageCount();
  console.log(
    `[Extract] PDF has ${totalPages} pages, splitting into ${MAX_PAGES_PER_CHUNK}-page chunks${limit ? ` (limit ${limit})` : ""}`,
  );

  const chunks: Buffer[] = [];
  for (let start = 0; start < totalPages; start += MAX_PAGES_PER_CHUNK) {
    if (limit && chunks.length >= limit) break;
    const end = Math.min(start + MAX_PAGES_PER_CHUNK, totalPages);
    const chunkDoc = await PDFDocument.create();
    const pageIndices = Array.from(
      { length: end - start },
      (_, i) => start + i,
    );
    const copiedPages = await chunkDoc.copyPages(srcDoc, pageIndices);
    copiedPages.forEach((p) => chunkDoc.addPage(p));
    const chunkBytes = await chunkDoc.save();
    chunks.push(Buffer.from(chunkBytes));
  }
  return chunks;
}

/**
 * Run Gemini 2.5 Flash multimodal on a single PDF/image buffer.
 * Returns the layout-preserved extracted text.
 */
async function extractWithGemini(
  buffer: Buffer,
  mimetype: string,
  label?: string,
): Promise<string> {
  if (!genAI) {
    throw new Error(
      "GEMINI_API_KEY is not set, cannot run multimodal extraction",
    );
  }
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      temperature: 0,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    },
  });

  const t0 = Date.now();
  const result = await model.generateContent([
    {
      inlineData: {
        data: buffer.toString("base64"),
        mimeType: mimetype,
      },
    },
    EXTRACTION_PROMPT,
  ]);
  const text = result.response.text();
  const ms = Date.now() - t0;
  console.log(
    `[Extract] Gemini multimodal${label ? ` (${label})` : ""}: ${text.length} chars in ${ms}ms`,
  );
  return text;
}

/**
 * Backward-compat name. Called by extract-metadata/route.ts.
 * `processorName` is ignored (no Document AI anymore).
 */
export async function processChunkWithDocAI(
  chunk: Buffer,
  mimetype: string,
  _processorName: string,
): Promise<{ text: string }> {
  const text = await extractWithGemini(chunk, mimetype, "metadata-chunk");
  return { text };
}

/**
 * Kept for backward-compat. Just concatenates extracted text from chunk
 * results. (Document AI structured shape no longer applies.)
 */
export function mergeDocAIResults(documents: any[]): any {
  if (documents.length === 0) return null;
  if (documents.length === 1) return documents[0];
  return {
    text: documents.map((d) => d?.text ?? "").join("\n\n"),
  };
}

/**
 * Process N items with limited concurrency.
 */
async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (true) {
        const i = nextIndex++;
        if (i >= items.length) return;
        results[i] = await fn(items[i], i);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

/**
 * Main public entrypoint used by the Inngest pipeline.
 *
 * Downloads the file from Supabase, then runs Gemini 2.5 Flash multimodal
 * extraction. For multi-page PDFs the document is split into 5-page chunks
 * processed with bounded concurrency.
 *
 * `skipDocAI` is preserved for signature compat but has no effect — there is
 * no Document AI anymore.
 */
export async function extractDocumentGCP(
  filePath: string,
  mimetype: string,
  _skipDocAI: boolean = false,
  onProgress?: (current: number, total: number) => Promise<void>,
): Promise<GCPExtractionResult> {
  console.log(`[Extract] Downloading ${filePath}...`);
  let fileBuffer: Buffer;

  const supabasePath = extractPathFromSupabaseUrl(filePath);
  if (supabasePath || filePath.includes("supabase.co")) {
    fileBuffer = await downloadFromSupabase(supabasePath || filePath);
  } else {
    throw new Error(`Unable to determine storage source for: ${filePath}`);
  }

  const sizeMB = (fileBuffer.byteLength / 1024 / 1024).toFixed(2);
  console.log(`[Extract] Downloaded ${sizeMB}MB`);

  // Images: single multimodal call
  if (mimetype.startsWith("image/")) {
    if (onProgress) await onProgress(1, 1).catch(() => {});
    const text = await extractWithGemini(fileBuffer, mimetype, "image");
    return { rawText: text, method: "GEMINI_MULTIMODAL" };
  }

  // Single-page or small PDFs: one call
  const srcDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
  const pageCount = srcDoc.getPageCount();

  if (pageCount <= MAX_PAGES_PER_CHUNK) {
    if (onProgress) await onProgress(1, 1).catch(() => {});
    const text = await extractWithGemini(
      fileBuffer,
      mimetype,
      `single-shot ${pageCount}p`,
    );
    return { rawText: text, method: "GEMINI_MULTIMODAL" };
  }

  // Larger PDFs: chunk + parallelise (bounded)
  const chunks = await splitPdfIntoChunks(fileBuffer);
  console.log(
    `[Extract] Processing ${chunks.length} chunks at concurrency ${PER_CHUNK_CONCURRENCY}`,
  );

  let completed = 0;
  const chunkTexts = await runWithConcurrency(
    chunks,
    PER_CHUNK_CONCURRENCY,
    async (chunk, idx) => {
      try {
        const text = await extractWithGemini(
          chunk,
          mimetype,
          `chunk ${idx + 1}/${chunks.length}`,
        );
        completed++;
        if (onProgress) {
          await onProgress(completed, chunks.length).catch(() => {});
        }
        return text;
      } catch (err: any) {
        console.error(
          `[Extract] Chunk ${idx + 1} failed: ${err?.message}. Returning empty.`,
        );
        completed++;
        if (onProgress) {
          await onProgress(completed, chunks.length).catch(() => {});
        }
        return "";
      }
    },
  );

  const startPage = (i: number) => i * MAX_PAGES_PER_CHUNK + 1;
  const endPage = (i: number) =>
    Math.min((i + 1) * MAX_PAGES_PER_CHUNK, pageCount);

  const rawText = chunkTexts
    .map(
      (text, i) =>
        `\n\n--- PAGES ${startPage(i)}-${endPage(i)} ---\n\n${text}`,
    )
    .join("")
    .trim();

  return {
    rawText,
    method: "GEMINI_MULTIMODAL_CHUNKED",
  };
}
