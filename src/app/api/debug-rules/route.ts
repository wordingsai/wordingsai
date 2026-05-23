import { NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { rules, workspaceRules } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveActiveWorkspaceContext } from "@/server/workspace-resolver";

export async function GET() {
  const resolved = await resolveActiveWorkspaceContext();
  if (!resolved.ok)
    return NextResponse.json({ error: resolved.error }, { status: 401 });

  const rulesList = await db
    .select()
    .from(rules)
    .innerJoin(workspaceRules, eq(rules.id, workspaceRules.ruleId))
    .where(
      and(
        eq(rules.organizationId, resolved.context.organizationId),
        eq(workspaceRules.workspaceId, resolved.context.workspaceId),
      ),
    );

  return NextResponse.json({
    orgId: resolved.context.organizationId,
    workspaceId: resolved.context.workspaceId,
    count: rulesList.length,
    rules: rulesList,
  });
}
