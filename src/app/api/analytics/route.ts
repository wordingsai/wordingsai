import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { db } from "@/db/drizzle";
import {
  contracts,
  ruleResults,
  rules,
  analysisEvents,
  clauses,
} from "@/db/schema";
import { eq, and, sql, avg, count, desc, or, isNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getActiveOrganization } from "@/server/organizations";
import { getActiveWorkspace } from "@/server/workspaces";

export async function GET(req: NextRequest) {
  try {
    const sessionData = await auth.api.getSession({ headers: await headers() });
    if (!sessionData || !sessionData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = sessionData.user.id;
    const sessionOrgId = (sessionData.session as any).activeOrganizationId;

    let organizationId = sessionOrgId;
    if (!organizationId) {
      const org = await getActiveOrganization(userId);
      if (!org) {
        return NextResponse.json(
          { error: "No active organization" },
          { status: 403 },
        );
      }
      organizationId = org.id;
    }

    const workspace = await getActiveWorkspace(userId, organizationId, null);
    const activeWorkspaceId = workspace?.id;

    if (!activeWorkspaceId) {
      return NextResponse.json(
        { error: "No active workspace" },
        { status: 403 },
      );
    }

    // 1. Basic Stats
    const statsResult = await db
      .select({
        totalContracts: count(contracts.id),
        avgRiskScore: avg(contracts.riskScore),
      })
      .from(contracts)
      .where(
        and(
          eq(contracts.organizationId, organizationId),
          eq(contracts.workspaceId, activeWorkspaceId),
          isNull(contracts.deletedAt),
          isNull(contracts.archivedAt),
        ),
      );

    const totalContracts = Number(statsResult[0]?.totalContracts || 0);
    const avgRiskScore = Math.round(Number(statsResult[0]?.avgRiskScore || 0));

    // 2. Risk Distribution
    const riskDistResult = await db
      .select({
        status: ruleResults.status,
        count: count(ruleResults.id),
      })
      .from(ruleResults)
      .innerJoin(contracts, eq(ruleResults.contractId, contracts.id))
      .where(
        and(
          eq(contracts.organizationId, organizationId),
          eq(contracts.workspaceId, activeWorkspaceId),
          isNull(contracts.deletedAt),
          isNull(contracts.archivedAt),
        ),
      )
      .groupBy(ruleResults.status);

    const riskDist = { Red: 0, Amber: 0, Green: 0, Total: 0 };
    riskDistResult.forEach((r) => {
      if (r.status in riskDist) {
        const c = Number(r.count);
        riskDist[r.status as keyof typeof riskDist] = c;
        riskDist.Total += c;
      }
    });

    // 3. Contract Type Mix
    const typeMixResult = await db
      .select({
        contractType: contracts.contractType,
        count: count(contracts.id),
      })
      .from(contracts)
      .where(
        and(
          eq(contracts.organizationId, organizationId),
          eq(contracts.workspaceId, activeWorkspaceId),
          isNull(contracts.deletedAt),
          isNull(contracts.archivedAt),
        ),
      )
      .groupBy(contracts.contractType);

    // 4. Trending Clauses - Task 10
    const trendingApproved = await db
      .select({
        id: clauses.id,
        name: clauses.clauseName,
        count: count(analysisEvents.id),
      })
      .from(analysisEvents)
      .innerJoin(clauses, eq(analysisEvents.clauseId, clauses.id))
      .where(
        and(
          eq(analysisEvents.organizationId, organizationId),
          eq(analysisEvents.workspaceId, activeWorkspaceId),
          eq(analysisEvents.status, "Matched"),
          eq(clauses.status, "Approved"),
        ),
      )
      .groupBy(clauses.id, clauses.clauseName)
      .orderBy(desc(sql`count`))
      .limit(10);

    const trendingNotApproved = await db
      .select({
        id: clauses.id,
        name: clauses.clauseName,
        count: count(analysisEvents.id),
      })
      .from(analysisEvents)
      .innerJoin(clauses, eq(analysisEvents.clauseId, clauses.id))
      .where(
        and(
          eq(analysisEvents.organizationId, organizationId),
          eq(analysisEvents.workspaceId, activeWorkspaceId),
          eq(analysisEvents.status, "Matched"),
          eq(clauses.status, "Not Approved"),
        ),
      )
      .groupBy(clauses.id, clauses.clauseName)
      .orderBy(desc(sql`count`))
      .limit(10);

    const trendingVariations = await db
      .select({
        id: clauses.id,
        name: clauses.clauseName,
        count: count(analysisEvents.id),
      })
      .from(analysisEvents)
      .innerJoin(clauses, eq(analysisEvents.clauseId, clauses.id))
      .where(
        and(
          eq(analysisEvents.organizationId, organizationId),
          eq(analysisEvents.workspaceId, activeWorkspaceId),
          eq(analysisEvents.status, "Variation"),
        ),
      )
      .groupBy(clauses.id, clauses.clauseName)
      .orderBy(desc(sql`count`))
      .limit(10);

    const latestClauses = await db
      .select({
        id: clauses.id,
        name: clauses.clauseName,
        createdAt: clauses.createdAt,
      })
      .from(clauses)
      .where(
        or(
          and(
            eq(clauses.organizationId, organizationId),
            eq(clauses.workspaceId, activeWorkspaceId),
          ),
          eq(clauses.isGlobal, true),
        ),
      )
      .orderBy(desc(clauses.createdAt))
      .limit(10);

    // 5. Portfolio Health - Task 11
    const healthResult = await db
      .select({
        status: clauses.status,
        count: count(clauses.id),
      })
      .from(clauses)
      .where(
        and(
          eq(clauses.organizationId, organizationId),
          eq(clauses.workspaceId, activeWorkspaceId),
        ),
      )
      .groupBy(clauses.status);

    const healthCheck = {
      approvedCount: Number(
        healthResult.find((r) => r.status === "Approved")?.count || 0,
      ),
      unapprovedCount: Number(
        healthResult.find((r) => r.status === "Not Approved")?.count || 0,
      ),
    };

    return NextResponse.json({
      summary: {
        totalContracts,
        avgRiskScore,
        activeContracts: totalContracts,
        riskDist,
      },
      distributions: {
        typeMix: typeMixResult.map((r) => ({
          contractType: r.contractType || "other",
          count: Number(r.count),
        })),
      },
      trendingApproved: trendingApproved.map((item) => ({
        ...item,
        count: Number(item.count),
      })),
      trendingNotApproved: trendingNotApproved.map((item) => ({
        ...item,
        count: Number(item.count),
      })),
      trendingVariations: trendingVariations.map((item) => ({
        ...item,
        count: Number(item.count),
      })),
      latestClauses: latestClauses.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
      })),
      healthCheck,
      marketIntelligence: [
        {
          title: "Cyber Exclusion Rise",
          trend: "up",
          detail: "LMA 5564 usage up by 42%",
          impact: "high",
        },
        {
          title: "Sanction Clause Drift",
          trend: "down",
          detail: "Non-standard interpretations in 14 treaties",
          impact: "medium",
        },
      ],
    });
  } catch (error: any) {
    console.error("[Analytics API] Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
