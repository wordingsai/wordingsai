import { inngest } from "./client";
import {
  prepareContractForAnalysis,
  finalizeContractAnalysis,
  detectMandatoryClauses,
  segmentContractIntoClauses,
  getCachedEmbeddings,
  retrieveRelevantContractChunks,
  evaluateRuleWithOpenRouter,
  storeRuleResultWithMatches,
  findCoordinatesForSubstring,
  generateInitialStructure,
  generateFastSummary,
} from "@/services/rule-engine";
import {
  downloadFromSupabase,
  extractPathFromSupabaseUrl,
  deleteFromSupabase,
} from "@/lib/supabase/storage";
import { db } from "@/db/drizzle";
import { eq, sql, and, inArray, lt, isNotNull } from "drizzle-orm";
import { subDays } from "date-fns";
import { supabaseServer } from "@/lib/supabase-server";
import {
  contracts,
  contractVersions,
  analysisEvents,
  analyzedClauses,
  ruleResults,
  rules,
  ruleVersions,
} from "@/db/schema";
import { extractDocumentGCP } from "@/server/extract-gcp";
import type { OrganizationPlan } from "@/lib/ai-router";
import {
  isQualityStructuredMap,
  mergeStructuredWindows,
  sanitizeStructuredMap,
  splitIntoWindows,
  structureSingleWindow,
  structureTextHeuristically,
  MAX_AI_MAP_WINDOWS,
  type StructuredContract,
} from "@/lib/contract-structuring";
import { isAstraVectorEnabled } from "@/lib/astra/config";
import { upsertAstraAiGeneration } from "@/lib/astra/vector-store";

/**
 * 1. evaluateRuleJob (Worker)
 * Trigger: contract/rule.evaluate
 * Handles deep analysis of a single rule in isolation.
 */
export const evaluateRuleJob = inngest.createFunction(
  {
    id: "evaluate-rule-worker",
    triggers: [{ event: "contract/rule.evaluate" }],
    concurrency: {
      limit: 5,
      key: "event.data.organizationId",
    },
    retries: 2,
    onFailure: async ({ error, event }) => {
      const originalData = event.data.event.data;
      const { contractId, ruleId } = originalData;

      console.error(
        `[RuleWorker] Permanent failure for rule ${ruleId} in contract ${contractId}:`,
        error.message,
      );

      // Fetch version ID to store a placeholder result
      const [rule] = await db
        .select({ currentVersionId: rules.currentVersionId })
        .from(rules)
        .where(eq(rules.id, ruleId))
        .limit(1);

      if (rule?.currentVersionId) {
        try {
          await db
            .insert(ruleResults)
            .values({
              contractId,
              ruleId,
              ruleVersionId: rule.currentVersionId,
              status: "Amber",
              reasoning: `Technical Error: Neural analysis for this specific rule failed after multiple attempts. Manual review recommended. Error: ${error.message || "Unknown"}`,
              evidence: [],
            })
            .onConflictDoNothing();
        } catch (dbErr) {
          console.error(
            "[RuleWorker] Failed to store failure placeholder:",
            dbErr,
          );
        }
      }

      // Trigger completion check so the contract can still reach 'completed' status
      await inngest.send({
        name: "contract/analysis.check",
        data: { contractId },
      });
    },
  },
  async ({ event, step }) => {
    const { contractId, ruleId, plan, totalRules } = event.data;

    await step.run("process-rule", async () => {
      // Process rule locally using rule-engine service
      const { processSingleRule } = await import("@/services/rule-engine");

      // Fetch the full rule record
      const [rule] = await db
        .select({
          id: rules.id,
          name: rules.name,
          category: rules.category,
          status: rules.status,
          currentVersion: ruleVersions,
        })
        .from(rules)
        .leftJoin(ruleVersions, eq(rules.currentVersionId, ruleVersions.id))
        .where(eq(rules.id, ruleId))
        .limit(1);

      if (!rule) {
        throw new Error(`Rule ${ruleId} not found`);
      }

      await processSingleRule(rule, contractId, plan);
    });

    await step.run("update-progress-and-check", async () => {
      const [res] = await db
        .select({ val: sql<number>`count(*)` })
        .from(ruleResults)
        .where(eq(ruleResults.contractId, contractId));
      const [contract] = await db
        .select({ totalRules: contracts.totalRules })
        .from(contracts)
        .where(eq(contracts.id, contractId));

      const completedCount = Number(res?.val || 0);
      const total = Number(contract?.totalRules || event.data.totalRules || 1);

      const progressBase = event.data.progressBase ?? 90;
      const progressInc = 9 / Math.max(total, 1);
      const currentProgress = Math.min(
        99,
        Math.floor(progressBase + completedCount * progressInc),
      );

      await db
        .update(contracts)
        .set({
          analysisProgress: sql`GREATEST(COALESCE(${contracts.analysisProgress}, 0), ${currentProgress})`,
          analysisStage: "deep",
          analysisStatus: `[Rules] Evaluating rule ${completedCount} of ${total}...`,
        })
        .where(eq(contracts.id, contractId));
    });

    await step.run("trigger-completion-check", async () => {
      await inngest.send({
        name: "contract/analysis.check",
        data: { contractId },
      });
    });
  },
);

