/**
 * Contract-level synthesis: finalize analysis (risk score + executive brief +
 * Plus insights) and the lightweight fast summary. Extracted verbatim from the
 * original src/services/rule-engine.ts during modularization (no logic changes).
 */
import { db } from "@/db/drizzle";
import { eq, and, sql, inArray } from "drizzle-orm";
import {
  contracts,
  ruleResults,
  organization,
  workspaces,
} from "@/db/schema";
import {
  generateJSONTierAware,
  type OrganizationPlan,
  MODEL_GEMMA_4_31B,
  MODEL_FLASH,
} from "@/lib/ai-router";
import { z } from "zod";
import type { ContractAnalysis } from "@/types/contracts";
import { isAstraVectorEnabled } from "@/lib/astra/config";
import { upsertAstraAiGeneration } from "@/lib/astra/vector-store";

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
