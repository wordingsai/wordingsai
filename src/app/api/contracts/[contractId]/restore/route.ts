import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { contracts } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getActiveOrganization } from "@/server/organizations";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ contractId: string }> },
) {
  try {
    const sessionData = await auth.api.getSession({ headers: await headers() });
    if (!sessionData || !sessionData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = sessionData.user.id;
    const sessionOrgId = (sessionData.session as any).activeOrganizationId;
    let userOrgId = sessionOrgId;

    if (!userOrgId) {
      const org = await getActiveOrganization(userId);
      if (!userOrgId) userOrgId = org?.id;
    }

    const { contractId } = await context.params;

    const [restored] = await db
      .update(contracts)
      .set({ deletedAt: null, archivedAt: null })
      .where(
        and(
          eq(contracts.id, contractId),
          eq(contracts.organizationId, userOrgId!),
        ),
      )
      .returning();

    if (!restored) {
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, message: "Contract restored" });
  } catch (error) {
    console.error("[Restore API] POST error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
