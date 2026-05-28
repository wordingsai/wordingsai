/**
 * GET /api/clauses/[clauseId]/versions
 *
 * Returns the full revision history for a clause, including the full
 * clauseText snapshot per version so the client can diff two versions
 * side-by-side without further round-trips.
 *
 * The lighter version list embedded in GET /api/clauses/[clauseId]
 * intentionally omits clauseText to keep the main payload small; this
 * endpoint is only hit when the user opens the "Full Differential View".
 */

import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { clauseVersions } from "@/db/schema";
import { auth } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";
import {
  resolveActiveWorkspaceContext,
} from "@/server/workspace-resolver";
import { assertClauseReadable } from "@/lib/clause-library-access";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clauseId: string }> },
) {
  try {
    const sessionData = await auth.api.getSession({ headers: await headers() });
    if (!sessionData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolved = await resolveActiveWorkspaceContext();
    if (!resolved.ok) {
      return NextResponse.json(
        { error: resolved.error },
        { status: resolved.status },
      );
    }
    const { context } = resolved;
    const { clauseId } = await params;

    if (clauseId === "new") {
      return NextResponse.json([]);
    }

    const access = await assertClauseReadable(
      clauseId,
      context.organizationId,
      context.workspaceId,
    );
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }
    const clause = access.clause;

    const rows = await db
      .select({
        versionNumber: clauseVersions.versionNumber,
        clauseText: clauseVersions.clauseText,
        heading: clauseVersions.heading,
        source: clauseVersions.source,
        changedByName: clauseVersions.changedByName,
        changeNote: clauseVersions.changeNote,
        createdAt: clauseVersions.createdAt,
      })
      .from(clauseVersions)
      .where(eq(clauseVersions.clauseId, clauseId))
      .orderBy(desc(clauseVersions.versionNumber));

    // Older rows historically lacked a version row; synthesise a v1 from
    // the live clause so the timeline doesn't appear empty.
    const synthesised = rows.length
      ? rows
      : [
          {
            versionNumber: 1,
            clauseText: clause.clauseText,
            heading: clause.heading ?? null,
            source: clause.source ?? null,
            changedByName: clause.organizationId
              ? "Organization Super User"
              : "Global Library",
            changeNote: "Initial version",
            createdAt: clause.createdAt,
          },
        ];

    // Reshape to the snake-ish format the client UI expects.
    const latestVersionNumber = synthesised[0]?.versionNumber ?? 0;
    return NextResponse.json(
      synthesised.map((v) => ({
        version: `v${v.versionNumber}`,
        versionNumber: v.versionNumber,
        isActive: v.versionNumber === latestVersionNumber,
        updatedAt:
          v.createdAt instanceof Date
            ? v.createdAt.toISOString()
            : (v.createdAt as unknown as string),
        changeSummary: v.changeNote ?? "",
        modifiedBy: v.changedByName ?? "",
        clauseText: v.clauseText ?? "",
        heading: v.heading,
        source: v.source,
      })),
    );
  } catch (err) {
    console.error("[Clause Versions API] GET error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