/**
 * 2. finalizeAnalysisJob (Collector)
 */
export const finalizeAnalysisJob = inngest.createFunction(
  {
    id: "finalize-analysis-collector",
    triggers: [{ event: "contract/analysis.check" }],
    cancelOn: [{ event: "contract/analysis.check", match: "data.contractId" }],
    debounce: { period: "15s", key: "event.data.contractId" },
  },
  async ({ event, step }) => {
    const { contractId } = event.data;

    await step.run("finalize", async () => {
      const [contract] = await db
        .select({ totalRules: contracts.totalRules })
        .from(contracts)
        .where(eq(contracts.id, contractId));
      const [res] = await db
        .select({ val: sql<number>`count(*)` })
        .from(ruleResults)
        .where(eq(ruleResults.contractId, contractId));

      const totalRules = contract?.totalRules || 0;
      const completedCount = Number(res?.val || 0);

      console.log(
        `[Finalizer] ${contractId}: ${completedCount}/${totalRules} rules completed.`,
      );

      if (totalRules > 0 && completedCount < totalRules) {
        console.log(
          `[Finalizer] Skipping synthesis and completion until all rule rows exist (${completedCount}/${totalRules}).`,
        );
        return;
      }

      await finalizeContractAnalysis(contractId);

      await db
        .update(contracts)
        .set({
          analysisStatus: "Analysis Complete",
          analysisProgress: 100,
          contractStatus: "completed",
          updatedAt: new Date(),
        })
        .where(eq(contracts.id, contractId));
    });
  },
);

/**
 * 3. evaluateContractRulesJob (Coordinator)
 * Consolidates Fast and Deep analysis into a single workflow for stability.
 */
