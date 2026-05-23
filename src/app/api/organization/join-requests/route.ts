import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/db/drizzle";
import { joinRequests, user, member } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { isAdmin } from "@/server/permissions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isSU = await isAdmin();
    if (!isSU) {
      return NextResponse.json(
        { error: "Forbidden: Super User access required" },
        { status: 403 },
      );
    }

    const orgId = (session.session as any).activeOrganizationId;
    if (!orgId) {
      return NextResponse.json(
        { error: "No active organization" },
        { status: 400 },
      );
    }

    const requests = await db
      .select({
        id: joinRequests.id,
        status: joinRequests.status,
        createdAt: joinRequests.createdAt,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        },
      })
      .from(joinRequests)
      .innerJoin(user, eq(joinRequests.userId, user.id))
      .where(
        and(
          eq(joinRequests.organizationId, orgId),
          eq(joinRequests.status, "pending"),
        ),
      );

    return NextResponse.json(requests);
  } catch (error: any) {
    console.error("Fetch join requests error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { requestId, status } = await request.json();
    if (!requestId || !["accepted", "rejected"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid request data" },
        { status: 400 },
      );
    }

    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isSU = await isAdmin();
    if (!isSU) {
      return NextResponse.json(
        { error: "Forbidden: Super User access required" },
        { status: 403 },
      );
    }

    const orgId = (session.session as any).activeOrganizationId;
    if (!orgId) {
      return NextResponse.json(
        { error: "No active organization" },
        { status: 400 },
      );
    }

    // 1. Get the request
    const [joinRequest] = await db
      .select()
      .from(joinRequests)
      .where(
        and(
          eq(joinRequests.id, requestId),
          eq(joinRequests.organizationId, orgId),
        ),
      )
      .limit(1);

    if (!joinRequest) {
      return NextResponse.json(
        { error: "Join request not found" },
        { status: 404 },
      );
    }

    if (status === "accepted") {
      // Create member
      await db
        .insert(member)
        .values({
          id: crypto.randomUUID(),
          organizationId: orgId,
          userId: joinRequest.userId,
          role: "u",
        })
        .onConflictDoNothing();

      // Update request status
      await db
        .update(joinRequests)
        .set({ status: "accepted", updatedAt: new Date() })
        .where(eq(joinRequests.id, requestId));
    } else {
      await db
        .update(joinRequests)
        .set({ status: "rejected", updatedAt: new Date() })
        .where(eq(joinRequests.id, requestId));
    }

    return NextResponse.json({
      success: true,
      message: `Request ${status} successfully`,
    });
  } catch (error: any) {
    console.error("Update join request error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
