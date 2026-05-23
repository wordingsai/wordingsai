import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { db } from "@/db/drizzle";
import {
  rules,
  ruleVersions,
  organizationRuleSettings,
  workspaceRules,
  workspaces,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { eq, and, or, isNull } from "drizzle-orm";
import { requirePlusPlan } from "@/server/subscription";
import {
  assertWorkspaceMutable,
  getOrCreateOrgMutableWorkspace,
  resolveActiveWorkspaceContext,
} from "@/server/workspace-resolver";

export async function POST(req: NextRequest) {
  try {
    const sessionData = await auth.api.getSession({ headers: await headers() });
    if (!sessionData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const plus = await requirePlusPlan(sessionData.user.id);
    if (!plus.ok) {
      return NextResponse.json(
        { error: "Access Denied: Creating rules requires a Plus plan." },
        { status: 403 },
      );
    }

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
      typeof name !== "string" ||
      !category ||
      typeof category !== "string" ||
      !ruleDefinition ||
      typeof ruleDefinition !== "object" ||
      Array.isArray(ruleDefinition)
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid input: name, category, and ruleDefinition (object) are required",
        },
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
    const isGlobal = isPSA && rawBody.isGlobal === true;

    const targetWorkspaceId = context.workspaceId;

    const result = await db
      .insert(rules)
      .values({
        name,
        description: description || null,
        category,
        isGlobal,
        organizationId: isGlobal ? null : context.organizationId,
        // Workspace link moved to junction table
        status: "active",
        createdBy: sessionData.user.id ?? sessionData.user.email ?? "system",
      })
      .returning();

    if (!Array.isArray(result) || result.length === 0) {
      throw new Error("Failed to create rule");
    }
    const newRule = result[0];

    // Add link to workspace junction table
    await db.insert(workspaceRules).values({
      workspaceId: targetWorkspaceId,
      ruleId: newRule.id,
    });

    const versionResult = await db
      .insert(ruleVersions)
      .values({
        ruleId: newRule.id,
        versionNumber: 1,
        ruleDefinition,
      })
      .returning();

    if (!Array.isArray(versionResult) || versionResult.length === 0) {
      throw new Error("Failed to create rule version");
    }
    const newVersion = versionResult[0];

    await db
      .update(rules)
      .set({ currentVersionId: newVersion.id })
      .where(eq(rules.id, newRule.id));

    const createdRule = await db.query.rules.findFirst({
      where: eq(rules.id, newRule.id),
    });

    return NextResponse.json(createdRule, { status: 201 });
  } catch (error) {
    console.error("Error creating rule:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const sessionData = await auth.api.getSession({ headers: await headers() });
    if (!sessionData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const workspaceIdParam = searchParams.get("workspaceId");

    const resolved = await resolveActiveWorkspaceContext();
    const context = resolved.ok ? resolved.context : null;

    const targetWorkspaceId = workspaceIdParam || context?.workspaceId;
    if (!targetWorkspaceId) {
      return NextResponse.json(
        {
          error: !resolved.ok ? resolved.error : "Missing workspace context",
        },
        {
          status: !resolved.ok ? resolved.status : 400,
        },
      );
    }

    const isGlobalWorkspace = context?.workspace?.isGlobal ?? false;
    const workspaceType = context?.workspace?.type ?? null;

    // For global workspaces, show all rules linked to ANY global workspace of the same TYPE
    // This allows sharing of standard library rules across organizations.
    // For non-global workspaces, show org's rules AND system-wide global rules.
    const rulesList =
      isGlobalWorkspace && workspaceType
        ? await db
            .select({
              rule: {
                id: rules.id,
                name: rules.name,
                category: rules.category,
                status: rules.status,
                description: rules.description,
                isGlobal: rules.isGlobal,
                currentVersionId: rules.currentVersionId,
              },
              version: {
                id: ruleVersions.id,
                versionNumber: ruleVersions.versionNumber,
                // ruleDefinition is NOT fetched here as it's large
              },
            })
            .from(rules)
            .innerJoin(workspaceRules, eq(rules.id, workspaceRules.ruleId))
            .innerJoin(
              workspaces,
              eq(workspaceRules.workspaceId, workspaces.id),
            )
            .leftJoin(ruleVersions, eq(rules.currentVersionId, ruleVersions.id))
            .where(
              and(
                eq(workspaces.type, workspaceType),
                eq(workspaces.isGlobal, true),
              ),
            )
        : await db
            .select({
              rule: {
                id: rules.id,
                name: rules.name,
                category: rules.category,
                status: rules.status,
                description: rules.description,
                isGlobal: rules.isGlobal,
                currentVersionId: rules.currentVersionId,
              },
              version: {
                id: ruleVersions.id,
                versionNumber: ruleVersions.versionNumber,
                // ruleDefinition is NOT fetched here as it's large
              },
            })
            .from(rules)
            .innerJoin(workspaceRules, eq(rules.id, workspaceRules.ruleId))
            .leftJoin(ruleVersions, eq(rules.currentVersionId, ruleVersions.id))
            .where(
              and(
                eq(workspaceRules.workspaceId, targetWorkspaceId),
                or(
                  eq(rules.organizationId, context?.organizationId || ""),
                  eq(rules.isGlobal, true),
                ),
              ),
            );

    const rulesWithVersions = rulesList.map((row) => ({
      ...row.rule,
      currentVersion: row.version,
    }));

    const overrides = await db.query.organizationRuleSettings.findMany({
      where: eq(
        organizationRuleSettings.organizationId,
        context?.organizationId || "",
      ),
    });

    const overrideMap = new Map(overrides.map((o) => [o.ruleId, o.status]));

    const rulesWithOverride = rulesWithVersions.map((rule) => {
      const effectiveStatus = overrideMap.has(rule.id)
        ? overrideMap.get(rule.id)
        : rule.status;
      return { ...rule, status: effectiveStatus };
    });

    // Deduplicate rules by name to prevent duplicates from multiple global workspaces
    const uniqueRules = Array.from(
      new Map(rulesWithOverride.map((r) => [r.name, r])).values(),
    );

    return NextResponse.json(uniqueRules);
  } catch (error) {
    console.error("Error fetching rules:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