export const evaluateContractRulesJob = inngest.createFunction(
  {
    id: "evaluate-contract-rules",
    triggers: [{ event: "contract/evaluate" }],
    concurrency: { limit: 5 },
    retries: 1,
    onFailure: async ({ error, event }) => {
      const failedPayload = event.data.event?.data as
        | { contractId?: string }
        | undefined;
      const contractId = failedPayload?.contractId;
      if (!contractId) return;
      const message =
        error instanceof Error ? error.message : "Unknown analysis error";
      console.error(
        `[Coordinator] Pipeline failed for ${contractId}:`,
        message,
      );
      await db
        .update(contracts)
        .set({
          contractStatus: "failed",
          analysisStatus: `Analysis failed: ${message.slice(0, 200)}`,
          updatedAt: new Date(),
        })
        .where(eq(contracts.id, contractId));
    },
  },
  async ({ event, step }) => {
    const {
      contractId,
      organizationId,
      organizationPlan,
      mode = "full",
      force = false,
    } = event.data;

    if (!contractId) {
      console.error(
        "[Coordinator] Missing contractId in event data",
        event.data,
      );
      return { status: "ignored", reason: "missing contractId" };
    }

    const isRulesOnly = mode === "rules-only";
    const plan: OrganizationPlan =
      organizationPlan === "plus" ? "plus" : "basic";

    console.log(
      `[Coordinator] Started for ${contractId}. Mode: ${mode}. Force: ${force}`,
    );

    if (!isRulesOnly) {
      await step.run("initialize-status", async () => {
        await db
          .update(contracts)
          .set({
            analysisStatus: "[1/5] Initializing pipeline...",
            analysisProgress: 5,
            analysisStage: "ocr",
            contractStatus: "reviewing",
          })
          .where(eq(contracts.id, contractId));
      });

      await step.run("process-ocr", async () => {
        const [contract] = await db
          .select({
            fileURL: contracts.fileURL,
            fileContent: contracts.fileContent,
          })
          .from(contracts)
          .where(eq(contracts.id, contractId))
          .limit(1);

        if (!contract?.fileURL) {
          throw new Error("Contract file URL not found for OCR");
        }

        // Skip OCR if already extracted and not the placeholder
        // ALWAYS skip OCR if we have text, as it's the most expensive part
        // and the user specifically asked to reuse extracted text.
        if (
          contract.fileContent &&
          contract.fileContent !== "READY_FOR_ANALYSIS"
        ) {
          return {
            textLength: contract.fileContent.length,
            layoutSaved: false,
          };
        }

        const { rawText, structuredJSON } = await extractDocumentGCP(
          contract.fileURL,
          "application/pdf",
          false,
          async (current, total) => {
            await db
              .update(contracts)
              .set({
                analysisStatus: `[2/5] OCR: Processing chunk ${current} of ${total}...`,
                updatedAt: new Date(),
              })
              .where(eq(contracts.id, contractId));
          },
        );

        if (!rawText) throw new Error("GCP Extraction returned no text");

        const layoutMap =
          structuredJSON?.text || structuredJSON?.pages
            ? generateInitialStructure(structuredJSON)
            : structureTextHeuristically(rawText);

        const cleanLayout = sanitizeStructuredMap(
          isQualityStructuredMap(layoutMap)
            ? layoutMap
            : structureTextHeuristically(rawText),
        );

        await db
          .update(contracts)
          .set({
            fileContent: rawText,
            structuredContent: cleanLayout,
            analysisStatus: "[2/5] OCR: Text and layout extracted",
            analysisProgress: 25,
            updatedAt: new Date(),
          })
          .where(eq(contracts.id, contractId));

        return {
          textLength: rawText.length,
          layoutSaved: isQualityStructuredMap(cleanLayout),
        };
      });

      // Document map: heuristic baseline (from OCR) + one Inngest step per AI window (60s each)
      const mapBaseline = await step.run("document-map-baseline", async () => {
        const [contract] = await db
          .select({
            fileContent: contracts.fileContent,
            structuredContent: contracts.structuredContent,
          })
          .from(contracts)
          .where(eq(contracts.id, contractId))
          .limit(1);

        if (!contract?.fileContent) {
          throw new Error("No text content available for document mapping");
        }

        const existingMap = contract.structuredContent as StructuredContract;

        if (isQualityStructuredMap(existingMap) && !force) {
          console.log(
            `[Coordinator] [${contractId}] Reusing quality document map.`,
          );
          await db
            .update(contracts)
            .set({
              analysisStatus: "[3/5] Map: Document structure ready (Reused)",
              analysisProgress: 50,
              updatedAt: new Date(),
            })
            .where(eq(contracts.id, contractId));
          return { reused: true, sectionCount: existingMap!.sections.length };
        }

        const baseline = isQualityStructuredMap(existingMap)
          ? existingMap!
          : sanitizeStructuredMap(
              structureTextHeuristically(contract.fileContent),
            );

        await db
          .update(contracts)
          .set({
            structuredContent: baseline,
            analysisStatus: "[3/5] Map: Building document structure...",
            analysisProgress: 35,
            updatedAt: new Date(),
          })
          .where(eq(contracts.id, contractId));

        return { reused: false, sectionCount: baseline.sections.length };
      });

      if (!mapBaseline.reused) {
        const [contract] = await db
          .select({ fileContent: contracts.fileContent })
          .from(contracts)
          .where(eq(contracts.id, contractId))
          .limit(1);

        const windows = splitIntoWindows(contract?.fileContent || "").slice(
          0,
          MAX_AI_MAP_WINDOWS,
        );

        const aiWindowResults: StructuredContract[] = [];

        for (let i = 0; i < windows.length; i++) {
          const windowMap = await step.run(
            `document-map-ai-window-${i}`,
            async () => {
              await db
                .update(contracts)
                .set({
                  analysisStatus: `[3/5] Map: AI refining section ${i + 1} of ${windows.length}...`,
                  analysisProgress: 35 + Math.floor((i / windows.length) * 12),
                  updatedAt: new Date(),
                })
                .where(eq(contracts.id, contractId));

              return structureSingleWindow(windows[i], plan);
            },
          );

          if (isQualityStructuredMap(windowMap)) {
            aiWindowResults.push(windowMap);
          }
        }

        await step.run("document-map-merge-save", async () => {
          const [row] = await db
            .select({
              structuredContent: contracts.structuredContent,
              fileContent: contracts.fileContent,
            })
            .from(contracts)
            .where(eq(contracts.id, contractId))
            .limit(1);

          const baseline = (
            isQualityStructuredMap(row?.structuredContent as StructuredContract)
              ? row!.structuredContent
              : structureTextHeuristically(row?.fileContent || "")
          ) as StructuredContract;

          const finalMap = sanitizeStructuredMap(
            aiWindowResults.length > 0
              ? mergeStructuredWindows([baseline, ...aiWindowResults])
              : baseline,
          );

          await db
            .update(contracts)
            .set({
              structuredContent: finalMap,
              analysisStatus: "[3/5] Map: Structure finalized",
              analysisProgress: 50,
              updatedAt: new Date(),
            })
            .where(eq(contracts.id, contractId));

          if (isAstraVectorEnabled()) {
            const searchText = (finalMap.sections || [])
              .map((s) => `${s.heading}\n${(s.paragraphs || []).join("\n")}`)
              .join("\n\n")
              .slice(0, 12_000);
            await upsertAstraAiGeneration({
              contractId,
              kind: "structured_content",
              payload: finalMap,
              searchText,
            });
          }

          return { sectionsCount: finalMap.sections.length };
        });
      }

      // NEW: Generate Fast Summary for the 'Summary' tab
      await step.run("generate-summary", async () => {
        await db
          .update(contracts)
          .set({
            analysisStatus:
              "[4/5] Summary: Synthesizing intelligence summary...",
            analysisProgress: 60,
          })
          .where(eq(contracts.id, contractId));

        const { generateFastSummary } = await import("@/services/rule-engine");
        await (generateFastSummary as any)(contractId, plan, force);

        await db
          .update(contracts)
          .set({
            analysisStatus: "[4/5] Summary: Intelligence report ready",
            analysisProgress: 75, // Recalibrated
            updatedAt: new Date(),
          })
          .where(eq(contracts.id, contractId));
      });

      // Checklist: one Inngest step per batch (Vercel Hobby 60s limit per step)
      const checklistPlan = await step.run("checklist-prepare", async () => {
        const [contract] = await db
          .select({ workspaceId: contracts.workspaceId })
          .from(contracts)
          .where(eq(contracts.id, contractId))
          .limit(1);

        if (!contract?.workspaceId) {
          throw new Error("Workspace ID not found for checklist analysis");
        }

        await db
          .update(contracts)
          .set({
            analysisStatus:
              "[5/5] Checklist: Preparing clause library alignment...",
            analysisProgress: 78,
          })
          .where(eq(contracts.id, contractId));

        const { prepareDocumentMapChecklist } =
          await import("@/services/rule-engine");
        return prepareDocumentMapChecklist(contractId, contract.workspaceId);
      });

      if (checklistPlan && checklistPlan.totalBatches > 0) {
        for (let b = 0; b < checklistPlan.totalBatches; b++) {
          await step.run(`checklist-batch-${b}`, async () => {
            const { runDocumentMapChecklistBatch } =
              await import("@/services/rule-engine");
            await runDocumentMapChecklistBatch(
              contractId,
              checklistPlan.workspaceId,
              b,
            );

            const pct = Math.min(
              94,
              78 + Math.floor(((b + 1) / checklistPlan.totalBatches) * 16),
            );
            await db
              .update(contracts)
              .set({
                analysisStatus: `[5/5] Checklist: Matching provisions (${b + 1}/${checklistPlan.totalBatches})...`,
                analysisProgress: pct,
                updatedAt: new Date(),
              })
              .where(eq(contracts.id, contractId));
          });
        }
      }

      await step.run("checklist-complete", async () => {
        const [countRow] = await db
          .select({ val: sql<number>`count(*)` })
          .from(analysisEvents)
          .where(
            and(
              eq(analysisEvents.contractId, contractId),
              eq(analysisEvents.eventType, "clause_detected"),
            ),
          );
        const stored = Number(countRow?.val ?? 0);
        const expected = checklistPlan?.expectedHeadingCount ?? stored;

        if (checklistPlan && stored !== expected) {
          console.warn(
            `[Checklist] Stored ${stored} events, expected ${expected} headings for ${contractId}`,
          );
        }

        const { clearChecklistStaging } =
          await import("@/services/rule-engine");
        await clearChecklistStaging(contractId);

        await db
          .update(contracts)
          .set({
            analysisStatus:
              "Fast Analysis Complete — review document map and checklist",
            analysisProgress: 100,
            contractStatus: "completed",
            analysisStage: "fast_complete",
            analysis: sql`jsonb_set(
              jsonb_set(
                COALESCE(${contracts.analysis}, '{}'::jsonb),
                '{status}',
                '"Fast Analysis Complete"'::jsonb
              ),
              '{checklistExpectedCount}',
              to_jsonb(${expected}::int)
            )`,
            updatedAt: new Date(),
          })
          .where(eq(contracts.id, contractId));
      });
    } else {
      await step.run("rules-only-deep-analysis", async () => {
        await db
          .update(contracts)
          .set({
            contractStatus: "reviewing",
            analysisProgress: 85,
            analysisStage: "deep",
            analysisStatus: "[5/5] Rules: Running neural rule evaluation...",
            updatedAt: new Date(),
          })
          .where(eq(contracts.id, contractId));

        await inngest.send({
          name: "contract/analyze.main",
          data: { contractId, plan, organizationId },
        });
      });
    }

    return { message: "Pipeline completed (Stabilized Phase)", contractId };
  },
);

