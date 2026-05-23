import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/db/drizzle";
import { member, organization, session as sessionTable } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !session.session.activeOrganizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const organizationId = session.session.activeOrganizationId;

    // 1. Verify user is a super user or PSA in this org
    const [userMember] = await db
      .select()
      .from(member)
      .where(
        and(
          eq(member.userId, userId),
          eq(member.organizationId, organizationId),
        ),
      )
      .limit(1);

    if (!userMember) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const isAuthorized = userMember.role === "su" || userMember.role === "psa";

    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Only Super Users can delete an organization." },
        { status: 403 },
      );
    }

    // 2. Verify the confirmation name matches
    const body = await request.json();
    const { confirmName } = body;

    const [org] = await db
      .select({ name: organization.name })
      .from(organization)
      .where(eq(organization.id, organizationId))
      .limit(1);

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 },
      );
    }

    if (confirmName?.trim() !== org.name?.trim()) {
      return NextResponse.json(
        { error: "Organization name does not match. Deletion aborted." },
        { status: 400 },
      );
    }

    // 3. Clear activeOrganizationId from all sessions in this org first
    await db
      .update(sessionTable)
      .set({ activeOrganizationId: null })
      .where(eq(sessionTable.activeOrganizationId, organizationId));

    // 4. Delete the organization — cascades to members, contracts, workspaces, clauses, rules etc.
    await db.delete(organization).where(eq(organization.id, organizationId));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete organization error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
