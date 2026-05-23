import { NextResponse } from "next/server";
import { headers } from "next/headers";
export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { db } from "@/db/drizzle";
import { invitation } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

function generateInviteCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    if (i < 2) code += "-";
  }
  return code;
}

export async function POST(request: Request) {
  try {
    const { email, role = "u" } = await request.json();

    if (!email?.trim()) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const sessionHeaders = await headers();

    const result = await auth.api.createInvitation({
      body: { email: email.trim().toLowerCase(), role },
      headers: sessionHeaders,
    });

    if (!result?.id) {
      return NextResponse.json(
        { error: "Failed to create invitation" },
        { status: 500 },
      );
    }

    const inviteCode = generateInviteCode();

    await db
      .update(invitation)
      .set({ inviteCode })
      .where(eq(invitation.id, result.id));

    // === SEND EMAIL VIA RESEND ===
    try {
      const senderName = process.env.EMAIL_SENDER_NAME || "WordingsAI";
      const senderAddress =
        process.env.EMAIL_SENDER_ADDRESS || "onboarding@resend.dev";

      const { data, error: emailError } = await resend.emails.send({
        from: `${senderName} <${senderAddress}>`,
        to: email.trim().toLowerCase(),
        subject: "You've been invited to join an organization on WordingsAI",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome to WordingsAI!</h2>
            <p>You've been invited to join an organization.</p>
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
        console.error("Resend Error on Organization Invite:", {
          error: emailError,
          to: email.trim().toLowerCase(),
          from: `${senderName} <${senderAddress}>`,
        });
      } else {
        console.log("Organization invite email sent successfully:", data?.id);
      }
    } catch (emailError) {
      console.error("Email send failed (invite still created):", emailError);
    }

    return NextResponse.json({
      success: true,
      inviteCode,
      message: "Invitation created and email sent!",
    });
  } catch (error: any) {
    console.error("Invite error:", error);
    return NextResponse.json(
      { error: error.message || "Something went wrong" },
      { status: 500 },
    );
  }
}
