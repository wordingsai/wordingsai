import { NextResponse } from "next/server";
import { headers } from "next/headers";
export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { db } from "@/db/drizzle";
import { invitation } from "@/db/schema";
import { and, eq, gt } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const { code } = await request.json();

    if (!code?.trim()) {
      return NextResponse.json(
        { error: "Invite code is required" },
        { status: 400 },
      );
    }

    const sessionHeaders = await headers();

    const session = await auth.api.getSession({
      headers: sessionHeaders,
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: "You must be signed in to join an organization" },
        { status: 401 },
      );
    }

    const invites = await db
      .select({ id: invitation.id })
      .from(invitation)
      .where(
        and(
          eq(invitation.inviteCode, code.trim()),
          eq(invitation.status, "pending"),
          gt(invitation.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (invites.length === 0) {
      return NextResponse.json(
        { error: "Invalid or expired invite code" },
        { status: 400 },
      );
    }

    const invitationId = invites[0].id;

    // Let Better Auth handle member creation, role assignment, etc.
    const result = await auth.api.acceptInvitation({
      body: { invitationId },
      headers: sessionHeaders,
    });

    if (!result) {
      return NextResponse.json(
        { error: "Failed to join organization" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Successfully joined the organization!",
    });
  } catch (error: any) {
    console.error("Join organization error:", error);
    return NextResponse.json(
      { error: error.message || "Something went wrong" },
      { status: 500 },
    );
  }
}
