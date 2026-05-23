import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";

import { db } from "@/db/drizzle";
import { rules, ruleVersions, workspaceRules } from "@/db/schema";
import { auth } from "@/lib/auth";
import { eq, and, or, isNull } from "drizzle-orm";
import { requirePlusPlan } from "@/server/subscription";
import {
  assertWorkspaceMutable,
  resolveActiveWorkspaceContext,
} from "@/server/workspace-resolver";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ruleId: string }> },
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
    const { ruleId } = await params;

    if (ruleId === "new") {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    const isPSA = (sessionData.session as any).role === "psa";

    // Use db.query to fetch rule with currentVersion for the frontend
    const rule = await db.query.rules.findFirst({
      where: and(
        eq(rules.id, ruleId),
        or(
          eq(rules.organizationId, context.organizationId),
          eq(rules.isGlobal, true),
        ),
      ),
      with: {
        currentVersion: true,
      },
    });

    if (!rule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...rule,
      isEditable: !context.workspace.isGlobal,
    });
  } catch (error) {
    console.error("Error fetching rule:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ ruleId: string }> },
) {
  try {
    const sessionData = await auth.api.getSession({ headers: await headers() });
    if (!sessionData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const plus = await requirePlusPlan(sessionData.user.id);
    if (!plus.ok) {
      return NextResponse.json(
        { error: "Access Denied: Editing rules requires a Plus plan." },
        { status: 403 },
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
    const mutable = await assertWorkspaceMutable(context);
    if (!mutable.ok) {
      return NextResponse.json(
        { error: mutable.error },
        { status: mutable.status },
      );
    }

    const { ruleId } = await params;
    const contentType = req.headers.get("content-type") || "";
    const rawBody = contentType.includes("multipart/form-data")
      ? Object.fromEntries(await req.formData())
      : await req.json();

    const name = typeof rawBody.name === "string" ? rawBody.name.trim() : "";
    const description =
      typeof rawBody.description === "string"
        ? rawBody.description.trim()
        : null;
    const category =
      typeof rawBody.category === "string" ? rawBody.category.trim() : "";
    let ruleDefinition = rawBody.ruleDefinition;

    if (typeof ruleDefinition === "string") {
      try {
        ruleDefinition = JSON.parse(ruleDefinition);
      } catch {
        ruleDefinition = null;
      }
    }

    if (
      !name ||
      !category ||
      !ruleDefinition ||
      typeof ruleDefinition !== "object" ||
      Array.isArray(ruleDefinition)
    ) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const isPSA = (sessionData.session as any).role === "psa";

    const ruleRows = await db
      .select()
      .from(rules)
      .innerJoin(workspaceRules, eq(rules.id, workspaceRules.ruleId))
      .leftJoin(ruleVersions, eq(rules.currentVersionId, ruleVersions.id))
      .where(
        and(
          eq(rules.id, ruleId),
          or(
            eq(rules.organizationId, context.organizationId),
            and(eq(rules.isGlobal, true), isNull(rules.organizationId)),
          ),
          eq(workspaceRules.workspaceId, context.workspaceId),
        ),
      );
    const ruleRow = ruleRows[0];

    if (!ruleRow) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    // Creating a new rule version
    const newVersionNumber = ruleRow.rule_versions
      ? ruleRow.rule_versions.versionNumber + 1
      : 1;

    const versionResult = await db
      .insert(ruleVersions)
      .values({
        ruleId,
        versionNumber: newVersionNumber,
        ruleDefinition,
      })
      .returning();

    if (!Array.isArray(versionResult) || versionResult.length === 0) {
      throw new Error("Failed to create new rule version");
    }
    const newVersion = versionResult[0];

    await db
      .update(rules)
      .set({
        name,
        description: description || null,
        category,
        currentVersionId: newVersion.id,
        updatedAt: new Date(),
      })
      .where(eq(rules.id, ruleId));

    const updatedRule = await db.query.rules.findFirst({
      where: eq(rules.id, ruleId),
    });

    return NextResponse.json({ success: true, rule: updatedRule });
  } catch (error) {
    console.error("Error updating rule:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ ruleId: string }> },
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
    const mutable = await assertWorkspaceMutable(context);
    if (!mutable.ok) {
      return NextResponse.json(
        { error: mutable.error },
        { status: mutable.status },
      );
    }

    const { ruleId } = await params;

    const [rule] = await db
      .select()
      .from(rules)
      .where(
        and(
          eq(rules.id, ruleId),
          eq(rules.organizationId, context.organizationId),
          eq(rules.workspaceId, context.workspaceId),
        ),
      )
      .limit(1);

    if (!rule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    await db.delete(rules).where(eq(rules.id, ruleId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting rule:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
