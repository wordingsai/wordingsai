import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/db/drizzle";
import { organization, joinRequests, member, session } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { inviteCode } = await request.json();
    if (!inviteCode?.trim()) {
      return NextResponse.json(
        { error: "Invite code is required" },
        { status: 400 },
      );
    }

    const sessionData = await auth.api.getSession({ headers: await headers() });
    if (!sessionData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = sessionData.user.id;

    const cleanInviteCode = inviteCode.replace(/-/g, "").trim().toUpperCase();

    // 1. Find organization with this invite code
    const [org] = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.inviteCode, cleanInviteCode))
      .limit(1);

    if (!org) {
      return NextResponse.json(
        { error: "Invalid invite code" },
        { status: 404 },
      );
    }

    // 2. Check if already a member
    const [existingMember] = await db
      .select()
      .from(member)
      .where(and(eq(member.userId, userId), eq(member.organizationId, org.id)))
      .limit(1);

    if (existingMember) {
      return NextResponse.json({
        success: true,
        joined: true,
        message: "Already a member of this organization",
      });
    }

    // 3. Check if already has a pending request
    const [existingRequest] = await db
      .select()
      .from(joinRequests)
      .where(
        and(
          eq(joinRequests.userId, userId),
          eq(joinRequests.organizationId, org.id),
        ),
      )
      .limit(1);

    if (existingRequest && existingRequest.status === "pending") {
      return NextResponse.json(
        { error: "Join request already pending" },
        { status: 400 },
      );
    }

    // 4. Join the organization instantly
    await db.insert(member).values({
      userId,
      organizationId: org.id,
      role: "member",
    });

    // Also update any pending join requests to "accepted" for consistency
    await db
      .update(joinRequests)
      .set({ status: "accepted", updatedAt: new Date() })
      .where(
        and(
          eq(joinRequests.userId, userId),
          eq(joinRequests.organizationId, org.id),
        ),
      );

    // Update session to make this organization active immediately
    if (sessionData?.session.id) {
      await db
        .update(session)
        .set({ activeOrganizationId: org.id })
        .where(eq(session.id, sessionData.session.id));
    }

    return NextResponse.json({
      success: true,
      joined: true,
      message: "Successfully joined the organization!",
    });
  } catch (error: any) {
    console.error("Join by code error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
