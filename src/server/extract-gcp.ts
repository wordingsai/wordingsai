import { DocumentProcessorServiceClient } from "@google-cloud/documentai";
import vision from "@google-cloud/vision";
import { PDFDocument } from "pdf-lib";
import crypto from "crypto";
import { getGlobalCache } from "@/lib/cache";
import {
  downloadFromSupabase,
  deleteFromSupabase,
  extractPathFromSupabaseUrl,
} from "@/lib/supabase/storage";
import {
  gcpAuthClient,
  GCP_PROJECT_ID,
  GCP_PROJECT_NUMBER,
  GCP_SERVICE_ACCOUNT_EMAIL,
} from "@/lib/gcp/auth";

const DOCAI_PROCESSOR_ID = process.env.DOCAI_PROCESSOR_ID;
// Document AI Processor Location. Defaulting to europe-west2 per user request.
const LOCATION =
  process.env.DOCAI_LOCATION ||
  process.env.GCP_CLOUD_LOCATION ||
  "europe-west2";
// No auto-mapping to eu/us multi-regions to respect specific regional processors.

// We split at 5 pages to safely stay well under the Vercel 60s timeout.
// Legal documents are dense and DocAI can take ~10-12s per page sometimes.
const MAX_PAGES_PER_CHUNK = 5;

function getGcpOptions() {
  const options: any = {};

  const projectId = GCP_PROJECT_ID || GCP_PROJECT_NUMBER;
  if (projectId) {
    options.projectId = projectId;
  }

  if (gcpAuthClient) {
    console.log("[GCP Auth] Using Vercel OIDC Client");
    options.auth = gcpAuthClient;
  } else {
    // Fallback: If no gcpAuthClient (Local Dev), the SDK will automatically
    // find your local ADC (e.g. from 'gcloud auth application-default login').
    console.log("[GCP Auth] Using Application Default Credentials (ADC)");
    console.warn(
      "[GCP Auth] No explicit credentials found. Falling back to Application Default Credentials.",
    );
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.log(
        `[GCP Auth] GOOGLE_APPLICATION_CREDENTIALS is set to: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`,
      );
    }
  }
  return options;
}

export const getDocAIClient = () => {
  const options = getGcpOptions();
  return new DocumentProcessorServiceClient({
    ...options,
    apiEndpoint: `${LOCATION}-documentai.googleapis.com`,
  });
};

export const getVisionClient = () => {
  const options = getGcpOptions();
  return new vision.ImageAnnotatorClient(options);
};

// For backward compatibility and internal use in this file
const docaiClient = getDocAIClient();
const visionClient = getVisionClient();

export type GCPExtractionResult = {
  rawText: string;
  structuredJSON?: any;
  method: "DOCUMENT_AI_SYNC" | "DOCUMENT_AI_ASYNC" | "VISION_API_FALLBACK";
};

/**
 * Retries a function with exponential backoff
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(
          `[GCP Retry] Attempt ${attempt + 1} failed. Retrying in ${delay}ms... Error: ${err.message}`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

/**
 * Splits a PDF buffer into chunks of MAX_PAGES_PER_CHUNK pages each.
 */
export async function splitPdfIntoChunks(
  pdfBuffer: Buffer,
  limit?: number,
): Promise<Buffer[]> {
  const srcDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const totalPages = srcDoc.getPageCount();
  console.log(
    `[GCP Parse] PDF has ${totalPages} pages — splitting into ${MAX_PAGES_PER_CHUNK}-page chunks ${limit ? `(limit: ${limit})` : ""}`,
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
    console.log(
      `[GCP Parse] Chunk ${chunks.length}: pages ${start + 1}–${end} (${(chunkBytes.byteLength / 1024 / 1024).toFixed(2)}MB)`,
    );
  }

  return chunks;
}

/**
 * Merges multiple Document AI results into a single structured document.
 */
export function mergeDocAIResults(documents: any[]): any {
  if (documents.length === 0) return null;
  if (documents.length === 1) return documents[0];

  const merged = {
    text: "",
    pages: [] as any[],
  };

  let currentTextOffset = 0;

  for (const doc of documents) {
    const docText = doc.text || "";
    const textLen = docText.length;

    if (doc.pages) {
      for (const page of doc.pages) {
        const clonedPage = JSON.parse(JSON.stringify(page));
        offsetTextAnchors(clonedPage, currentTextOffset);
        merged.pages.push(clonedPage);
      }
    }

    merged.text += docText;
    currentTextOffset += textLen;
  }

  return merged;
}

