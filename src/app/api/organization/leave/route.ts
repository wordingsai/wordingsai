import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/db/drizzle";
import { member, organization, session as sessionTable } from "@/db/schema";
import { eq, and, count } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !session.session.activeOrganizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const organizationId = session.session.activeOrganizationId;

    // 1. Get user's role and membership
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

    // 2. If SU, check if they are the last one
    if (userMember.role === "su" || userMember.role === "psa") {
      const [{ value: suCount }] = await db
        .select({ value: count() })
        .from(member)
        .where(
          and(
            eq(member.organizationId, organizationId),
            eq(member.role, userMember.role),
          ),
        );

      if (suCount <= 1) {
        return NextResponse.json(
          {
            error:
              "You are the last Super User. Promote someone else before leaving.",
          },
          { status: 400 },
        );
      }
    }

    // 3. Remove membership
    await db
      .delete(member)
      .where(
        and(
          eq(member.userId, userId),
          eq(member.organizationId, organizationId),
        ),
      );

    // 4. Clear activeOrganizationId from the session
    if (session.session.id) {
      await db
        .update(sessionTable)
        .set({ activeOrganizationId: null })
        .where(eq(sessionTable.id, session.session.id));
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Leave organization error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
