import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { db } from "@/db/drizzle";
import { clauses } from "@/db/schema";
import { eq, and, like, isNotNull, sql } from "drizzle-orm";
import { resolveActiveWorkspaceContext } from "@/server/workspace-resolver";

const WORKSPACE_SUFFIX: Record<string, string> = {
  property: "PR",
  reinsurance: "RI",
  general: "GN",
};

/**
 * Generates the next available WAI code for a given workspace type and org.
 * Format: WAI-001-PR
 */
export async function generateNextClauseCode(
  organizationId: string,
  workspaceType: string,
): Promise<string> {
  const suffix = WORKSPACE_SUFFIX[workspaceType?.toLowerCase()] ?? "GN";
  const pattern = `WAI-%-${suffix}`;

  // Find the highest existing number for this suffix in this org
  const existing = await db
    .select({ code: clauses.code })
    .from(clauses)
    .where(
      and(
        eq(clauses.organizationId, organizationId),
        isNotNull(clauses.code),
        like(clauses.code, pattern),
      ),
    );

  let maxNum = 0;
  for (const row of existing) {
    if (!row.code) continue;
    const match = row.code.match(/^WAI-(\d+)-/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }

  const nextNum = String(maxNum + 1).padStart(3, "0");
  return `WAI-${nextNum}-${suffix}`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceType = searchParams.get("workspaceType") || "general";

    const resolved = await resolveActiveWorkspaceContext();
    if (!resolved.ok) {
      return NextResponse.json(
        { error: resolved.error },
        { status: resolved.status },
      );
    }

    const { context } = resolved;
    const code = await generateNextClauseCode(
      context.organizationId,
      workspaceType,
    );
    return NextResponse.json({ code });
  } catch (error) {
    console.error("[Auto-Code API] Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
