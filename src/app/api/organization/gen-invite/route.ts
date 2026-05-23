import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/db/drizzle";
import { organization } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isAdmin } from "@/server/permissions";

export const dynamic = "force-dynamic";

function generateInviteCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function POST(request: Request) {
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

    const inviteCode = generateInviteCode();

    await db
      .update(organization)
      .set({ inviteCode, updatedAt: new Date() })
      .where(eq(organization.id, orgId));

    return NextResponse.json({ success: true, inviteCode });
  } catch (error: any) {
    console.error("Generate invite code error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = (session.session as any).activeOrganizationId;
    if (!orgId) {
      return NextResponse.json(
        { error: "No active organization" },
        { status: 400 },
      );
    }

    const [org] = await db
      .select({ inviteCode: organization.inviteCode })
      .from(organization)
      .where(eq(organization.id, orgId))
      .limit(1);

    return NextResponse.json({ inviteCode: org?.inviteCode || null });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
