import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { db } from "@/db/drizzle";
import { clauses, clauseVersions, workspaceClauses } from "@/db/schema";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { generateClauseAI } from "@/lib/ai";
import { inngest } from "@/inngest/client";
import {
  assertWorkspaceMutable,
  getOrCreateOrgMutableWorkspace,
  resolveActiveWorkspaceContext,
} from "@/server/workspace-resolver";
import { requireCustomizationPlan } from "@/server/subscription";
import { logActivity, createNotification } from "@/lib/activity-utils";
import { fetchVisibleClausesForWorkspace } from "@/lib/clause-library-access";
import { generateNextClauseCode } from "@/app/api/clauses/auto-code/route";

type ClauseAIShape = {
  aiSummary: string | null;
  aiFavorability: string | null;
  aiRecommendedUse: string[];
  aiNote: string | null;
  aiGeneratedAt: Date | null;
  aiVersion: string | null;
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceIdParam = searchParams.get("workspaceId");

    const resolved = await resolveActiveWorkspaceContext();
    const context = resolved.ok ? resolved.context : null;
    const targetWorkspaceId = workspaceIdParam || context?.workspaceId;

    if (!targetWorkspaceId) {
      return NextResponse.json(
        { error: "Missing workspace context" },
        { status: 400 },
      );
    }

    if (!context?.organizationId) {
      return NextResponse.json(
        { error: "Missing organization context" },
        { status: 400 },
      );
    }

    // Pass the active userId so user-private "Custom" clauses are scoped
    // correctly: caller sees global + org-shared + their own private clauses,
    // and is blocked from seeing other users' private clauses in the same org.
    const uniqueClauses = await fetchVisibleClausesForWorkspace(
      context.organizationId,
      targetWorkspaceId,
      context.userId,
    );

    // PERF: encourage SWR-style caching on the browser. We never want a
    // stale clause to render after a write, so we set max-age=0 (always
    // revalidate) but allow stale-while-revalidate for 60s so repeat
    // page visits in the same session render instantly from cache while
    // a background refresh happens.
    return NextResponse.json(uniqueClauses, {
      headers: {
        "Cache-Control":
          "private, max-age=0, must-revalidate, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    console.error("[Clauses API] GET error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const sessionData = await auth.api.getSession({ headers: await headers() });
    if (!sessionData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Custom clauses are available from the Intelligence tier upward
    // (Intelligence + Plus). Only the read-only Fast tier is blocked.
    // Rules remain Plus-only (see /api/rules).
    const access = await requireCustomizationPlan(sessionData.user.id);
    if (!access.ok) {
      return NextResponse.json(
        {
          error:
            "Access Denied: adding clauses requires the Intelligence or Plus plan.",
        },
        { status: 403 },
      );
    }

    const contentType = req.headers.get("content-type") || "";
    const body = contentType.includes("multipart/form-data")
      ? Object.fromEntries(await req.formData())
      : await req.json();

    const clauseName = body.clauseName;
    const category = body.category;
    const clauseText = body.clauseText;
    const heading = body.heading || null;
    const source = body.source || null;
    const library = body.library;
    const status = body.status || "Approved";

    if (
      typeof clauseName !== "string" ||
      typeof category !== "string" ||
      typeof clauseText !== "string" ||
      typeof library !== "string"
    ) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
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
    const isGlobal = isPSA && body.isGlobal === true;
    // When body.isPrivate === true (or scope === "user"), the new clause is
    // stored as a user-private "Custom" clause: only the creating user sees
    // it, even other members of the same org can't. NULL ownerUserId keeps
    // the original org-shared behavior.
    const isPrivate =
      body.isPrivate === true || body.scope === "user" || body.scope === "private";
    const ownerUserId = !isGlobal && isPrivate ? sessionData.user.id : null;

    const targetWorkspaceId = context.workspaceId;
    const workspaceType = body.workspaceType || "general";

    // Auto-generate code for non-global org-scoped clauses
    let code: string | undefined;
    if (!isGlobal) {
      try {
        code = await generateNextClauseCode(
          context.organizationId,
          workspaceType,
        );
      } catch (e) {
        console.warn("[Clauses POST] Failed to generate code:", e);
      }
    }

    const [newClause] = await db
      .insert(clauses)
      .values({
        organizationId: isGlobal ? null : context.organizationId,
        workspaceId: isGlobal ? null : targetWorkspaceId,
        ownerUserId,
        isGlobal,
        clauseName,
        category: category as any,
        clauseText,
        heading,
        source,
        library,
        status: status as "Approved" | "Not Approved",
        approvalStatus: status as "Approved" | "Not Approved",
        code: code || null,
      })
      .returning();

    // Add link to workspace junction table
    await db.insert(workspaceClauses).values({
      workspaceId: targetWorkspaceId,
      clauseId: newClause.id,
    });

    // Activity and Notifications
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
      title: "New Clause Added",
      message: `The clause "${newClause.clauseName}" has been added to your library.`,
      type: "success",
      link: `/clause-library`,
    });

    // Trigger background sync for embeddings
    await inngest.send({
      name: "clause/sync",
      data: { clauseId: newClause.id },
    });

    let aiData: ClauseAIShape;
    try {
      const response = NextResponse.json(newClause, { status: 201 });

      generateClauseAI(clauseText)
        .then(async (aiData) => {
          await db
            .update(clauses)
            .set(aiData)
            .where(eq(clauses.id, newClause.id));

          await db.insert(clauseVersions).values({
            clauseId: newClause.id,
            versionNumber: 1,
            clauseText,
            heading,
            source,
            ...aiData,
            changedByName: context.organizationId
              ? "Organization Super User"
              : "Global Library",
            changeNote: "Initial version with AI insights",
          });
        })
        .catch(console.error);

      return response;
    } catch (aiError) {
      console.warn("AI generation failed, saving clause without AI:", aiError);
      aiData = {
        aiSummary: null,
        aiFavorability: null,
        aiRecommendedUse: [],
        aiNote: null,
        aiGeneratedAt: null,
        aiVersion: null,
      };
    }

    await db
      .update(clauses)
      .set({
        aiSummary: aiData.aiSummary,
        aiFavorability: aiData.aiFavorability,
        aiRecommendedUse: aiData.aiRecommendedUse,
        aiNote: aiData.aiNote,
        aiGeneratedAt: aiData.aiGeneratedAt,
        aiVersion: aiData.aiVersion,
      })
      .where(eq(clauses.id, newClause.id));

    await db.insert(clauseVersions).values({
      clauseId: newClause.id,
      versionNumber: 1,
      clauseText,
      heading,
      source,
      aiSummary: aiData.aiSummary,
      aiFavorability: aiData.aiFavorability,
      aiRecommendedUse: aiData.aiRecommendedUse,
      aiNote: aiData.aiNote,
      changedByName: context.organizationId
        ? "Organization Super User"
        : "Global Library",
      changeNote: "Initial version with AI insights",
    });

    const updatedClause = await db.query.clauses.findFirst({
      where: eq(clauses.id, newClause.id),
    });

    return NextResponse.json(updatedClause, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
