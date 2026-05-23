import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { activityLog } from "@/db/schema";
import { auth } from "@/lib/auth";
import { eq, desc, and, or, inArray, isNull } from "drizzle-orm";
import { getActiveWorkspace } from "@/server/workspaces";
import { contracts, clauses, rules } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !session.session.activeOrganizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = session.session.activeOrganizationId;

    const workspace = await getActiveWorkspace(
      session.user.id,
      orgId,
      session.session.activeWorkspaceId || null,
    );
    const activeWorkspaceId = workspace?.id;

    if (!activeWorkspaceId) {
      return NextResponse.json(
        { error: "No active workspace" },
        { status: 403 },
      );
    }

    // Fetch the 15 most recent activities for the active organization, filtering by workspace
    const logs = await db
      .select({
        entityId: activityLog.entityId,
        entityName: activityLog.entityName,
        entityType: activityLog.entityType,
        action: activityLog.action,
        createdAt: activityLog.createdAt,
      })
      .from(activityLog)
      .where(
        and(
          eq(activityLog.organizationId, orgId),
          or(
            and(
              eq(activityLog.entityType, "contract"),
              inArray(
                activityLog.entityId,
                db
                  .select({ id: contracts.id })
                  .from(contracts)
                  .where(
                    and(
                      eq(contracts.workspaceId, activeWorkspaceId),
                      isNull(contracts.deletedAt),
                      isNull(contracts.archivedAt),
                    ),
                  ),
              ),
            ),
            and(
              eq(activityLog.entityType, "clause"),
              inArray(
                activityLog.entityId,
                db
                  .select({ id: clauses.id })
                  .from(clauses)
                  .where(
                    or(
                      eq(clauses.workspaceId, activeWorkspaceId),
                      eq(clauses.isGlobal, true),
                    ),
                  ),
              ),
            ),
            and(
              eq(activityLog.entityType, "rule"),
              inArray(
                activityLog.entityId,
                db
                  .select({ id: rules.id })
                  .from(rules)
                  .where(
                    or(
                      eq(rules.workspaceId, activeWorkspaceId),
                      eq(rules.isGlobal, true),
                    ),
                  ),
              ),
            ),
          ),
        ),
      )
      .orderBy(desc(activityLog.createdAt))
      .limit(15);

    // Transform for the dashboard feed
    const activities = logs.map((log) => ({
      id: log.entityId,
      title: log.entityName || "Unnamed Entity",
      type: log.entityType, // "contract", "clause", "rule"
      action: log.action.charAt(0).toUpperCase() + log.action.slice(1), // e.g. "Created"
      updatedAt: log.createdAt.toISOString(),
    }));

    return NextResponse.json(activities);
  } catch (error) {
    console.error("[Activity API] GET error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
