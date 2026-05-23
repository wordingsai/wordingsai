/**
 * GET /api/contracts/[contractId]/evidence
 * Fetch structured evidence for a contract's rule evaluations
 * with clause library matching and hierarchical grouping
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { eq, and } from "drizzle-orm";
import { ruleResults, evidenceItems, contracts } from "@/db/schema";
import { auth } from "@/lib/auth";
import type { StructuredEvidenceResult } from "@/types/evidence";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contractId: string }> },
) {
  try {
    // Verify authentication
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { contractId } = await params;
    const { searchParams } = new URL(request.url);
    const ruleResultId = searchParams.get("ruleResultId");

    // Get contract to verify ownership and get organization
    const [contract] = await db
      .select()
      .from(contracts)
      .where(eq(contracts.id, contractId));

    if (!contract) {
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 },
      );
    }

    // TODO: Add workspace/organization permission check

    // Fetch rule results with evidence
    const conditions = [eq(ruleResults.contractId, contractId)];
    if (ruleResultId) {
      conditions.push(eq(ruleResults.id, ruleResultId));
    }

    const results = await db
      .select()
      .from(ruleResults)
      .where(and(...conditions))
      .limit(100);

    // Fetch evidence items for each result
    const resultsWithEvidence = await Promise.all(
      results.map(async (result) => {
        const items = await db
          .select()
          .from(evidenceItems)
          .where(eq(evidenceItems.ruleResultId, result.id));

        // Group by section
        const groupMap = new Map<string, typeof items>();
        items.forEach((item) => {
          if (!groupMap.has(item.section)) {
            groupMap.set(item.section, []);
          }
          groupMap.get(item.section)!.push(item);
        });

        const groupedEvidence = Array.from(groupMap.entries()).map(
          ([section, sectionItems]) => ({
            section,
            items: sectionItems.map((item) => ({
              id: item.id,
              section: item.section,
              clauseType: item.clauseType,
              text: item.text,
              libraryClauseId: item.libraryClauseId,
              matchConfidence: item.matchConfidence ?? 0,
              isManuallyMatched: item.isManuallyMatched ?? false,
              source: {
                chunk: item.sourceChunk || "",
                position: item.sourcePosition ?? 0,
                fileName: item.sourceFileName,
              },
              similarity: item.similarity,
              metadata: {
                extractedAt: item.createdAt?.toISOString(),
                matchedAt: item.updatedAt?.toISOString(),
              },
            })),
            count: sectionItems.length,
          }),
        );

        // Calculate statistics
        const totalEvidence = items.length;
        const matchedCount = items.filter((i) => i.libraryClauseId).length;
        const manualCount = items.filter((i) => i.isManuallyMatched).length;
        const avgConfidence =
          totalEvidence > 0
            ? items.reduce((sum, i) => sum + (i.matchConfidence ?? 0), 0) /
              totalEvidence
            : 0;

        const structured: StructuredEvidenceResult = {
          ruleId: result.ruleId || "",
          contractId: result.contractId || "",
          status: (result.status as any) || "Amber",
          reasoning: result.reasoning || "",
          confidence: result.confidence || undefined,
          detectedBias: result.bias,
          allEvidence: items.map((item) => ({
            id: item.id || "",
            section: item.section,
            clauseType: item.clauseType,
            text: item.text,
            libraryClauseId: item.libraryClauseId,
            matchConfidence: item.matchConfidence ?? 0,
            isManuallyMatched: item.isManuallyMatched ?? false,
            source: {
              chunk: item.sourceChunk || "",
              position: item.sourcePosition ?? 0,
              fileName: item.sourceFileName,
            },
            similarity: item.similarity,
            metadata: {
              extractedAt: item.createdAt?.toISOString(),
              matchedAt: item.updatedAt?.toISOString(),
            },
          })),
          groupedEvidence,
          statistics: {
            totalEvidence,
            totalSections: groupMap.size,
            matchedToLibrary: matchedCount,
            manuallyMatched: manualCount,
            averageConfidence: avgConfidence,
          },
          evaluatedAt:
            result.evaluatedAt?.toISOString() || new Date().toISOString(),
          ruleVersionId: result.ruleVersionId,
        };

        return structured;
      }),
    );

    return NextResponse.json({
      contractId,
      evidenceResults: resultsWithEvidence,
      total: resultsWithEvidence.length,
    });
  } catch (error) {
    console.error("[Evidence API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
