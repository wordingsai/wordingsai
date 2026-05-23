import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { db } from "@/db/drizzle";
import { clauses, clauseVersions } from "@/db/schema";
import { auth } from "@/lib/auth";
import { and, eq, desc, or, isNull } from "drizzle-orm";
import {
  resolveActiveWorkspaceContext,
  assertWorkspaceMutable,
} from "@/server/workspace-resolver";
import {
  assertClauseReadable,
  isClauseEditableByOrg,
} from "@/lib/clause-library-access";

export async function GET(
  req: NextRequest,
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
      return NextResponse.json({ error: "Clause not found" }, { status: 404 });
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

    const isEditable = isClauseEditableByOrg(clause, context.organizationId);

    const versions = await db
      .select({
        versionNumber: clauseVersions.versionNumber,
        createdAt: clauseVersions.createdAt,
        changedByName: clauseVersions.changedByName,
        changeNote: clauseVersions.changeNote,
      })
      .from(clauseVersions)
      .where(eq(clauseVersions.clauseId, clauseId))
      .orderBy(desc(clauseVersions.versionNumber));

    const finalVersions =
      versions.length > 0
        ? versions
        : [
            {
              versionNumber: 1,
              createdAt: clause.createdAt,
              changedByName: clause.organizationId
                ? "Organization Super User"
                : "Global Library",
              changeNote: "Initial version",
            },
          ];

    return NextResponse.json({
      ...clause,
      isEditable,
      versions: finalVersions,
      creatorName: clause.organizationId
        ? "Organization Super User"
        : "Global Library",
      creatorPfp: null,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function PUT(
  req: NextRequest,
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
    const body = await req.json();

    const {
      clauseName,
      category,
      clauseText,
      heading,
      source,
      library,
      status,
    } = body;

    const [clause] = await db
      .select()
      .from(clauses)
      .where(
        and(
          eq(clauses.id, clauseId),
          eq(clauses.organizationId, context.organizationId),
        ),
      );

    if (!clause) {
      return NextResponse.json({ error: "Clause not found" }, { status: 404 });
    }

    return await db.transaction(async (tx) => {
      const [latestVersion] = await tx
        .select({ versionNumber: clauseVersions.versionNumber })
        .from(clauseVersions)
        .where(eq(clauseVersions.clauseId, clauseId))
        .orderBy(desc(clauseVersions.versionNumber))
        .limit(1);

      const newVersionNumber = (latestVersion?.versionNumber ?? 0) + 1;

      await tx.insert(clauseVersions).values({
        clauseId,
        versionNumber: newVersionNumber,
        clauseText,
        heading,
        source,
        changedByName: sessionData.user.name || "System",
        changeNote: body.changeNote || "Updated via API",
      });

      const [updatedClause] = await tx
        .update(clauses)
        .set({
          clauseName,
          category,
          clauseText,
          heading,
          source,
          library,
          ...(status && {
            status: status as "Approved" | "Not Approved",
            approvalStatus: status as "Approved" | "Not Approved",
          }),
          updatedAt: new Date(),
        })
        .where(eq(clauses.id, clauseId))
        .returning();

      return NextResponse.json(updatedClause);
    });
  } catch (error) {
    console.error("Error updating clause:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
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

    const [clause] = await db
      .select()
      .from(clauses)
      .where(
        and(
          eq(clauses.id, clauseId),
          eq(clauses.organizationId, context.organizationId),
        ),
      );

    if (!clause) {
      return NextResponse.json({ error: "Clause not found" }, { status: 404 });
    }

    if (clause.isGlobal) {
      return NextResponse.json(
        { error: "Cannot delete global (Standard) library clauses." },
        { status: 403 },
      );
    }

    await db.delete(clauses).where(eq(clauses.id, clauseId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting clause:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
