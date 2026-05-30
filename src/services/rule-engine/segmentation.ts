/**
 * Contract segmentation into clauses (AI-driven) plus the dedupe/validate
 * helpers. Extracted verbatim from the original src/services/rule-engine.ts
 * during modularization (no logic changes).
 */
import { db } from "@/db/drizzle";
import { eq } from "drizzle-orm";
import { analyzedClauses } from "@/db/schema";
import { generateJSONTierAware, type OrganizationPlan } from "@/lib/ai-router";
import { z } from "zod";
import { semanticChunking } from "@/lib/chunking";
import type { SegmentedClause } from "./types";

export const SEGMENTATION_CHUNK_SIZE = 3500;
export const SEGMENTATION_OVERLAP = 200;

const segmentationSystemPrompt = `You are a contract AI that segments document text into structured clauses.
Identify the logical boundaries of each clause/section.
Provide a JSON array where each object has:
- clause_identifier: The section number or heading (e.g. "Section 1.2", "Indemnification")
- clause_text: The full verbatim text of that clause.
- category: A high-level category (e.g. "Liability", "Termination", "Payment")

Example format:
[
  { "clause_identifier": "1.1", "clause_text": "...", "category": "Definitions" }
]`;

const clauseSchema = z.array(
  z.object({
    clause_identifier: z.string(),
    clause_text: z.string(),
    category: z.string(),
  }),
);


export function splitTextForSegmentation(text: string): string[] {
  return semanticChunking(text, {
    maxTokens: SEGMENTATION_CHUNK_SIZE,
    overlapTokens: SEGMENTATION_OVERLAP,
    separator: "\n\n",
  });
}

/**
 * Segment a single text chunk via AI. Designed for one Inngest step (< 60s).
 */
export async function segmentSingleChunk(
  chunkText: string,
  chunkIndex: number,
  totalChunks: number,
  plan: OrganizationPlan = "basic",
): Promise<SegmentedClause[]> {
  const chunkLabel =
    totalChunks > 1 ? ` (Part ${chunkIndex + 1}/${totalChunks})` : "";
  const userPrompt = `Contract Text${chunkLabel}:\n${chunkText}`;

  const segments = await generateJSONTierAware({
    schema: clauseSchema,
    messages: [{ role: "user", content: userPrompt }],
    system: segmentationSystemPrompt,
    plan,
    parallelModelConcurrency: 1,
  });

  return Array.isArray(segments) ? segments : [];
}

/**
 * Deduplicate overlapping clauses from chunk overlap zones.
 */
export function deduplicateSegments(
  allSegments: SegmentedClause[],
): SegmentedClause[] {
  const seen = new Set<string>();
  return allSegments.filter((s) => {
    const key = `${s.clause_identifier}::${s.clause_text.substring(0, 100)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Simplified stable segmentation pipeline.
 */
export async function segmentContractIntoClauses(
  contractId: string,
  contractVersionId: string,
  text: string,
  plan: OrganizationPlan = "basic",
  onProgress?: (current: number, total: number) => Promise<void>,
) {
  if (!text?.trim()) return [];

  // 1. Idempotency Check
  const existingSegments = await db
    .select({ id: analyzedClauses.id })
    .from(analyzedClauses)
    .where(eq(analyzedClauses.contractVersionId, contractVersionId));

  if (existingSegments.length > 0) {
    console.log(
      `[Segmentation] Reuse: Found ${existingSegments.length} existing segments for contract ${contractId} version ${contractVersionId}. Skipping AI segmentation.`,
    );
    return existingSegments;
  }

  try {
    // Stage 1: Fast segmentation with Flash
    const chunks = splitTextForSegmentation(text);
    let allSegments: any[] = [];

    // Run chunk segmentation in batches to prevent overwhelming the AI provider and respect rate limits
    let completedChunks = 0;
    const BATCH_SIZE = 5;
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (chunk, batchIdx) => {
          const idx = i + batchIdx;
          try {
            const result = await segmentSingleChunk(
              chunk,
              idx,
              chunks.length,
              plan,
            );
            completedChunks++;
            if (onProgress) {
              await onProgress(completedChunks, chunks.length);
            }
            return result;
          } catch (err) {
            console.warn(
              `[Segmentation] Chunk ${idx + 1}/${chunks.length} failed:`,
              err,
            );
            completedChunks++; // Still count as completed to keep progress moving
            if (onProgress) {
              await onProgress(completedChunks, chunks.length);
            }
            return [] as SegmentedClause[];
          }
        }),
      );

      for (const chunkSegments of batchResults) {
        if (Array.isArray(chunkSegments)) {
          allSegments.push(...chunkSegments);
        }
      }
    }

    // Filter out segments with noise headings identified by the user
    const filteredSegments = allSegments.filter((s) => {
      const heading = s.clause_identifier || "";
      // Filter out pure number headings or OCR-like codes
      if (/^\d{5,}$/.test(heading)) return false;
      return true;
    });

    const uniqueSegments = deduplicateSegments(filteredSegments);

    if (uniqueSegments.length > 0) {
      const inserted = await db
        .insert(analyzedClauses)
        .values(
          uniqueSegments.map((s) => ({
            contractId,
            contractVersionId,
            clauseIdentifier: s.clause_identifier,
            clauseText: s.clause_text,
            category: s.category,
          })),
        )
        .returning();

      return inserted;
    }
    return [];
  } catch (error) {
    console.error("[Segmentation] Pipeline failed:", error);
    throw error; // Re-throw so Inngest knows it failed
  }
}

/**
 * Stage 2: Validates segmentation accuracy using Gemma Reasoning.
 */
async function validateStructureWithGemma(
  segments: SegmentedClause[],
  rawText: string,
  plan: OrganizationPlan,
): Promise<SegmentedClause[]> {
  const gemmaModel = plan === "plus" ? "gemma-4-31b-it" : "gemma-4-26b-it";
  const validationPrompt = `Validate and repair the structure of the following clauses extracted from a contract.
  Fix heading hierarchies, broken bullet points, or missing text. 
  Ensure the list is 100% correct.
  Return the fixed JSON structure.
  
  Extracted Segments: ${JSON.stringify(segments)}
  Raw Contract Text snippet for verification: ${rawText.substring(0, 5000)}`;

  // Use the reasoning-capable model to perform the final cleanup
  const validated = await generateJSONTierAware({
    schema: clauseSchema,
    messages: [{ role: "user", content: validationPrompt }],
    system:
      "You are an expert contract auditor. Your task is to correct and validate clause segmentation.",
    plan,
    models: [gemmaModel],
    parallelModelConcurrency: 2,
  });

  return Array.isArray(validated) ? validated : segments;
}
