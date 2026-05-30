/**
 * POST /api/workspace/[workspaceId]/invite
 *
 * Creates a workspace-scoped invitation and emails a magic link.
 *
 * Authorization: caller must be a Better Auth member of the workspace's
 * organisation with role "owner" / "admin" / "super-user", OR the platform
 * super-user (`user.role === "su"`), OR platform staff (`role === "psa"`).
 *
 * Body: { email: string, role?: "member" | "admin" }
 */

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getResend } from "@/lib/resend";
import { db } from "@/db/drizzle";
import {
  workspaces,
  workspaceInvitations,
  member,
  user as userTable,
} from "@/db/schema";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const INVITE_TTL_DAYS = 7;

function newToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

async function assertCanInvite(
  workspaceId: string,
  callerUserId: string,
): Promise<
  | { ok: true; workspaceName: string; organizationId: string }
  | { ok: false; status: number; error: string }
> {
  const [ws] = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      organizationId: workspaces.organizationId,
      ownerUserId: workspaces.ownerUserId,
    })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!ws) {
    return { ok: false, status: 404, error: "Workspace not found" };
  }

  // Platform-level super-users / staff can always invite.
  const [callerRow] = await db
    .select({ role: userTable.role })
    .from(userTable)
    .where(eq(userTable.id, callerUserId))
    .limit(1);

  if (callerRow?.role === "su" || callerRow?.role === "psa") {
    return { ok: true, workspaceName: ws.name, organizationId: ws.organizationId };
  }

  // Owners of a private workspace can always invite to their own.
  if (ws.ownerUserId && ws.ownerUserId === callerUserId) {
    return { ok: true, workspaceName: ws.name, organizationId: ws.organizationId };
  }

  // Otherwise the caller must be an owner / admin of the org.
  const [m] = await db
    .select({ role: member.role })
    .from(member)
    .where(
      and(
        eq(member.userId, callerUserId),
        eq(member.organizationId, ws.organizationId),
      ),
    )
    .limit(1);

  if (!m) {
    return {
      ok: false,
      status: 403,
      error: "Not a member of this workspace's organisation",
    };
  }
  if (m.role !== "owner" && m.role !== "admin") {
    return {
      ok: false,
      status: 403,
      error: "Only org owners and admins can invite to a workspace",
    };
  }

  return { ok: true, workspaceName: ws.name, organizationId: ws.organizationId };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { workspaceId } = await params;
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const role: "member" | "admin" = body.role === "admin" ? "admin" : "member";

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "A valid email is required" },
        { status: 400 },
      );
    }

    const auth_check = await assertCanInvite(workspaceId, session.user.id);
    if (!auth_check.ok) {
      return NextResponse.json(
        { error: auth_check.error },
        { status: auth_check.status },
      );
    }

    const token = newToken();
    const expiresAt = new Date(
      Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    const [inserted] = await db
      .insert(workspaceInvitations)
      .values({
        workspaceId,
        organizationId: auth_check.organizationId,
        email,
        role,
        status: "pending",
        token,
        inviterId: session.user.id,
        expiresAt,
      })
      .returning({ id: workspaceInvitations.id });

    // Build the accept URL. Prefer NEXT_PUBLIC_APP_URL but fall back to the
    // request origin so this works on preview deployments without config.
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      new URL(req.url).origin.replace(/\/+$/, "");
    const acceptUrl = `${baseUrl}/workspace/accept?token=${encodeURIComponent(token)}`;

    // Fire-and-forget email. Don't fail the invite if Resend has a hiccup.
    try {
      const senderName = process.env.EMAIL_SENDER_NAME || "WordingsAI";
      const senderAddress =
        process.env.EMAIL_SENDER_ADDRESS || "onboarding@resend.dev";

      const { error: emailError } = await getResend().emails.send({
        from: `${senderName} <${senderAddress}>`,
        to: email,
        subject: `You've been invited to the "${auth_check.workspaceName}" workspace on WordingsAI`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color:#111;">
            <h2 style="margin:0 0 12px 0;">Workspace invitation</h2>
            <p>${session.user.name || "Someone"} has invited you to join the
            <strong>${auth_check.workspaceName}</strong> workspace on WordingsAI as a
            <strong>${role}</strong>.</p>
            <p style="margin: 24px 0;">
              <a href="${acceptUrl}"
                 style="background:#2563eb;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:600;">
                Accept invitation
              </a>
            </p>
            <p style="font-size:12px;color:#555;">
              Or paste this link into your browser:<br/>
              <code style="word-break:break-all;">${acceptUrl}</code>
            </p>
            <p style="font-size:12px;color:#999;margin-top:24px;">
              This invite expires in ${INVITE_TTL_DAYS} days. If you weren't expecting it
              you can safely ignore this email.
            </p>
          </div>
        `,
      });

      if (emailError) {
        console.error("[WorkspaceInvite] Resend error:", emailError);
      }
    } catch (e) {
      console.error("[WorkspaceInvite] Email send threw:", e);
    }

    return NextResponse.json({
      success: true,
      invitationId: inserted.id,
      acceptUrl,
    });
  } catch (err) {
    console.error("[WorkspaceInvite] Error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
