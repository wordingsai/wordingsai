import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import {
  contracts,
  rules,
  analysisEvents,
  workspaces,
  workspaceRules,
  ruleVersions,
} from "@/db/schema";
import { eq, and, inArray, sql, or } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { contractId } = await params;

    // 1. Fetch the contract and its workspace
    const [contract] = await db
      .select({
        id: contracts.id,
        workspaceId: contracts.workspaceId,
        organizationId: contracts.organizationId,
      })
      .from(contracts)
      .where(eq(contracts.id, contractId))
      .limit(1);

    if (!contract) {
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 },
      );
    }

    const workspaceId = contract.workspaceId;
    console.log(
      `[Recommendations API] Fetching for contract: ${contractId}, workspace: ${workspaceId}, org: ${contract.organizationId}`,
    );

    if (!workspaceId) {
      console.warn(
        `[Recommendations API] Workspace missing for contract: ${contractId}`,
      );
      return NextResponse.json(
        { error: "Workspace context missing" },
        { status: 400 },
      );
    }

    // 2. Fetch matched clauses from analysis events
    const matchedEvents = await db
      .select({
        metadata: analysisEvents.metadata,
      })
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

    const matchedClauseNames = matchedEvents
      .map((e) => (e.metadata as any)?.clauseName?.toLowerCase())
      .filter(Boolean) as string[];
    console.log(
      `[Recommendations] Matched clauses for ${contractId}:`,
      matchedClauseNames,
    );

    // 3. Fetch all active rules for this workspace with their definitions
    const rulesList = await db
      .select({
        id: rules.id,
        name: rules.name,
        category: rules.category,
        description: rules.description,
        definition: ruleVersions.ruleDefinition,
      })
      .from(rules)
      .innerJoin(workspaceRules, eq(rules.id, workspaceRules.ruleId))
      .leftJoin(ruleVersions, eq(rules.currentVersionId, ruleVersions.id))
      .where(
        and(
          eq(workspaceRules.workspaceId, workspaceId),
          eq(rules.status, "active"),
        ),
      );

    console.log(
      `[Recommendations API] Found ${rulesList.length} active rules for workspace ${workspaceId}`,
    );

    // 4. Determine recommendations
    const { matchRuleToClauses } = await import("@/services/rule-engine");
    const recommendations = rulesList.map((rule) => {
      const isMatch = matchRuleToClauses(rule, matchedClauseNames);

      return {
        id: rule.id,
        name: rule.name,
        category: rule.category,
        description: rule.description,
        isRecommended: isMatch,
        matchReason: isMatch
          ? `Highly relevant to detected document structure`
          : null,
      };
    });

    // Sort: Recommended first
    recommendations.sort(
      (a, b) => (b.isRecommended ? 1 : 0) - (a.isRecommended ? 1 : 0),
    );

    return NextResponse.json({
      rules: recommendations,
      matchedCount: matchedClauseNames.length,
    });
  } catch (error) {
    console.error("[Recommendations API] Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
