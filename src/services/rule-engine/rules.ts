/**
 * Rule selection and deep (RAG) rule evaluation: applicable-rule resolution,
 * the OpenRouter evaluation prompts and calls, result persistence, and the
 * structured-evidence builder. Extracted verbatim from the original
 * src/services/rule-engine.ts during modularization (only the moved type and
 * cross-module imports differ; logic is unchanged).
 */
import { db } from "@/db/drizzle";
import { eq, and, or, sql, inArray } from "drizzle-orm";
import {
  rules,
  ruleResults,
  contracts,
  organizationRuleSettings,
  analysisEvents,
  workspaces,
  workspaceRules,
  ruleVersions,
  evidenceItems,
} from "@/db/schema";
import {
  generateJSONTierAware,
  type OrganizationPlan,
  estimateTokens,
} from "@/lib/ai-router";
import { z } from "zod";
import {
  getAutoSelectedBrainModules,
  inferRuleModuleKey,
} from "@/lib/brain-modules";
import type {
  StructuredEvidenceItem,
  StructuredEvidenceGroup,
  StructuredEvidenceResult,
} from "@/types/evidence";
import { matchClauseToLibrary } from "../clause-matching";
import {
  type RuleDefinition,
  type RuleEvaluationResult,
  type RuleEvidenceItem,
  type KnownContractType,
  type GetApplicableRulesOptions,
  sanitizeEvidenceItems,
} from "./types";
import { normalizeContractType, normalizeText } from "./text-utils";
import {
  getCachedEmbeddings,
  retrieveRelevantContractChunks,
} from "./embeddings";
import { findWarExclusionMatches } from "./library-matching";
import { findCoordinatesForSubstring } from "./document-map";
import { finalizeContractAnalysis } from "./summary";

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