/**
 * Recursively offsets textAnchor indexes within a Document AI object.
 */
function offsetTextAnchors(obj: any, offset: number) {
  if (!obj || typeof obj !== "object" || offset === 0) return;

  if (obj.textAnchor && Array.isArray(obj.textAnchor.textSegments)) {
    for (const segment of obj.textAnchor.textSegments) {
      if (segment.startIndex) {
        segment.startIndex = String(Number(segment.startIndex) + offset);
      } else {
        segment.startIndex = String(offset);
      }

      if (segment.endIndex) {
        segment.endIndex = String(Number(segment.endIndex) + offset);
      }
    }
  }

  // Recurse through all properties to find nested textAnchors (blocks, paragraphs, lines, tokens, etc.)
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === "object") offsetTextAnchors(item, offset);
        }
      } else if (value && typeof value === "object") {
        offsetTextAnchors(value, offset);
      }
    }
  }
}

/**
 * Processes a single PDF buffer synchronously using Document AI.
 */
export async function processChunkWithDocAI(
  chunk: Buffer,
  mimetype: string,
  processorName: string,
): Promise<any> {
  const [result] = await docaiClient.processDocument({
    name: processorName,
    rawDocument: {
      content: chunk.toString("base64"),
      mimeType: mimetype,
    },
    fieldMask: {
      paths: [
        "text",
        "pages.pageNumber",
        "pages.tokens",
        "pages.paragraphs",
        "pages.blocks",
        "pages.lines",
      ],
    },
  });
  return result.document;
}

const TIMEOUT_MS = 60000; // 60 second timeout per chunk

