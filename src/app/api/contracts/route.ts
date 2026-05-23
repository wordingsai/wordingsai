import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { db } from "@/db/drizzle";
import { contracts, contractVersions, contractChunks } from "@/db/schema";
import { eq, desc, sql, and, isNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getActiveOrganization } from "@/server/organizations";
import { getActiveWorkspace } from "@/server/workspaces";
import { isAdmin } from "@/server/permissions";
import { inngest } from "@/inngest/client";
import type { ContractAnalysis } from "@/types/contracts";

// chunkText is now imported from @/lib/text-processing

import { logActivity, createNotification } from "@/lib/activity-utils";

export async function POST(req: NextRequest) {
  try {
    // Quick DB check
    try {
      await db.execute(sql`SELECT 1`);
    } catch (dbCheckErr: any) {
      console.error(
        "[Contracts API POST] DB Connectivity check failed:",
        dbCheckErr?.message,
      );
      return NextResponse.json(
        { error: "Database connection failed", details: dbCheckErr?.message },
        { status: 500 },
      );
    }

    const sessionData = await auth.api.getSession({ headers: await headers() });
    if (!sessionData || !sessionData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isSuperUser = await isAdmin();
    if (!isSuperUser) {
      return NextResponse.json(
        { error: "Forbidden: Super User access required" },
        { status: 403 },
      );
    }

    const userId = sessionData.user.id;
    const { session } = sessionData as any;
    let sessionOrgId = session?.activeOrganizationId;
    let sessionWorkspaceId = session?.activeWorkspaceId;

    let organizationId = sessionOrgId;

    if (!organizationId) {
      console.log(
        "[Contracts API] No activeOrganizationId in session, falling back to getActiveOrganization",
      );
      const org = await getActiveOrganization(userId);
      if (!org) {
        return NextResponse.json(
          { error: "No active organization" },
          { status: 403 },
        );
      }
      organizationId = org.id;
    }

    // If no workspace in session, fetch default workspace
    let activeWorkspaceId = sessionWorkspaceId;
    if (!activeWorkspaceId) {
      console.log(
        "[Contracts API] No activeWorkspaceId in session, fetching default workspace",
      );
      const workspace = await getActiveWorkspace(userId, organizationId, null);
      if (workspace) {
        activeWorkspaceId = workspace.id;
      }
    }

    console.log(
      `[Contracts API] Using organizationId: ${organizationId}, workspaceId: ${activeWorkspaceId} for user: ${userId}`,
    );

    const contentType = req.headers.get("content-type") || "";
    let contractName: string | null = null;
    let reinsured: string | null = null;
    let broker: string | null = null;
    let contractType: string | null = null;
    let tags: string[] = [];
    let periodFrom: Date | null = null;
    let periodTo: Date | null = null;
    let fileURL: string | null = null;
    let fileContent: string | null = null;
    let fileSize: number | null = null;
    let fileHash: string | null = null;
    let selectedRuleIds: string[] = [];

    const safeDate = (d?: string | null): Date | null => {
      if (!d) return null;
      const date = new Date(d);
      return isNaN(date.getTime()) ? null : date;
    };

    const body = await req.json();
    contractName = body.contractName;
    reinsured = body.reinsured;
    broker = body.broker || null;
    contractType = body.contractType;
    tags = body.tags || [];
    periodFrom = safeDate(body.periodFrom);
    periodTo = safeDate(body.periodTo);
    fileContent = body.fileContent || null;
    fileURL = body.fileURL || null;
    fileSize = body.fileSize || null;
    fileHash = body.fileHash || null;
    selectedRuleIds = body.selectedRuleIds || [];

    if (!contractName || !reinsured || !fileContent || !fileURL) {
      return NextResponse.json(
        { error: "All fields including file are required" },
        { status: 400 },
      );
    }

    const contractTypeValue =
      typeof contractType === "string" && contractType.trim().length > 0
        ? contractType.trim().toLowerCase()
        : "other";

    tags = tags.filter(Boolean);

    const finalContract = await db.transaction(async (tx) => {
      // 1. DUPLICATE CHECK (Isolated by Workspace)
      if (fileHash) {
        const existing = await tx
          .select()
          .from(contracts)
          .where(
            and(
              eq(contracts.organizationId, organizationId),
              eq(contracts.workspaceId, activeWorkspaceId),
              eq(contracts.fileHash, fileHash),
              isNull(contracts.deletedAt),
            ),
          )
          .limit(1);

        if (existing.length > 0) {
          console.log(
            `[Contracts API] Duplicate found in workspace ${activeWorkspaceId}. Returning existing contract: ${existing[0].id}`,
          );
          return existing[0];
        }
      }

      try {
        const newContractResult = await tx
          .insert(contracts)
          .values({
            organizationId,
            workspaceId: activeWorkspaceId,
            userId,
            contractName,
            reinsured,
            broker,
            contractType: contractTypeValue,
            tags,
            periodFrom,
            periodTo,
            executionDate: periodFrom || new Date(),
            createdBy: userId,
            updatedBy: userId,
            fileSize,
            fileHash,
            fileURL,
            fileContent,
            selectedRuleIds,
            contractStatus: "reviewing",
            analysisProgress: 5,
            analysis: { status: "Initializing Neural Engine..." } as any,
          })
          .returning();
        const newContract = (newContractResult as any[])[0];

        const newVersionResult = await tx
          .insert(contractVersions)
          .values({
            contractId: newContract.id,
            versionNumber: 1,
            fileURL,
            fileContent,
            analysis: null,
            riskScore: null,
            createdBy: userId,
            changeNote: "Initial contract upload",
          })
          .returning();
        const newVersion = (newVersionResult as any[])[0];

        const updatedContractResult = await tx
          .update(contracts)
          .set({
            currentVersionId: newVersion.id,
            updatedBy: userId,
          })
          .where(eq(contracts.id, newContract.id))
          .returning();
        const updatedContract = (updatedContractResult as any[])[0];

        return updatedContract;
      } catch (dbErr: any) {
        console.error("[Contracts API] Database transaction failed:", dbErr);
        // Rethrow to fail the outer transaction
        throw dbErr;
      }
    });

    console.log(
      "[Contracts API] Contract created successfully:",
      finalContract.id,
    );

    // Auto-archive oldest active contract if we now have >10
    try {
      const activeContracts = await db
        .select({ id: contracts.id, createdAt: contracts.createdAt })
        .from(contracts)
        .where(
          and(
            eq(contracts.organizationId, organizationId),
            activeWorkspaceId
              ? eq(contracts.workspaceId, activeWorkspaceId)
              : (undefined as any),
            isNull(contracts.deletedAt),
            isNull(contracts.archivedAt),
          ),
        )
        .orderBy(desc(contracts.createdAt));

      if (activeContracts.length > 10) {
        // Archive the oldest ones beyond the top 10
        const toArchive = activeContracts.slice(10);
        for (const c of toArchive) {
          await db
            .update(contracts)
            .set({ archivedAt: new Date() })
            .where(eq(contracts.id, c.id));
        }
        console.log(
          `[Contracts API] Auto-archived ${toArchive.length} old contract(s)`,
        );
      }
    } catch (archiveErr) {
      // Non-fatal: log but don't fail the upload
      console.warn("[Contracts API] Auto-archive check failed:", archiveErr);
    }

    // 5. Activity and Notifications
    await logActivity({
      userId,
      organizationId,
      action: "created",
      entityType: "contract",
      entityId: finalContract.id,
      entityName: finalContract.contractName,
    });

    await createNotification({
      userId,
      organizationId,
      title: "Contract Uploaded",
      message: `The contract "${finalContract.contractName}" has been successfully uploaded and is now queued for analysis.`,
      type: "success",
      link: `/contracts/${finalContract.id}`,
    });

    // Trigger analysis job
    await inngest.send({
      name: "contract/evaluate",
      data: {
        contractId: finalContract.id,
        organizationId,
        workspaceId: activeWorkspaceId,
        userId,
        organizationPlan:
          (sessionData.session as any).activeOrganizationPlan || "basic",
        mode:
          (sessionData.session as any).activeOrganizationPlan === "fast"
            ? "fast"
            : "full",
      },
    });

    return NextResponse.json(finalContract, { status: 201 });
  } catch (error: any) {
    console.error("[Contracts API] POST error detail:", {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
      query: error?.query,
      params: error?.params,
      hint: error?.hint,
      detail: error?.detail,
    });
    return NextResponse.json(
      {
        error: error?.message || "Internal Server Error",
        details:
          process.env.NODE_ENV === "development" ? error?.detail : undefined,
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    // Quick DB check
    try {
      await db.execute(sql`SELECT 1`);
    } catch (dbCheckErr: any) {
      console.error(
        "[Contracts API GET] DB Connectivity check failed:",
        dbCheckErr?.message,
      );
      return NextResponse.json(
        { error: "Database connection failed", details: dbCheckErr?.message },
        { status: 500 },
      );
    }

    const sessionData = await auth.api.getSession({ headers: await headers() });

    if (!sessionData || !sessionData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = sessionData.user.id;
    const sessionOrgId = (sessionData.session as any).activeOrganizationId;

    let userOrgId = sessionOrgId;

    if (!userOrgId) {
      console.log(
        "[Contracts API GET] No activeOrganizationId in session, falling back to getActiveOrganization",
      );
      const org = await getActiveOrganization(userId);
      if (!org) {
        return NextResponse.json(
          { error: "No active organization" },
          { status: 403 },
        );
      }
      userOrgId = org.id;
    }

    const { session } = sessionData as any;
    const activeWorkspaceId = session?.activeWorkspaceId;

    console.log(
      `[Contracts API GET] Fetching contracts for org: ${userOrgId}, user: ${userId}, workspace: ${activeWorkspaceId}`,
    );

    const whereClause = and(
      activeWorkspaceId
        ? and(
            eq(contracts.organizationId, userOrgId),
            eq(contracts.workspaceId, activeWorkspaceId),
          )
        : eq(contracts.organizationId, userOrgId),
      isNull(contracts.deletedAt),
      isNull(contracts.archivedAt),
    );

    const userContracts = await db
      .select({
        id: contracts.id,
        contractName: contracts.contractName,
        reinsured: contracts.reinsured,
        broker: contracts.broker,
        contractType: contracts.contractType,
        periodFrom: contracts.periodFrom,
        periodTo: contracts.periodTo,
        tags: contracts.tags,
        contractStatus: contracts.contractStatus,
        analysisStage: contracts.analysisStage,
        analysisProgress: contracts.analysisProgress,
        totalRules: contracts.totalRules,
        riskScore: contracts.riskScore,
        createdAt: contracts.createdAt,
        analysis: contracts.analysis,
      })
      .from(contracts)
      .where(whereClause)
      .orderBy(desc(contracts.createdAt));

    const contractsWithStatus = userContracts.map((contract: any) => {
      let auditStatus = "pending";
      const { analysisProgress } = contract;
      const analysis = contract.analysis as ContractAnalysis | null;

      if (
        analysis?.status?.includes("Processing") ||
        analysis?.status?.toLowerCase().includes("reviewing") ||
        analysis?.status?.includes("Neural") ||
        analysis?.status?.includes("Vetting") ||
        analysis?.status?.includes("Mapping")
      ) {
        auditStatus = "reviewing";
      } else if (
        contract.totalRules &&
        contract.analysisProgress >= contract.totalRules &&
        contract.totalRules > 0
      ) {
        auditStatus = "completed";
      } else if (
        analysis?.status?.includes("failed") ||
        analysis?.status?.includes("Failed")
      ) {
        auditStatus = "failed";
      }

      return {
        ...contract,
        auditStatus,
      };
    });

    console.log(
      `[Contracts API GET] Found ${contractsWithStatus.length} contracts for user ${userId}`,
    );

    return NextResponse.json(contractsWithStatus);
  } catch (error: any) {
    console.error("[Contracts API GET] Detailed Error:", {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
      cause: error?.cause,
    });
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details:
          process.env.NODE_ENV === "development" ? error?.message : undefined,
      },
      { status: 500 },
    );
  }
}
