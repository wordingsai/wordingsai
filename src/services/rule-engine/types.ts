/**
 * Shared rule-engine types, the evidence schema, and the shared GoogleGenAI
 * client. Extracted from the original src/services/rule-engine.ts during
 * modularization (behavior-preserving — no logic changes).
 */
import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ruleVersions } from "@/db/schema";

export type RuleDefinition = {
  searchQueries?: string[];
  purpose?: string;
  whatToCheck?: string[];
  redCriteria?: string[];
  amberCriteria?: string[];
  greenCriteria?: string[];
  amberExamples?: string[];
  greenExamples?: string[];
  logic?: {
    green?: string[];
    amber?: string[];
  };
  matrixLogic?: {
    perspectives: Array<{
      name: string;
      description: string;
      recommendations: string[];
    }>;
    overallGuidance?: string;
  };
  keywordPacks?: Array<{
    theme: string;
    bias: "Balanced" | "Cedant" | "Reinsurer";
    keywords: string[];
  }>;
  warExclusionLogic?: boolean;
};

export interface RuleEvaluationResult {
  status: "Green" | "Amber" | "Red";
  reasoning: string;
  detectedBias?: string;
  extractedEvidence: string[];
  rawEvidence?: Array<{ heading: string; verbatim_text: string }>;
  confidence?: number;
  triggeredConditions?: string[];
  keyTerms?: string[];
  granularGuidance?: {
    matchedKeywords: string[];
    conditionMatrix?: any;
    legalCommentary?: string;
    standardWordingMatch?: string;
    standardWordingText?: string | null;
  };
}

export interface RuleEvidenceItem {
  content: string;
  id?: string | null;
  similarity?: number | null;
  sourceFileName?: string | null;
  headingLine?: string | null;
  clauseBody?: string | null;
  sourceType?: "analyzed_clause" | "chunk" | "unknown";
  sourceId?: string | null;
}

const ruleEvidenceItemSchema = z.object({
  content: z.string().default(""),
  id: z.string().nullable().optional(),
  similarity: z.number().nullable().optional(),
  sourceFileName: z.string().nullable().optional(),
  headingLine: z.string().nullable().optional(),
  clauseBody: z.string().nullable().optional(),
  sourceType: z.enum(["analyzed_clause", "chunk", "unknown"]).optional(),
  sourceId: z.string().nullable().optional(),
});

export function sanitizeEvidenceItems(
  items: RuleEvidenceItem[],
): RuleEvidenceItem[] {
  const sanitized: RuleEvidenceItem[] = [];
  for (const item of items) {
    const parsed = ruleEvidenceItemSchema.safeParse(item);
    if (!parsed.success) continue;
    const normalized = parsed.data;
    sanitized.push({
      content: normalized.content,
      id: normalized.id ?? null,
      similarity: normalized.similarity ?? null,
      sourceFileName: normalized.sourceFileName ?? null,
      headingLine: normalized.headingLine ?? null,
      clauseBody: normalized.clauseBody ?? normalized.content ?? null,
      sourceType: normalized.sourceType ?? "unknown",
      sourceId: normalized.sourceId ?? normalized.id ?? null,
    });
  }
  return sanitized;
}

// GoogleGenerativeAI does not throw on an undefined key at construction (unlike
// Resend/Supabase), so a module-scope const is build-safe; we still default to
// "" rather than a non-null assertion for cleanliness.
export const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

export type KnownContractType =
  | "reinsurance"
  | "insurance"
  | "property"
  | "liability"
  | "casualty"
  | "marine"
  | "energy"
  | "employment"
  | "vendor"
  | "partnership"
  | "aviation"
  | "other";

export type GetApplicableRulesOptions = {
  filterByDetection?: boolean;
  /** Run every active rule for the org (no brain module / category / detection filters). */
  evaluateAllActive?: boolean;
};

export type SegmentedClause = {
  clause_identifier: string;
  clause_text: string;
  category: string;
};

export type ChecklistCandidate = {
  heading: string;
  fullText: string;
  semanticQuery: string;
  embeddingQuery: string;
  /**
   * Set when this candidate is a by-reference incorporation row pulled from a
   * Conditions/Wordings list — e.g. "Interlocking Clause (As attached)". These
   * carry no body in the slip; the authoritative wording is the library clause
   * of the same name (or an appendix section in the same document). The batch
   * runner resolves them by clause NAME (Rule "name-ref") rather than by code or
   * raw semantic similarity, so they are analysed against real wording instead
   * of surfacing as reference-only.
   */
  referenceName?: string;
};

export type ChecklistBatchPlan = {
  orgId: string;
  workspaceId: string;
  candidateCount: number;
  expectedHeadingCount: number;
  totalBatches: number;
  batchSize: number;
};

export interface AnalysisResult {
  name: string;
  category: string;
  found: boolean;
  found_text: string | null;
  status: "Matched" | "Variation" | "Not Matched";
  reasoning: string;
}

/** Row shape returned for applicable rules (rule + its current version). */
export type ApplicableRuleRow = {
  id: string;
  name: string;
  category: string | null;
  status: string;
  currentVersion: typeof ruleVersions.$inferSelect | null;
};
