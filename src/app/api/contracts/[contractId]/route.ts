import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
import { db } from "@/db/drizzle";
import {
  contracts,
  contractVersions,
  contractChunks,
  ruleResults,
  rules,
  ruleVersions,
  organization,
  analysisEvents,
  analyzedClauses,
} from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getActiveOrganization } from "@/server/organizations";
import { inngest } from "@/inngest/client";
import { isAdmin } from "@/server/permissions";
import {
  deleteFromSupabase,
  extractPathFromSupabaseUrl,
} from "@/lib/supabase/storage";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ contractId: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    console.log(
      "[Contract API GET] Session retrieved:",
      !!session,
      "User ID:",
      session?.user?.id,
    );
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const params = await context.params;
    const contractId = params.contractId;

    if (!contractId || contractId === "undefined") {
      return NextResponse.json(
        { error: "Valid Contract ID is required" },
        { status: 400 },
      );
    }

    // Basic UUID format check to prevent DB errors
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(contractId)) {
      return NextResponse.json(
        { error: "Invalid Contract ID format" },
        { status: 400 },
      );
    }

    const sessionOrgId = (session.session as any).activeOrganizationId;
    let orgId = sessionOrgId;
    console.log("[Contract API GET] Session Org ID:", sessionOrgId);

    if (!orgId) {
      console.log(
        "[Contract API GET] Falling back to getActiveOrganization for userId:",
        userId,
      );
      const org = await getActiveOrganization(userId);
      if (!org) {
        return NextResponse.json(
          { error: "No active organization" },
          { status: 403 },
        );
      }
      orgId = org.id;
    }
    console.log(
      "[Contract API GET] Effective Org ID:",
      orgId,
      "Target Contract ID:",
      contractId,
    );

    const isPolling = request.nextUrl.searchParams.get("polling") === "true";

    const contractRecord = isPolling
      ? await db
          .select({
            id: contracts.id,
            contractName: contracts.contractName,
            reinsured: contracts.reinsured,
            broker: contracts.broker,
            contractType: contracts.contractType,
            periodFrom: contracts.periodFrom,
            periodTo: contracts.periodTo,
            tags: contracts.tags,
            analysisProgress: contracts.analysisProgress,
            analysisStatus: contracts.analysisStatus,
            analysisStage: contracts.analysisStage,
            organizationId: contracts.organizationId,
            createdAt: contracts.createdAt,
            updatedAt: contracts.updatedAt,
            currentVersionId: contracts.currentVersionId,
            totalRules: contracts.totalRules,
            riskScore: contracts.riskScore,
            fileURL: contracts.fileURL,
            contractStatus: contracts.contractStatus,
          })
          .from(contracts)
          .where(
            and(
              eq(contracts.id, contractId),
              eq(contracts.organizationId, orgId),
            ),
          )
          .limit(1)
          .then((res) => res[0])
      : await db
          .select({
            id: contracts.id,
            contractName: contracts.contractName,
            reinsured: contracts.reinsured,
            broker: contracts.broker,
            contractType: contracts.contractType,
            periodFrom: contracts.periodFrom,
            periodTo: contracts.periodTo,
            tags: contracts.tags,
            analysisProgress: contracts.analysisProgress,
            analysisStatus: contracts.analysisStatus,
            analysisStage: contracts.analysisStage,
            analysis: contracts.analysis,
            organizationId: contracts.organizationId,
            createdAt: contracts.createdAt,
            updatedAt: contracts.updatedAt,
            currentVersionId: contracts.currentVersionId,
            totalRules: contracts.totalRules,
            riskScore: contracts.riskScore,
            fileURL: contracts.fileURL,
            structuredContent: contracts.structuredContent,
            contractStatus: contracts.contractStatus,
          })
          .from(contracts)
          .where(
            and(
              eq(contracts.id, contractId),
              eq(contracts.organizationId, orgId),
            ),
          )
          .limit(1)
          .then((res) => res[0]);

    if (!contractRecord) {
      console.error("[Contract API GET] Contract not found or org mismatch.", {
        contractId,
        orgId,
      });
      return NextResponse.json(
        { error: `Contract not found or access denied for org ${orgId}` },
        { status: 404 },
      );
    }
    console.log(
      "[Contract API GET] Found contract:",
      contractRecord.contractName,
    );

    const orgRecord = await db.query.organization.findFirst({
      where: eq(organization.id, orgId),
    });
    const organizationPlan = orgRecord?.plan || "basic";

    let analysisResults: any[] = [];
    let currentRuleCount = contractRecord.totalRules || 0;

    if (!isPolling) {
      if ((contractRecord as any).analysis) {
        analysisResults = await db
          .select({
            id: ruleResults.id,
            status: ruleResults.status,
            reasoning: ruleResults.reasoning,
            comments: ruleResults.comments,
            evidence: ruleResults.evidence,
            rule: {
              id: rules.id,
              name: rules.name,
              definition: ruleVersions.ruleDefinition,
              currentVersionId: rules.currentVersionId,
            },
            ruleVersionId: ruleResults.ruleVersionId,
            evaluatedAt: ruleResults.evaluatedAt,
            confidence: ruleResults.confidence,
            triggeredConditions: ruleResults.triggeredConditions,
            keyTerms: ruleResults.keyTerms,
          })
          .from(ruleResults)
          .innerJoin(rules, eq(ruleResults.ruleId, rules.id))
          .innerJoin(ruleVersions, eq(rules.currentVersionId, ruleVersions.id))
          .where(eq(ruleResults.contractId, contractId));
      }
    } else {
      const [countRow] = await db
        .select({ val: sql<number>`count(*)` })
        .from(ruleResults)
        .where(eq(ruleResults.contractId, contractId));
      currentRuleCount = Number(countRow?.val ?? 0);
    }

    return NextResponse.json({
      ...contractRecord,
      analysisResults,
      currentRuleCount,
      organizationPlan,
    });
  } catch (error) {
    console.error("[Contract API] GET error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ contractId: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Removed strict isAdmin check to allow members to configure analysis selection
    // The query below already ensures the contract belongs to the user's active organization.

    const userId = session.user.id;
    const sessionOrgId = (session.session as any).activeOrganizationId;
    let orgId = sessionOrgId;

    if (!orgId) {
      const org = await getActiveOrganization(userId);
      if (!org) {
        return NextResponse.json(
          { error: "No active organization" },
          { status: 403 },
        );
      }
      orgId = org.id;
    }

    const params = await context.params;
    const contractId = params.contractId;
    const body = await req.json();
    console.log(
      `[Contract API PATCH] Updating contract ${contractId} with:`,
      body,
    );

    // Build update object dynamically to avoid setting nulls for missing keys
    const updateData: any = {
      updatedBy: userId,
      updatedAt: new Date(),
    };

    if (body.contractName !== undefined)
      updateData.contractName = body.contractName;
    if (body.reinsured !== undefined) updateData.reinsured = body.reinsured;
    if (body.broker !== undefined) updateData.broker = body.broker;
    if (body.contractType !== undefined)
      updateData.contractType = body.contractType;
    if (body.tags !== undefined) updateData.tags = body.tags;
    if (body.selectedRuleIds !== undefined)
      updateData.selectedRuleIds = body.selectedRuleIds;
    if (body.periodFrom !== undefined)
      updateData.periodFrom = body.periodFrom
        ? new Date(body.periodFrom)
        : null;
    if (body.periodTo !== undefined)
      updateData.periodTo = body.periodTo ? new Date(body.periodTo) : null;

    const [updatedContract] = await db
      .update(contracts)
      .set(updateData)
      .where(
        and(eq(contracts.id, contractId), eq(contracts.organizationId, orgId)),
      )
      .returning();

    if (!updatedContract) {
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(updatedContract);
  } catch (error) {
    console.error("PATCH error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

// chunkText is now imported from @/lib/text-processing

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ contractId: string }> },
) {
  const { contractId } = await context.params;
  console.log("[Contract API POST] Request started for contract:", contractId);
  try {
    const sessionData = await auth.api.getSession({ headers: await headers() });
    if (!sessionData || !sessionData.user) {
      console.warn("[Contract API POST] Unauthorized attempt");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requestUserId = sessionData.user.id;
    const isSuperUser = await isAdmin();
    console.log(
      "[Contract API POST] User:",
      requestUserId,
      "isSuperUser:",
      isSuperUser,
    );

    if (!isSuperUser) {
      return NextResponse.json(
        { error: "Forbidden: Super User access required" },
        { status: 403 },
      );
    }

    const sessionOrgId = (sessionData.session as any).activeOrganizationId;
    let organizationId = sessionOrgId;

    if (!organizationId) {
      const org = await getActiveOrganization(requestUserId);
      if (!org) {
        return NextResponse.json(
          { error: "No active organization" },
          { status: 403 },
        );
      }
      organizationId = org.id;
    }

    const body = await req.json().catch(() => ({}));
    let {
      action,
      contractName,
      reinsured,
      broker,
      fileContent,
      fileURL,
      tags = [],
      contractType,
      fileSize,
    } = body;

    console.log("[Contract API POST] Action:", action);

    // Intercept "run-analysis"
    if (action === "run-analysis") {
      const { force } = body;
      try {
        const [existing] = await db
          .select({
            analysisProgress: contracts.analysisProgress,
            analysis: contracts.analysis,
          })
          .from(contracts)
          .where(
            and(
              eq(contracts.id, contractId),
              eq(contracts.organizationId, organizationId),
            ),
          )
          .limit(1);

        if (!existing) {
          return NextResponse.json(
            { error: "Contract not found or access denied" },
            { status: 404 },
          );
        }

        const activeStatuses = [
          "Processing",
          "Neural",
          "Vetting",
          "Evaluating",
          "Mapping",
          "Extracting",
          "OCR",
          "Clause",
          "Analysis",
          "Initializing",
          "Rule",
        ];
        const isProcessing =
          !force &&
          existing.analysisProgress > 0 &&
          existing.analysisProgress < 100 &&
          activeStatuses.some((s) => existing.analysis?.status?.includes(s));
        if (isProcessing) {
          return NextResponse.json({
            success: true,
            status: "processing",
            message: "Already processing",
          });
        }

        const [orgRecord] = await db
          .select({ plan: organization.plan })
          .from(organization)
          .where(eq(organization.id, organizationId))
          .limit(1);

        const organizationPlan = orgRecord?.plan || "basic";

        // Detect if fast analysis has already completed (has summary)
        const hasFastAnalysisSummary = !!existing.analysis?.summary;

        // Resume awareness: If progress is already meaningful and we have summary data, don't fully reset
        const canResume =
          !force &&
          existing.analysisProgress > 0 &&
          activeStatuses.some((s) => existing.analysis?.status?.includes(s));

        if (!canResume) {
          // IMPORTANT: Use jsonb_set to ONLY update the status field
          // This preserves any fast analysis `summary` already stored in the analysis JSONB
          await db
            .update(contracts)
            .set({
              contractStatus: "reviewing",
              analysisProgress: 0, // ALWAYS reset to 0 for a forced re-run
              analysis: sql`jsonb_set(COALESCE(${contracts.analysis}, '{}'::jsonb), '{status}', '"Initializing Neural Engine..."'::jsonb)`,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(contracts.id, contractId),
                eq(contracts.organizationId, organizationId),
              ),
            );

          // ALWAYS clear rule results for a forced re-run
          try {
            await db.transaction(async (tx) => {
              await tx
                .delete(ruleResults)
                .where(eq(ruleResults.contractId, contractId));

              // For a forced re-run, always clear analyzed clauses to trigger fresh segmentation
              await tx
                .delete(analyzedClauses)
                .where(eq(analyzedClauses.contractId, contractId));

              // Only clear events if we don't have a fast summary yet
              // OR if force is true, we want a clean slate
              if (!hasFastAnalysisSummary || force) {
                await tx
                  .delete(analysisEvents)
                  .where(eq(analysisEvents.contractId, contractId));
              }
            });
          } catch (delErr) {
            console.warn(
              "[Contracts API] Failed to clear rule results",
              delErr,
            );
          }
        } else {
          console.log(
            `[Analysis] [ContractId: ${contractId}] Resuming existing analysis from current state`,
          );
        }

        // Send to Inngest to handle background evaluation
        try {
          const { mode = "full" } = body;

          await inngest.send({
            name: "contract/evaluate",
            data: {
              contractId: contractId,
              organizationId: organizationId,
              userId: requestUserId,
              organizationPlan: organizationPlan,
              mode: mode,
              force: force,
            },
          });
        } catch (inngestErr: any) {
          console.error("[Analysis] Inngest send failed:", inngestErr);
          return NextResponse.json(
            {
              error:
                "Failed to trigger analysis. Please ensure background services are running.",
              details: inngestErr?.message || String(inngestErr),
            },
            { status: 500 },
          );
        }

        return NextResponse.json({
          success: true,
          status: "processing",
          message: "Analysis started in background",
        });
      } catch (err: any) {
        console.error("[Analysis] Critical error in API route:", err);
        return NextResponse.json(
          {
            error: err?.message || "Internal server error during analysis",
            details: err instanceof Error ? err.stack : String(err),
          },
          { status: 500 },
        );
      }
    }

    if (!contractName || !reinsured || !fileContent || !fileURL) {
      return NextResponse.json(
        { error: "All fields including file are required" },
        { status: 400 },
      );
    }

    tags = (tags as string[]).filter(Boolean);

    const finalContract = await db.transaction(async (tx) => {
      // Verify contract belongs to the organization
      const [contract] = await tx
        .select()
        .from(contracts)
        .where(
          and(
            eq(contracts.id, contractId),
            eq(contracts.organizationId, organizationId),
          ),
        )
        .limit(1);

      if (!contract) {
        throw new Error("Contract not found or access denied");
      }

      // Get latest version number
      const [latestVersion] = await tx
        .select()
        .from(contractVersions)
        .where(eq(contractVersions.contractId, contractId))
        .orderBy(desc(contractVersions.versionNumber))
        .limit(1);

      const nextVersionNumber = (latestVersion?.versionNumber ?? 0) + 1;

      const newVersionResult = await tx
        .insert(contractVersions)
        .values({
          contractId: contractId,
          versionNumber: nextVersionNumber,
          fileURL,
          fileContent,
          createdBy: requestUserId,
          changeNote: `Uploaded version ${nextVersionNumber}`,
        })
        .returning();
      const newVersion = (newVersionResult as any[])[0];

      const updatedContractResult = await tx
        .update(contracts)
        .set({
          currentVersionId: newVersion.id,
          updatedBy: requestUserId,
          contractName,
          reinsured,
          broker,
          contractType: contractType || contract.contractType,
          tags,
          fileSize: fileSize || contract.fileSize,
          fileURL,
          fileContent,
        })
        .where(eq(contracts.id, contractId))
        .returning();
      const updatedContract = (updatedContractResult as any[])[0];

      return updatedContract;
    });

    return NextResponse.json(finalContract, { status: 201 });
  } catch (error: any) {
    console.error("Error creating contract version:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      {
        status:
          error.message === "Contract not found or access denied" ? 404 : 500,
      },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ contractId: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const isSuperUser = await isAdmin();
    if (!isSuperUser)
      return NextResponse.json(
        { error: "Forbidden: Super User access required" },
        { status: 403 },
      );

    const userId = session.user.id;
    const sessionOrgId = (session.session as any).activeOrganizationId;
    let orgId = sessionOrgId;

    if (!orgId) {
      const org = await getActiveOrganization(userId);
      if (!org) {
        return NextResponse.json(
          { error: "No active organization" },
          { status: 403 },
        );
      }
      orgId = org.id;
    }

    const params = await context.params;
    const contractId = params.contractId;

    // 1. Check current status
    const [existing] = await db
      .select({
        id: contracts.id,
        deletedAt: contracts.deletedAt,
        fileURL: contracts.fileURL,
      })
      .from(contracts)
      .where(
        and(eq(contracts.id, contractId), eq(contracts.organizationId, orgId)),
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 },
      );
    }

    // 2. If already in bin, perform permanent delete
    if (existing.deletedAt) {
      console.log(`[Contract API DELETE] Permanent delete for ${contractId}`);

      // Fetch all versions for storage cleanup
      const versions = await db
        .select({ fileURL: contractVersions.fileURL })
        .from(contractVersions)
        .where(eq(contractVersions.contractId, contractId));

      const allFileUrls = new Set<string>();
      if (existing.fileURL) allFileUrls.add(existing.fileURL);
      versions.forEach((v) => {
        if (v.fileURL) allFileUrls.add(v.fileURL);
      });

      // Storage Cleanup
      for (const fileURL of Array.from(allFileUrls)) {
        try {
          const filePath = extractPathFromSupabaseUrl(fileURL);
          if (filePath) {
            await deleteFromSupabase(filePath);
          }
        } catch (err) {
          console.error(
            `[Contract API DELETE] Storage delete failed for ${fileURL}:`,
            err,
          );
        }
      }

      // Permanent DB Delete (Cascades to versions, results, events, etc. based on schema)
      await db.delete(contracts).where(eq(contracts.id, contractId));

      return NextResponse.json({
        success: true,
        message: "Contract permanently deleted",
      });
    }

    // 3. Otherwise, perform soft delete
    const deletedResult: any = await db
      .update(contracts)
      .set({ deletedAt: new Date() })
      .where(
        and(eq(contracts.id, contractId), eq(contracts.organizationId, orgId)),
      )
      .returning();

    return NextResponse.json({
      success: true,
      message: "Contract moved to bin",
    });
  } catch (error) {
    console.error("DELETE error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
