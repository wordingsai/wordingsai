/**
 * POST /api/evidence/[evidenceId]/match
 * Record a manual clause match override for evidence item
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { eq } from "drizzle-orm";
import { evidenceItems, evidenceClauseMatches } from "@/db/schema";
import { auth } from "@/lib/auth";
import { z } from "zod";

const matchOverrideSchema = z.object({
  libraryClauseId: z.string().uuid("Invalid clause ID"),
  reason: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ evidenceId: string }> },
) {
  try {
    // Verify authentication
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { evidenceId } = await params;
    const body = await request.json();
    const parsed = matchOverrideSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { libraryClauseId, reason } = parsed.data;

    // Get the evidence item
    const [evidence] = await db
      .select()
      .from(evidenceItems)
      .where(eq(evidenceItems.id, evidenceId));

    if (!evidence) {
      return NextResponse.json(
        { error: "Evidence item not found" },
        { status: 404 },
      );
    }

    // TODO: Verify user has permission to edit this evidence

    // Create or update the match
    const now = new Date();

    // Insert match record
    const [match] = await db
      .insert(evidenceClauseMatches)
      .values({
        evidenceItemId: evidenceId as any,
        libraryClauseId: libraryClauseId as any,
        matchConfidence: 1.0, // Manual match is 100% confident
        isManualOverride: true,
        overriddenBy: session.user.id,
        reason: reason || null,
        matchedAt: now,
        createdAt: now,
      })
      .returning();

    // Update the evidence item
    await db
      .update(evidenceItems)
      .set({
        libraryClauseId: libraryClauseId as any,
        matchConfidence: 1.0,
        isManuallyMatched: true,
        updatedAt: now,
      })
      .where(eq(evidenceItems.id, evidenceId));

    return NextResponse.json({
      success: true,
      evidenceId,
      libraryClauseId,
      matched: true,
      isManualOverride: true,
    });
  } catch (error) {
    console.error("[Evidence Match API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
