import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { member, user } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getActiveOrganization } from "@/server/organizations";
import { isAdmin } from "@/server/permissions";

export async function GET() {
  try {
    const sessionData = await auth.api.getSession({ headers: await headers() });
    if (!sessionData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = sessionData.user.id;
    const org = await getActiveOrganization(userId);

    if (!org) {
      return NextResponse.json(
        { error: "No active organization" },
        { status: 403 },
      );
    }

    const members = await db
      .select({
        id: member.id,
        role: member.role,
        createdAt: member.createdAt,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        },
      })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(eq(member.organizationId, org.id));

    return NextResponse.json(members);
  } catch (error) {
    console.error("GET members error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const sessionData = await auth.api.getSession({ headers: await headers() });
    if (!sessionData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Verify caller has `su` permission
    const isSuperUser = await isAdmin();
    if (!isSuperUser) {
      return NextResponse.json(
        { error: "Forbidden: Only Super Users can manage roles" },
        { status: 403 },
      );
    }

    const userId = sessionData.user.id;
    const org = await getActiveOrganization(userId);
    if (!org) {
      return NextResponse.json(
        { error: "No active organization" },
        { status: 403 },
      );
    }

    const body = await req.json();
    const { memberId, newRole } = body;

    if (!memberId || !["su", "u"].includes(newRole)) {
      return NextResponse.json(
        { error: "Invalid parameters" },
        { status: 400 },
      );
    }

    // Check if trying to promote to `su` -> enforce max 2 `su` limit
    if (newRole === "su") {
      const suUsers = await db
        .select()
        .from(member)
        .where(and(eq(member.organizationId, org.id), eq(member.role, "su")));
      if (suUsers.length >= 2) {
        return NextResponse.json(
          {
            error:
              "Limit reached: Maximum of 2 Super Users allowed per organization.",
          },
          { status: 400 },
        );
      }
    }

    // Check if someone is trying to demote the LAST `su`
    if (newRole === "u") {
      const suUsers = await db
        .select()
        .from(member)
        .where(and(eq(member.organizationId, org.id), eq(member.role, "su")));
      if (suUsers.length === 1 && suUsers[0].id === memberId) {
        return NextResponse.json(
          { error: "Cannot demote the last Super User in the organization." },
          { status: 400 },
        );
      }
    }

    // Update member role
    const [updatedMember] = await db
      .update(member)
      .set({ role: newRole })
      .where(and(eq(member.id, memberId), eq(member.organizationId, org.id)))
      .returning();

    if (!updatedMember) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    return NextResponse.json(updatedMember);
  } catch (error) {
    console.error("PATCH members error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
