import {
  generateJSONTierAware,
  resolveTierAwareModels,
  type OrganizationPlan,
  MODEL_FLASH,
  MODEL_FLASH_LITE_PREVIEW,
} from "./ai-router";
import { z } from "zod";
import {
  type StructuredContract,
  isFallbackSectionHeading,
  isQualityStructuredMap,
  countDocumentMapHeadings,
  sanitizeStructuredMap,
} from "./structured-contract";

export type { StructuredContract };
export {
  isFallbackSectionHeading,
  isQualityStructuredMap,
  countDocumentMapHeadings,
  sanitizeStructuredMap,
};

/** Fits one Vercel Hobby invocation (60s hard cap). */
export const VERCEL_STEP_TIMEOUT_MS = 48_000;

export const STRUCTURING_WINDOW_SIZE = 2_500;
export const STRUCTURING_OVERLAP = 250;
export const MAX_AI_MAP_WINDOWS = 8;

/** Fast models only — one model per 60s step, ~15s each with fallbacks.
 * Gemini-only: we run on the free Gemini tier, so fallbacks stay within Gemini
 * models (which have independent quotas) rather than keyless foreign providers
 * that would only fail and waste an attempt. */
const STRUCTURING_FAST_MODELS = [
  MODEL_FLASH,
  MODEL_FLASH_LITE_PREVIEW,
];

/**
 * Deterministic structure from plain text (no AI). Used as baseline and fallback.
 */
export function structureTextHeuristically(text: string): StructuredContract {
  if (!text?.trim()) {
    return { title: null, sections: [] };
  }

  const blocks = text
    .split(/\n{2,}/)
    .map((b) => b.replace(/\s+/g, " ").trim())
    .filter((b) => b.length > 2);

  const sections: StructuredContract["sections"] = [];
  let current: StructuredContract["sections"][number] | null = null;

  const isHeading = (para: string): boolean => {
    const wordCount = para.split(/\s+/).length;
    if (para.length > 150 || wordCount > 22) return false;
    if (/^\d+$/.test(para)) return false;
    if (
      /^(article|section|clause|schedule|annex|appendix|part)\s+[\d\.a-z]+/i.test(
        para,
      )
    ) {
      return true;
    }
    if (/^\d+(\.\d+)*[\.\s]+[A-Z]/.test(para)) return true;
    if (
      /^[A-Z0-9][A-Z0-9\s\-\/&]{2,}$/.test(para) &&
      wordCount <= 12 &&
      !/\b(shall|will|agrees|between|hereby)\b/i.test(para)
    ) {
      return true;
    }
    return false;
  };

  for (const block of blocks) {
    if (isHeading(block)) {
      const numberMatch = block.match(/^(\d+(?:\.\d+)*)/);
      current = {
        heading: block,
        number: numberMatch ? numberMatch[1] : null,
        subsections: [],
        paragraphs: [],
      };
      sections.push(current);
      continue;
    }

    if (!current) {
      current = {
        heading: "Introduction",
        number: null,
        subsections: [],
        paragraphs: [],
      };
      sections.push(current);
    }
    current.paragraphs.push(block);
  }

  if (sections.length === 0) {
    return {
      title: "Document",
      sections: [
        {
          heading: "Contract Text",
          number: null,
          subsections: [],
          paragraphs: blocks.length > 0 ? blocks : [text.slice(0, 20_000)],
        },
      ],
    };
  }

  return { title: "Document Map", sections };
}

/**
 * Splits contract text into windows for chunked processing.
 */
export function splitIntoWindows(text: string): string[] {
  if (!text?.trim()) return [];
  const windows: string[] = [];
  if (text.length <= STRUCTURING_WINDOW_SIZE) {
    windows.push(text);
  } else {
    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + STRUCTURING_WINDOW_SIZE, text.length);
      windows.push(text.slice(start, end));
      if (end >= text.length) break;
      start = Math.max(0, end - STRUCTURING_OVERLAP);
    }
  }
  return windows;
}

/**
 * Structures a single text window via AI; falls back to heuristic (never "Unstructured Extract").
 */
export async function structureSingleWindow(
  windowText: string,
  plan: OrganizationPlan = "basic",
): Promise<StructuredContract> {
  return structureSingleWindowTierAware(windowText, plan);
}

