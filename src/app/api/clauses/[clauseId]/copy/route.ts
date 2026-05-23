import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { db } from "@/db/drizzle";
import { clauses, clauseVersions, workspaceClauses } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { generateClauseAI } from "@/lib/ai";
import { inngest } from "@/inngest/client";
import { resolveActiveWorkspaceContext } from "@/server/workspace-resolver";
import { generateNextClauseCode } from "@/app/api/clauses/auto-code/route";
import { logActivity, createNotification } from "@/lib/activity-utils";

/**
 * POST /api/clauses/[clauseId]/copy
 * Creates a private, workspace-scoped copy of any clause (global or org-level)
 * for the current user's active workspace. The copy is fully editable and
 * isolated to this org+workspace — it does not leak to other workspaces.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clauseId: string }> },
) {
  try {
    const sessionData = await auth.api.getSession({ headers: await headers() });
    if (!sessionData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { clauseId } = await params;

    // Resolve workspace context
    const resolved = await resolveActiveWorkspaceContext();
    if (!resolved.ok) {
      return NextResponse.json(
        { error: resolved.error },
        { status: resolved.status },
      );
    }
    const { context } = resolved;

    // Fetch the source clause
    const [sourceClause] = await db
      .select()
      .from(clauses)
      .where(eq(clauses.id, clauseId))
      .limit(1);

    if (!sourceClause) {
      return NextResponse.json(
        { error: "Source clause not found" },
        { status: 404 },
      );
    }

    // Check this workspace doesn't already have a custom copy of this clause
    const existingCopy = await db
      .select({ id: clauses.id })
      .from(clauses)
      .where(
        and(
          eq(clauses.organizationId, context.organizationId),
          eq(clauses.workspaceId, context.workspaceId),
          eq(clauses.clauseName, `${sourceClause.clauseName} (Custom Copy)`),
        ),
      )
      .limit(1);

    if (existingCopy.length > 0) {
      return NextResponse.json(
        {
          error:
            "A custom copy of this clause already exists in this workspace.",
          existingId: existingCopy[0].id,
        },
        { status: 409 },
      );
    }

    // Resolve the workspace type for code generation
    const body = await req.json().catch(() => ({}));
    const workspaceType = body.workspaceType || "general";

    // Generate auto-code
    const code = await generateNextClauseCode(
      context.organizationId,
      workspaceType,
    );

    // Create the custom copy — scoped to org + workspace, never global
    const [newClause] = await db
      .insert(clauses)
      .values({
        organizationId: context.organizationId,
        workspaceId: context.workspaceId,
        isGlobal: false,
        clauseName: `${sourceClause.clauseName} (Custom Copy)`,
        category: sourceClause.category,
        clauseText: sourceClause.clauseText,
        heading: sourceClause.heading,
        source: sourceClause.source
          ? `${sourceClause.source} (Copy)`
          : "Custom Copy",
        library: "Custom",
        status: "Approved",
        approvalStatus: "Approved",
        keywords: sourceClause.keywords ?? [],
        code,
      })
      .returning();

    // Link to workspace junction table so it's visible only in this workspace
    await db.insert(workspaceClauses).values({
      workspaceId: context.workspaceId,
      clauseId: newClause.id,
    });

    // Log activity
    await logActivity({
      userId: context.userId,
      organizationId: context.organizationId,
      action: "created",
      entityType: "clause",
      entityId: newClause.id,
      entityName: newClause.clauseName,
    });

    await createNotification({
      userId: context.userId,
      organizationId: context.organizationId,
      title: "Custom Clause Created",
      message: `A custom copy "${newClause.clauseName}" (${code}) has been added to your workspace library.`,
      type: "success",
      link: `/clause-library/${newClause.id}`,
    });

    // Background: sync embeddings
    await inngest.send({
      name: "clause/sync",
      data: { clauseId: newClause.id },
    });

    // Background: generate AI insights
    generateClauseAI(sourceClause.clauseText)
      .then(async (aiData) => {
        await db
          .update(clauses)
          .set(aiData)
          .where(eq(clauses.id, newClause.id));
        await db.insert(clauseVersions).values({
          clauseId: newClause.id,
          versionNumber: 1,
          clauseText: sourceClause.clauseText,
          heading: sourceClause.heading,
          source: newClause.source,
          ...aiData,
          changedByName: "Custom Copy",
          changeNote: `Custom copy created from clause ${clauseId} with code ${code}`,
        });
      })
      .catch(console.error);

    return NextResponse.json(
      { id: newClause.id, code, clauseName: newClause.clauseName },
      { status: 201 },
    );
  } catch (error) {
    console.error("[Clause Copy API] Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
