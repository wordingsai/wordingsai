import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

import {
  processChunkWithDocAI,
  splitPdfIntoChunks,
  extractDocumentGCP,
} from "@/server/extract-gcp";
import {
  downloadFromSupabase,
  extractPathFromSupabaseUrl,
} from "@/lib/supabase/storage";
import { generateJSON } from "@/lib/ai-router";
import { z } from "zod";
import crypto from "crypto";
import { setGlobalCache } from "@/lib/cache";

const DOCAI_PROCESSOR_ID = process.env.DOCAI_PROCESSOR_ID;
const LOCATION = process.env.GCP_CLOUD_LOCATION || "europe-west2";

async function extractMetadataWithGemini(
  buffer: Buffer,
  mimetype: string,
  workspaceType?: string,
) {
  let textToAnalyze = "";

  console.log(
    `[ExtractMetadata] Starting serverless extraction for mimetype: ${mimetype}`,
  );

  if (mimetype === "application/pdf") {
    // Only process the first chunk (5 pages) to keep it fast and under Vercel limits
    const chunks = await splitPdfIntoChunks(buffer, 1);
    const firstChunk = chunks[0];

    const projectId = process.env.GCP_PROJECT_ID;
    if (!projectId) throw new Error("GCP Project ID is missing.");
    const processorName = `projects/${projectId}/locations/${LOCATION}/processors/${DOCAI_PROCESSOR_ID}`;

    console.log(`[ExtractMetadata] Running Document AI on first 5 pages...`);
    const doc = await processChunkWithDocAI(
      firstChunk,
      mimetype,
      processorName,
    );
    textToAnalyze = doc.text || "";

    // Cache the first chunk's parsed Document AI JSON, keyed by the document's SHA-256 hash
    try {
      const fileHash = crypto.createHash("sha256").update(buffer).digest("hex");
      const cacheKey = `docai:chunk0:${fileHash}`;
      await setGlobalCache(cacheKey, doc, 86400); // cache for 24 hours
      console.log(
        `[ExtractMetadata] Safely cached chunk 0 for file hash: ${fileHash}`,
      );
    } catch (cacheErr) {
      console.warn(
        "[ExtractMetadata] Non-fatal: Failed to cache chunk 0:",
        cacheErr,
      );
    }
  } else {
    textToAnalyze = buffer.toString("utf-8", 0, 15000);
  }

  if (!textToAnalyze || textToAnalyze.length < 50) {
    console.warn(
      "[ExtractMetadata] Warning: Very little text extracted from document.",
    );
  }

  console.log(
    `[ExtractMetadata] Running LLM analysis on ${textToAnalyze.length} chars...`,
  );

  const isProperty = workspaceType === "property";

  const metadata = await generateJSON(
    z.object({
      contractName: z
        .string()
        .optional()
        .describe(
          isProperty
            ? "The Policy Number or Contract Number"
            : "The Unique Market Reference (UMR) - e.g. B1234ABC",
        ),
      reinsured: z
        .string()
        .optional()
        .describe(
          isProperty
            ? "Primary legal entity name of the Policyholder"
            : "Primary legal entity name of the Reinsured",
        ),
      broker: z.string().optional().describe("Broker name"),
      contractType: z
        .string()
        .optional()
        .describe(
          isProperty
            ? "Policy type (e.g., Commercial Property, General Liability)"
            : "Full descriptive class of business or contract type (e.g. Reinsured for losses, Professional Indemnity)",
        ),
      periodFrom: z.string().optional().describe("Inception date (YYYY-MM-DD)"),
      periodTo: z.string().optional().describe("Expiration date (YYYY-MM-DD)"),
    }),
    [
      {
        role: "user",
        content: `Analyze the following insurance contract text and extract the key metadata.
        
        Specific Instructions:
        - contractName: ${isProperty ? "Look specifically for the 'Policy Number' or 'Contract Number'." : "Look specifically for the 'Unique Market Reference' or 'UMR'. This is often on the first page or in the Slip Header."}
        - reinsured: ${isProperty ? "Extract the primary legal entity name of the Policyholder only." : "Extract the primary legal entity name of the Reinsured only. Do NOT include phrases like 'if applicable', 'and/or their subsidiary', or 'for their respective rights and interests'."}
        - broker: Extract the primary name of the Broker (e.g., Willis, Aon, Marsh).
        - contractType: ${isProperty ? "Extract the policy type exactly as it appears (e.g., 'Commercial Property', 'General Liability')." : 'Extract the FULL descriptive class of business or wording type exactly as it appears (e.g., "Reinsured for losses", "Excess of Loss Reinsurance", "Public Liability"). Do NOT shorten to a single word.'}
        - periodFrom: Effective date in YYYY-MM-DD format.
        - periodTo: Expiry date in YYYY-MM-DD format.
        
        Text:
        ${textToAnalyze.substring(0, 15000)}`,
      },
    ],
    "You are a professional insurance contract analyst.",
  );

  console.log(
    "[ExtractMetadata] AI Results:",
    JSON.stringify(metadata, null, 2),
  );
  return NextResponse.json(metadata);
}

export async function POST(req: NextRequest) {
  try {
    const sessionData = await auth.api.getSession({ headers: await headers() });
    if (!sessionData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contentType = req.headers.get("content-type") || "";
    let fileUrl: string | null = null;
    let buffer: Buffer | null = null;
    let mimetype = "application/pdf";

    let workspaceType = "reinsurance";

    if (contentType.includes("application/json")) {
      const body = await req.json();
      fileUrl = body.fileUrl;
      if (body.workspaceType) workspaceType = body.workspaceType;
    }

    if (fileUrl) {
      console.log(
        `[ExtractMetadata] Direct serverless extraction for: ${fileUrl}`,
      );

      const path = extractPathFromSupabaseUrl(fileUrl);
      if (path) {
        console.log(`[ExtractMetadata] Downloading from Supabase: ${path}`);
        buffer = await downloadFromSupabase(path);
      } else {
        throw new Error("Unable to extract path from URL");
      }
    } else {
      const formData = await req.formData();
      const file = formData.get("file") as File;
      const wsTypeForm = formData.get("workspaceType") as string;
      if (wsTypeForm) workspaceType = wsTypeForm;
      if (file) {
        buffer = Buffer.from(await file.arrayBuffer());
        mimetype = file.type;
      }
    }

    if (!buffer) {
      return NextResponse.json(
        { error: "No file content found" },
        { status: 400 },
      );
    }

    return await extractMetadataWithGemini(buffer, mimetype, workspaceType);
  } catch (error: any) {
    console.error("[ExtractMetadata] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