// Removed deepAnalysisJob as it's now consolidated into evaluateContractRulesJob

/**
 * 4. fastAnalysisJob
 */
export const fastAnalysisJob = inngest.createFunction(
  {
    id: "fast-analysis",
    triggers: [{ event: "contract/analyze.fast" }],
    retries: 2,
  },
  async ({ event, step }) => {
    const { contractId, plan = "basic" } = event.data;
    await step.run("fast-pipeline", async () => {
      const [contract] = await db
        .select({
          fileContent: contracts.fileContent,
          workspaceId: contracts.workspaceId,
        })
        .from(contracts)
        .where(eq(contracts.id, contractId))
        .limit(1);
      if (contract?.fileContent && contract.workspaceId) {
        await detectMandatoryClauses(
          contractId,
          contract.workspaceId,
          contract.fileContent,
        );
        await db
          .update(contracts)
          .set({
            analysisStatus: "Analysis Complete",
            analysisProgress: 100,
            contractStatus: "completed",
          })
          .where(eq(contracts.id, contractId));
      }
    });
  },
);

/**
 * 5. mainAnalysisJob
 */
export const mainAnalysisJob = inngest.createFunction(
  { id: "main-analysis", triggers: [{ event: "contract/analyze.main" }] },
  async ({ event, step }) => {
    const { contractId, plan, organizationId } = event.data;

    const ruleIds = await step.run("prepare-analysis-ids", async () => {
      const [contract] = await db
        .select({
          fileContent: contracts.fileContent,
          currentVersionId: contracts.currentVersionId,
        })
        .from(contracts)
        .where(eq(contracts.id, contractId))
        .limit(1);
      if (contract?.fileContent && contract.currentVersionId) {
        const { chunkAndEmbedContractVersion } =
          await import("@/services/rule-engine");
        await chunkAndEmbedContractVersion(
          contractId,
          contract.currentVersionId,
          contract.fileContent,
        );
      }
      const rulesRes = await prepareContractForAnalysis(contractId, {
        filterByDetection: false,
        evaluateAllActive: true,
      });
      const ids = rulesRes.map((r) => r.id);
      await db
        .update(contracts)
        .set({ totalRules: ids.length })
        .where(eq(contracts.id, contractId));
      return ids;
    });

    if (ruleIds.length > 0) {
      await step.run("fan-out-rules", async () => {
        const events = ruleIds.map((id) => ({
          name: "contract/rule.evaluate",
          data: {
            contractId,
            ruleId: id,
            plan,
            totalRules: ruleIds.length,
            organizationId,
          },
        }));

        for (let i = 0; i < events.length; i += 50) {
          await inngest.send(events.slice(i, i + 50));
        }
      });
    } else {
      await step.run("finalize-empty", async () => {
        await finalizeContractAnalysis(contractId);
        await db
          .update(contracts)
          .set({
            analysisStatus: "Analysis Complete (No rules applicable)",
            analysisProgress: 100,
          })
          .where(eq(contracts.id, contractId));
      });
    }

    return { message: "Main analysis fanned out", contractId };
  },
);
/**
 * 6. cleanupBinJob (Cron)
 * Trigger: 0 0 * * * (Daily)
 * Permanently deletes contracts from the bin after 7 days.
 */
