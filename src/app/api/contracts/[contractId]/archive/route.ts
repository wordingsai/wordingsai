import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { contracts } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getActiveOrganization } from "@/server/organizations";

// POST /api/contracts/[contractId]/archive  → archive
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ contractId: string }> },
) {
  try {
    const sessionData = await auth.api.getSession({ headers: await headers() });
    if (!sessionData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = sessionData.user.id;
    const sessionOrgId = (sessionData.session as any).activeOrganizationId;
    let userOrgId = sessionOrgId;

    if (!userOrgId) {
      const org = await getActiveOrganization(userId);
      userOrgId = org?.id;
    }

    const { contractId } = await context.params;

    const [archived] = await db
      .update(contracts)
      .set({ archivedAt: new Date() })
      .where(
        and(
          eq(contracts.id, contractId),
          eq(contracts.organizationId, userOrgId!),
        ),
      )
      .returning();

    if (!archived) {
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, message: "Contract archived" });
  } catch (error) {
    console.error("[Archive API] POST error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

// DELETE /api/contracts/[contractId]/archive  → unarchive
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ contractId: string }> },
) {
  try {
    const sessionData = await auth.api.getSession({ headers: await headers() });
    if (!sessionData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = sessionData.user.id;
    const sessionOrgId = (sessionData.session as any).activeOrganizationId;
    let userOrgId = sessionOrgId;

    if (!userOrgId) {
      const org = await getActiveOrganization(userId);
      userOrgId = org?.id;
    }

    const { contractId } = await context.params;

    const [unarchived] = await db
      .update(contracts)
      .set({ archivedAt: null })
      .where(
        and(
          eq(contracts.id, contractId),
          eq(contracts.organizationId, userOrgId!),
        ),
      )
      .returning();

    if (!unarchived) {
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, message: "Contract unarchived" });
  } catch (error) {
    console.error("[Archive API] DELETE error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
