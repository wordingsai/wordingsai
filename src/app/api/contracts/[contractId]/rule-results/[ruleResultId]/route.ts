import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { ruleResults, contracts } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getActiveOrganization } from "@/server/organizations";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<any> },
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { contractId, ruleResultId } = await params;
    const { comments, keyTerms } = await req.json();

    const updateData: any = { evaluatedAt: new Date() };
    if (comments !== undefined) updateData.comments = comments;
    if (keyTerms !== undefined) updateData.keyTerms = keyTerms;

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

    // Verify contract belongs to org
    const [contract] = await db
      .select()
      .from(contracts)
      .where(
        and(eq(contracts.id, contractId), eq(contracts.organizationId, orgId)),
      )
      .limit(1);

    if (!contract) {
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 },
      );
    }

    const [updated] = await db
      .update(ruleResults)
      .set(updateData)
      .where(
        and(
          eq(ruleResults.id, ruleResultId),
          eq(ruleResults.contractId, contractId),
        ),
      )
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Rule result not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[RuleResult PATCH] error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
