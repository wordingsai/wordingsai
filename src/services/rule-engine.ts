import "dotenv/config";
import { db } from "@/db/drizzle";
import { eq, and, or, sql, inArray, desc, isNull } from "drizzle-orm";
import {
  rules,
  ruleResults,
  contracts,
  contractChunks,
  contractVersions,
  organization,
  organizationRuleSettings,
  analyzedClauses,
  clauseChunks,
  clauses,
  warExclusions,
  workspaces,
  analysisEvents,
  workspaceRules,
  workspaceClauses,
  ruleVersions,
  evidenceItems,
} from "@/db/schema";
import { createEmbeddings } from "@/lib/embedding";
import {
  openrouter,
  generateJSON,
  generateJSONTierAware,
  type OrganizationPlan,
  DEFAULT_MODEL,
  MODEL_GEMMA_4_31B,
  MODEL_FLASH,
  estimateTokens,
} from "@/lib/ai-router";
import { z } from "zod";
import type { ContractAnalysis } from "@/types/contracts";
import type { ModelMessage } from "ai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  BRAIN_MODULES,
  getAutoSelectedBrainModules,
  inferRuleModuleKey,
} from "@/lib/brain-modules";
import {
  type StructuredContract,
  countDocumentMapHeadings,
  isFallbackSectionHeading,
  isQualityStructuredMap,
  sanitizeStructuredMap,
  structureTextHeuristically,
} from "@/lib/contract-structuring";
import { isAstraVectorEnabled } from "@/lib/astra/config";
import {
  deleteAstraContractChunks,
  insertAstraContractChunks,
  searchAstraClauseChunks,
  searchAstraContractChunks,
  searchAstraWarExclusions,
  upsertAstraAiGeneration,
} from "@/lib/astra/vector-store";
import type {
  StructuredEvidenceItem,
  StructuredEvidenceGroup,
  StructuredEvidenceResult,
} from "@/types/evidence";
import { matchClauseToLibrary } from "./clause-matching";

/** Fast checklist (Stage 2): minimum raw cosine similarity to count a library hit. */
export const CHECKLIST_SEMANTIC_FLOOR = 0.65;
/** Raw cosine similarity at or above this value => Matched–Approved (Green); below => Variation (Amber). */
export const CHECKLIST_MATCHED_APPROVED_THRESHOLD = 0.85;
/**
 * Document-map checklist: similarity at/above this (but below Matched) => Variation
 * (Amber). Deliberately higher than CHECKLIST_SEMANTIC_FLOOR: the embedding model
 * (NV-Embed-QA) compresses cosine high, so even unrelated sections land at
 * ~0.65–0.80. Below this floor a section is treated as bespoke (Custom) rather
 * than force-matched to an arbitrary nearest neighbour.
 */
export const CHECKLIST_VARIATION_FLOOR = 0.78;
/**
 * Document-map checklist: a sub-Matched top hit must beat the runner-up by at
 * least this cosine margin to be asserted as a Variation. If several library
 * clauses are nearly equidistant, the nearest neighbour is too arbitrary to
 * trust, so the section is treated as bespoke (Custom).
 */
export const CHECKLIST_MATCH_MARGIN = 0.04;

/**
 * Maps raw library cosine similarity to checklist status. Used by fast analysis;
 * kept pure so unit tests can lock the Green vs Amber boundary.
 */
export function fastChecklistStatusForSimilarity(
  similarity: number,
): "Matched" | "Variation" | "Not Matched" {
  if (similarity >= CHECKLIST_MATCHED_APPROVED_THRESHOLD) return "Matched";
  if (similarity >= CHECKLIST_SEMANTIC_FLOOR) return "Variation";
  return "Not Matched";
}

/**
 * Strips out generic legal "noise" words to focus on the unique intent of the clause.
 * This helps resolve "vector crowding" where boilerplate text dominates the embedding.
 */
export function stripLegalNoise(text: string): string {
  const noiseWords = [
    "hereto",
    "agreement",
    "party",
    "parties",
    "shall",
    "clause",
    "section",
    "article",
    "hereby",
    "thereof",
    "whereof",
    "herein",
    "provision",
    "provisions",
    "contract",
    "document",
    "forth",
    "forthwith",
    "whereas",
    "witnesseth",
    "undersigned",
    "applicable",
    "including",
    "limited",
    "connection",
    "terms",
  ];

  let cleaned = text.toLowerCase();
  for (const word of noiseWords) {
    // Match word boundaries to avoid partial matches
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    cleaned = cleaned.replace(regex, " ");
  }
  return cleaned;
}

/**
 * Calibrates and normalizes raw similarity scores to separate "Matched" from "Variation".
 * If scores are flat (crowded around 62-67%), this function stretches them.
 * Raw 0.6 -> 0.0
 * Raw 0.65 -> 0.65 (Anchor point)
 * Raw 0.7 -> 0.9
 * Raw 0.8+ -> 1.0
 */
export function calibrateSimilarity(raw: number): number {
  if (raw < 0.5) return raw * 0.5; // Supress low matches

  // Linear stretching for the "crowded" range
  // Mapping [0.6, 0.8] to [0.2, 0.95]
  const min = 0.6;
  const max = 0.8;
  const targetMin = 0.2;
  const targetMax = 0.95;

  if (raw <= min) return (raw / min) * targetMin;
  if (raw >= max) return Math.min(1.0, targetMax + (raw - max) * 0.25);

  // Mid-range interpolation
  const stretched =
    targetMin + ((raw - min) / (max - min)) * (targetMax - targetMin);
  return parseFloat(stretched.toFixed(3));
}

/** Light normalization for embeddings — keeps semantic signal for similarity. */
export function prepareEmbeddingText(text: string): string {
  if (!text) return "";
  return text
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
}

