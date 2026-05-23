import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { clauses, clauseVersions, workspaceClauses } from "@/db/schema";
import { auth } from "@/lib/auth";
import { eq, and, sql } from "drizzle-orm";
import { inngest } from "@/inngest/client";
import {
  assertWorkspaceMutable,
  resolveActiveWorkspaceContext,
} from "@/server/workspace-resolver";
import { embedSingleClause } from "@/lib/chunk";
import { GoogleGenerativeAI } from "@google/generative-ai";

async function runClauseEnrichment(clauseId: string) {
  try {
    const [clause] = await db
      .select({
        id: clauses.id,
        clauseText: clauses.clauseText,
        library: clauses.library,
        category: clauses.category,
      })
      .from(clauses)
      .where(eq(clauses.id, clauseId));
    if (!clause) return;

    // 2. AI Enrichment (Simplified)
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_FAST_API_KEY!);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite-preview",
    });
    const prompt = `Analyze this clause: ${clause.clauseText}. Return summary, favorability (vendor/customer/neutral), recommendedUse (array), note. JSON format.`;

    const result = await model.generateContent(prompt);
    const parsed = JSON.parse(result.response.text());

    await db.transaction(async (tx) => {
      await tx
        .update(clauses)
        .set({
          aiSummary: parsed.summary,
          aiFavorability: parsed.favorability,
          aiRecommendedUse: parsed.recommendedUse,
          aiNote: parsed.note,
          updatedAt: new Date(),
        })
        .where(eq(clauses.id, clauseId));
    });

    await embedSingleClause(clauseId);
  } catch (err) {
    console.error(`[Enrichment] Failed for ${clauseId}:`, err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> },
) {
  try {
    const { contractId } = await params;
    const sessionData = await auth.api.getSession({ headers: await headers() });
    if (!sessionData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { clauseName, clauseText, category, library } = body;

    if (!clauseName || !clauseText) {
      return NextResponse.json(
        { error: "Missing required fields" },
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

    const isPSA = (sessionData.session as any).role === "psa";
    const isGlobalClause = isPSA && library === "Standard";

    const existing = await db.query.clauses.findFirst({
      columns: { id: true },
      where: and(
        eq(clauses.organizationId, context.organizationId),
        eq(clauses.clauseName, clauseName),
        eq(clauses.isGlobal, isGlobalClause),
      ),
    });

    let targetId: string;

    if (existing) {
      targetId = existing.id;
      await db
        .update(clauses)
        .set({
          clauseText,
          updatedAt: new Date(),
        })
        .where(eq(clauses.id, targetId));

      const [latestVersion] = await db
        .select({ num: clauseVersions.versionNumber })
        .from(clauseVersions)
        .where(eq(clauseVersions.clauseId, targetId))
        .orderBy(sql`version_number desc`)
        .limit(1);

      await db.insert(clauseVersions).values({
        clauseId: targetId,
        versionNumber: (latestVersion?.num || 0) + 1,
        clauseText,
        changedByName: sessionData.user.name || "System",
        changeNote: `Updated from contract analysis (${contractId})`,
      });
    } else {
      const [newClause] = await db
        .insert(clauses)
        .values({
          organizationId: isGlobalClause ? null : context.organizationId,
          workspaceId: isGlobalClause ? null : context.workspaceId,
          clauseName,
          clauseText,
          category: category || "Other",
          library: library || "Custom",
          status: "Approved",
          approvalStatus: "Approved",
          isGlobal: isGlobalClause,
        })
        .returning();

      targetId = newClause.id;

      if (!isGlobalClause) {
        await db.insert(workspaceClauses).values({
          workspaceId: context.workspaceId,
          clauseId: targetId,
        });
      }

      await db.insert(clauseVersions).values({
        clauseId: targetId,
        versionNumber: 1,
        clauseText,
        changedByName: sessionData.user.name || "System",
        changeNote: `Created from contract analysis (${contractId})`,
      });
    }

    await inngest.send({
      name: "clause/sync",
      data: { clauseId: targetId },
    });

    await runClauseEnrichment(targetId);

    return NextResponse.json({ success: true, clauseId: targetId });
  } catch (error) {
    console.error("[UpdateLibrary] Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
