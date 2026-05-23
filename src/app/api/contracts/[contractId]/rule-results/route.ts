// app/api/contracts/[contractId]/rule-results/route.ts
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { db } from "@/db/drizzle";
import { eq, desc } from "drizzle-orm";
import { ruleResults, contracts } from "@/db/schema";
import { getCurrentUserOrgId } from "@/server/organizations";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ contractId: string }> },
) {
  const { contractId } = await params;

  try {
    const [contractRecord] = await db
      .select({ organizationId: contracts.organizationId })
      .from(contracts)
      .where(eq(contracts.id, contractId))
      .limit(1);

    if (!contractRecord) {
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 },
      );
    }

    const currentOrgId = await getCurrentUserOrgId();

    if (!currentOrgId || contractRecord.organizationId !== currentOrgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const results = await db.query.ruleResults.findMany({
      where: eq(ruleResults.contractId, contractId),
      orderBy: [desc(ruleResults.evaluatedAt)],
      with: {
        rule: {
          columns: {
            id: true,
            name: true,
            category: true,
            isGlobal: true,
            status: true,
          },
        },
        clauseMatches: {
          columns: {
            id: true,
            clauseId: true,
            score: true,
            createdAt: true,
          },
        },
      },
      columns: {
        id: true,
        status: true,
        reasoning: true,
        comments: true,
        evidence: true,
        evaluatedAt: true,
        ruleVersionId: true,
      },
    });

    return NextResponse.json({
      success: true,
      contractId: contractId,
      results,
      count: results.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[RuleResults] Failed for contract", contractId, error);
    return NextResponse.json(
      { error: "Failed to fetch rule results", details: message },
      { status: 500 },
    );
  }
}