/** Token overlap boost between document heading and library clause name (0–0.15). */
export function headingMatchBoost(
  documentHeading: string,
  clauseName: string,
): number {
  const a = new Set(
    documentHeading
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
  const b = new Set(
    clauseName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
  if (a.size === 0 || b.size === 0) return 0;
  let overlap = 0;
  for (const w of a) {
    if (b.has(w)) overlap++;
  }
  return Math.min(0.15, (overlap / Math.max(a.size, b.size)) * 0.15);
}

export function normalizeText(text: string): string {
  if (!text) return "";

  // 1. Basic Cleaning
  let cleaned = text
    // Aggressive OCR Noise Cleaning
    .replace(
      /(page\s+\d+|[\[\]\(\)\{\}\<\>]\d{1,3}[\[\]\(\)\{\}\<\>]|\d+\s+of\s+\d+|wordings\s+ai|header|footer)/gi,
      " ",
    )
    .replace(/[•●■□◆◇]/g, " ")
    // Strip common prefixes
    .replace(
      /^\s*(article|section|clause|provision|item|schedule|annex|appendix)\s+([0-9a-z\.]+)?(\s*\([a-z0-9]\))?[:\-\s\.]+/gi,
      "",
    )
    .replace(/^\s*\d+(\.\d+)*(\s*\([a-z0-9]\))?[:\-\s\.]+/gi, "")
    .replace(/---/g, " ")
    .replace(/[^\w\s\-\.]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  // 2. Legal Noise Stripping (User Fix #1)
  return stripLegalNoise(cleaned);
}
import {
  getGlobalCache,
  setGlobalCache,
  getEmbeddingCacheKey,
  getRetrievalCacheKey,
} from "@/lib/cache";

import { semanticChunking } from "@/lib/chunking";

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

function sanitizeEvidenceItems(items: RuleEvidenceItem[]): RuleEvidenceItem[] {
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

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

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

export function normalizeContractType(
  input?: string | null,
): KnownContractType {
  const raw = (input || "").toLowerCase().trim();
  if (!raw) return "other";

  const known: KnownContractType[] = [
    "reinsurance",
    "insurance",
    "property",
    "liability",
    "casualty",
    "marine",
    "energy",
    "employment",
    "vendor",
    "partnership",
    "aviation",
    "other",
  ];

  // Exact match first
  if (known.includes(raw as KnownContractType)) return raw as KnownContractType;

  // Fuzzy containment for common extended labels (free-text types)
  for (const k of known) {
    if (k !== "other" && raw.includes(k)) return k;
  }

  return "other";
}

/**
 * Classifies the contract type based on its text.
 */
export async function classifyContractType(
  text: string,
  plan: OrganizationPlan = "basic",
): Promise<KnownContractType> {
  const prompt = `Analyze the following contract text and classify its type into one of these categories: 
  - nda (Non-Disclosure Agreement)
  - msa (Master Service Agreement)
  - sla (Service Level Agreement)
  - employment (Employment Contract)
  - vendor (Vendor/Supplier Agreement)
  - partnership (Partnership Agreement)
  - insurance (Insurance Policy)
  - reinsurance (Reinsurance Treaty/Contract)
  - aviation (Aviation/Hull/Liability Risk)
  - other (If none of the above match)

  Contract Text (first 10,000 chars):
  ${text.substring(0, 10000)}
  `;

  try {
    const result = await generateJSONTierAware({
      schema: z.object({
        type: z.enum([
          "reinsurance",
          "insurance",
          "property",
          "liability",
          "casualty",
          "marine",
          "energy",
          "nda",
          "msa",
          "sla",
          "employment",
          "vendor",
          "partnership",
          "aviation",
          "other",
        ]),
        confidence: z.number().min(0).max(1),
      }),
      messages: [{ role: "user", content: prompt }],
      system: "You are a contract document classifier.",
      plan,
    });

    return result.type as KnownContractType;
  } catch (error) {
    console.error("[Classification] Failed:", error);
    return "other";
  }
}

/**
 * Stricter matching logic to determine if a rule is relevant to the clauses detected in a document.
 * Used for both Recommendations and for skipping redundant deep analysis.
 */
export function matchRuleToClauses(
  rule: any,
  matchedClauseNames: string[],
): boolean {
  const ruleName = (rule.name || "").toLowerCase();
  const ruleDesc = (rule.description || "").toLowerCase();
  const definition = (rule.definition ||
    rule.currentVersion?.ruleDefinition) as any;

  // Extract keywords/queries for better matching
  const ruleKeywords = [
    ...(definition?.searchQueries || []),
    ...(definition?.whatToCheck || []),
    ...(definition?.keywordPacks?.flatMap((p: any) => p.keywords) || []),
  ]
    .map((k) => k?.toLowerCase())
    .filter(Boolean);

  return matchedClauseNames.some((clause) => {
    const clauseLower = clause.toLowerCase().trim();
    if (!clauseLower || clauseLower.length < 3) return false;

    // Clean clause name for better matching (e.g., remove "Exclusion: " prefix)
    const cleanClause = clauseLower
      .replace(/^(exclusion|clause|provision|article|section):\s*/i, "")
      .trim();
    if (cleanClause.length < 3) return false;

    // Escape for regex safety
    const escaped = cleanClause.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // 1. Direct Name Match (Flexible)
    if (ruleName.includes(cleanClause) || cleanClause.includes(ruleName))
      return true;

    try {
      const nameRegex = new RegExp(`\\b${escaped}\\b`, "i");
      if (nameRegex.test(ruleName)) return true;
    } catch (e) {
      // Fallback already handled by includes
    }

    // 2. Keyword/Query Match
    if (
      ruleKeywords.some((kw) => {
        if (!kw) return false;
        const kwClean = kw
          .replace(/^(exclusion|clause|provision|article|section):\s*/i, "")
          .trim();
        if (!kwClean) return false;

        const kwEscaped = kwClean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        try {
          // Check if clause is in keyword or vice versa
          if (kwClean.includes(cleanClause) || cleanClause.includes(kwClean))
            return true;

          const kwRegex = new RegExp(`\\b${escaped}\\b`, "i");
          const clauseRegex = new RegExp(`\\b${kwEscaped}\\b`, "i");
          return (
            kwRegex.test(kwClean) ||
            clauseRegex.test(ruleName) ||
            clauseRegex.test(ruleDesc)
          );
        } catch (e) {
          return kwClean.includes(cleanClause) || cleanClause.includes(kwClean);
        }
      })
    )
      return true;

    // 3. Description overlap
    if (cleanClause.length > 5 && ruleDesc.includes(cleanClause)) return true;

    return false;
  });
}

export type GetApplicableRulesOptions = {
  filterByDetection?: boolean;
  /** Run every active rule for the org (no brain module / category / detection filters). */
  evaluateAllActive?: boolean;
};

export async function getApplicableRules(
  contractId: string,
  filterByDetectionOrOptions: boolean | GetApplicableRulesOptions = false,
) {
  const options: GetApplicableRulesOptions =
    typeof filterByDetectionOrOptions === "boolean"
      ? { filterByDetection: filterByDetectionOrOptions }
      : filterByDetectionOrOptions;
  const { filterByDetection = false, evaluateAllActive = false } = options;
  const [contractRecord] = await db
    .select({
      organizationId: contracts.organizationId,
      workspaceId: contracts.workspaceId,
      selectedRuleIds: contracts.selectedRuleIds,
      contractType: contracts.contractType,
    })
    .from(contracts)
    .where(eq(contracts.id, contractId))
    .limit(1);

  if (!contractRecord) throw new Error(`Contract ${contractId} not found`);

  const { organizationId, workspaceId, selectedRuleIds, contractType } =
    contractRecord;

  console.log(`[RuleEngine] Fetching rules for Contract: ${contractId}`);
  console.log(`[RuleEngine] Workspace: ${workspaceId}, Type: ${contractType}`);
  console.log(`[RuleEngine] Selected Rule IDs:`, selectedRuleIds);

  if (!workspaceId) {
    throw new Error(`Contract ${contractId} has no workspace assigned`);
  }

  // 1. Determine active Brain Modules and workspace type
  let workspaceType = "general";
  let isGlobalWorkspace = false;
  if (workspaceId) {
    const [ws] = await db
      .select({ type: workspaces.type, isGlobal: workspaces.isGlobal })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);
    if (ws) {
      workspaceType = ws.type;
      isGlobalWorkspace = ws.isGlobal ?? false;
    }
  }

  const activeModuleKeys = getAutoSelectedBrainModules({
    workspaceType,
    contractType: normalizeContractType(contractType),
  });

  type RuleRow = {
    id: string;
    name: string;
    category: string | null;
    status: string;
    currentVersion: typeof ruleVersions.$inferSelect | null;
  };

  let rawRows: RuleRow[];

  if (evaluateAllActive) {
    // Deep evaluation: all active org + platform global rules (deduped).
    rawRows = await db
      .select({
        id: rules.id,
        name: rules.name,
        category: rules.category,
        status: rules.status,
        currentVersion: ruleVersions,
      })
      .from(rules)
      .leftJoin(ruleVersions, eq(rules.currentVersionId, ruleVersions.id))
      .where(
        or(eq(rules.isGlobal, true), eq(rules.organizationId, organizationId)),
      );
  } else if (isGlobalWorkspace) {
    rawRows = await db
      .select({
        id: rules.id,
        name: rules.name,
        category: rules.category,
        status: rules.status,
        currentVersion: ruleVersions,
      })
      .from(rules)
      .innerJoin(workspaceRules, eq(rules.id, workspaceRules.ruleId))
      .innerJoin(workspaces, eq(workspaceRules.workspaceId, workspaces.id))
      .leftJoin(ruleVersions, eq(rules.currentVersionId, ruleVersions.id))
      .where(
        and(eq(workspaces.type, workspaceType), eq(workspaces.isGlobal, true)),
      );
  } else {
    rawRows = await db
      .select({
        id: rules.id,
        name: rules.name,
        category: rules.category,
        status: rules.status,
        currentVersion: ruleVersions,
      })
      .from(rules)
      .leftJoin(workspaceRules, eq(rules.id, workspaceRules.ruleId))
      .leftJoin(ruleVersions, eq(rules.currentVersionId, ruleVersions.id))
      .where(
        or(
          eq(rules.isGlobal, true),
          and(
            eq(rules.organizationId, organizationId),
            or(
              eq(workspaceRules.workspaceId, workspaceId),
              sql`${workspaceRules.workspaceId} IS NULL`,
            ),
          ),
        ),
      );
  }

  const rawApplicableRules = Array.from(
    new Map(rawRows.map((r) => [r.id, r])).values(),
  );

  const ruleSettings = await db.query.organizationRuleSettings.findMany({
    where: eq(organizationRuleSettings.organizationId, organizationId),
  });

  const overridesMap = new Map(ruleSettings.map((s) => [s.ruleId, s.status]));

  // 6. Optional: Filter by detection (Mandatory for deep analysis skip)
  let matchedClauseNames: string[] = [];
  if (filterByDetection) {
    const matchedEvents = await db
      .select({ metadata: analysisEvents.metadata })
      .from(analysisEvents)
      .where(
        and(
          eq(analysisEvents.contractId, contractId),
          eq(analysisEvents.eventType, "clause_detected"),
          or(
            eq(analysisEvents.status, "Matched"),
            eq(analysisEvents.status, "Variation"),
            eq(analysisEvents.status, "Green"),
          ),
        ),
      );
    matchedClauseNames = matchedEvents
      .map((e) => (e.metadata as any)?.clauseName?.toLowerCase())
      .filter(Boolean) as string[];
    console.log(
      `[RuleEngine] Detected clauses for filtering:`,
      matchedClauseNames,
    );
  }

  const applicableRules = rawApplicableRules.filter((rule) => {
    // 4. Manual Selection Whitelist (ABSOLUTE OVERRIDE)
    // If the user explicitly chose rules, we respect that.
    // If selectedRuleIds is missing/empty, fall through to auto-selection.
    if (selectedRuleIds && selectedRuleIds.length > 0) {
      if (!selectedRuleIds.includes(rule.id)) return false;
    }

    // --- AUTO-SELECTION FALLBACK ---

    if (rule.status !== "active") return false;

    if (!evaluateAllActive) {
      // 2. Brain Module Filtering - recommendations / auto-select only
      const ruleModuleKey = inferRuleModuleKey(rule);
      if (!activeModuleKeys.includes(ruleModuleKey)) return false;

      // 3. Category Filtering (Smart)
      const ruleCategory = rule.category?.toLowerCase();
      const currentType = normalizeContractType(contractType);

      const knownContractTypes: KnownContractType[] = [
        "reinsurance",
        "insurance",
        "property",
        "liability",
        "casualty",
        "marine",
        "energy",
        "employment",
        "vendor",
        "partnership",
        "aviation",
        "other",
      ];

      if (
        ruleCategory &&
        (knownContractTypes as string[]).includes(ruleCategory) &&
        currentType !== "other"
      ) {
        if (ruleCategory !== currentType) return false;
      }
    }

    // 5. Evaluate standard organization-level overrides explicitly
    const effectiveStatus = overridesMap.has(rule.id)
      ? overridesMap.get(rule.id)
      : rule.status;

    if (effectiveStatus !== "active") return false;

    // 6. Detection Filter — only evaluate rules whose required clauses appear in the contract
    if (filterByDetection && matchedClauseNames.length > 0) {
      return matchRuleToClauses(rule, matchedClauseNames);
    }

    return true;
  });

  const withVersion = applicableRules.filter((r) => r.currentVersion?.id);

  console.log(`[RuleEngine] Raw Rules found: ${rawApplicableRules.length}`);
  console.log(
    `[RuleEngine] Applicable Rules after filtering: ${withVersion.length} (${applicableRules.length} before version filter)`,
  );

  return withVersion;
}

export async function prepareContractForAnalysis(
  contractId: string,
  filterByDetectionOrOptions: boolean | GetApplicableRulesOptions = false,
) {
  const options: GetApplicableRulesOptions =
    typeof filterByDetectionOrOptions === "boolean"
      ? {
          filterByDetection: filterByDetectionOrOptions,
          evaluateAllActive: !filterByDetectionOrOptions,
        }
      : {
          filterByDetection: false,
          evaluateAllActive: true,
          ...filterByDetectionOrOptions,
        };

  const applicableRules = await getApplicableRules(contractId, options);
  const total = applicableRules.length;

  const ruleVersionIds = applicableRules
    .map((r) => r.currentVersion?.id)
    .filter(Boolean) as string[];

  let initialProgress = 0;
  if (ruleVersionIds.length > 0) {
    const [existingCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(ruleResults)
      .where(
        and(
          eq(ruleResults.contractId, contractId),
          inArray(ruleResults.ruleVersionId, ruleVersionIds),
        ),
      );
    initialProgress = Number(existingCount?.count || 0);
  }

  // We only set analysisProgress to initialProgress if it's currently very low (initialization)
  // or if we want to force a refresh. In the main Inngest pipeline, we want to preserve
  // the high percentage (70-80%) already set.
  const [stageRow] = await db
    .select({ analysisStage: contracts.analysisStage })
    .from(contracts)
    .where(eq(contracts.id, contractId))
    .limit(1);

  const fastAlreadyDone = stageRow?.analysisStage === "fast_complete";

  await db
    .update(contracts)
    .set({
      totalRules: total,
      analysisProgress: sql`GREATEST(COALESCE(${contracts.analysisProgress}, 0), ${initialProgress})`,
      ...(fastAlreadyDone
        ? {
            analysisStage: "deep",
            analysisStatus: `[5/5] Rules: Evaluating ${total} rules...`,
          }
        : { contractStatus: "reviewing" }),
    })
    .where(eq(contracts.id, contractId));

  console.log(
    `[RuleEngine] Prepared ${total} rules for contract ${contractId} (evaluateAllActive=${options.evaluateAllActive ?? false})`,
  );

  return applicableRules;
}

export async function finalizeContractAnalysis(contractId: string) {
  const results = await db
    .select({
      status: ruleResults.status,
      reasoning: ruleResults.reasoning,
    })
    .from(ruleResults)
    .where(eq(ruleResults.contractId, contractId));

  const [contractRecord] = await db
    .select({ totalRules: contracts.totalRules })
    .from(contracts)
    .where(eq(contracts.id, contractId))
    .limit(1);

  const totalRules = contractRecord?.totalRules ?? results.length ?? 0;

  if (totalRules === 0) {
    await db
      .update(contracts)
      .set({
        contractStatus: "completed",
        riskScore: 0,
        analysisProgress: 100,
        analysis: null,
        lastAnalyzedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(contracts.id, contractId));
    return;
  }

  const redCount = results.filter((r) => r.status === "Red").length;
  const amberCount = results.filter((r) => r.status === "Amber").length;

  const weightedRisk = redCount * 1.0 + amberCount * 0.4;
  const globalRiskScore = Math.min(
    100,
    Math.round((weightedRisk / totalRules) * 100),
  );

  // AI Synthesis of Contract Intelligence (Step 8/10)
  const [fullContract] = await db
    .select({
      fileContent: contracts.fileContent,
      organizationId: contracts.organizationId,
      contractName: contracts.contractName,
    })
    .from(contracts)
    .where(eq(contracts.id, contractId))
    .limit(1);

  const orgRecord = await db.query.organization.findFirst({
    where: eq(organization.id, fullContract.organizationId),
  });
  const plan: OrganizationPlan = orgRecord?.plan === "plus" ? "plus" : "basic";
  console.log(`[Synthesis] Starting for contract ${contractId}. Plan: ${plan}`);

  const allRulesText = results
    .map(
      (r) =>
        `[Rule Status: ${r.status}]\nFindings: ${r.reasoning?.substring(0, 300)}...`,
    )
    .join("\n\n---\n\n");

  const synthesisSchema = z.object({
    summary: z.string(),
    metadata: z.record(z.string(), z.string()),
    riskConsensus: z.string(),
    keyHighlights: z.array(z.string()),
  });

  const synthesisPrompt = `You are a high-level contract intelligence engine. Synthesize the final executive brief for the contract: "${fullContract.contractName}".
  
  CORE CONTRACT TEXT (EXCERPT):
  ${fullContract.fileContent?.slice(0, 10000)}
  
  DETAILED RULE EVALUATION PROFILE:
  ${allRulesText}
  
  YOUR TASK:
  1. Synthesize a professional, two-paragraph summary of the document's compliance and risk posture. Use the findings provided above.
  2. Extract key-value metadata: Identification of Parties, Effective/Expiry Dates, Governing Law, and Liability/Indemnity Caps.
  3. Provide a one-sentence 'risk consensus' statement.
  4. List the top 3-5 critical highlights or compliance warnings based on the 'Findings' provided.
  `;

  let enrichedAnalysis: ContractAnalysis | null = null;
  try {
    enrichedAnalysis = await generateJSONTierAware({
      schema: synthesisSchema,
      messages: [{ role: "user", content: synthesisPrompt }],
      system:
        "You are a master contract analyst. Provide deep, structured intelligence.",
      plan,
    });
    console.log(
      `[Synthesis] Success for contract ${contractId}. Has summary: ${!!enrichedAnalysis?.summary}`,
    );
  } catch (err) {
    console.error(`[Synthesis] Failed for contract ${contractId}:`, err);
  }

  let plusInsights: any = null;

  if (plan === "plus") {
    console.log(
      `[Synthesis] Generating Plus insights for contract ${contractId}...`,
    );

    const plusSchema = z.object({
      clauseCoverage: z.object({
        coverageScore: z.number().min(0).max(100),
        missingClauses: z.array(z.string()),
        unusualClauses: z.array(z.string()),
      }),
      riskBreakdown: z.object({
        categories: z.record(z.string(), z.string()),
        topDrivers: z.array(z.string()),
      }),
      obligations: z
        .array(
          z.object({
            party: z.string(),
            task: z.string(),
            deadline: z.string().optional(),
            type: z.enum(["critical", "standard"]),
          }),
        )
        .optional(),
      timeline: z
        .array(
          z.object({
            date: z.string(),
            event: z.string(),
            isRisky: z.boolean(),
          }),
        )
        .optional(),
      evidenceSnippets: z
        .array(
          z.object({
            finding: z.string(),
            verbatimText: z.string(),
            explanation: z.string(),
          }),
        )
        .optional(),
    });

    const plusPrompt = `You are a high-level contract intelligence engine. Generate deep "Plus" insights for the contract: "${fullContract.contractName}".
  
  CORE CONTRACT TEXT (EXCERPT):
  ${fullContract.fileContent?.slice(0, 15000)}
  
  DETAILED RULE EVALUATION PROFILE:
  ${allRulesText}
  
  YOUR TASK:
  Extract actionable intelligence across 5 categories:
  1. Clause Coverage: Calculate a coverage score (0-100) based on standard corporate clauses vs detected. List missing and unusual clauses.
  2. Risk Breakdown: Categorize the risks (e.g., Liability, Payment) and list the top driver clauses.
  3. Obligations: Extract key party obligations, tasks, and deadlines (if any).
  4. Timeline: Extract key dates, notice periods, and renewal deadlines.
  5. Evidence: Provide 3-5 critical verbatim snippets from the text supporting the major findings.
  `;

    try {
      plusInsights = await generateJSONTierAware({
        schema: plusSchema,
        messages: [{ role: "user", content: plusPrompt }],
        system:
          "You are a master contract analyst providing deep, structured, and interpretable contract intelligence.",
        plan,
      });
      console.log(
        `[Synthesis] Plus insights generated successfully for contract ${contractId}.`,
      );
    } catch (err) {
      console.error(
        `[Synthesis] Plus insights failed for contract ${contractId}:`,
        err,
      );
    }
  }

  if (enrichedAnalysis && plusInsights) {
    enrichedAnalysis.plus = {
      enabled: true,
      updatedAt: new Date().toISOString(),
      ...plusInsights,
    };
  } else if (!enrichedAnalysis && plusInsights) {
    enrichedAnalysis = {
      plus: {
        enabled: true,
        updatedAt: new Date().toISOString(),
        ...plusInsights,
      },
    };
  }

  await db
    .update(contracts)
    .set({
      contractStatus: "completed",
      riskScore: globalRiskScore,
      analysisProgress: 100,
      analysis: enrichedAnalysis
        ? sql`COALESCE(${contracts.analysis}, '{}'::jsonb) || ${JSON.stringify(enrichedAnalysis)}::jsonb`
        : sql`jsonb_set(COALESCE(${contracts.analysis}, '{}'::jsonb), '{status}', '"Analysis Complete"'::jsonb)`,
      lastAnalyzedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(contracts.id, contractId));
}

export async function getCachedEmbeddings(
  queries: string[],
  bypassDelay = false,
): Promise<number[][]> {
  if (isAstraVectorEnabled()) {
    return queries.map(() => []);
  }

  const queryEmbeddings: number[][] = [];
  const queriesToEmbed: string[] = [];
  const queryToIndex: Map<string, number> = new Map();

  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    const cacheKey = getEmbeddingCacheKey(q);
    const cached = await getGlobalCache<number[]>(cacheKey);

    if (cached) {
      queryEmbeddings[i] = cached;
    } else {
      queriesToEmbed.push(q);
      queryToIndex.set(q, i);
    }
  }

  if (queriesToEmbed.length > 0) {
    const newEmbeddings = await createEmbeddings(queriesToEmbed);

    queriesToEmbed.forEach((q, idx) => {
      const originalIdx = queryToIndex.get(q)!;
      queryEmbeddings[originalIdx] = newEmbeddings[idx];
      // Cache for global reuse
      setGlobalCache(getEmbeddingCacheKey(q), newEmbeddings[idx]);
    });
  }

  return queryEmbeddings;
}

export async function evaluateContractRules(
  contractId: string,
  plan: OrganizationPlan = "basic",
  filterByDetection: boolean = false,
) {
  const applicableRules = await prepareContractForAnalysis(
    contractId,
    filterByDetection,
  );

  if (applicableRules.length === 0) {
    console.log(
      `[RuleEngine] [ContractId: ${contractId}] No applicable rules found. Finalizing.`,
    );
    await finalizeContractAnalysis(contractId);
    return;
  }

  console.log(
    `[RuleEngine] [ContractId: ${contractId}] Starting evaluation of ${applicableRules.length} rules with plan: ${plan}`,
  );

  // PRE-FETCH & BATCH CACHE:
  // Extract all unique search queries from all rules and batch embed them in a single optimized pass.
  // This guarantees 100% cache hits during the parallel Promise.all map later and completely eliminates quota issues!
  const allQueriesSet = new Set<string>();
  for (const rule of applicableRules) {
    const version = rule.currentVersion;
    if (!version) continue;
    const definition = version.ruleDefinition as RuleDefinition | null;
    if (!definition) continue;

    let queries = definition.searchQueries || [];
    if (!Array.isArray(queries) || queries.length === 0) {
      queries = definition.whatToCheck || [];
    }
    const finalQueries =
      Array.isArray(queries) && queries.length > 0
        ? queries
        : [rule.name || rule.id || "Contract Compliance"];

    for (const q of finalQueries) {
      if (q && typeof q === "string" && q.trim()) {
        allQueriesSet.add(q.trim());
      }
    }
  }

  const allQueries = Array.from(allQueriesSet);
  if (allQueries.length > 0) {
    console.log(
      `[RuleEngine] Pre-generating and caching embeddings for ${allQueries.length} unique queries across all rules...`,
    );
    try {
      await getCachedEmbeddings(allQueries);
      console.log(
        `[RuleEngine] Successfully pre-cached all queries for deep analysis!`,
      );
    } catch (prefetchErr) {
      console.warn(
        `[RuleEngine] Pre-caching queries failed non-fatally:`,
        prefetchErr,
      );
    }
  }

  if (plan === "plus") {
    // Parallel batches of 3 for Plus
    const batchSize = 3;
    for (let i = 0; i < applicableRules.length; i += batchSize) {
      const batch = applicableRules.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (rule) => {
          await processSingleRule(rule, contractId, plan);
          await db
            .update(contracts)
            .set({
              analysisProgress: sql`COALESCE(${contracts.analysisProgress}, 0) + ${Math.round(100 / applicableRules.length)}`,
            })
            .where(eq(contracts.id, contractId));
        }),
      );
    }
  } else {
    for (const rule of applicableRules) {
      await processSingleRule(rule, contractId, plan);
      await db
        .update(contracts)
        .set({
          analysisProgress: sql`COALESCE(${contracts.analysisProgress}, 0) + ${Math.round(100 / applicableRules.length)}`,
        })
        .where(eq(contracts.id, contractId));
    }
  }

  await finalizeContractAnalysis(contractId);
}

/** Build evaluation context from fast-analysis clause_detected events when RAG returns nothing. */
async function getDetectedClauseChunksForRule(
  contractId: string,
  rule: {
    id: string;
    name: string;
    description?: string | null;
    currentVersion?: { ruleDefinition?: unknown } | null;
  },
): Promise<
  Array<{
    id: string;
    content: string;
    similarity: number;
    sourceFileName: string | null;
  }>
> {
  const matchedEvents = await db
    .select({ id: analysisEvents.id, metadata: analysisEvents.metadata })
    .from(analysisEvents)
    .where(
      and(
        eq(analysisEvents.contractId, contractId),
        eq(analysisEvents.eventType, "clause_detected"),
        or(
          eq(analysisEvents.status, "Matched"),
          eq(analysisEvents.status, "Variation"),
          eq(analysisEvents.status, "Green"),
        ),
      ),
    );

  const chunks: Array<{
    id: string;
    content: string;
    similarity: number;
    sourceFileName: string | null;
  }> = [];

  for (const event of matchedEvents) {
    const meta = event.metadata as Record<string, unknown> | null;
    const clauseName = (meta?.clauseName as string | undefined)?.toLowerCase();
    if (!clauseName) continue;

    const ruleForMatch = {
      name: rule.name,
      description: rule.description,
      definition: rule.currentVersion?.ruleDefinition,
    };
    if (!matchRuleToClauses(ruleForMatch, [clauseName])) continue;

    const content =
      (meta?.documentText as string | undefined) ||
      (meta?.documentTextSnippet as string | undefined) ||
      "";
    if (content.trim().length < 20) continue;

    chunks.push({
      id: `detected-${event.id}`,
      content: content.trim(),
      similarity: (meta?.confidence as number | undefined) ?? 0.85,
      sourceFileName: null,
    });
  }

  return chunks;
}

/** Strip optional `**Heading**` prefix from model evidence so chunk overlap matching uses verbatim body text. */
function evidenceTextForChunkMatch(extracted: string): string {
  const t = extracted.trim();
  const afterHeading = t.replace(/^\*\*[^*]+\*\*\s*\n*/m, "").trim();
  return afterHeading || t;
}

export async function processSingleRule(
  rule: any,
  contractId: string,
  plan: OrganizationPlan = "basic",
) {
  console.log(
    `[RuleEngine] processSingleRule START for rule ${rule.id} contract ${contractId}`,
  );
  const version = rule.currentVersion;
  if (!version) {
    console.log(`[RuleEngine] Rule ${rule.id} has no version!`);
    return;
  }
  console.log(`[RuleEngine] Rule ${rule.id} version found: ${version.id}`);

  const definition = version.ruleDefinition as RuleDefinition | null;
  if (!definition) {
    console.log(`[RuleEngine] Rule ${rule.id} has NO definition!`);
    return;
  }
  console.log(`[RuleEngine] Rule ${rule.id} has valid definition`);

  let queries = definition.searchQueries || [];
  if (!Array.isArray(queries) || queries.length === 0) {
    queries = definition.whatToCheck || [];
  }

  const finalQueries =
    Array.isArray(queries) && queries.length > 0
      ? queries
      : [rule.name || rule.id || "Contract Compliance"];

  try {
    const queryEmbeddings = await getCachedEmbeddings(finalQueries);

    let matchedChunks = await retrieveRelevantContractChunks(
      contractId,
      finalQueries,
      queryEmbeddings,
    );

    if (matchedChunks.length === 0) {
      matchedChunks = await getDetectedClauseChunksForRule(contractId, rule);
    }

    if (matchedChunks.length === 0) {
      await storeRuleResultWithMatches({
        contractId,
        ruleId: rule.id,
        ruleVersionId: version.id,
        status: "Red",
        reasoning:
          "No relevant clauses or contract terms found for this rule within the document.",
        matchedContractChunks: [],
      });
      return;
    }

    const evaluation = await evaluateRuleWithOpenRouter(
      contractId,
      rule.name,
      definition,
      matchedChunks,
      plan,
    );

    const finalEvidence: any[] = [];
    const usedChunkIds = new Set<string>();

    for (const extractedText of evaluation.extractedEvidence) {
      const needle = evidenceTextForChunkMatch(extractedText);
      const matchingChunk = matchedChunks.find(
        (c) =>
          (needle.length >= 12 &&
            (c.content.includes(needle) || needle.includes(c.content))) ||
          c.content.includes(extractedText) ||
          extractedText.includes(c.content.substring(0, 100)),
      );

      if (matchingChunk && !usedChunkIds.has(matchingChunk.id)) {
        finalEvidence.push({
          content: extractedText,
          id: matchingChunk.id,
          similarity: matchingChunk.similarity,
          sourceFileName: matchingChunk.sourceFileName,
          clauseBody: needle || extractedText,
        });
        usedChunkIds.add(matchingChunk.id);
      } else if (matchingChunk && usedChunkIds.has(matchingChunk.id)) {
        finalEvidence.push({
          content: extractedText,
          id: null,
          similarity: matchingChunk.similarity,
          sourceFileName: matchingChunk.sourceFileName,
          clauseBody: needle || extractedText,
        });
      } else if (!matchingChunk) {
        finalEvidence.push({
          content: extractedText,
          id: null,
          similarity: null,
          sourceFileName: null,
          clauseBody: needle || extractedText,
        });
      }
    }

    console.log(
      `[RuleEngine] Calling storeRuleResultWithMatches for ${rule.id}`,
    );
    await storeRuleResultWithMatches({
      contractId,
      ruleId: rule.id,
      ruleVersionId: version.id,
      status: evaluation.status,
      reasoning: evaluation.reasoning,
      bias: evaluation.detectedBias,
      matchedContractChunks: finalEvidence,
      granularGuidance: evaluation.granularGuidance,
    });
    console.log(
      `[RuleEngine] storeRuleResultWithMatches completed for ${rule.id}`,
    );
  } catch (err) {
    console.error(
      `[RuleEngine Worker] [ContractId: ${contractId}] [RuleId: ${rule.id}] Failed:`,
      err,
    );
    throw err;
  }
}

/**
 * Chunks a contract version and generates embeddings for RAG retrieval.
 */
export async function chunkAndEmbedContractVersion(
  contractId: string,
  versionId: string,
  text: string,
  onProgress?: (current: number, total: number) => Promise<void>,
) {
  if (!text?.trim()) return;

  const { splitText } = await import("@/lib/chunk");
  const { createEmbeddings } = await import("@/lib/embedding");

  const chunks = splitText(text, 1000);
  if (chunks.length === 0) return;

  // Check if we already have chunks for this version in the database
  const existingChunks = await db
    .select({ id: contractChunks.id })
    .from(contractChunks)
    .where(eq(contractChunks.contractVersionId, versionId));

  // Verify version exists (sanity check for FK race conditions)
  const [versionCheck] = await db
    .select({ id: contractVersions.id })
    .from(contractVersions)
    .where(eq(contractVersions.id, versionId))
    .limit(1);

  if (!versionCheck) {
    console.error(
      `[RAG] Fatal: Contract version ${versionId} not found in database. Aborting embedding.`,
    );
    throw new Error(`Contract version ${versionId} not found`);
  }

  if (isAstraVectorEnabled()) {
    await deleteAstraContractChunks(versionId);
  }

  if (existingChunks.length > 0) {
    if (existingChunks.length === chunks.length && !isAstraVectorEnabled()) {
      console.log(
        `[RAG] Reuse: Found all ${existingChunks.length} existing embeddings/chunks for contract ${contractId} version ${versionId}. Skipping generation.`,
      );
      return;
    }

    console.log(
      `[RAG] Partial/stale chunks found (${existingChunks.length} vs expected ${chunks.length}). Rebuilding chunks...`,
    );
    await db
      .delete(contractChunks)
      .where(eq(contractChunks.contractVersionId, versionId));
  }

  console.log(
    `[RAG] Chunking ${chunks.length} segments for contract ${contractId} (Version: ${versionId}, Astra: ${isAstraVectorEnabled()})...`,
  );

  if (isAstraVectorEnabled()) {
    await insertAstraContractChunks({
      contractId,
      contractVersionId: versionId,
      chunks: chunks.map((content) => ({ content: content.trim() })),
    });
    const values = chunks.map((content) => ({
      contractVersionId: versionId,
      content: content.trim(),
      embedding: null,
    }));
    if (values.length > 0) {
      await db.insert(contractChunks).values(values);
    }
    if (onProgress) await onProgress(chunks.length, chunks.length);
    return;
  }

  const BATCH_SIZE = 10;
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    try {
      const embeddings = (await createEmbeddings(batch)) as number[][];
      const values = batch.map((content, idx) => ({
        contractVersionId: versionId,
        content: content.trim(),
        embedding: embeddings[idx],
      }));

      if (values.length > 0) {
        await db.insert(contractChunks).values(values);
      }

      if (onProgress) {
        await onProgress(
          Math.min(i + BATCH_SIZE, chunks.length),
          chunks.length,
        );
      }
    } catch (err) {
      console.error(`[RAG] Embedding batch ${i / BATCH_SIZE} failed:`, err);
      throw err;
    }
  }
}

/**
 * High-performance semantic retrieval for contract chunks.
 */
export async function retrieveRelevantContractChunks(
  contractId: string,
  queries: string[],
  queryEmbeddings: number[][],
  topKPerQuery = 5,
  distanceThreshold = 0.5,
  useCache = true,
) {
  if (!queries.length) return [];

  const cacheKey = getRetrievalCacheKey(contractId, queries);
  if (useCache) {
    const cached = await getGlobalCache<any[]>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  console.log(`[RuleEngine] Fetching contract ${contractId}...`);
  const query = db
    .select({ currentVersionId: contracts.currentVersionId })
    .from(contracts)
    .where(eq(contracts.id, contractId));

  const contractResult = await query;
  console.log(`[RuleEngine] Query result:`, contractResult);
  const [contract] = contractResult;

  if (!contract?.currentVersionId) return [];

  const versionId = contract.currentVersionId;

  let allChunksResults: Array<
    Array<{
      id: string;
      content: string;
      sourceFileName?: string | null;
      similarity: number;
    }>
  >;

  if (isAstraVectorEnabled()) {
    allChunksResults = await Promise.all(
      queries.map(async (q) => {
        const hits = await searchAstraContractChunks({
          contractVersionId: versionId,
          queryText: q,
          limit: topKPerQuery,
          maxDistance: distanceThreshold,
        });
        return hits.map((h) => ({
          id: h.id,
          content: h.content,
          sourceFileName: (h.metadata.sourceFileName as string) ?? null,
          similarity: h.similarity,
        }));
      }),
    );
  } else {
    allChunksResults = await Promise.all(
      queries.map(async (_, i) => {
        if (!queryEmbeddings[i]) return [];

        const queryVec = sql`${"[" + queryEmbeddings[i].join(",") + "]"}::vector`;

        return await db
          .select({
            id: contractChunks.id,
            content: contractChunks.content,
            embedding: contractChunks.embedding,
            sourceFileName: contractChunks.sourceFileName,
            similarity: sql<number>`1 - (${contractChunks.embedding} <=> ${queryVec})`,
          })
          .from(contractChunks)
          .where(
            and(
              eq(contractChunks.contractVersionId, versionId),
              sql`${contractChunks.embedding} <=> ${queryVec} < ${distanceThreshold}`,
            ),
          )
          .orderBy(sql`${contractChunks.embedding} <=> ${queryVec}`)
          .limit(topKPerQuery);
      }),
    );
  }

  const allChunks = allChunksResults.flat();
  const unique = new Map<string, any>();
  for (const c of allChunks) {
    const existing = unique.get(c.id);
    if (!existing || c.similarity > existing.similarity) unique.set(c.id, c);
  }

  const finalChunks = Array.from(unique.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 10);

  if (useCache && finalChunks.length > 0) {
    await setGlobalCache(cacheKey, finalChunks, 60 * 30);
  }

  return finalChunks;
}

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

export type SegmentedClause = {
  clause_identifier: string;
  clause_text: string;
  category: string;
};

/**
 * Generates a lightweight document summary during fast analysis.
 * Uses only the contract text (no rule results needed) so the summary
 * appears immediately after the fast analysis phase completes.
 */
export async function generateFastSummary(
  contractId: string,
  plan: OrganizationPlan = "basic",
  force: boolean = false,
) {
  const [contractRecord] = await db
    .select({
      fileContent: contracts.fileContent,
      contractName: contracts.contractName,
      organizationId: contracts.organizationId,
      workspaceId: contracts.workspaceId,
    })
    .from(contracts)
    .where(eq(contracts.id, contractId))
    .limit(1);

  if (!contractRecord?.fileContent) {
    console.warn(`[FastSummary] No file content for contract ${contractId}`);
    return;
  }

  // Idempotency Check - skip if force is true
  const [existingAnalysis] = await db
    .select({ analysis: contracts.analysis })
    .from(contracts)
    .where(eq(contracts.id, contractId))
    .limit(1);

  if (!force && (existingAnalysis?.analysis as any)?.summary) {
    console.log(
      `[FastSummary] Reuse: Summary already exists for contract ${contractId}. Skipping generation.`,
    );
    return;
  }

  // Determine workspace type for tailored metadata extraction
  let workspaceType = "general";
  if (contractRecord.workspaceId) {
    const [ws] = await db
      .select({ type: workspaces.type })
      .from(workspaces)
      .where(eq(workspaces.id, contractRecord.workspaceId))
      .limit(1);
    if (ws) workspaceType = ws.type;
  }

  // Typed, described metadata schema per workspace. A previous open
  // z.record(...) let weaker models satisfy the schema with an empty {}
  // (which is exactly what we saw in production — blank metadata despite the
  // prose containing every value). Named fields force population and lift
  // structured-output reliability on cheaper models like Gemma. Every field
  // is a string; the prompt instructs "Not specified" rather than omission.
  const reinsuranceMeta = z.object({
    cedent: z.string().describe("Ceding company / reinsured."),
    reinsurer: z.string().describe("Reinsurer(s) / subscribing underwriters."),
    broker: z.string().describe("Broker / intermediary, if any."),
    treatyType: z
      .string()
      .describe("e.g. Excess of Loss, Quota Share, Surplus, Facultative."),
    period: z.string().describe("Treaty period (inception to expiry) as written."),
    retentionPriority: z
      .string()
      .describe("Retention / priority / deductible."),
    limitIndemnity: z.string().describe("Limit / indemnity / cover amount."),
    governingLaw: z.string().describe("Governing law & jurisdiction."),
  });
  const generalMeta = z.object({
    parties: z.string().describe("Contracting parties."),
    effectiveDate: z.string(),
    expiryDate: z.string(),
    governingLaw: z.string(),
    liabilityCap: z.string().describe("Liability / indemnity cap if identifiable."),
  });
  const summarySchema = z.object({
    summary: z.string(),
    metadata: workspaceType === "reinsurance" ? reinsuranceMeta : generalMeta,
    riskConsensus: z.string(),
    keyHighlights: z.array(z.string()),
  });

  const summaryPrompt = `You are a senior reinsurance wording analyst reviewing the contract "${contractRecord.contractName}".

CONTRACT TEXT (EXCERPT):
${contractRecord.fileContent.slice(0, 12000)}

TASK — return strict JSON for the schema. Quality bar: a treaty underwriter should find every field immediately useful.
1. summary: two tight paragraphs covering purpose, structure, the key commercial terms (limits, priorities/retentions, period), and any notable or unusual provisions. No filler, no hedging.
2. metadata: fill EVERY field from the text. If a value genuinely is not present, use the exact string "Not specified" — never leave a field blank or omit it.
3. riskConsensus: ONE sentence naming the single most material risk or gap a reinsurer should note in THIS contract — e.g. a missing loss-date-order clause, aggregation/"each and every loss" ambiguity, an unbalanced priority ladder, an absent cyber or terrorism exclusion, unclear reinstatement terms. Name the specific provision. Do NOT write generic statements like "introduces complexity".
4. keyHighlights: 3-5 concrete, factual highlights (structure, limits, exclusions, conditions). Each standalone.`;

  try {
    const result = await generateJSONTierAware({
      schema: summarySchema,
      messages: [{ role: "user", content: summaryPrompt }],
      system:
        "You are a master contract analyst. Provide deep, structured intelligence based on a first-pass document reading.",
      plan,
      models: [MODEL_GEMMA_4_31B, MODEL_FLASH], // Prioritize Gemma 4 as requested
      timeoutMs: 48_000, // Vercel Hobby 60s cap per step
    });

    if (result?.summary) {
      // Store summary in the analysis JSONB, preserving existing fields (like status)
      await db
        .update(contracts)
        .set({
          analysis: sql`COALESCE(${contracts.analysis}, '{}'::jsonb) || ${JSON.stringify(
            {
              summary: result.summary,
              metadata: result.metadata,
              riskConsensus: result.riskConsensus,
              keyHighlights: result.keyHighlights,
            },
          )}::jsonb`,
        })
        .where(eq(contracts.id, contractId));

      console.log(`[FastSummary] Summary generated for contract ${contractId}`);

      if (isAstraVectorEnabled() && result) {
        const searchText = [
          result.summary,
          result.riskConsensus,
          ...(result.keyHighlights ?? []),
        ]
          .filter(Boolean)
          .join("\n");
        await upsertAstraAiGeneration({
          contractId,
          kind: "fast_summary",
          organizationId: contractRecord.organizationId,
          workspaceId: contractRecord.workspaceId,
          payload: result,
          searchText,
        });
      }
    }
  } catch (err) {
    console.error(`[FastSummary] Failed for contract ${contractId}:`, err);
    // Non-fatal: fast analysis continues without summary
  }
}

/** Batches per Inngest step (each step must finish within Vercel 60s). */
export const CHECKLIST_BATCH_SIZE = 5;

export type ChecklistCandidate = {
  heading: string;
  fullText: string;
  semanticQuery: string;
  embeddingQuery: string;
};

export type ChecklistBatchPlan = {
  orgId: string;
  workspaceId: string;
  candidateCount: number;
  expectedHeadingCount: number;
  totalBatches: number;
  batchSize: number;
};

/**
 * MRC slips open with an administrative header block — client / reinsured
 * names, broker references, dates — laid out as field:value rows. Those are
 * not contract provisions, so they must not enter the clause checklist (they
 * still appear in the document map). Without this filter they get force-matched
 * to the nearest library clause at low similarity, producing noise such as
 * "CLIENT SHORTNAME ≈ Extra contractual obligations clause".
 *
 * Deliberately conservative: it targets recognised administrative field labels
 * and generic container headings only, so real provisions (Reinsuring Clause,
 * Premium, Exclusions, Governing Law, named LSW/NMA clauses, …) are kept.
 */
const NON_CLAUSE_HEADINGS = new Set([
  "introduction",
  "contract details",
  "risk details",
  "client information",
  "agreement information",
  "contract administration",
  "agreement number",
  "order hereon",
  "unique market reference",
  "umr",
]);

function isNonClauseHeading(headingRaw: string): boolean {
  const h = headingRaw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/:+$/, "");
  if (!h) return true;
  if (NON_CLAUSE_HEADINGS.has(h)) return true;
  // Field labels: "<party> SHORTNAME/LONGNAME", references, dates.
  if (/\b(short ?name|long ?name)$/.test(h)) return true;
  if (/^(previous |client |reinsured |broker |cedant |cedent )?ref\.?(\s*\/\s*contact)?$/.test(h))
    return true;
  if (/(^|\b)(contract )?document date$/.test(h)) return true;
  if (/^(client|reinsured|cedant|cedent|broker|insured) (name|number|code|contact)$/.test(h))
    return true;
  return false;
}

function buildChecklistCandidates(
  docMap: StructuredContract,
): ChecklistCandidate[] {
  const candidates: ChecklistCandidate[] = [];
  const buildSemanticQuery = (heading: string, body: string) => {
    const parts = [heading?.trim(), body?.trim()].filter(Boolean);
    return parts.join("\n\n").slice(0, 4000);
  };

  const pushHeading = (headingRaw: string, body: string, fallback: string) => {
    const heading = headingRaw?.trim() || fallback;
    if (isFallbackSectionHeading(heading)) return;
    // Skip MRC administrative/metadata fields — they belong in the document
    // map, not the clause checklist.
    if (isNonClauseHeading(heading)) return;
    const bodyText = body.trim();
    const sectionQuery = buildSemanticQuery(heading, bodyText);
    candidates.push({
      heading,
      fullText: bodyText || heading,
      semanticQuery: sectionQuery,
      embeddingQuery: prepareEmbeddingText(sectionQuery),
    });
  };

  for (const section of docMap.sections || []) {
    const sectionText = (section.paragraphs || []).join("\n").trim();
    pushHeading(section.heading, sectionText, "Section");

    for (const sub of section.subsections || []) {
      const subText = (sub.paragraphs || []).join("\n").trim();
      pushHeading(sub.heading, subText, section.heading?.trim() || "Section");
    }
  }
  return candidates;
}

/** Load document map and flatten sections into checklist candidates. */
export async function loadChecklistCandidates(contractId: string): Promise<{
  orgId: string;
  candidates: ChecklistCandidate[];
  expectedHeadingCount: number;
} | null> {
  const [contract] = await db
    .select({
      structuredContent: contracts.structuredContent,
      fileContent: contracts.fileContent,
      organizationId: contracts.organizationId,
    })
    .from(contracts)
    .where(eq(contracts.id, contractId))
    .limit(1);

  if (!contract) {
    console.warn(`[Checklist] Contract ${contractId} not found`);
    return null;
  }

  let docMap = contract.structuredContent as StructuredContract | null;

  if (!isQualityStructuredMap(docMap) && contract.fileContent?.trim()) {
    console.warn(
      `[Checklist] Rebuilding document map from text for ${contractId}`,
    );
    docMap = structureTextHeuristically(contract.fileContent);
    await db
      .update(contracts)
      .set({ structuredContent: docMap, updatedAt: new Date() })
      .where(eq(contracts.id, contractId));
  }

  if (!isQualityStructuredMap(docMap)) {
    console.warn(
      `[Checklist] No usable document map for contract ${contractId}`,
    );
    return null;
  }

  const sanitized = sanitizeStructuredMap(docMap as StructuredContract);
  const candidates = buildChecklistCandidates(sanitized);
  // expectedHeadingCount must track the provisions we will actually check —
  // the filtered candidate count, not every document-map heading (MRC metadata
  // fields are excluded in buildChecklistCandidates). This keeps the stored
  // checklistExpectedCount and the stored-vs-expected check consistent.
  const mapHeadingCount = countDocumentMapHeadings(sanitized);
  const expectedHeadingCount = candidates.length;
  if (mapHeadingCount > candidates.length) {
    console.log(
      `[Checklist] Skipped ${mapHeadingCount - candidates.length} non-clause/metadata heading(s); ${candidates.length} provision(s) to check for ${contractId}`,
    );
  }

  if (candidates.length === 0) {
    console.warn(
      `[Checklist] Document map is empty for contract ${contractId}`,
    );
    return null;
  }

  if (candidates.length !== expectedHeadingCount) {
    console.warn(
      `[Checklist] Candidate count ${candidates.length} !== document map headings ${expectedHeadingCount} for ${contractId}`,
    );
  }

  return { orgId: contract.organizationId, candidates, expectedHeadingCount };
}

/**
 * Prepare checklist: clear prior events and return batch plan for Inngest fan-out.
 */
type ChecklistStagingRow = {
  heading: string;
  fullText: string;
  embeddingQuery: string;
};

async function persistChecklistStaging(
  contractId: string,
  orgId: string,
  candidates: ChecklistCandidate[],
  expectedHeadingCount: number,
) {
  const staging: ChecklistStagingRow[] = candidates.map((c) => ({
    heading: c.heading,
    fullText: c.fullText.slice(0, 4000),
    embeddingQuery: c.embeddingQuery,
  }));

  await db
    .update(contracts)
    .set({
      analysis: sql`jsonb_set(
        jsonb_set(
          COALESCE(${contracts.analysis}, '{}'::jsonb),
          '{checklistStaging}',
          ${JSON.stringify(staging)}::jsonb
        ),
        '{checklistExpectedCount}',
        to_jsonb(${expectedHeadingCount}::int)
      )`,
      updatedAt: new Date(),
    })
    .where(eq(contracts.id, contractId));
}

async function loadStagedChecklistCandidates(contractId: string): Promise<{
  orgId: string;
  candidates: ChecklistCandidate[];
  expectedHeadingCount: number;
} | null> {
  const [row] = await db
    .select({
      organizationId: contracts.organizationId,
      analysis: contracts.analysis,
    })
    .from(contracts)
    .where(eq(contracts.id, contractId))
    .limit(1);

  if (!row) return null;

  const staging = (row.analysis as { checklistStaging?: ChecklistStagingRow[] })
    ?.checklistStaging;
  if (!staging?.length) return loadChecklistCandidates(contractId);

  const expected =
    (row.analysis as { checklistExpectedCount?: number })
      ?.checklistExpectedCount ?? staging.length;

  return {
    orgId: row.organizationId,
    candidates: staging.map((s) => ({
      heading: s.heading,
      fullText: s.fullText,
      semanticQuery: s.fullText,
      embeddingQuery: s.embeddingQuery,
    })),
    expectedHeadingCount: expected,
  };
}

export async function clearChecklistStaging(contractId: string) {
  await db
    .update(contracts)
    .set({
      analysis: sql`${contracts.analysis} - 'checklistStaging'`,
      updatedAt: new Date(),
    })
    .where(eq(contracts.id, contractId));
}

export async function prepareDocumentMapChecklist(
  contractId: string,
  workspaceId: string,
): Promise<ChecklistBatchPlan | null> {
  console.log(`[Checklist] Preparing for ${contractId}`);

  const loaded = await loadChecklistCandidates(contractId);
  if (!loaded) return null;

  await db
    .delete(analysisEvents)
    .where(
      and(
        eq(analysisEvents.contractId, contractId),
        eq(analysisEvents.eventType, "clause_detected"),
      ),
    );

  await persistChecklistStaging(
    contractId,
    loaded.orgId,
    loaded.candidates,
    loaded.expectedHeadingCount,
  );

  const totalBatches = Math.ceil(
    loaded.candidates.length / CHECKLIST_BATCH_SIZE,
  );
  console.log(
    `[Checklist] ${loaded.candidates.length} candidates → ${totalBatches} batches (staged in Neon once)`,
  );

  return {
    orgId: loaded.orgId,
    workspaceId,
    candidateCount: loaded.candidates.length,
    expectedHeadingCount: loaded.expectedHeadingCount,
    totalBatches,
    batchSize: CHECKLIST_BATCH_SIZE,
  };
}

/**
 * Process a single checklist batch (one Inngest step — stays under Vercel 60s).
 */
/**
 * Clause-code classification (Richard's Rule A / B / C).
 *
 * Reinsurance contracts frequently incorporate a library clause purely by
 * reference: the contract shows only a heading + a market code (e.g.
 * "Errors and Omissions - LSW321") with no clause body, meaning the library
 * wording is authoritative and must be "read in". When that happens the
 * provision is a 100% match to the coded library clause, regardless of
 * semantic similarity.
 *
 *   Rule A  heading carries a code, no substantive body   -> 100% (read-in)
 *   Rule C  heading carries a code, plus extra body text   -> 100% (+ context)
 *   Rule B  bespoke/amended body, no code match            -> semantic (Amber)
 *
 * We match against the ACTUAL library codes (loaded into an index) rather
 * than guessing a regex, so only real references count.
 */
type CodeIndexRow = {
  id: string;
  clauseName: string;
  clauseText: string;
  library: string | null;
  category: string | null;
  code: string;
};

/** Uppercase + strip everything but A-Z0-9 so "LSW 321", "lsw-321" all match. */
function normalizeCodeToken(s: string): string {
  return (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Index key for a library code. Library codes often carry an edition /
 * variant suffix in parentheses, e.g. "LSW307A (05/00)" or
 * "LSW1001 (Reinsurance) (08/94)". A contract references only the base code
 * ("LSW 307A"), so we drop the parenthetical groups before normalizing.
 * The result ("LSW307A") substring-matches the normalized contract text.
 */
function baseCodeKey(s: string): string {
  return (s || "")
    .toUpperCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

/** Build a normalized-code -> clause index for all coded clauses in scope. */
async function buildWorkspaceCodeIndex(
  organizationId: string,
): Promise<Map<string, CodeIndexRow>> {
  const rows = await db
    .select({
      id: clauses.id,
      clauseName: clauses.clauseName,
      clauseText: clauses.clauseText,
      library: clauses.library,
      category: clauses.category,
      code: clauses.code,
    })
    .from(clauses)
    .where(
      and(
        or(
          eq(clauses.isGlobal, true),
          eq(clauses.organizationId, organizationId),
        ),
        sql`${clauses.code} IS NOT NULL AND ${clauses.code} <> ''`,
      ),
    );

  const index = new Map<string, CodeIndexRow>();
  for (const r of rows) {
    if (!r.code) continue;
    const norm = baseCodeKey(r.code);
    // Codes shorter than 5 normalized chars are too ambiguous to substring-match.
    if (norm.length < 5) continue;
    // First writer wins; core (global) rows are returned first by default.
    if (!index.has(norm)) index.set(norm, r as CodeIndexRow);
  }
  return index;
}

/**
 * Find a library clause whose code appears in the given heading/lead text.
 * Returns the longest (most specific) matching code's clause, or null.
 */
function findCodeReference(
  text: string,
  codeIndex: Map<string, CodeIndexRow>,
): CodeIndexRow | null {
  const hay = normalizeCodeToken(text);
  if (!hay) return null;
  let best: CodeIndexRow | null = null;
  let bestLen = 0;
  for (const [norm, row] of codeIndex) {
    if (norm.length > bestLen && hay.includes(norm)) {
      best = row;
      bestLen = norm.length;
    }
  }
  return best;
}

export async function runDocumentMapChecklistBatch(
  contractId: string,
  workspaceId: string,
  batchIndex: number,
): Promise<{ stored: number; expectedHeadingCount: number }> {
  const loaded = await loadStagedChecklistCandidates(contractId);
  if (!loaded) return { stored: 0, expectedHeadingCount: 0 };

  const { orgId, candidates } = loaded;
  const start = batchIndex * CHECKLIST_BATCH_SIZE;
  const batch = candidates.slice(start, start + CHECKLIST_BATCH_SIZE);
  if (batch.length === 0)
    return { stored: 0, expectedHeadingCount: loaded.expectedHeadingCount };

  const totalBatches = Math.ceil(candidates.length / CHECKLIST_BATCH_SIZE);
  console.log(
    `[Checklist] Batch ${batchIndex + 1}/${totalBatches} (${batch.length} items) for ${contractId}`,
  );

  let matchesBatch: Awaited<ReturnType<typeof findClosestLibraryMatchesBatch>> =
    batch.map(() => []);

  try {
    matchesBatch = await findClosestLibraryMatchesBatch(
      batch.map((c) => c.embeddingQuery),
      orgId,
      workspaceId,
      3,
      batch.map((c) => c.heading),
    );
  } catch (err) {
    console.error(`[Checklist] Batch ${batchIndex + 1} failed:`, err);
  }

  // Code index for Rule A/C: any contract heading that carries a real
  // library code is an incorporation-by-reference and counts as a 100% match.
  let codeIndex = new Map<string, CodeIndexRow>();
  try {
    codeIndex = await buildWorkspaceCodeIndex(orgId);
  } catch (err) {
    console.warn("[Checklist] code index build failed:", err);
  }

  const eventValues = batch.map((candidate, idx) => {
    // ── Rule A / C: code reference in the heading (or its lead text) ──
    // Look in the heading first, then a short lead of the body, since the
    // code sometimes lands at the very start of the section body.
    const codeHaystack = `${candidate.heading}\n${candidate.fullText.slice(0, 200)}`;
    const codeHit = findCodeReference(codeHaystack, codeIndex);

    if (codeHit) {
      // Does the provision carry substantive body text beyond the heading?
      // buildChecklistCandidates sets fullText = body || heading, so an
      // empty body means fullText === heading.
      const bodyOnly =
        candidate.fullText.trim() === candidate.heading.trim()
          ? ""
          : candidate.fullText.trim();
      const hasContext = bodyOnly.replace(/\s+/g, " ").length > 60;

      const reasoning = hasContext
        ? `Library clause ${codeHit.code} incorporated by reference, with contract-specific additions (100% match).`
        : `Incorporated by reference to ${codeHit.code} — the library wording is authoritative (100% match).`;

      return {
        workspaceId,
        contractId,
        organizationId: orgId,
        eventType: "clause_detected" as const,
        status: "Matched" as const,
        metadata: {
          clauseName: candidate.heading,
          category: codeHit.category || "Contract Provision",
          documentText: candidate.fullText,
          documentTextSnippet: candidate.fullText.substring(0, 300),
          libraryStandard: codeHit.clauseText || "No library standard found.",
          reasoning,
          confidence: 1,
          clauseCode: codeHit.code,
          matchType: "code" as const,
          libraryPlusContext: hasContext,
          isGlobal: true,
        },
      };
    }

    // ── Rule B: no code reference, fall back to semantic similarity ──
    // Sort descending so we can compare the top hit against the runner-up.
    const matches = (matchesBatch[idx] || [])
      .slice()
      .sort((a: any, b: any) => (b.similarity ?? 0) - (a.similarity ?? 0));
    const bestMatch = matches[0] ?? null;
    const similarity = bestMatch ? Number(bestMatch.similarity) : 0;
    const runnerUpSim = matches[1] ? Number(matches[1].similarity) : 0;

    // Ambiguity guard: a sub-Matched hit that barely beats the runner-up is an
    // arbitrary nearest neighbour, not a real equivalence — treat as bespoke.
    const ambiguous =
      similarity < CHECKLIST_MATCHED_APPROVED_THRESHOLD &&
      runnerUpSim > 0 &&
      similarity - runnerUpSim < CHECKLIST_MATCH_MARGIN;

    let status: "Matched" | "Variation" | "Custom" = "Custom";
    if (similarity >= CHECKLIST_MATCHED_APPROVED_THRESHOLD) {
      status = "Matched";
    } else if (similarity >= CHECKLIST_VARIATION_FLOOR && !ambiguous) {
      status = "Variation";
    }

    // Only carry a library reference when we actually asserted a match. A
    // Custom (bespoke) provision must NOT inherit the weak nearest-neighbour's
    // code/standard — that was the source of misleading "Variation" noise.
    const hasLibraryRef = status !== "Custom";
    const pct = Math.round(similarity * 100);
    const reasoning =
      status === "Matched"
        ? `Closely matches library clause "${bestMatch?.clauseName}" (${pct}% similarity) — treat as the company standard wording.`
        : status === "Variation"
          ? `Resembles library clause "${bestMatch?.clauseName}" (${pct}% similarity) — review for departures from the standard wording.`
          : "Bespoke provision with no close library equivalent — review on its own terms.";

    return {
      workspaceId,
      contractId,
      organizationId: orgId,
      eventType: "clause_detected" as const,
      status,
      metadata: {
        clauseName: candidate.heading,
        category: hasLibraryRef
          ? bestMatch?.category || "Contract Provision"
          : "Contract Provision",
        documentText: candidate.fullText,
        documentTextSnippet: candidate.fullText.substring(0, 300),
        libraryStandard: hasLibraryRef
          ? bestMatch?.clauseText || "No library standard found."
          : "No close library equivalent.",
        reasoning,
        confidence: similarity,
        clauseCode: hasLibraryRef ? bestMatch?.code || null : null,
        matchType: "semantic" as const,
        libraryPlusContext: false,
        isGlobal: true,
      },
    };
  });

  if (eventValues.length > 0) {
    await db.insert(analysisEvents).values(eventValues);
  }

  return {
    stored: eventValues.length,
    expectedHeadingCount: loaded.expectedHeadingCount,
  };
}

/**
 * Analysis Checklist Stage (Fast Analysis 2.5)
 * Driven by the AI-generated Document Map.
 * Prefer prepareDocumentMapChecklist + runDocumentMapChecklistBatch from Inngest.
 */
export async function runDocumentMapChecklist(
  contractId: string,
  workspaceId: string,
) {
  console.log(`[Checklist] Running Document Map Checklist for ${contractId}`);
  const plan = await prepareDocumentMapChecklist(contractId, workspaceId);
  if (!plan) return;

  let totalStored = 0;
  for (let b = 0; b < plan.totalBatches; b++) {
    const { stored } = await runDocumentMapChecklistBatch(
      contractId,
      workspaceId,
      b,
    );
    totalStored += stored;
  }

  console.log(
    `[Checklist] Stored ${totalStored} checklist items for contract ${contractId}`,
  );
}

export interface AnalysisResult {
  name: string;
  category: string;
  found: boolean;
  found_text: string | null;
  status: "Matched" | "Variation" | "Not Matched";
  reasoning: string;
}

export async function detectMandatoryClauses(
  contractId: string,
  workspaceId: string,
  text: string,
): Promise<AnalysisResult[]> {
  console.log(
    `[RuleEngine] Running local detectMandatoryClauses for contract ${contractId}`,
  );

  // 1. Fetch Registry (Workspace Defaults + Library Clauses)
  const [workspaceData] = await db
    .select({
      mandatoryRegistry: workspaces.mandatoryRegistry,
      organizationId: workspaces.organizationId,
    })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!workspaceData) {
    console.error(`[RuleEngine] Workspace ${workspaceId} not found`);
    return [];
  }

  // 1b. Idempotency Check
  const existingEvents = await db
    .select({ id: analysisEvents.id })
    .from(analysisEvents)
    .where(
      and(
        eq(analysisEvents.contractId, contractId),
        eq(analysisEvents.eventType, "clause_detected"),
      ),
    );

  if (existingEvents.length > 0) {
    console.log(
      `[RuleEngine] Reuse: Found ${existingEvents.length} existing detection events for contract ${contractId}. Skipping neural scan.`,
    );
    return []; // We return empty as the data is already in DB events table
  }

  const orgId = workspaceData.organizationId || "";

  // 2. Segment document into provisions (paragraph split, then semantic chunks as fallback)
  let docSegments = text
    .split(/\n\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30);

  if (docSegments.length === 0) {
    docSegments = splitTextForSegmentation(text).filter(
      (s) => s.trim().length > 30,
    );
  }

  console.log(
    `[RuleEngine] Segmented doc into ${docSegments.length} segments for contract-centric matching.`,
  );

  // 3. Find matches for each segment in the library
  const BATCH_SIZE = 10;
  const results: any[] = [];

  for (let i = 0; i < docSegments.length; i += BATCH_SIZE) {
    const batch = docSegments.slice(i, i + BATCH_SIZE);

    // Update status incrementally
    const pct = Math.round((i / docSegments.length) * 100);
    await db
      .update(contracts)
      .set({
        analysis: sql`jsonb_set(
          COALESCE(${contracts.analysis}, '{}'::jsonb),
          '{status}',
          ${JSON.stringify(`[5/5] Neural scan analysis (${pct}%)...`)}::jsonb
        )`,
        updatedAt: new Date(),
      })
      .where(eq(contracts.id, contractId));

    const matchesBatch = await findClosestLibraryMatchesBatch(
      batch,
      orgId,
      workspaceId,
      1,
    );

    batch.forEach((chunkText, idx) => {
      const matches = matchesBatch[idx];
      const bestMatch = matches && matches.length > 0 ? matches[0] : null;

      const similarity = bestMatch ? bestMatch.similarity : 0;

      // Only process if it meets the minimum threshold
      if (similarity >= CHECKLIST_SEMANTIC_FLOOR && bestMatch) {
        const status = fastChecklistStatusForSimilarity(similarity);

        results.push({
          name: bestMatch.clauseName,
          category: bestMatch.category || "General",
          found: true,
          found_text: chunkText,
          status,
          reasoning:
            status === "Matched"
              ? `Library match at ${Math.round(similarity * 100)}% similarity.`
              : `Provision identified with ${Math.round(similarity * 100)}% similarity to library standard.`,
          confidence: similarity,
          libraryStandard:
            bestMatch.clauseText ||
            "No library standard found for this provision.",
          source: bestMatch.id || null,
        });
      }
    });
  }

  // Deduplicate: Keep only the BEST match for each unique library clause
  const uniqueResults = new Map<string, any>();
  for (const r of results) {
    if (!r.source) continue;
    const existing = uniqueResults.get(r.source);
    if (!existing || r.confidence > existing.confidence) {
      uniqueResults.set(r.source, r);
    }
  }

  const finalResults = Array.from(uniqueResults.values());

  // 4. Store Events in DB
  const eventValues = finalResults.map((r) => ({
    workspaceId,
    contractId,
    organizationId: orgId,
    eventType: "clause_detected",
    status: r.status,
    metadata: {
      clauseName: r.name,
      category: r.category,
      documentText: r.found_text || "",
      documentTextSnippet: (r.found_text || "").substring(0, 200),
      libraryStandard: r.libraryStandard,
      reasoning: r.reasoning,
      confidence: r.confidence,
      clauseCode: r.source,
      isGlobal: true,
    },
  }));

  try {
    // Clear old events - moved inside the try block and before insert
    await db
      .delete(analysisEvents)
      .where(
        and(
          eq(analysisEvents.contractId, contractId),
          eq(analysisEvents.eventType, "clause_detected"),
        ),
      );

    if (eventValues.length > 0) {
      await db.insert(analysisEvents).values(eventValues);
    }
  } catch (e) {
    console.error(`[RuleEngine] Failed to store analysis events:`, e);
  }

  // 5. Update Contract Summary Stats in analysis JSONB
  const redCount = finalResults.filter(
    (r) => r.status === "Not Matched",
  ).length;
  const amberCount = finalResults.filter(
    (r) => r.status === "Variation",
  ).length;
  const greenCount = finalResults.filter((r) => r.status === "Matched").length;

  await db
    .update(contracts)
    .set({
      analysis: sql`COALESCE(${contracts.analysis}, '{}'::jsonb) || ${JSON.stringify(
        {
          mandatory_registry_count: finalResults.length,
          checklistSummary: {
            matched: greenCount,
            variation: amberCount,
            missing: redCount,
            total: results.length,
          },
        },
      )}::jsonb`,
    })
    .where(eq(contracts.id, contractId));

  return results;
}

/**
 * Split contract text into chunks for segmentation.
 */
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

export async function findClosestLibraryMatches(
  clauseText: string,
  organizationId: string,
  workspaceId: string,
  limit = 3,
) {
  const normText = normalizeText(clauseText);

  const exactMatches = await db
    .select({
      id: clauses.id,
      clauseName: clauses.clauseName,
      clauseText: clauses.clauseText,
      library: clauses.library,
      code: clauses.code,
      status: clauses.status,
      similarity: sql<number>`1.0`,
      keywords: clauses.keywords,
    })
    .from(clauses)
    .leftJoin(workspaceClauses, eq(clauses.id, workspaceClauses.clauseId))
    .where(
      and(
        or(
          eq(clauses.isGlobal, true),
          and(
            eq(clauses.organizationId, organizationId),
            or(
              eq(clauses.workspaceId, workspaceId),
              eq(workspaceClauses.workspaceId, workspaceId),
              and(
                sql`${clauses.workspaceId} IS NULL`,
                sql`${workspaceClauses.workspaceId} IS NULL`,
              ),
            ),
          ),
        ),
        sql`trim(regexp_replace(regexp_replace(lower(${clauses.clauseText}), '[^a-z0-9\\s]', '', 'g'), '\\s+', ' ', 'g')) = ${normText}`,
      ),
    )
    .limit(limit);

  if (exactMatches.length > 0) {
    return exactMatches;
  }

  if (isAstraVectorEnabled()) {
    const hits = await searchAstraClauseChunks({
      queryText: prepareEmbeddingText(clauseText),
      organizationId,
      workspaceId,
      limit,
    });
    const clauseIds = [
      ...new Set(hits.map((h) => String(h.metadata.clauseId ?? h.id))),
    ];
    if (clauseIds.length === 0) return [];

    const hydrated = await db
      .select({
        id: clauses.id,
        clauseName: clauses.clauseName,
        clauseText: clauses.clauseText,
        library: clauses.library,
        code: clauses.code,
        status: clauses.status,
        keywords: clauses.keywords,
      })
      .from(clauses)
      .where(inArray(clauses.id, clauseIds));

    const simByClause = new Map(
      hits.map((h) => [String(h.metadata.clauseId ?? h.id), h.similarity]),
    );

    return hydrated
      .map((row) => ({
        ...row,
        similarity: simByClause.get(row.id) ?? 0,
      }))
      .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
      .slice(0, limit);
  }

  const [embedding] = await createEmbeddings([normText]);
  if (!embedding) return [];
  const vec = sql`${"[" + embedding.join(",") + "]"}::vector`;

  const matches = await db
    .select({
      id: clauses.id,
      clauseName: clauses.clauseName,
      clauseText: clauses.clauseText,
      library: clauses.library,
      code: clauses.code,
      status: clauses.status,
      similarity: sql<number>`1 - (${clauseChunks.embedding} <=> ${vec})`,
      keywords: clauses.keywords,
    })
    .from(clauseChunks)
    .innerJoin(clauses, eq(clauses.id, clauseChunks.clauseId))
    .leftJoin(workspaceClauses, eq(clauses.id, workspaceClauses.clauseId))
    .where(
      and(
        or(
          eq(clauses.isGlobal, true),
          and(
            eq(clauses.organizationId, organizationId),
            or(
              eq(clauses.workspaceId, workspaceId),
              eq(workspaceClauses.workspaceId, workspaceId),
              and(
                sql`${clauses.workspaceId} IS NULL`,
                sql`${workspaceClauses.workspaceId} IS NULL`,
              ),
            ),
          ),
        ),
        sql`${clauseChunks.embedding} <=> ${vec} < 0.6`,
      ),
    )
    .orderBy(sql`${clauseChunks.embedding} <=> ${vec}`)
    .limit(limit);

  return matches;
}

/** Max cosine distance for a vector hit (same as single-match path). */
const SEMANTIC_MATCH_MAX_DISTANCE = 0.6;

export async function findClosestLibraryMatchesBatch(
  clauseTexts: string[],
  organizationId: string,
  workspaceId: string,
  limit = 3,
  documentHeadings?: string[],
) {
  if (clauseTexts.length === 0) return [];

  const embeddingInputs = clauseTexts.map((t) => prepareEmbeddingText(t));
  const normalizedQueryTexts = clauseTexts.map((t) => normalizeText(t));
  const emptyRow = () => Array(clauseTexts.length).fill([]);

  if (isAstraVectorEnabled()) {
    const matchesBatch: Awaited<
      ReturnType<typeof findClosestLibraryMatches>
    >[] = [];

    for (let i = 0; i < clauseTexts.length; i++) {
      const normText = normalizedQueryTexts[i];
      const docHeading = documentHeadings?.[i] || "";

      if (!normText || normText.length < 8) {
        matchesBatch.push([]);
        continue;
      }

      try {
        const exactMatches = await db
          .select({
            id: clauses.id,
            clauseName: clauses.clauseName,
            clauseText: clauses.clauseText,
            library: clauses.library,
            code: clauses.code,
            status: clauses.status,
            category: clauses.category,
            similarity: sql<number>`1.0`,
            keywords: clauses.keywords,
          })
          .from(clauses)
          .leftJoin(workspaceClauses, eq(clauses.id, workspaceClauses.clauseId))
          .where(
            and(
              or(
                eq(clauses.isGlobal, true),
                and(
                  eq(clauses.organizationId, organizationId),
                  or(
                    eq(clauses.workspaceId, workspaceId),
                    eq(workspaceClauses.workspaceId, workspaceId),
                    and(
                      sql`${clauses.workspaceId} IS NULL`,
                      sql`${workspaceClauses.workspaceId} IS NULL`,
                    ),
                  ),
                ),
              ),
              sql`trim(regexp_replace(regexp_replace(lower(${clauses.clauseText}), '[^a-z0-9\\s]', '', 'g'), '\\s+', ' ', 'g')) = ${normText}`,
            ),
          )
          .limit(limit);

        if (exactMatches.length > 0) {
          matchesBatch.push(exactMatches);
          continue;
        }

        const hits = await searchAstraClauseChunks({
          queryText: embeddingInputs[i],
          organizationId,
          workspaceId,
          limit: Math.max(limit, 5),
        });

        const clauseIds = [
          ...new Set(hits.map((h) => String(h.metadata.clauseId ?? h.id))),
        ];
        if (clauseIds.length === 0) {
          matchesBatch.push([]);
          continue;
        }

        const hydrated = await db
          .select({
            id: clauses.id,
            clauseName: clauses.clauseName,
            clauseText: clauses.clauseText,
            library: clauses.library,
            code: clauses.code,
            status: clauses.status,
            category: clauses.category,
            keywords: clauses.keywords,
          })
          .from(clauses)
          .where(inArray(clauses.id, clauseIds));

        const simByClause = new Map(
          hits.map((h) => [String(h.metadata.clauseId ?? h.id), h.similarity]),
        );

        const merged = hydrated
          .map((row) => {
            const base = simByClause.get(row.id) ?? 0;
            const boost = headingMatchBoost(docHeading, row.clauseName);
            return {
              ...row,
              similarity: Math.min(1, base + boost),
            };
          })
          .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
          .slice(0, limit);

        matchesBatch.push(merged);
      } catch (err) {
        console.warn(`[Checklist] Astra match failed for index ${i}:`, err);
        matchesBatch.push([]);
      }
    }

    return matchesBatch;
  }

  let embeddings: number[][] = [];
  try {
    embeddings = await createEmbeddings(embeddingInputs);
  } catch (err) {
    console.error("[Checklist] Embedding batch failed:", err);
    return emptyRow();
  }

  if (!embeddings || embeddings.length === 0) return emptyRow();

  const scopeFilter = or(
    eq(clauses.isGlobal, true),
    and(
      eq(clauses.organizationId, organizationId),
      or(
        eq(clauses.workspaceId, workspaceId),
        eq(workspaceClauses.workspaceId, workspaceId),
        and(
          sql`${clauses.workspaceId} IS NULL`,
          sql`${workspaceClauses.workspaceId} IS NULL`,
        ),
      ),
    ),
  );

  const matchesBatch: Awaited<ReturnType<typeof findClosestLibraryMatches>>[] =
    [];

  for (let i = 0; i < clauseTexts.length; i++) {
    const normText = normalizedQueryTexts[i];
    const embedding = embeddings[i];

    if (!normText || normText.length < 8) {
      matchesBatch.push([]);
      continue;
    }

    try {
      const exactMatches = await db
        .select({
          id: clauses.id,
          clauseName: clauses.clauseName,
          clauseText: clauses.clauseText,
          library: clauses.library,
          code: clauses.code,
          status: clauses.status,
          similarity: sql<number>`1.0`,
          keywords: clauses.keywords,
        })
        .from(clauses)
        .leftJoin(workspaceClauses, eq(clauses.id, workspaceClauses.clauseId))
        .where(
          and(
            scopeFilter,
            sql`trim(regexp_replace(regexp_replace(lower(${clauses.clauseText}), '[^a-z0-9\\s]', '', 'g'), '\\s+', ' ', 'g')) = ${normText}`,
          ),
        )
        .limit(limit);

      if (exactMatches.length > 0) {
        matchesBatch.push(exactMatches);
        continue;
      }

      if (!embedding?.length) {
        matchesBatch.push([]);
        continue;
      }

      const vec = sql`${"[" + embedding.join(",") + "]"}::vector`;
      const rawMatches = await db
        .select({
          id: clauses.id,
          clauseName: clauses.clauseName,
          clauseText: clauses.clauseText,
          library: clauses.library,
          code: clauses.code,
          status: clauses.status,
          similarity: sql<number>`1 - (${clauseChunks.embedding} <=> ${vec})`,
          keywords: clauses.keywords,
        })
        .from(clauseChunks)
        .innerJoin(clauses, eq(clauses.id, clauseChunks.clauseId))
        .leftJoin(workspaceClauses, eq(clauses.id, workspaceClauses.clauseId))
        .where(
          and(
            scopeFilter,
            sql`${clauseChunks.embedding} <=> ${vec} < ${SEMANTIC_MATCH_MAX_DISTANCE}`,
          ),
        )
        .orderBy(sql`${clauseChunks.embedding} <=> ${vec}`)
        .limit(limit);

      const docHeading = documentHeadings?.[i] || "";
      const ranked = rawMatches
        .map((m) => {
          const base = Number(m.similarity) || 0;
          const boost = headingMatchBoost(docHeading, m.clauseName || "");
          return { ...m, similarity: Math.min(1, base + boost) };
        })
        .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));

      matchesBatch.push(ranked);
    } catch (err) {
      console.warn(
        `[Checklist] Semantic match failed for query index ${i}:`,
        err,
      );
      matchesBatch.push([]);
    }
  }

  return matchesBatch;
}

/**
 * Generates a basic StructuredContract from Document AI raw output.
 * Ensures the document viewer has content immediately after OCR.
 */
export function generateInitialStructure(docAI: any): StructuredContract {
  if (!docAI || !docAI.text) {
    return {
      title: "Document Content",
      sections: [
        {
          heading: "Main Text",
          number: null,
          subsections: [],
          paragraphs: ["No text extracted."],
        },
      ],
    };
  }

  const sections: any[] = [];

  // Strict noise filtering regexes for general OCR and MRC specific headers
  const NOISE_PATTERNS = [
    /^\s*page\s+\d+\s*$/i,
    /^\s*page\s+\d+\s*of(\s+\d+)?\s*$/i,
    /^\s*\d+\s+of\s+\d+\s*$/i,
    /^\s*wordings\s+ai\s+confidential\s*$/i,
    /^\s*\(c\)\s+\d{4}.*$/i,
    /^\s*ocr\s+error.*$/i,
    /^\s*\[ocr\s+error.*\]\s*$/i,
    /^\s*registration\s+no\.\s+[A-Z0-9]+\s*$/i,
    /^\s*\d+\s+[A-Z]{2,4}\s*$/i, // e.g. "775 BRE"
    /^\s*[\d\.\s\-]{1,10}$/, // Just numbers/dots/hyphens
    /^\s*[a-zA-Z]\s*$/, // Single character noise
    /^\s*market\s*reform\s*contract.*$/i,
    /^\s*risk\s*details\s*section.*$/i,
    /^\s*unique\s*market.*$/i,
    /^\s*taxes\s*payable.*$/i,
    /^\s*security\s*details.*$/i,
    /^\s*subscription\s*agreement.*$/i,
    /^\s*fiscal\s*and\s*regulatory.*$/i,
    /^\s*broker\s*remuneration.*$/i,
    /^\s*basis\s*of\s*(written|agreement).*$/i,
    /^\s*client\s*requirement.*$/i,
    /^\s*policy\s*number.*$/i,
    /^\s*expiring\s*policy.*$/i,
    /^\s*information\s*page\s*$/i,
    /^\s*claims\s*agreement.*$/i,
    /^[_\-\.]{5,}$/, // Horizontal lines or separators
    /^\s*[0-9A-Z]{2,}\s+[0-9A-Z]{2,}\s+[0-9A-Z]{2,}\s*$/i, // Suspiciously spaced caps
    /^\s*confidential\s*$/i,
    /Willis\s*Re\s*I{1,3}/i,
    /Willis\s*Limited/i,
    /Lloyd's\s*broker/i,
    /Registered\s*Office:/i,
    /Registered\s*Number/i,
    /Guy\s*Carpenter/i,
    /Aon\s*UK\s*Limited/i,
    /Paul\s*Smith\/LSR/i,
    /<<Authorised\s*Dt>>/i,
    /LR\/Date\s*created/i,
    /JLT\s*Page/i,
  ];

  function cleanText(text: string): string {
    if (!text) return "";
    let cleaned = text;

    // 1. Remove non-printable characters
    cleaned = cleaned.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");

    // 2. Remove common OCR artifacts (random single characters or symbols isolated by spaces)
    // e.g. "A article B" -> "article" (if A and B are noise)
    // But we must be careful with legitimate single-char words like "a" or "I"
    // More focus on symbols: ~ | _ \ / [ ] { }
    cleaned = cleaned.replace(/(^|\s)[~|\\\/_{}\[\]](\s|$)/g, " ");

    // 3. Remove duplicated dots/hyphens/underscores often found in OCR
    cleaned = cleaned.replace(/\.{2,}/g, ".");
    cleaned = cleaned.replace(/-{2,}/g, "-");
    cleaned = cleaned.replace(/_{2,}/g, "_");

    // 4. Clean up whitespace
    cleaned = cleaned.replace(/\s+/g, " ").trim();

    return cleaned;
  }

  function isNoise(text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed) return true;

    // If it's just a single character that isn't a digit or 'a'/'i', it's noise
    if (
      trimmed.length === 1 &&
      !/[0-9ai]/i.test(trimmed) &&
      !/^[A-Z]$/.test(trimmed)
    )
      return true;

    // Reject lines that are strictly page numbers or "Page X of Y"
    if (/^\d+$/.test(trimmed)) return true;
    if (/^page\s+\d+$/i.test(trimmed)) return true;
    if (/^page\s+\d+\s+of\s+\d+$/i.test(trimmed)) return true;

    // Filter out long strings of non-alphanumeric characters
    if (/^[^a-zA-Z0-9]{2,}$/.test(trimmed)) return true;

    // Reject short lines that are strictly page headers/footers (UMR, etc)
    if (trimmed.length < 50) {
      const lower = trimmed.toLowerCase();
      // Common MRC Header noise
      if (
        lower === "unique market reference" ||
        lower === "umr" ||
        lower === "type"
      )
        return true;
      if (lower.includes("page") && lower.includes("of")) return true;
      if (lower === "confidential") return true;
    }

    // Pattern-based noise
    return NOISE_PATTERNS.some((pattern) => pattern.test(trimmed));
  }

  // Use entities if available (Document AI specialized parsers)
  if (docAI.entities && docAI.entities.length > 0) {
    const sortedEntities = [...docAI.entities].sort((a, b) => {
      const aStart = a.textAnchor?.textSegments?.[0]?.startIndex || 0;
      const bStart = b.textAnchor?.textSegments?.[0]?.startIndex || 0;
      return aStart - bStart;
    });

    let currentSection: any = null;
    for (const entity of sortedEntities) {
      const type = entity.type?.toLowerCase() || "";
      const rawText = entity.mentionText || entity.text || "";
      if (!rawText || isNoise(rawText)) continue;

      const text = cleanText(rawText);
      if (!text) continue;

      const isHeadingType =
        type.includes("heading") ||
        type.includes("header") ||
        type.includes("title") ||
        type.includes("article_number") ||
        type.includes("section_number");

      if (isHeadingType) {
        currentSection = {
          heading: text,
          number: null,
          subsections: [],
          paragraphs: [],
        };
        sections.push(currentSection);
      } else if (currentSection) {
        currentSection.paragraphs.push(text);
      } else {
        currentSection = {
          heading: "Introduction",
          number: null,
          subsections: [],
          paragraphs: [text],
        };
        sections.push(currentSection);
      }
    }
  } else if (docAI.pages) {
    let currentSection: any = null;
    let pendingLabel: string | null = null;

    for (const page of docAI.pages) {
      if (page.paragraphs) {
        for (const para of page.paragraphs) {
          const start = Number(
            para.layout?.textAnchor?.textSegments?.[0]?.startIndex || 0,
          );
          const end = Number(
            para.layout?.textAnchor?.textSegments?.[0]?.endIndex || 0,
          );
          let rawParaText = docAI.text.substring(start, end);

          if (!rawParaText || isNoise(rawParaText)) continue;

          let paraText = cleanText(rawParaText);
          if (!paraText) continue;

          // Logic to join orphan labels like (a), (b), or "Section 1"
          const isOrphanLabel = /^\s*(\([a-z0-9]\)|[a-z0-9]\))\s*$/i.test(
            paraText,
          );
          if (isOrphanLabel) {
            pendingLabel = paraText;
            continue;
          }

          if (pendingLabel) {
            paraText = pendingLabel + " " + paraText;
            pendingLabel = null;
          }

          // Strict heading detection
          const wordCount = paraText.split(/\s+/).length;
          const isAlphaNumericCode = /^[A-Z0-9]{8,}$/.test(paraText);

          const isArticleStyle =
            /^(article|section|clause|provision|item|schedule|annex|appendix|risk\s+details|subscription\s+agreement|information\s+page|fiscal\s+and\s+regulatory|security\s+details|broker\s+remuneration|premium|conditions|period|class\s+of\s+business|limits|unique\s+market|reinsured|type)\s*([0-9a-z\.]+)?/i.test(
              paraText,
            );

          const isNumberedHeading = /^\d+(\.\d+)*[\.\s]+[A-Z]/.test(paraText);

          const isAllcapsHeading =
            /^[^a-z]{3,100}$/.test(paraText) &&
            /[A-Z]/.test(paraText) &&
            wordCount < 10;

          const isHeading =
            (isArticleStyle || isNumberedHeading || isAllcapsHeading) &&
            !isAlphaNumericCode &&
            paraText.length < 150 &&
            wordCount < 22 &&
            (!paraText.includes(":") ||
              paraText.split(":").shift()?.split(/\s+/).length! < 4) &&
            !/\b(agrees|shall|will|hereby|between|referred|witnesseth|if\s+applicable|with\s+the\s+terms)\b/i.test(
              paraText,
            );

          if (isHeading) {
            const numberMatch = paraText.match(/\d+(\.\d+)*/);
            currentSection = {
              heading: paraText,
              number: numberMatch ? numberMatch[0] : null,
              subsections: [],
              paragraphs: [],
            };
            sections.push(currentSection);
          } else {
            if (!currentSection) {
              currentSection = {
                heading: "General Provisions",
                number: null,
                subsections: [],
                paragraphs: [],
              };
              sections.push(currentSection);
            }
            currentSection.paragraphs.push(paraText);
          }
        }
      }
    }
  }

  // Final cleanup: remove empty sections or those that are just noise
  const filteredSections = sections.filter(
    (s) => s.paragraphs.length > 0 || (s.heading && !isNoise(s.heading)),
  );

  if (filteredSections.length === 0) {
    return {
      title: "Initial Extraction Map",
      sections: [
        {
          heading: "Extracted Text",
          number: null,
          subsections: [],
          paragraphs: [docAI.text.substring(0, 20000)],
        },
      ],
    };
  }

  return {
    title: "Document Map",
    sections: filteredSections,
  };
}

