/**
 * POST /api/contracts/extract-metadata
 *
 * Fires from the contract upload UI to auto-fill the metadata form (UMR /
 * Reinsured / Broker / Type / Period). Reads the uploaded file, runs Gemini
 * 2.5 Flash multimodal on the first 5 pages, then asks for structured JSON
 * with the workspace-specific field set.
 *
 * Workspace-aware: when workspaceType === "property" the prompt + field
 * descriptions switch to property-policy terminology (Policy Number,
 * Policyholder, etc.) instead of the reinsurance default (UMR, Reinsured).
 */
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

import { processChunkWithDocAI, splitPdfIntoChunks } from "@/server/extract-gcp";
import {
  downloadFromSupabase,
  extractPathFromSupabaseUrl,
} from "@/lib/supabase/storage";
import { generateJSON } from "@/lib/ai-router";
import { z } from "zod";
import crypto from "crypto";
import { setGlobalCache, getGlobalCache } from "@/lib/cache";

const METADATA_FIRST_PAGES = 5;

async function extractMetadataWithGemini(
  buffer: Buffer,
  mimetype: string,
  workspaceType?: string,
) {
  let textToAnalyze = "";

  console.log(
    `[ExtractMetadata] Multimodal extraction for mimetype=${mimetype}, size=${(buffer.byteLength / 1024).toFixed(0)}KB`,
  );

  if (mimetype === "application/pdf") {
    // Cache the extracted text by file hash — repeated uploads of the same
    // file skip the LLM call.
    const fileHash = crypto.createHash("sha256").update(buffer).digest("hex");
    const cacheKey = `metadata-extract:firstpages:${fileHash}`;
    const cached = await getGlobalCache<{ text: string }>(cacheKey);

    if (cached?.text) {
      console.log(
        `[ExtractMetadata] Cache HIT for file hash ${fileHash.slice(0, 12)}`,
      );
      textToAnalyze = cached.text;
    } else {
      // Only process the first N pages — that's where slip-style metadata lives.
      const chunks = await splitPdfIntoChunks(buffer, 1);
      const firstChunk = chunks[0] || buffer;
      const doc = await processChunkWithDocAI(firstChunk, mimetype, "");
      textToAnalyze = doc.text || "";
      if (textToAnalyze.length > 50) {
        await setGlobalCache(cacheKey, { text: textToAnalyze }, 86400).catch(
          () => undefined,
        );
      }
    }
  } else {
    // Non-PDF: treat as text-ish, take first 15K chars
    textToAnalyze = buffer.toString("utf-8", 0, 15000);
  }

  if (!textToAnalyze || textToAnalyze.length < 50) {
    console.warn(
      `[ExtractMetadata] Very little text extracted (${textToAnalyze.length} chars). Returning empty metadata.`,
    );
    return NextResponse.json({});
  }

  console.log(
    `[ExtractMetadata] Running LLM analysis on ${textToAnalyze.length} chars (workspace=${workspaceType ?? "reinsurance"})`,
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
            : "The Unique Market Reference (UMR), e.g. B1234ABC",
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
            : "Full descriptive class of business or contract type (e.g. Excess of Loss Reinsurance, Public Liability)",
        ),
      periodFrom: z.string().optional().describe("Inception date in YYYY-MM-DD"),
      periodTo: z.string().optional().describe("Expiry date in YYYY-MM-DD"),
    }),
    [
      {
        role: "user",
        content: `Analyse the following insurance contract text and extract the key metadata.

Specific instructions:
- contractName: ${isProperty ? "Look specifically for 'Policy Number' or 'Contract Number'." : "Look specifically for 'Unique Market Reference' or 'UMR'. Usually on the first page or in the slip header."}
- reinsured: ${isProperty ? "Extract the primary legal entity name of the Policyholder only." : "Extract the primary legal entity name of the Reinsured only. Do NOT include phrases like 'if applicable', 'and/or their subsidiary', or 'for their respective rights and interests'."}
- broker: Extract the primary name of the Broker (e.g. Willis, Aon, Marsh, Guy Carpenter, JLT).
- contractType: ${isProperty ? "Extract the policy type exactly as it appears (e.g. 'Commercial Property', 'General Liability')." : "Extract the FULL descriptive class of business or wording type exactly as it appears (e.g. 'Excess of Loss Reinsurance', 'Public Liability'). Do NOT shorten to a single word."}
- periodFrom: Effective date in YYYY-MM-DD format. If only a range is given, use the start.
- periodTo: Expiry date in YYYY-MM-DD format. If only a range is given, use the end.

Text:
${textToAnalyze.substring(0, 15000)}`,
      },
    ],
    "You are a professional insurance contract analyst.",
  );

  console.log(
    "[ExtractMetadata] AI results:",
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
      console.log(`[ExtractMetadata] Source: ${fileUrl}`);
      const path = extractPathFromSupabaseUrl(fileUrl);
      if (!path) throw new Error("Unable to extract path from URL");
      buffer = await downloadFromSupabase(path);
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
