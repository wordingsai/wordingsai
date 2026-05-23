import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { notifications, activityLog, joinRequests } from "@/db/schema";
import { auth } from "@/lib/auth";
import { eq, desc, and, or } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !session.session.activeOrganizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const orgId = session.session.activeOrganizationId;

    // Fetch user-specific, organization-wide, or global notifications
    const data = await db
      .select()
      .from(notifications)
      .where(
        or(
          eq(notifications.userId, userId),
          and(
            eq(notifications.organizationId, orgId),
            eq(notifications.isGlobal, false),
          ),
          eq(notifications.isGlobal, true),
        ),
      )
      .orderBy(desc(notifications.createdAt))
      .limit(50);

    return NextResponse.json(data);
  } catch (error) {
    console.error("[Notifications API] GET error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !session.session.activeOrganizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const orgId = session.session.activeOrganizationId;
    const isPSA = (session.session as any).role === "psa";

    if (isPSA) {
      // Global wipe for PSA
      await db.delete(notifications);
      await db.delete(activityLog);
      // Also reject all pending join requests
      await db
        .update(joinRequests)
        .set({ status: "rejected", updatedAt: new Date() })
        .where(eq(joinRequests.status, "pending"));
    } else {
      // "Clear all" for normal users marks as read or deletes non-global notifications
      await db
        .delete(notifications)
        .where(
          and(
            or(
              eq(notifications.userId, userId),
              eq(notifications.organizationId, orgId),
            ),
            eq(notifications.isGlobal, false),
          ),
        );

      // Also clear activity log for the organization
      await db.delete(activityLog).where(eq(activityLog.organizationId, orgId));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Notifications API] DELETE error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
