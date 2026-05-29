import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { db } from "@/db/drizzle";
import { clauses } from "@/db/schema";
import { eq, and, like, isNotNull, sql } from "drizzle-orm";
import { resolveActiveWorkspaceContext } from "@/server/workspace-resolver";

/**
 * Generates the next available custom-clause reference for an org.
 *
 * Format: WAI-NNN (e.g. WAI-081), zero-padded to 3 digits, sequential per
 * organization. This matches the convention Richard already uses in his
 * custom library (WAI-001 .. WAI-080), so newly added custom clauses simply
 * continue the sequence. The market-standard core clauses keep their real
 * references (LSW, LMA, IUA, NMA) and never go through this generator.
 *
 * `workspaceType` is accepted for backwards-compatibility with existing
 * callers but no longer affects the code (we dropped the -RI/-PR suffix).
 */
export async function generateNextClauseCode(
  organizationId: string,
  _workspaceType?: string,
): Promise<string> {
  // Highest existing WAI-NNN number in this org.
  const existing = await db
    .select({ code: clauses.code })
    .from(clauses)
    .where(
      and(
        eq(clauses.organizationId, organizationId),
        isNotNull(clauses.code),
        like(clauses.code, "WAI-%"),
      ),
    );

  let maxNum = 0;
  for (const row of existing) {
    if (!row.code) continue;
    const match = row.code.match(/^WAI-(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }

  const nextNum = String(maxNum + 1).padStart(3, "0");
  return `WAI-${nextNum}`;
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
