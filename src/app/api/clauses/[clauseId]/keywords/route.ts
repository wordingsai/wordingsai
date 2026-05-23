import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { clauses } from "@/db/schema";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import {
  assertWorkspaceMutable,
  resolveActiveWorkspaceContext,
} from "@/server/workspace-resolver";
import { assertClauseEditable } from "@/lib/clause-library-access";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<any> },
) {
  try {
    const sessionData = await auth.api.getSession({ headers: await headers() });
    if (!sessionData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { clauseId } = await params;
    const { keywords } = await req.json();

    if (!Array.isArray(keywords)) {
      return NextResponse.json(
        { error: "Invalid keywords array" },
        { status: 400 },
      );
    }

    const resolved = await resolveActiveWorkspaceContext();
    if (!resolved.ok) {
      return NextResponse.json(
        { error: resolved.error },
        { status: resolved.status },
      );
    }
    const { context } = resolved;

    const access = await assertClauseEditable(
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

    const [updated] = await db
      .update(clauses)
      .set({
        keywords,
        updatedAt: new Date(),
      })
      .where(eq(clauses.id, clauseId))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[PATCH keywords]", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
