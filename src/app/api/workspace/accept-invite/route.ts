/**
 * POST /api/workspace/accept-invite
 *
 * Accepts a workspace invitation token. The caller must be logged in and
 * the session email must match the invitation email (case-insensitive).
 *
 * On success creates a `workspace_access` row (idempotent via the
 * workspace+user unique index) and marks the invitation accepted.
 *
 * Body: { token: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/drizzle";
import {
  workspaceInvitations,
  workspaceAccess,
  workspaces,
  member,
} from "@/db/schema";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        { error: "You must be signed in to accept an invitation" },
        { status: 401 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const token = typeof body.token === "string" ? body.token : "";
    if (!token) {
      return NextResponse.json(
        { error: "Missing invitation token" },
        { status: 400 },
      );
    }

    const [inv] = await db
      .select()
      .from(workspaceInvitations)
      .where(eq(workspaceInvitations.token, token))
      .limit(1);

    if (!inv) {
      return NextResponse.json(
        { error: "This invitation link is invalid" },
        { status: 404 },
      );
    }

    if (inv.status !== "pending") {
      return NextResponse.json(
        { error: "This invitation has already been used" },
        { status: 410 },
      );
    }

    if (inv.expiresAt && new Date(inv.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: "This invitation has expired" },
        { status: 410 },
      );
    }

    if (
      session.user.email.trim().toLowerCase() !==
      inv.email.trim().toLowerCase()
    ) {
      return NextResponse.json(
        {
          error: `This invitation was sent to ${inv.email}. Please sign in with that account to accept it.`,
        },
        { status: 403 },
      );
    }

    // Make sure the workspace still exists.
    const [ws] = await db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        organizationId: workspaces.organizationId,
      })
      .from(workspaces)
      .where(eq(workspaces.id, inv.workspaceId))
      .limit(1);
    if (!ws) {
      return NextResponse.json(
        { error: "The workspace this invitation pointed at no longer exists" },
        { status: 410 },
      );
    }

    await db.transaction(async (tx) => {
      // Ensure org membership too -- needed so workspace-resolver and the
      // rest of the app see them as part of the tenant.
      const [existingMember] = await tx
        .select({ id: member.id })
        .from(member)
        .where(
          and(
            eq(member.userId, session.user.id),
            eq(member.organizationId, ws.organizationId),
          ),
        )
        .limit(1);
      if (!existingMember) {
        await tx.insert(member).values({
          userId: session.user.id,
          organizationId: ws.organizationId,
          role: "member",
        });
      }

      // Idempotent workspace access (unique on workspace_id + user_id).
      const [existing] = await tx
        .select({ id: workspaceAccess.id })
        .from(workspaceAccess)
        .where(
          and(
            eq(workspaceAccess.userId, session.user.id),
            eq(workspaceAccess.workspaceId, ws.id),
          ),
        )
        .limit(1);

      if (!existing) {
        await tx.insert(workspaceAccess).values({
          workspaceId: ws.id,
          userId: session.user.id,
          role: inv.role,
        });
      }

      await tx
        .update(workspaceInvitations)
        .set({ status: "accepted", acceptedAt: new Date() })
        .where(eq(workspaceInvitations.id, inv.id));
    });

    return NextResponse.json({
      success: true,
      workspaceId: ws.id,
      workspaceName: ws.name,
    });
  } catch (err) {
    console.error("[AcceptWorkspaceInvite] Error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