export function getAdvancedRuleSystemPrompt(
  ruleName: string,
  definition: RuleDefinition,
  warExclusionContext?: string,
) {
  const matrixStr = definition.matrixLogic
    ? `**MATRIX LOGIC PERSPECTIVES:**
${definition.matrixLogic.perspectives.map((p) => `- ${p.name}: ${p.description} (Recommendations: ${p.recommendations.join(", ")})`).join("\n")}
Overall Guidance: ${definition.matrixLogic.overallGuidance || "Standard aggregation"}`
    : "";

  return `You are an expert contract AI assistant.
Evaluate the provided Clause Text against the Rule: "${ruleName}".
${definition.purpose ? `Rule Purpose: ${definition.purpose}` : ""}

${warExclusionContext ? `**SPECIALIZED REFERENCE CONTEXT:**\n${warExclusionContext}` : ""}

**CRITERIA:**
Red: ${definition.redCriteria?.join(", ") || "N/A"}
Amber: ${definition.amberCriteria?.join(", ") || "N/A"}
Green: ${definition.greenCriteria?.join(", ") || "N/A"}

${matrixStr}

**EVIDENCE EXTRACTION (CRITICAL - STRICT GROUNDING):**
1. Extract ONLY verbatim snippets from the input text.
2. DO NOT paraphrase. DO NOT fix typos. DO NOT summarize.
3. EXTRACT COMPLETE SENTENCES AND PARAGRAPHS. Never truncate mid-sentence.
4. If a clause spans multiple lines, extract the entire relevant portion to provide full context.
5. If the relevant text is missing, return an empty evidence array.
6. You MUST provide the "heading" and the "verbatim_text" for each snippet.

Respond in JSON:
{
  "status": "Green" | "Amber" | "Red",
  "reasoning": "Markdown format reasoning",
  "detectedBias": "Balanced" | "Cedant" | "Reinsurer",
  "confidence": 0.0 to 1.0,
  "triggeredConditions": [],
  "keyTerms": [],
  "extractedEvidence": [
    {
      "heading": "Exact Article/Section Heading",
      "verbatim_text": "Full verbatim text of the clause"
    }
  ],
  "granularGuidance": {
    "matchedKeywords": [],
    "legalCommentary": "..."
  }
}`;
}