export async function extractDocumentGCP(
  filePath: string,
  mimetype: string,
  skipDocAI: boolean = false,
  onProgress?: (current: number, total: number) => Promise<void>,
): Promise<GCPExtractionResult> {
  return withRetry(
    async () => {
      const isImage = mimetype.startsWith("image/");

      console.log(`[GCP Parse] Downloading ${filePath}...`);
      let fileBuffer: Buffer;

      const supabasePath = extractPathFromSupabaseUrl(filePath);
      if (supabasePath || filePath.includes("supabase.co")) {
        console.log(
          `[GCP Parse] Detected Supabase path: ${supabasePath || filePath}`,
        );
        fileBuffer = await downloadFromSupabase(supabasePath || filePath);
      } else {
        throw new Error("Unable to determine storage source for file");
      }

      const downloadedFileSizeMB = (
        fileBuffer.byteLength /
        1024 /
        1024
      ).toFixed(2);
      console.log(`[GCP Parse] Downloaded ${downloadedFileSizeMB}MB`);

      if (isImage || skipDocAI) {
        console.log(
          `[GCP Parse] Using Vision API (inline content) for ${filePath}`,
        );
        const [result] = await visionClient.documentTextDetection({
          image: { content: fileBuffer.toString("base64") },
        });
        return {
          rawText: result.fullTextAnnotation?.text || "",
          method: "VISION_API_FALLBACK",
        };
      }

      if (!DOCAI_PROCESSOR_ID) throw new Error("DOCAI_PROCESSOR_ID is missing");

      const projectId =
        getGcpOptions().projectId || GCP_PROJECT_ID || GCP_PROJECT_NUMBER;
      if (!projectId) {
        throw new Error(
          "GCP Project ID is missing. Please check your environment variables.",
        );
      }

      const processorName = `projects/${projectId}/locations/${LOCATION}/processors/${DOCAI_PROCESSOR_ID}`;

      try {
        let finalDoc: any = null;
        let method: GCPExtractionResult["method"] = "DOCUMENT_AI_SYNC";

        if (mimetype === "application/pdf") {
          const srcDoc = await PDFDocument.load(fileBuffer, {
            ignoreEncryption: true,
          });
          const totalPages = srcDoc.getPageCount();

          if (totalPages > MAX_PAGES_PER_CHUNK) {
            const chunks = await splitPdfIntoChunks(fileBuffer);
            console.log(
              `[GCP Parse] Processing ${chunks.length} chunk(s) with Document AI sync...`,
            );

            // Compute file content hash to check for cached first chunk
            let cachedChunk0: any = null;
            try {
              const fileHash = crypto
                .createHash("sha256")
                .update(fileBuffer)
                .digest("hex");
              const cacheKey = `docai:chunk0:${fileHash}`;
              cachedChunk0 = await getGlobalCache<any>(cacheKey);
              if (cachedChunk0) {
                console.log(
                  `[GCP Parse] Cache HIT: Reusing cached Document AI result for chunk 0!`,
                );
              }
            } catch (hashErr) {
              console.warn(
                `[GCP Parse] Non-fatal: Failed to query cache for chunk 0:`,
                hashErr,
              );
            }

            // Process chunks in batches to prevent overwhelming GCP quota and respect serverless limits
            const results: any[] = [];
            const BATCH_SIZE = 5;
            for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
              const batch = chunks.slice(i, i + BATCH_SIZE);
              console.log(
                `[GCP Parse] Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(chunks.length / BATCH_SIZE)}...`,
              );

              const batchResults = await Promise.all(
                batch.map(async (chunk, batchIdx) => {
                  const idx = i + batchIdx;
                  if (idx === 0 && cachedChunk0) {
                    console.log(
                      `[GCP Parse] Chunk 1 (index 0) matched cache. Skipping API call.`,
                    );
                    if (onProgress) {
                      await onProgress(1, chunks.length).catch(() => {});
                    }
                    return { doc: cachedChunk0, index: 0 };
                  }

                  try {
                    const doc = await processChunkWithDocAI(
                      chunk,
                      mimetype,
                      processorName,
                    );
                    if (onProgress) {
                      await onProgress(idx + 1, chunks.length).catch(() => {});
                    }
                    return { doc, index: idx };
                  } catch (chunkErr: any) {
                    console.error(
                      `[GCP Parse] Chunk ${idx + 1} failed:`,
                      chunkErr.message,
                    );
                    return { doc: null, index: idx };
                  }
                }),
              );
              results.push(...batchResults);
            }

            // Sort by chunk index to maintain correct document page order before merging
            const docParts = results
              .sort((a, b) => a.index - b.index)
              .map((r) => r.doc)
              .filter(Boolean);

            if (docParts.length > 0) {
              finalDoc = mergeDocAIResults(docParts);
            }
          } else {
            // Single chunk processing
            console.log(`[GCP Parse] Processing document with Document AI...`);
            const [result] = await docaiClient.processDocument({
              name: processorName,
              rawDocument: {
                content: fileBuffer.toString("base64"),
                mimeType: mimetype,
              },
              fieldMask: {
                paths: [
                  "text",
                  "pages.pageNumber",
                  "pages.tokens",
                  "pages.paragraphs",
                  "pages.blocks",
                  "pages.lines",
                ],
              },
            });
            finalDoc = result.document;
          }

          // --- VISION FALLBACK LOGIC ---
          const textLength = finalDoc?.text?.length || 0;
          const pageCount = totalPages;
          const charsPerPage = pageCount > 0 ? textLength / pageCount : 0;

          // If very little text was extracted (e.g. < 100 chars per page), it's likely a scanned PDF
          if (!finalDoc || charsPerPage < 100) {
            console.warn(
              `[GCP Parse] Low text volume (${charsPerPage.toFixed(0)} chars/page). Falling back to Vision API...`,
            );

            // Vision API documentTextDetection for PDFs requires GCS, but we can process it as an image if it's small,
            // or use the inline visionClient.documentTextDetection if we convert pages to images.
            // Simplified fallback: use Vision API on the whole buffer (Vision supports PDF in some contexts, but let's be safe)
            try {
              const [visionResult] = await visionClient.documentTextDetection({
                image: { content: fileBuffer.toString("base64") },
              });

              if (visionResult.fullTextAnnotation?.text) {
                console.log("[GCP Parse] Vision API fallback successful.");
                return {
                  rawText: visionResult.fullTextAnnotation.text,
                  method: "VISION_API_FALLBACK",
                };
              }
            } catch (vErr) {
              console.error("[GCP Parse] Vision Fallback failed:", vErr);
            }
          }
        }

        if (!finalDoc) {
          throw new Error("Failed to extract content from document");
        }

        return {
          rawText: finalDoc.text || "",
          structuredJSON: finalDoc,
          method,
        };
      } catch (err: any) {
        console.error("[GCP Parse] Extraction failure:", err.message);
        throw err;
      }
    },
    1,
    1000,
  );
}
