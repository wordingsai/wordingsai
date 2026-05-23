import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";

import { db } from "@/db/drizzle";
import { rules, organizationRuleSettings } from "@/db/schema";
import { auth } from "@/lib/auth";
import { eq, and, or } from "drizzle-orm";
import { resolveActiveWorkspaceContext } from "@/server/workspace-resolver";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<any> },
) {
  try {
    const sessionData = await auth.api.getSession({ headers: await headers() });
    if (!sessionData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { ruleId } = await params;
    const { status } = await req.json();

    if (status !== "active" && status !== "inactive") {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const resolved = await resolveActiveWorkspaceContext();
    if (!resolved.ok) {
      return NextResponse.json(
        { error: resolved.error },
        { status: resolved.status },
      );
    }
    const { context } = resolved;

    // Fetch the rule - allow global or org-owned rules
    const [rule] = await db
      .select()
      .from(rules)
      .where(
        and(
          eq(rules.id, ruleId),
          or(
            eq(rules.organizationId, context.organizationId),
            eq(rules.isGlobal, true),
          ),
        ),
      )
      .limit(1);

    if (!rule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    // Always use organizationRuleSettings as the primary override mechanism
    const [existingSetting] = await db
      .select()
      .from(organizationRuleSettings)
      .where(
        and(
          eq(organizationRuleSettings.organizationId, context.organizationId),
          eq(organizationRuleSettings.ruleId, ruleId),
        ),
      )
      .limit(1);

    if (existingSetting) {
      await db
        .update(organizationRuleSettings)
        .set({ status, updatedAt: new Date() })
        .where(eq(organizationRuleSettings.id, existingSetting.id));
    } else {
      await db.insert(organizationRuleSettings).values({
        organizationId: context.organizationId,
        ruleId,
        status,
      });
    }

    // If the organization owns the rule, also update the main status for consistency
    if (rule.organizationId === context.organizationId) {
      await db
        .update(rules)
        .set({ status, updatedAt: new Date() })
        .where(eq(rules.id, ruleId));
    }

    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error("Error toggling rule status:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
