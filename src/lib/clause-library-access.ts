import { db } from "@/db/drizzle";
import { clauses, workspaceClauses, workspaces } from "@/db/schema";
import { and, eq, or, sql, isNull } from "drizzle-orm";

/** Platform seed org — Custom library rows here are private to this org only. */
export const MASTER_CLAUSE_ORG_ID =
  process.env.MASTER_CLAUSE_ORG_ID ?? "c7BkNsHuGpIKHyEcrmgbySSP76uExuwf";

export type ClauseAccessRow = {
  id: string;
  organizationId: string | null;
  isGlobal: boolean | null;
  library?: string | null;
  /**
   * When set, the clause is private to that user (a "Custom" clause they
   * added themselves). Other org members cannot see it.
   * When null, the clause is org-scoped or global per the other flags.
   */
  ownerUserId?: string | null;
};

/**
 * Whether a user may read this clause in the library or during analysis.
 *
 * Rules (in order):
 *  - Platform-global clauses (isGlobal=true) are readable by everyone.
 *  - A clause owned by a specific user (ownerUserId != null) is readable
 *    ONLY by that user. Even other members of the same org cannot see it.
 *  - Otherwise, the clause must belong to the same org as the reader.
 */
export function isClauseReadableByUser(
  clause: ClauseAccessRow,
  organizationId: string,
  userId: string | null,
): boolean {
  if (clause.isGlobal) return true;
  if (clause.ownerUserId) {
    return clause.ownerUserId === userId;
  }
  if (!clause.organizationId) return false;
  return clause.organizationId === organizationId;
}

/** Back-compat shim: org-scoped read check (does not enforce per-user privacy). */
export function isClauseReadableByOrg(
  clause: ClauseAccessRow,
  organizationId: string,
): boolean {
  if (clause.isGlobal) return true;
  if (!clause.organizationId) return false;
  return clause.organizationId === organizationId;
}

/** Whether the user may edit/delete this clause. */
export function isClauseEditableByUser(
  clause: ClauseAccessRow,
  organizationId: string,
  userId: string | null,
): boolean {
  if (clause.isGlobal) return false;
  // A user-owned custom clause is editable only by that user.
  if (clause.ownerUserId) return clause.ownerUserId === userId;
  return clause.organizationId === organizationId;
}

/** Back-compat shim. */
export function isClauseEditableByOrg(
  clause: ClauseAccessRow,
  organizationId: string,
): boolean {
  if (clause.isGlobal) return false;
  return clause.organizationId === organizationId;
}

function dedupeById<T extends { id: string }>(rows: T[]): T[] {
  return Array.from(new Map(rows.map((r) => [r.id, r])).values());
}

/**
 * All clauses visible in the library for the active org + workspace + user.
 *
 * Visibility tiers (in order):
 *  1. Platform global Core (clauses.isGlobal = true) — visible to everyone.
 *  2. Org-shared clauses (organizationId = active org, ownerUserId IS NULL)
 *     — visible to all members of the org.
 *  3. User-private "Custom" clauses (organizationId = active org,
 *     ownerUserId = current user) — visible ONLY to that user.
 *
 *  Workspace-linked rows from other orgs are excluded. Other users' custom
 *  clauses in the same org are also excluded (privacy).
 *
 * `userId` may be null in cases where we're computing a workspace-wide
 * library for matching (e.g. global core workspace lookups). In that case
 * we just return the visible-to-org set and skip per-user filtering.
 */