export function getRuleSystemPrompt(
  ruleName: string,
  definition: RuleDefinition,
) {
  return `You are an expert contract AI assistant deployed to evaluate business contracts. 
You will be provided with:
1. A Rule Name and its specific target criteria.
2. Sourced snippets from the contract.

Rule Name: "${ruleName}"
Red Criteria (Non-Compliant): ${definition.redCriteria?.join(", ") || "N/A"}
Amber Criteria (Risky): ${definition.amberCriteria?.join(", ") || definition.logic?.amber?.join(", ") || "N/A"}
Green Criteria (Compliant): ${definition.greenCriteria?.join(", ") || definition.logic?.green?.join(", ") || "N/A"}

${
  definition.keywordPacks && definition.keywordPacks.length > 0
    ? `**KEYWORD GUIDANCE & BIAS PACKS:**\nBelow are themes and keywords associated with specific clause biases (B=Balanced, C=Cedant, R=Reinsurer). Use these to classify the clause bias and provide tailored recommendations:\n\n${definition.keywordPacks.map((p) => `- Theme: ${p.theme} (Bias: ${p.bias})\n  Keywords: ${p.keywords.join(", ")}`).join("\n")}`
    : `**BIAS INFERENCE:**\nNo explicit keyword packs provided. Infer the clause bias (Balanced, Cedant, or Reinsurer) based on general contractual standards and the clause's effect on party obligations. Default to 'Balanced' if unclear.`
}

