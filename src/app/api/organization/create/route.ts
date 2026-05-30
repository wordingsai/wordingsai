import { NextResponse } from "next/server";
import { headers } from "next/headers";
export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { db } from "@/db/drizzle";
import { invitation, workspaces, workspaceAccess } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getResend } from "@/lib/resend";
import { DEFAULT_WORKSPACES } from "@/lib/workspace-defaults";

function generateInviteCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++)
      code += chars[Math.floor(Math.random() * chars.length)];
    if (i < 2) code += "-";
  }
  return code;
}

export async function POST(request: Request) {
  try {
    const { name, industry, teamSize, emails = [] } = await request.json();

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Organization name is required" },
        { status: 400 },
      );
    }

    const sessionHeaders = await headers();

    // 1. Create organization → creator is now "su" (thanks to creatorRole in auth.ts)
    const orgResult = await auth.api.createOrganization({
      body: {
        name: name.trim(),
        slug:
          name
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-") +
          "-" +
          Math.random().toString(36).slice(2, 7),
        metadata: { industry, teamSize },
      },
      headers: sessionHeaders,
    });

    if (!orgResult?.id) {
      return NextResponse.json(
        { error: "Failed to create organization" },
        { status: 500 },
      );
    }

    // Retrieve the session to get the inviter's user ID
    const session = await auth.api.getSession({ headers: sessionHeaders });
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized to invite users" },
        { status: 401 },
      );
    }

    // Switch the active org on this session to the newly created one so the
    // user lands in the new org after creation (important when they already
    // belonged to another org — the session would otherwise keep the old org).
    try {
      await auth.api.setActiveOrganization({
        body: { organizationId: orgResult.id },
        headers: sessionHeaders,
      });
    } catch (switchErr) {
      // Non-fatal: the org was created successfully; session can be refreshed client-side.
      console.warn("Could not auto-switch active org after creation:", switchErr);
    }

    // 2. Create Default Workspaces — only Reinsurance for new orgs
    //    (Property workspace is reserved for the admin profile only)
    const publicWorkspaceSeeds = DEFAULT_WORKSPACES.filter(
      (w) => w.type === "reinsurance",
    );

    for (const def of publicWorkspaceSeeds) {
      const [workspace] = await db
        .insert(workspaces)
        .values({
          organizationId: orgResult.id,
          name: def.name,
          type: def.type,
          isGlobal: true,
          mandatoryRegistry: def.mandatoryRegistry,
        })
        .returning();

      // Grant creator access to default workspaces
      await db.insert(workspaceAccess).values({
        workspaceId: workspace.id,
        userId: session.user.id,
        role: "admin",
      });
    }

    // 3. Create invitations (Bypass Better Auth API to avoid 403 context error on org creation)
    const inviteCodes: string[] = [];
    const validEmails = emails.filter((e: string) => e?.trim());

    for (const email of validEmails) {
      const inviteCode = generateInviteCode();
      // Set expiration to 7 days from now
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // Insert directly into the database
      await db.insert(invitation).values({
        id: crypto.randomUUID(),
        organizationId: orgResult.id,
        email: email.trim().toLowerCase(),
        role: "u",
        status: "pending",
        expiresAt,
        inviterId: session.user.id,
        inviteCode,
      });

      // Send email with code (single email, no duplicate)
      try {
        const senderName = process.env.EMAIL_SENDER_NAME || "WordingsAI";
        const senderAddress =
          process.env.EMAIL_SENDER_ADDRESS || "onboarding@wordingsai.com";

        const { data, error: emailError } = await getResend().emails.send({
          from: `${senderName} <${senderAddress}>`,
          to: email.trim().toLowerCase(),
          subject: "You've been invited to join an organization on WordingsAI",
          html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome to WordingsAI!</h2>
            <p>You've been invited to join <strong>${name.trim()}</strong>.</p>
            <p><strong>Your Invite Code:</strong></p>
            <h1 style="font-size: 32px; letter-spacing: 4px; background: #f3f4f6; padding: 16px; border-radius: 8px; text-align: center;">
              ${inviteCode}
            </h1>
            <p>Go to <strong>/onboarding/join</strong> and enter this code to accept the invitation.</p>
            <p style="color: #666;">This code expires in 7 days.</p>
          </div>
        `,
        });

        if (emailError) {
          console.error("Resend Error on Organization Create:", {
            error: emailError,
            to: email.trim().toLowerCase(),
            from: `${senderName} <${senderAddress}>`,
          });
        } else {
          console.log(
            "Organization create invitation email sent successfully:",
            data?.id,
          );
        }
      } catch (err) {
        console.error("Email send failed (invite still created):", err);
      }

      inviteCodes.push(inviteCode);
    }

    return NextResponse.json({
      success: true,
      organization: orgResult,
      inviteCodes,
      message: validEmails.length
        ? `Organization created + ${validEmails.length} invitation(s) sent!`
        : "Organization created successfully!",
    });
  } catch (error: any) {
    console.error("Create org error:", error);
    return NextResponse.json(
      { error: error.message || "Internal error" },
      { status: 500 },
    );
  }
}