export async function fetchVisibleClausesForWorkspace(
  organizationId: string,
  workspaceId: string,
  userId: string | null = null,
) {
  const workspaceRes = await db
    .select({ type: workspaces.type, isGlobal: workspaces.isGlobal })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  const isGlobalWorkspace = workspaceRes[0]?.isGlobal ?? false;
  const workspaceType = workspaceRes[0]?.type ?? null;

  let results: any[] = [];

  if (isGlobalWorkspace && workspaceType) {
    results = await db
      .select({
        clause: {
          id: clauses.id,
          organizationId: clauses.organizationId,
          workspaceId: clauses.workspaceId,
          isGlobal: clauses.isGlobal,
          ownerUserId: clauses.ownerUserId,
          clauseName: clauses.clauseName,
          category: clauses.category,
          status: clauses.status,
          approvalStatus: clauses.approvalStatus,
          library: clauses.library,
          code: clauses.code,
          source: clauses.source,
          // Display fields the library list + inline expand need (wording,
          // heading, keywords, AI insight). Omitting these left the expanded
          // clause panel blank.
          clauseText: clauses.clauseText,
          heading: clauses.heading,
          keywords: clauses.keywords,
          aiSummary: clauses.aiSummary,
          aiFavorability: clauses.aiFavorability,
          aiRecommendedUse: clauses.aiRecommendedUse,
          aiNote: clauses.aiNote,
          createdAt: clauses.createdAt,
          updatedAt: clauses.updatedAt,
        },
      })
      .from(clauses)
      .innerJoin(workspaceClauses, eq(clauses.id, workspaceClauses.clauseId))
      .innerJoin(workspaces, eq(workspaceClauses.workspaceId, workspaces.id))
      .where(
        and(eq(workspaces.type, workspaceType), eq(workspaces.isGlobal, true)),
      );
  } else {
    results = await db
      .select({
        clause: {
          id: clauses.id,
          organizationId: clauses.organizationId,
          workspaceId: clauses.workspaceId,
          isGlobal: clauses.isGlobal,
          ownerUserId: clauses.ownerUserId,
          clauseName: clauses.clauseName,
          category: clauses.category,
          status: clauses.status,
          approvalStatus: clauses.approvalStatus,
          library: clauses.library,
          code: clauses.code,
          source: clauses.source,
          // Display fields the library list + inline expand need (wording,
          // heading, keywords, AI insight). Omitting these left the expanded
          // clause panel blank.
          clauseText: clauses.clauseText,
          heading: clauses.heading,
          keywords: clauses.keywords,
          aiSummary: clauses.aiSummary,
          aiFavorability: clauses.aiFavorability,
          aiRecommendedUse: clauses.aiRecommendedUse,
          aiNote: clauses.aiNote,
          createdAt: clauses.createdAt,
          updatedAt: clauses.updatedAt,
        },
      })
      .from(clauses)
      .leftJoin(workspaceClauses, eq(clauses.id, workspaceClauses.clauseId))
      .where(
        or(
          eq(clauses.isGlobal, true),
          and(
            eq(clauses.organizationId, organizationId),
            or(
              eq(clauses.workspaceId, workspaceId),
              eq(workspaceClauses.workspaceId, workspaceId),
              and(
                sql`${clauses.workspaceId} IS NULL`,
                sql`${workspaceClauses.workspaceId} IS NULL`,
              ),
            ),
          ),
        ),
      );
  }

  // Deduplicate and apply per-user privacy filter.
  const seen = new Set();
  const visibleClauses = results
    .map((r) => r.clause)
    .filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      // If we have a userId, enforce per-user privacy (hides other users'
      // custom clauses). If not, fall back to org-scoped visibility.
      return userId
        ? isClauseReadableByUser(c, organizationId, userId)
        : isClauseReadableByOrg(c, organizationId);
    });

  return visibleClauses;
}

/** SQL filter for clause rows visible to an org (no cross-tenant master Custom leak). */
export function clauseVisibleToOrgFilter(organizationId: string) {
  return or(
    eq(clauses.isGlobal, true),
    eq(clauses.organizationId, organizationId),
  );
}

/** Clause is editable in the active workspace (org-owned + linked or workspace set). */
export async function isClauseLinkedToWorkspace(
  clauseId: string,
  workspaceId: string,
): Promise<boolean> {
  const [link] = await db
    .select({ workspaceId: workspaceClauses.workspaceId })
    .from(workspaceClauses)
    .where(
      and(
        eq(workspaceClauses.clauseId, clauseId),
        eq(workspaceClauses.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  return !!link;
}

export async function assertClauseReadable(
  clauseId: string,
  organizationId: string,
  workspaceId: string,
) {
  const [clause] = await db
    .select()
    .from(clauses)
    .where(eq(clauses.id, clauseId))
    .limit(1);

  if (!clause)
    return { ok: false as const, status: 404, error: "Clause not found" };

  if (!isClauseReadableByOrg(clause, organizationId)) {
    return { ok: false as const, status: 404, error: "Clause not found" };
  }

  if (clause.isGlobal) {
    return { ok: true as const, clause };
  }

  // Strictly enforce workspace isolation via junction table or direct link
  const linked = await isClauseLinkedToWorkspace(clauseId, workspaceId);
  const isDirectlyLinked = clause.workspaceId === workspaceId;

  if (!linked && !isDirectlyLinked) {
    return { ok: false as const, status: 404, error: "Clause not found" };
  }

  return { ok: true as const, clause };
}

export async function assertClauseEditable(
  clauseId: string,
  organizationId: string,
  workspaceId: string,
) {
  const [clause] = await db
    .select()
    .from(clauses)
    .where(
      and(eq(clauses.id, clauseId), eq(clauses.organizationId, organizationId)),
    )
    .limit(1);

  if (!clause) {
    return { ok: false as const, status: 404, error: "Clause not found" };
  }

  if (clause.isGlobal) {
    return {
      ok: false as const,
      status: 403,
      error: "Global library clauses cannot be edited here",
    };
  }

  const linked = await isClauseLinkedToWorkspace(clauseId, workspaceId);
  const workspaceOk = linked || clause.workspaceId === workspaceId;

  if (!workspaceOk) {
    return {
      ok: false as const,
      status: 403,
      error: "Forbidden: Clause is outside active workspace scope",
    };
  }

  return { ok: true as const, clause };
}

/** IDs of clauses eligible for semantic matching in this org/workspace. */
export async function getVisibleClauseIdsForMatching(
  organizationId: string,
  workspaceId: string,
): Promise<string[]> {
  const visible = await fetchVisibleClausesForWorkspace(
    organizationId,
    workspaceId,
  );
  return visible.map((c) => c.id);
}