export const cleanupBinJob = inngest.createFunction(
  {
    id: "cleanup-bin",
    name: "Cleanup Deleted Contracts",
    triggers: [{ cron: "0 0 * * *" }],
  },
  async ({ step }: { step: any }) => {
    const expiredDate = subDays(new Date(), 7);

    const expiredContracts = await step.run(
      "fetch-expired-contracts",
      async () => {
        return await db
          .select({ id: contracts.id, fileURL: contracts.fileURL })
          .from(contracts)
          .where(
            and(
              isNotNull(contracts.deletedAt),
              lt(contracts.deletedAt, expiredDate),
            ),
          );
      },
    );

    for (const contract of expiredContracts) {
      await step.run(`cleanup-contract-${contract.id}`, async () => {
        // 1. Fetch version files
        const versions = await db
          .select({ fileURL: contractVersions.fileURL })
          .from(contractVersions)
          .where(eq(contractVersions.contractId, contract.id));

        const allFileUrls = new Set<string>();
        if (contract.fileURL) allFileUrls.add(contract.fileURL);
        versions.forEach((v) => {
          if (v.fileURL) allFileUrls.add(v.fileURL);
        });

        // 2. Storage Cleanup
        for (const fileURL of allFileUrls) {
          try {
            const url = new URL(fileURL);
            if (url.hostname.includes("supabase.co")) {
              const filePath = extractPathFromSupabaseUrl(fileURL);
              if (filePath) await deleteFromSupabase(filePath);
            }
          } catch (err) {
            console.error(
              `[Cleanup] Storage delete failed for ${fileURL}`,
              err,
            );
          }
        }

        // 3. Permanent DB Delete (Cascades)
        await db.delete(contracts).where(eq(contracts.id, contract.id));
      });
    }

    return { deletedCount: expiredContracts.length };
  },
);
