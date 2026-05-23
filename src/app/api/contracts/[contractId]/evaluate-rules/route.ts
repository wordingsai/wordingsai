// app/api/contracts/[contractId]/evaluate-rules/route.ts
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { inngest } from "@/inngest/client";
import { db } from "@/db/drizzle";
import { eq, sql } from "drizzle-orm";
import { contracts, ruleResults } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getActiveOrganization } from "@/server/organizations";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ contractId: string }> },
) {
  let contractId = "unknown";
  try {
    const resolvedParams = await params;
    contractId = resolvedParams.contractId;
    console.log(`[EvaluateRules] Starting POST for ${contractId}`);
  } catch (pe) {
    console.error("[EvaluateRules] Failed to resolve params:", pe);
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  try {
    console.log("[EvaluateRules] Getting session...");
    const headersList = await headers();
    const sessionData = await auth.api.getSession({ headers: headersList });

    if (!sessionData?.user) {
      console.warn("[EvaluateRules] Unauthorized: No user in session");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log(
      `[EvaluateRules] Getting organization for user ${sessionData.user.id}...`,
    );
    const organization = await getActiveOrganization(sessionData.user.id);
    if (!organization) {
      console.warn("[EvaluateRules] Forbidden: No organization context");
      return NextResponse.json(
        { error: "No organization context" },
        { status: 403 },
      );
    }

    console.log(`[EvaluateRules] Fetching contract ${contractId}...`);
    const [contractRecord] = await db
      .select()
      .from(contracts)
      .where(eq(contracts.id, contractId))
      .limit(1);

    if (!contractRecord) {
      console.warn(`[EvaluateRules] Contract ${contractId} not found`);
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 },
      );
    }

    if (contractRecord.organizationId !== organization.id) {
      console.warn(
        `[EvaluateRules] Forbidden: Org mismatch. Contract: ${contractRecord.organizationId}, User: ${organization.id}`,
      );
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    console.log(
      `[EvaluateRules] Cleaning up rule results for ${contractId}...`,
    );
    await db.delete(ruleResults).where(eq(ruleResults.contractId, contractId));

    console.log(
      `[EvaluateRules] Updating contract status for ${contractId}...`,
    );
    await db
      .update(contracts)
      .set({
        // Use raw SQL for the column name to bypass any Drizzle schema mapping issues
        // while still providing the necessary state for the UI
        contractStatus: "reviewing",
        analysisProgress: 80,
        analysis: sql`jsonb_set(COALESCE(${contracts.analysis}, '{}'::jsonb), '{status}', '"[5/5] Rules Evaluation: Starting..."'::jsonb)`,
        updatedAt: new Date(),
      })
      .where(eq(contracts.id, contractId));

    console.log(
      `[EvaluateRules] Sending Inngest event for ${contractId} with mode: rules-only`,
    );
    await inngest.send({
      name: "contract/evaluate",
      data: {
        contractId: contractId,
        organizationId: contractRecord.organizationId,
        organizationPlan: organization.plan,
        userId: sessionData.user.id,
        mode: "rules-only",
      },
    });

    console.log(`[EvaluateRules] Successfully queued ${contractId}`);
    return NextResponse.json({
      success: true,
      status: "queued",
      message: "Rules evaluation queued successfully",
      contractId: contractId,
    });
  } catch (error: any) {
    console.error("[EvaluateRules] CRITICAL ERROR:", {
      message: error?.message,
      stack: error?.stack,
      contractId,
    });
    return NextResponse.json(
      {
        error: "Rule evaluation failed",
        details: error?.message || "Unknown error",
      },
      { status: 500 },
    );
  }
}