**EVIDENCE EXTRACTION (CRITICAL - STRICT GROUNDING):**
1. Extract ONLY verbatim snippets from the input text.
2. DO NOT paraphrase. DO NOT fix typos. DO NOT summarize.
3. EXTRACT COMPLETE SENTENCES AND PARAGRAPHS. Never truncate mid-sentence.
4. If a clause spans multiple lines, extract the entire relevant portion to provide full context.
5. If the relevant text is missing, return an empty evidence array.
6. You MUST provide the "heading" and the "verbatim_text" for each snippet.

Respond in JSON with an additional "detectedBias" field (one of: "Balanced", "Cedant", "Reinsurer"), an "extractedEvidence" array of {heading, verbatim_text} objects, and prioritize the "reasoning" to reflect why this bias was chosen.`;
}

export function prepareRuleEvaluationPayloads(
  ruleName: string,
  definition: RuleDefinition,
  chunks: any[],
) {
  const systemPrompt = getRuleSystemPrompt(ruleName, definition);
  const baseTokens = estimateTokens(systemPrompt);
  const maxTokensPerReq = 20000; // Safe ceiling for multi-provider compatibility

  const payloads: string[] = [];
  let currentGroup: any[] = [];
  let currentTokens = baseTokens;

  for (const chunk of chunks) {
    const snippet = `[Snippet]:\n${chunk.content}\n\n`;
    const snippetTokens = estimateTokens(snippet);

    if (
      currentTokens + snippetTokens > maxTokensPerReq &&
      currentGroup.length > 0
    ) {
      // Flush current group
      payloads.push(
        currentGroup
          .map((c, idx) => `[Snippet ${idx + 1}]:\n${c.content}`)
          .join("\n\n"),
      );
      currentGroup = [chunk];
      currentTokens = baseTokens + snippetTokens;
    } else {
      currentGroup.push(chunk);
      currentTokens += snippetTokens;
    }
  }

  if (currentGroup.length > 0) {
    payloads.push(
      currentGroup
        .map((c, idx) => `[Snippet ${idx + 1}]:\n${c.content}`)
        .join("\n\n"),
    );
  }

  return payloads.length === 0
    ? ["No relevant contract terms found."]
    : payloads;
}

export async function findWarExclusionMatches(
  clauseText: string,
  organizationId: string,
  limit = 2,
) {
  try {
    if (isAstraVectorEnabled()) {
      const hits = await searchAstraWarExclusions({
        queryText: clauseText,
        organizationId,
        limit: Math.max(limit, 5),
        minSimilarity: 0.4,
      });
      if (hits.length === 0) return [];

      const ids = hits.map((h) => h.id);
      const rows = await db
        .select({
          id: warExclusions.id,
          title: warExclusions.title,
          clauseText: warExclusions.clauseText,
          category: warExclusions.category,
          bias: warExclusions.bias,
          conditions: warExclusions.conditions,
          keywords: warExclusions.keywords,
        })
        .from(warExclusions)
        .where(inArray(warExclusions.id, ids));

      const simById = new Map(hits.map((h) => [h.id, h.similarity]));

      return rows
        .map((row) => ({
          ...row,
          similarity: simById.get(row.id) ?? 0,
        }))
        .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
        .slice(0, limit);
    }

    const [embedding] = await createEmbeddings([clauseText]);
    if (!embedding) return [];

    const similarityThreshold = 0.4;
    const matches = await db
      .select({
        id: warExclusions.id,
        title: warExclusions.title,
        clauseText: warExclusions.clauseText,
        category: warExclusions.category,
        bias: warExclusions.bias,
        conditions: warExclusions.conditions,
        keywords: warExclusions.keywords,
        similarity: sql<number>`1 - (${warExclusions.embedding} <=> ${JSON.stringify(embedding)}::vector)`,
      })
      .from(warExclusions)
      .where(
        and(
          or(
            eq(warExclusions.organizationId, organizationId),
            isNull(warExclusions.organizationId),
          ),
          sql`1 - (${warExclusions.embedding} <=> ${JSON.stringify(embedding)}::vector) > ${similarityThreshold}`,
        ),
      )
      .orderBy((t) => desc(t.similarity))
      .limit(limit);

    return matches;
  } catch (error) {
    console.error("[findWarExclusionMatches] Error:", error);
    return [];
  }
}

export async function evaluateRulePayloadWithOpenRouter(
  ruleName: string,
  systemPrompt: string,
  payload: string,
  useLimiter = true,
  plan: OrganizationPlan = "basic",
) {
  const userPrompt = `Contract Snippets:\n${payload}`;
  const estimatedTokens = estimateTokens(systemPrompt + userPrompt);

  // Centralized rate limiting is now handled in the ai-router.ts
  const done = () => {};

  try {
    const schema = z.object({
      status: z.enum(["Green", "Amber", "Red"]),
      reasoning: z.string(),
      detectedBias: z.enum(["Balanced", "Cedant", "Reinsurer"]),
      confidence: z.number().min(0).max(1),
      triggeredConditions: z.array(z.string()),
      keyTerms: z.array(z.string()),
      extractedEvidence: z.array(
        z.object({
          heading: z.string(),
          verbatim_text: z
            .string()
            .describe(
              "Exact verbatim snippet from the document that justifies the decision. NEVER summarize or paraphrase. Must be the exact text.",
            ),
        }),
      ),
      granularGuidance: z
        .object({
          matchedKeywords: z.array(z.string()).optional(),
          conditionMatrix: z.record(z.string(), z.string()).optional(),
          legalCommentary: z.string().optional(),
          standardWordingMatch: z.string().optional(),
        })
        .optional(),
    });

    const result = await generateJSONTierAware({
      schema,
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
      plan,
      parallelModelConcurrency: plan === "plus" ? 2 : 1,
      merge: (values) => {
        const severity = (s: string) =>
          s === "Red" ? 3 : s === "Amber" ? 2 : 1;

        const byConfidence = [...values].sort(
          (a, b) => (b.confidence ?? 0) - (a.confidence ?? 0),
        );
        const best = byConfidence[0];

        const statuses = values.map((v) => v.status);
        const statusCounts = statuses.reduce<Record<string, number>>(
          (acc, s) => ((acc[s] = (acc[s] ?? 0) + 1), acc),
          {},
        );
        const mergedStatus =
          Object.entries(statusCounts || {}).sort(
            (a, b) => b[1] - a[1] || severity(b[0]) - severity(a[0]),
          )[0]?.[0] ?? best.status;

        const evidenceSet = new Set<string>();
        const NOISE_FILTER =
          /^\s*(page\s+\d+|wordings\s+ai|\[ocr|error|\d+\s+of\s+\d+)/i;

        for (const v of values) {
          for (const item of v.extractedEvidence ?? []) {
            if (!item || !item.verbatim_text) continue;

            let verbatim = item.verbatim_text;
            let heading = item.heading || "Extracted Clause";

            if (
              !verbatim ||
              verbatim.length < 10 ||
              NOISE_FILTER.test(verbatim)
            )
              continue;

            evidenceSet.add(`**${heading}**\n\n${verbatim}`);
          }
        }

        const mergedTriggered = Array.from(
          new Set(values.flatMap((v) => v.triggeredConditions ?? [])),
        );
        const mergedTerms = Array.from(
          new Set(values.flatMap((v) => v.keyTerms ?? [])),
        );

        return {
          ...best,
          status: mergedStatus,
          extractedEvidence: Array.from(evidenceSet).slice(0, 30),
          rawEvidence: values
            .flatMap((v) => {
              if (!Array.isArray(v.extractedEvidence)) return [];
              return v.extractedEvidence
                .map((item) => {
                  if (item && item.verbatim_text) {
                    const verbatim = item.verbatim_text;
                    const NOISE_FILTER =
                      /^\s*(page\s+\d+|wordings\s+ai|\[ocr|error|\d+\s+of\s+\d+)/i;
                    if (
                      !verbatim ||
                      verbatim.length < 10 ||
                      NOISE_FILTER.test(verbatim)
                    )
                      return null;
                    return {
                      heading: item.heading || "Extracted Clause",
                      verbatim_text: verbatim,
                    };
                  }
                  return null;
                })
                .filter(
                  (i): i is { heading: string; verbatim_text: string } =>
                    i !== null,
                );
            })
            .slice(0, 30),
          triggeredConditions: mergedTriggered.slice(0, 30),
          keyTerms: mergedTerms.slice(0, 30),
          reasoning:
            best.reasoning ?? "Could not conclusively determine compliance.",
        };
      },
    });

    const validStatuses = ["Green", "Amber", "Red"];
    const status = validStatuses.includes(result.status)
      ? result.status
      : "Red";
    const reasoning =
      result.reasoning || "Could not conclusively determine compliance.";
    const detectedBias = result.detectedBias || "Balanced";

    const extractedEvidence: string[] = [];
    const rawEvidence: Array<{ heading: string; verbatim_text: string }> = [];

    if (Array.isArray(result.extractedEvidence)) {
      for (const item of result.extractedEvidence) {
        if (item && item.verbatim_text) {
          const heading = item.heading || "Extracted Clause";
          const verbatim = item.verbatim_text;
          extractedEvidence.push(`**${heading}**\n\n${verbatim}`);
          rawEvidence.push({ heading, verbatim_text: verbatim });
        }
      }
    }

    const confidence =
      typeof result.confidence === "number" ? result.confidence : 0.7;
    const triggeredConditions = Array.isArray(result.triggeredConditions)
      ? result.triggeredConditions
      : [];
    const keyTerms = Array.isArray(result.keyTerms) ? result.keyTerms : [];
    const granularGuidance = result.granularGuidance || null;

    return {
      status: status as "Green" | "Amber" | "Red",
      reasoning,
      detectedBias,
      extractedEvidence,
      rawEvidence,
      confidence,
      triggeredConditions,
      keyTerms,
      granularGuidance,
    };
  } finally {
    done();
  }
}

export async function evaluateRuleWithOpenRouter(
  contractId: string,
  ruleName: string,
  definition: RuleDefinition,
  evidence: any[], // Chunks or AnalyzedClauses
  plan: OrganizationPlan = "basic",
): Promise<RuleEvaluationResult> {
  const payload = evidence
    .map((e, idx) => `[Segment ${idx + 1}]:\n${e.content || e.clauseText}`)
    .join("\n\n");

  // Specialized War Exclusion Logic
  let warExclusionContext = "";
  let standardMatch: any = null;
  const isWarRelated =
    definition.warExclusionLogic ||
    ruleName.toLowerCase().includes("war") ||
    ruleName.toLowerCase().includes("terrorism") ||
    ruleName.toLowerCase().includes("exclusion");

  if (isWarRelated) {
    const [contractRecord] = await db
      .select({ organizationId: contracts.organizationId })
      .from(contracts)
      .where(eq(contracts.id, contractId))
      .limit(1);
    if (contractRecord?.organizationId) {
      const matches = await findWarExclusionMatches(
        payload.substring(0, 2000),
        contractRecord.organizationId,
        2,
      );
      if (matches.length > 0) {
        standardMatch = matches[0];
        warExclusionContext = `