export async function structureSingleWindowTierAware(
  windowText: string,
  plan: OrganizationPlan,
): Promise<StructuredContract> {
  const heuristic = structureTextHeuristically(windowText);

  const prompt = `Convert this contract text excerpt into structured JSON with headings, subsections, and paragraphs.
Remove OCR noise (page numbers, footers, "[OCR Error]").
Preserve all legal content and list markers (a), b), i), ii)).
Keep section headings exactly as they appear when possible.

Text:
${windowText.slice(0, 6000)}
`;

  const schema = z.object({
    title: z.string().nullable(),
    sections: z.array(
      z.object({
        heading: z.string(),
        number: z.string().nullable(),
        subsections: z.array(
          z.object({
            heading: z.string(),
            number: z.string().nullable(),
            paragraphs: z.array(z.string()),
          }),
        ),
        paragraphs: z.array(z.string()),
      }),
    ),
  });

  const models = resolveTierAwareModels(plan, STRUCTURING_FAST_MODELS);

  try {
    const structuredJson = await generateJSONTierAware({
      schema,
      messages: [{ role: "user", content: prompt }],
      system:
        "Output valid JSON only. Infer contract hierarchy from headings and numbering.",
      plan,
      models,
      maxTokens: 4096,
      timeoutMs: VERCEL_STEP_TIMEOUT_MS,
      parallelModelConcurrency: 1,
    });

    const parsed = structuredJson as StructuredContract;
    if (isQualityStructuredMap(parsed)) {
      return sanitizeStructuredMap(parsed);
    }
    console.warn(
      "[Structuring] AI returned low-quality sections; using heuristic.",
    );
    return heuristic;
  } catch (err) {
    console.warn(
      "[Structuring] AI window failed, using heuristic structure:",
      err instanceof Error ? err.message : err,
    );
    return heuristic;
  }
}

/**
 * Merges multiple StructuredContract results into one, deduplicating sections.
 */
export function mergeStructuredWindows(
  results: StructuredContract[],
): StructuredContract {
  const merged: StructuredContract = { title: null, sections: [] };

  for (const parsed of results) {
    if (!merged.title && parsed.title) {
      merged.title = parsed.title;
    }
    for (const section of parsed.sections) {
      if (isFallbackSectionHeading(section.heading)) continue;

      const existing = merged.sections.find(
        (s) =>
          s.heading.trim().toLowerCase() ===
            section.heading.trim().toLowerCase() &&
          (s.number || "") === (section.number || ""),
      );
      if (!existing) {
        merged.sections.push(section);
        continue;
      }
      for (const paragraph of section.paragraphs) {
        if (!existing.paragraphs.includes(paragraph)) {
          existing.paragraphs.push(paragraph);
        }
      }
      for (const sub of section.subsections) {
        const existingSub = existing.subsections.find(
          (es) =>
            es.heading.trim().toLowerCase() ===
              sub.heading.trim().toLowerCase() &&
            (es.number || "") === (sub.number || ""),
        );
        if (!existingSub) {
          existing.subsections.push(sub);
          continue;
        }
        for (const p of sub.paragraphs) {
          if (!existingSub.paragraphs.includes(p)) {
            existingSub.paragraphs.push(p);
          }
        }
      }
    }
  }

  return merged;
}

/**
 * Full-document structure: heuristic baseline + optional AI per window (call from Inngest per step).
 */
export async function structureContractText(
  text: string,
  plan: OrganizationPlan = "basic",
): Promise<StructuredContract> {
  if (!text?.trim()) {
    return { title: null, sections: [] };
  }

  const baseline = structureTextHeuristically(text);
  const windows = splitIntoWindows(text).slice(0, MAX_AI_MAP_WINDOWS);
  const aiResults: StructuredContract[] = [];

  for (const windowText of windows) {
    try {
      const result = await structureSingleWindow(windowText, plan);
      if (isQualityStructuredMap(result)) {
        aiResults.push(result);
      }
    } catch (error) {
      console.error("[Structuring] Window error:", error);
    }
  }

  const merged = sanitizeStructuredMap(
    aiResults.length > 0
      ? mergeStructuredWindows([baseline, ...aiResults])
      : baseline,
  );

  return isQualityStructuredMap(merged) ? merged : baseline;
}
