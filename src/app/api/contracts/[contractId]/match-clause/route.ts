/**
 * POST /api/contracts/[contractId]/match-clause
 *
 * Persists a MANUAL clause match made from the Document Map ("map this contract
 * provision to a library clause"). The Document Map UI (document-structure.tsx)
 * POSTs { documentText, libraryClauseId, section } here after the user picks a
 * library clause in the Confirm Match modal.
 *
 * Previously this route did not exist, so the action always 404'd ("Failed to
 * save clause match"). It records the match as an `analysisEvents` row of
 * eventType "clause_detected" — the SAME store the foundational checklist writes
 * to (see runDocumentMapChecklistBatch) — with matchType "manual" so it is
 * distinguishable from automatic matches and shows up in the checklist with the
 * library code attached.
 */
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db/drizzle";
import { contracts, clauses, analysisEvents } from "@/db/schema";
import { auth } from "@/lib/auth";
import { eq, and, sql } from "drizzle-orm";
import { resolveActiveWorkspaceContext } from "@/server/workspace-resolver";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> },
) {
  const { contractId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const documentText: string | undefined = body?.documentText;
  const libraryClauseId: string | undefined = body?.libraryClauseId;
  const section: string | null = body?.section ?? null;

  if (!documentText?.trim() || !libraryClauseId) {
    return NextResponse.json(
      { error: "documentText and libraryClauseId are required" },
      { status: 400 },
    );
  }

  const workspaceContext = await resolveActiveWorkspaceContext();
  if (!workspaceContext.ok) {
    return NextResponse.json(
      { error: workspaceContext.error },
      { status: workspaceContext.status },
    );
  }
  const { organizationId, workspaceId } = workspaceContext.context;

  // Confirm the contract exists and belongs to the caller's organization.
  const [contract] = await db
    .select({ id: contracts.id, organizationId: contracts.organizationId })
    .from(contracts)
    .where(eq(contracts.id, contractId))
    .limit(1);

  if (!contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }
  if (contract.organizationId !== organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Resolve the library clause (must be visible to this org: global or owned).
  const [libraryClause] = await db
    .select({
      id: clauses.id,
      clauseName: clauses.clauseName,
      clauseText: clauses.clauseText,
      category: clauses.category,
      code: clauses.code,
      status: clauses.status,
      isGlobal: clauses.isGlobal,
      organizationId: clauses.organizationId,
    })
    .from(clauses)
    .where(eq(clauses.id, libraryClauseId))
    .limit(1);

  if (!libraryClause) {
    return NextResponse.json(
      { error: "Library clause not found" },
      { status: 404 },
    );
  }
  if (
    !libraryClause.isGlobal &&
    libraryClause.organizationId !== organizationId
  ) {
    return NextResponse.json(
      { error: "Library clause not accessible" },
      { status: 403 },
    );
  }

  const clauseName = section?.trim() || libraryClause.clauseName;

  // Remove any prior manual match for the same provision+contract so re-matching
  // overwrites cleanly (idempotent from the user's perspective).
  await db
    .delete(analysisEvents)
    .where(
      and(
        eq(analysisEvents.contractId, contractId),
        eq(analysisEvents.eventType, "clause_detected"),
        sql`${analysisEvents.metadata}->>'matchType' = 'manual'`,
        sql`${analysisEvents.metadata}->>'clauseName' = ${clauseName}`,
      ),
    );

  const [inserted] = await db
    .insert(analysisEvents)
    .values({
      contractId,
      workspaceId,
      organizationId,
      eventType: "clause_detected",
      status: "Matched",
      createdBy: session.user.id,
      metadata: {
        clauseName,
        category: libraryClause.category || "Contract Provision",
        documentText,
        documentTextSnippet: documentText.substring(0, 300),
        libraryStandard: libraryClause.clauseText || "",
        reasoning: `Manually matched to library clause ${
          libraryClause.code || libraryClause.clauseName
        } by reviewer.`,
        confidence: 1,
        clauseCode: libraryClause.code ?? null,
        libraryClauseId: libraryClause.id,
        approvalStatus: libraryClause.status ?? null,
        matchType: "manual",
        isGlobal: libraryClause.isGlobal,
      },
    })
    .returning({ id: analysisEvents.id });

  return NextResponse.json({
    ok: true,
    eventId: inserted?.id,
    libraryClauseName: libraryClause.clauseName,
    code: libraryClause.code ?? null,
    approvalStatus: libraryClause.status ?? null,
  });
}
