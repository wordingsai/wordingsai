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
import { generateNextClauseCode } from "@/app/api/clauses/auto-code/route";
import { requireCustomizationPlan } from "@/server/subscription";
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

    // Saving a clause to the library is a customization feature: Intelligence
    // or Plus only, Fast is read-only.
    const access = await requireCustomizationPlan(sessionData.user.id);
    if (!access.ok) {
      return NextResponse.json(
        {
          error:
            "Access Denied: saving clauses requires the Intelligence or Plus plan.",
        },
        { status: 403 },
      );
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
      // When the caller marks isPrivate (or scope === "user"), the new
      // clause is stored as a user-private "Custom" clause: only the
      // saving user sees it. This is the path the "Save detected clause to
      // my library" prompt on the contract page uses.
      const isPrivate =
        body.isPrivate === true ||
        body.scope === "user" ||
        body.scope === "private";
      const ownerUserId =
        !isGlobalClause && isPrivate ? sessionData.user.id : null;

      // Every clause needs a reference. Core (global) clauses carry their
      // real market code; a clause saved from a contract is bespoke, so it
      // gets the next auto WAI-NNN reference for the org (matching the
      // custom-library convention). Best-effort: never block the save if
      // code generation fails.
      let code: string | undefined;
      if (!isGlobalClause) {
        try {
          code = await generateNextClauseCode(context.organizationId);
        } catch (e) {
          console.warn("[UpdateLibrary] code generation failed:", e);
        }
      }

      const [newClause] = await db
        .insert(clauses)
        .values({
          organizationId: isGlobalClause ? null : context.organizationId,
          workspaceId: isGlobalClause ? null : context.workspaceId,
          ownerUserId,
          clauseName,
          clauseText,
          category: category || "Other",
          library: library || (isPrivate ? "My custom library" : "Custom"),
          status: "Approved",
          approvalStatus: "Approved",
          isGlobal: isGlobalClause,
          code: code || null,
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