Title: ${standardMatch.title}
Bias: ${standardMatch.bias}
Standard Clause: ${standardMatch.clauseText}
Reference Conditions (Condition Matrix): ${JSON.stringify(standardMatch.conditions)}
Recommended Keywords: ${standardMatch.keywords?.join(", ")}
`;
      }
    }
  }

  // Inject general library semantic keywords if present
  const keywordsSet = new Set<string>();
  evidence.forEach((e: any) => {
    if (e.metadata?.libraryMatch?.keywords) {
      e.metadata.libraryMatch.keywords.forEach((kw: string) =>
        keywordsSet.add(kw),
      );
    }
  });

  const allKeywords = Array.from(keywordsSet);
  if (allKeywords.length > 0 && !isWarRelated) {
    warExclusionContext += `\n**LIBRARY MATCH CONTEXT:**
Based on semantic library matches, consider these associated keywords: ${allKeywords.join(", ")}
`;
  }

  const systemPrompt = getAdvancedRuleSystemPrompt(
    ruleName,
    definition,
    warExclusionContext,
  );

  try {
    const evaluation = await evaluateRulePayloadWithOpenRouter(
      ruleName,
      systemPrompt,
      payload,
      true, // always enforce limiter to protect against provider limits
      plan,
    );

    return {
      ...evaluation,
      granularGuidance: {
        matchedKeywords: evaluation.granularGuidance?.matchedKeywords || [],
        ...evaluation.granularGuidance,
        standardWordingMatch:
          standardMatch?.title ||
          evaluation.granularGuidance?.standardWordingMatch,
        standardWordingText: standardMatch?.clauseText || null,
      },
    };
  } catch (error) {
    console.error("[Evaluation] Failed:", error);
    return {
      status: "Red",
      reasoning: "Evaluation error",
      extractedEvidence: [],
    };
  }
}

/**
 * Finds the coordinates of a verbatim substring within the Document AI structured JSON.
 */
export function findCoordinatesForSubstring(
  structuredJSON: any,
  substring: string,
) {
  if (!structuredJSON || !structuredJSON.text || !substring) return null;

  const docText = structuredJSON.text;
  const startIndex = docText.indexOf(substring);
  if (startIndex === -1) return null;
  const endIndex = startIndex + substring.length;

  const results: any[] = [];

  // Iterate through pages to find bounding boxes that overlap with the substring range
  if (structuredJSON.pages) {
    for (const page of structuredJSON.pages) {
      const pageNum = page.pageNumber;

      // Look into tokens/lines/paragraphs/blocks. Lines are usually a good balance of detail.
      if (page.lines) {
        for (const line of page.lines) {
          const segments = line.layout?.textAnchor?.textSegments || [];
          for (const seg of segments) {
            const segStart = Number(seg.startIndex || 0);
            const segEnd = Number(seg.endIndex || 0);

            // Check for overlap
            if (
              (segStart >= startIndex && segStart < endIndex) ||
              (segEnd > startIndex && segEnd <= endIndex) ||
              (segStart <= startIndex && segEnd >= endIndex)
            ) {
              results.push({
                page: pageNum,
                boundingPoly: line.layout.boundingPoly,
                confidence: line.layout.confidence,
              });
            }
          }
        }
      }
    }
  }

  // Aggregate results by page
  const pageMap = new Map<number, any[]>();
  for (const res of results) {
    if (!pageMap.has(res.page)) pageMap.set(res.page, []);
    pageMap.get(res.page)!.push(res.boundingPoly);
  }

  return Array.from(pageMap.entries()).map(([page, polys]) => ({
    page,
    polygons: polys,
  }));
}

export async function storeRuleResultWithMatches({
  contractId,
  ruleId,
  ruleVersionId,
  status,
  reasoning,
  bias,
  matchedContractChunks,
  confidence,
  triggeredConditions,
  keyTerms,
  granularGuidance,
  coordinates,
}: {
  contractId: string;
  ruleId: string;
  ruleVersionId: string;
  status: "Green" | "Amber" | "Red";
  reasoning: string;
  bias?: string;
  matchedContractChunks: RuleEvidenceItem[];
  confidence?: number;
  triggeredConditions?: string[];
  keyTerms?: string[];
  granularGuidance?: RuleEvaluationResult["granularGuidance"];
  coordinates?: any;
}) {
  console.log(`[RuleEngine] storeRuleResultWithMatches START for ${ruleId}`);
  try {
    console.log("[Test Debug] Inside storeRuleResultWithMatches try block");
    const safeEvidence = sanitizeEvidenceItems(matchedContractChunks);
    console.log(`[RuleEngine] Safe evidence count: ${safeEvidence.length}`);

    // Call findCoordinatesForSubstring for evidence items if not provided
    if (safeEvidence.length > 0 && !coordinates) {
      const docAI = await db
        .select({ structuredContent: contracts.structuredContent })
        .from(contracts)
        .where(eq(contracts.id, contractId))
        .limit(1);
      if (docAI[0]?.structuredContent) {
        coordinates = {};
        for (const item of safeEvidence) {
          coordinates[item.content] = findCoordinatesForSubstring(
            docAI[0].structuredContent,
            item.content,
          );
        }
      }
    }

    // Safety check with retry for contract existence (handles potential Neon pooler lag)
    let exists = false;
    for (let i = 0; i < 3; i++) {
      const [res] = await db
        .select({ id: contracts.id })
        .from(contracts)
        .where(eq(contracts.id, contractId))
        .limit(1);
      if (res) {
        exists = true;
        break;
      }
      if (i < 2) await new Promise((r) => setTimeout(r, 500));
    }

    if (!exists) {
      console.error(
        `[RuleEngine] FK Safety Failure: Contract ${contractId} NOT FOUND after 3 retries! Continuing anyway.`,
      );
    }

    const [inserted] = await db
      .insert(ruleResults)
      .values({
        contractId,
        ruleId,
        ruleVersionId,
        status,
        reasoning,
        bias,
        confidence,
        triggeredConditions,
        keyTerms,
        granularGuidance,
        evidence: safeEvidence.map((c) => ({
          content: c.content,
          id: c.id,
          similarity: c.similarity,
          sourceFileName: c.sourceFileName,
          headingLine: c.headingLine ?? null,
          clauseBody: c.clauseBody ?? c.content ?? null,
          sourceType: c.sourceType ?? "unknown",
          sourceId: c.sourceId ?? c.id ?? null,
          // Store mapping coordinates alongside each evidence item if available
          coordinates: coordinates?.[c.content] || null,
        })),
      })
      .onConflictDoUpdate({
        target: [ruleResults.contractId, ruleResults.ruleVersionId],
        set: {
          status,
          reasoning,
          confidence,
          triggeredConditions,
          keyTerms,
          granularGuidance,
          evidence: safeEvidence.map((c) => ({
            content: c.content,
            id: c.id,
            similarity: c.similarity,
            sourceFileName: c.sourceFileName,
            headingLine: c.headingLine ?? null,
            clauseBody: c.clauseBody ?? c.content ?? null,
            sourceType: c.sourceType ?? "unknown",
            sourceId: c.sourceId ?? c.id ?? null,
            coordinates: coordinates?.[c.content] || null,
          })),
          evaluatedAt: new Date(),
        },
      })
      .returning({ id: ruleResults.id });

    console.log(
      `[RuleEngine] Stored result for rule ${ruleId} -> ${inserted.id}`,
    );

    // --- NEW: Populate structured evidenceItems table ---
    if (inserted.id && safeEvidence.length > 0) {
      console.log(
        `[RuleEngine] Inserting ${safeEvidence.length} evidence items for ${inserted.id}`,
      );
      // Clear existing evidence items for this result to ensure clean update
      await db
        .delete(evidenceItems)
        .where(eq(evidenceItems.ruleResultId, inserted.id));

      const [contract] = await db
        .select({ organizationId: contracts.organizationId })
        .from(contracts)
        .where(eq(contracts.id, contractId))
        .limit(1);

      const evidenceValues = safeEvidence.map((c) => {
        // Try to extract heading from formatted content (**Heading**\n\nVerbatim)
        const headingMatch = c.content.match(/^\*\*([^*]+)\*\*/);
        const section = headingMatch
          ? headingMatch[1]
          : c.headingLine || "Extracted Clause";

        return {
          ruleResultId: inserted.id,
          contractId,
          organizationId: contract?.organizationId || "",
          section: section.substring(0, 255), // DB safety
          clauseType: section.substring(0, 100),
          text: c.clauseBody || c.content,
          libraryClauseId:
            c.id && c.id.length === 36 && !c.id.startsWith("detected-")
              ? c.id
              : null,
          matchConfidence: c.similarity ?? 0,
          sourceChunk: c.content,
          sourceFileName: c.sourceFileName,
          similarity: c.similarity,
        };
      });

      if (evidenceValues.length > 0) {
        await db.insert(evidenceItems).values(evidenceValues);
      }
    }
  } catch (err: any) {
    const dbUrl = process.env.DATABASE_URL || "NOT_SET";
    const maskedUrl = dbUrl.replace(/:[^:@]+@/, ":****@");

    if (err?.code === "23503") {
      console.error(
        `[RuleEngine] FK ERROR 23503: Parent Contract ${contractId} not found in ${maskedUrl}. Detail: ${err.detail}`,
      );
    } else {
      console.error(
        `[RuleEngine] storeRuleResultWithMatches FAILED for contract ${contractId}:`,
        {
          error: err?.message,
          code: err?.code,
          dbHost: maskedUrl,
        },
      );
    }
    throw err;
  }
}

export async function waitForChunks(
  versionId: string,
  maxAttempts = 20,
): Promise<boolean> {
  console.log(`[RuleEngine] Waiting for chunks for version: ${versionId}...`);
  for (let i = 0; i < maxAttempts; i++) {
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(contractChunks)
      .where(eq(contractChunks.contractVersionId, versionId));

    const count = Number(countResult?.count || 0);
    if (count > 0) {
      console.log(`[RuleEngine] Chunks found for version: ${versionId}`);
      return true;
    }

    if (i % 5 === 0 && i > 0) {
      console.log(
        `[RuleEngine] Still waiting for chunks (${i * 3}s elapsed)...`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  throw new Error(
    `Timeout waiting for contract chunks for version ${versionId}. Ensure text extraction completed successfully.`,
  );
}

/**
 * Converts a RuleEvaluationResult to structured evidence format
 * with clause matching and hierarchical grouping
 */
export async function buildStructuredEvidence(
  ruleEvalResult: RuleEvaluationResult,
  ruleId: string,
  contractId: string,
  organizationId: string,
  workspaceId?: string,
): Promise<StructuredEvidenceResult> {
  const now = new Date().toISOString();

  // Convert flat evidence to structured format with matching
  const structuredItems: StructuredEvidenceItem[] = [];
  let matchedCount = 0;

  if (
    ruleEvalResult.extractedEvidence &&
    ruleEvalResult.extractedEvidence.length > 0
  ) {
    for (let i = 0; i < ruleEvalResult.extractedEvidence.length; i++) {
      const evidence = ruleEvalResult.extractedEvidence[i];
      const rawEv = ruleEvalResult.rawEvidence?.[i];

      // Clean the evidence text
      const cleanText = normalizeText(evidence || "");
      if (!cleanText) continue;

      try {
        // Attempt clause matching
        const matchingResult = await matchClauseToLibrary(
          {
            documentClauseText: cleanText,
            section: rawEv?.heading,
            topN: 3,
            minConfidence: 0.5,
          },
          organizationId,
          workspaceId,
        );

        const recommendedMatch = matchingResult.recommendedMatch;

        const item: StructuredEvidenceItem = {
          id: `ev-${ruleId}-${i}`,
          section: rawEv?.heading || "Uncategorized",
          clauseType: recommendedMatch?.name || "Unknown",
          text: cleanText,
          libraryClauseId: recommendedMatch?.id || null,
          libraryClauseName: recommendedMatch?.name || null,
          matchConfidence:
            recommendedMatch?.confidence ??
            matchingResult.matches[0]?.confidence ??
            0,
          isManuallyMatched: false,
          source: {
            chunk: (rawEv?.verbatim_text || evidence).substring(0, 500),
            position: i,
            fileName: null,
          },
          similarity:
            ruleEvalResult.extractedEvidence[i] &&
            typeof ruleEvalResult.extractedEvidence[i] === "number"
              ? (ruleEvalResult.extractedEvidence[i] as any)
              : undefined,
          metadata: {
            extractedAt: now,
            matchedAt: recommendedMatch ? now : undefined,
          },
        };

        structuredItems.push(item);
        if (recommendedMatch) {
          matchedCount++;
        }
      } catch (error) {
        console.error(
          `[StructuredEvidence] Error matching evidence item ${i}:`,
          error,
        );

        // Still add item even if matching failed
        const item: StructuredEvidenceItem = {
          id: `ev-${ruleId}-${i}`,
          section: rawEv?.heading || "Uncategorized",
          clauseType: "Unknown",
          text: cleanText,
          libraryClauseId: null,
          matchConfidence: 0,
          isManuallyMatched: false,
          source: {
            chunk: (rawEv?.verbatim_text || evidence).substring(0, 500),
            position: i,
            fileName: null,
          },
          metadata: {
            extractedAt: now,
          },
        };

        structuredItems.push(item);
      }
    }
  }

  // Group evidence by section
  const groupMap = new Map<string, StructuredEvidenceItem[]>();
  for (const item of structuredItems) {
    if (!groupMap.has(item.section)) {
      groupMap.set(item.section, []);
    }
    groupMap.get(item.section)!.push(item);
  }

  const groupedEvidence: StructuredEvidenceGroup[] = Array.from(
    groupMap.entries(),
  ).map(([section, items]) => ({
    section,
    items,
    count: items.length,
  }));

  // Calculate statistics
  const totalEvidence = structuredItems.length;
  const averageConfidence =
    totalEvidence > 0
      ? structuredItems.reduce((sum, item) => sum + item.matchConfidence, 0) /
        totalEvidence
      : 0;

  return {
    ruleId,
    contractId,
    status: ruleEvalResult.status,
    reasoning: ruleEvalResult.reasoning,
    confidence: ruleEvalResult.confidence,
    detectedBias: ruleEvalResult.detectedBias,
    allEvidence: structuredItems,
    groupedEvidence,
    statistics: {
      totalEvidence,
      totalSections: groupMap.size,
      matchedToLibrary: matchedCount,
      manuallyMatched: 0,
      averageConfidence,
    },
    evaluatedAt: now,
  };
}

/**
 * Convert existing RuleEvaluationResult to structured format
 * This is a wrapper to integrate with existing evaluateRuleWithOpenRouter
 */
export async function evaluateRuleAndStructureEvidence(
  contractId: string,
  ruleName: string,
  ruleId: string,
  definition: RuleDefinition,
  evidence: any[],
  organizationId: string,
  workspaceId?: string,
  plan: OrganizationPlan = "basic",
): Promise<StructuredEvidenceResult> {
  // Get the unstructured evaluation result
  const evaluationResult = await evaluateRuleWithOpenRouter(
    contractId,
    ruleName,
    definition,
    evidence,
    plan,
  );

  // Convert to structured format with matching
  return buildStructuredEvidence(
    evaluationResult,
    ruleId,
    contractId,
    organizationId,
    workspaceId,
  );
}
