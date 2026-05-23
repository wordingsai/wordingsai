"use server";

import { headers } from "next/headers";
import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/drizzle";
import { workspaceAccess, workspaces } from "@/db/schema";
import { canAccessWorkspace, getActiveWorkspace } from "@/server/workspaces";

export type ResolvedWorkspaceContext = {
  userId: string;
  organizationId: string;
  workspaceId: string;
  workspace: typeof workspaces.$inferSelect;
};

export async function resolveActiveWorkspaceContext(): Promise<
  | { ok: true; context: ResolvedWorkspaceContext }
  | { ok: false; status: number; error: string }
> {
  const sessionData = await auth.api.getSession({ headers: await headers() });
  if (!sessionData?.user) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const session = sessionData.session as any;
  const organizationId = session?.activeOrganizationId as string | undefined;
  const workspaceId = session?.activeWorkspaceId as string | undefined;

  if (!organizationId) {
    return { ok: false, status: 403, error: "No active organization" };
  }

  // If no workspaceId in session, fetch one
  let resolvedWorkspaceId = workspaceId;
  if (!resolvedWorkspaceId) {
    const activeWorkspace = await getActiveWorkspace(
      sessionData.user.id,
      organizationId,
      null,
    );
    if (activeWorkspace) {
      resolvedWorkspaceId = activeWorkspace.id;
    }
  }

  if (!resolvedWorkspaceId) {
    return { ok: false, status: 400, error: "No active workspace" };
  }

  const hasAccess = await canAccessWorkspace(
    sessionData.user.id,
    organizationId,
    resolvedWorkspaceId,
  );
  if (!hasAccess) {
    return { ok: false, status: 403, error: "Workspace access denied" };
  }

  // Add retry logic for DB query to handle transient connection terminations
  let workspace = null;
  for (let i = 0; i < 3; i++) {
    try {
      const [res] = await db
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, resolvedWorkspaceId))
        .limit(1);
      workspace = res;
      if (workspace) break;
    } catch (err: any) {
      if (err.message?.includes("Connection terminated") && i < 2) {
        console.warn(
          `[Workspace Resolver] Connection terminated. Retrying... ${i + 1}`,
        );
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      throw err;
    }
  }

  if (!workspace) {
    return { ok: false, status: 404, error: "Active workspace not found" };
  }

  return {
    ok: true,
    context: {
      userId: sessionData.user.id,
      organizationId,
      workspaceId: resolvedWorkspaceId,
      workspace,
    },
  };
}

export async function assertWorkspaceMutable(
  context: ResolvedWorkspaceContext,
): Promise<
  | {
      ok: true;
    }
  | { ok: false; status: number; error: string }
> {
  if (context.workspace.isGlobal) {
    return {
      ok: false,
      status: 403,
      error: "Global workspaces are read-only",
    };
  }
  return { ok: true };
}

/**
 * If the active workspace is global (read-only), returns an org-owned mutable
 * workspace to write into. Creates one if the org has none.
 *
 * This enables "create private content while browsing global workspace"
 * without ever linking org-private data into a global workspace junction table.
 */
export async function getOrCreateOrgMutableWorkspace(params: {
  userId: string;
  organizationId: string;
  preferredType?: string | null;
}): Promise<
  | { ok: true; workspaceId: string; created?: boolean }
  | { ok: false; status: number; error: string }
> {
  const { userId, organizationId, preferredType } = params;

  // 1) Prefer an existing non-global workspace in this org (optionally same type)
  const baseWhere = [
    eq(workspaces.organizationId, organizationId),
    eq(workspaces.isGlobal, false),
    eq(workspaceAccess.userId, userId),
  ] as const;

  const typedWhere = preferredType
    ? and(...baseWhere, eq(workspaces.type, preferredType))
    : and(...baseWhere);

  const existing = await db
    .select({
      id: workspaces.id,
      type: workspaces.type,
      name: workspaces.name,
    })
    .from(workspaces)
    .innerJoin(workspaceAccess, eq(workspaces.id, workspaceAccess.workspaceId))
    .where(typedWhere)
    .orderBy(asc(workspaces.name))
    .limit(1);

  if (existing[0]?.id) {
    return { ok: true, workspaceId: existing[0].id };
  }

  // 2) If no same-type workspace, fall back to *any* mutable workspace the user can access
  const anyMutable = await db
    .select({ id: workspaces.id, name: workspaces.name })
    .from(workspaces)
    .innerJoin(workspaceAccess, eq(workspaces.id, workspaceAccess.workspaceId))
    .where(
      and(
        eq(workspaces.organizationId, organizationId),
        eq(workspaces.isGlobal, false),
        eq(workspaceAccess.userId, userId),
      ),
    )
    .orderBy(asc(workspaces.name))
    .limit(1);

  if (anyMutable[0]?.id) {
    return { ok: true, workspaceId: anyMutable[0].id };
  }

  // 3) Create a new mutable workspace
  try {
    const type = preferredType || "reinsurance";
    const name = `Custom ${type}`.replace(/\s+/g, " ").trim();

    const [ws] = await db
      .insert(workspaces)
      .values({
        organizationId,
        name,
        type,
        isGlobal: false,
        mandatoryRegistry: [],
      })
      .returning();

    if (!ws?.id) {
      return {
        ok: false,
        status: 500,
        error: "Failed to create custom workspace",
      };
    }

    await db.insert(workspaceAccess).values({
      workspaceId: ws.id,
      userId,
      role: "admin",
    });

    return { ok: true, workspaceId: ws.id, created: true };
  } catch (e) {
    console.error("[Workspace Resolver] create mutable workspace failed:", e);
    return { ok: false, status: 500, error: "Failed to create workspace" };
  }
}
