/**
 * POST /api/clauses/match
 * Match a document clause text to library clauses
 * Returns ranked matches with confidence scores
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { matchClauseToLibrary } from "@/services/clause-matching";
import { z } from "zod";
import { resolveActiveWorkspaceContext } from "@/server/workspace-resolver";

const matchRequestSchema = z.object({
  text: z.string().min(1, "Clause text required"),
  section: z.string().optional(),
  clauseTypeHint: z.string().optional(),
  topN: z.number().int().min(1).max(10).optional(),
  minConfidence: z.number().min(0).max(1).optional(),
  workspaceId: z.string().optional(), // Allow explicit workspaceId, though we usually resolve from session
});

export async function POST(request: NextRequest) {
  try {
    const workspaceRes = await resolveActiveWorkspaceContext();
    if (!workspaceRes.ok) {
      return NextResponse.json(
        { error: workspaceRes.error },
        { status: workspaceRes.status },
      );
    }

    const { organizationId, workspaceId: resolvedWorkspaceId } =
      workspaceRes.context;

    const body = await request.json();
    const parsed = matchRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const {
      text,
      section,
      clauseTypeHint,
      topN = 5,
      minConfidence = 0.5,
      workspaceId: providedWorkspaceId,
    } = parsed.data;

    // Use provided workspaceId if available (for cross-workspace tools), otherwise use resolved one
    const targetWorkspaceId = providedWorkspaceId || resolvedWorkspaceId;

    const result = await matchClauseToLibrary(
      {
        documentClauseText: text,
        section,
        clauseTypeHint,
        topN,
        minConfidence,
      },
      organizationId,
      targetWorkspaceId,
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Clause Match API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
