import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { contracts } from "@/db/schema";
import { eq, and, desc, isNotNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getActiveOrganization } from "@/server/organizations";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
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
      if (!org) {
        return NextResponse.json(
          { error: "No active organization" },
          { status: 403 },
        );
      }
      userOrgId = org.id;
    }

    const deletedContracts = await db
      .select()
      .from(contracts)
      .where(
        and(
          eq(contracts.organizationId, userOrgId),
          isNotNull(contracts.deletedAt),
        ),
      )
      .orderBy(desc(contracts.deletedAt));

    return NextResponse.json(deletedContracts);
  } catch (error) {
    console.error("[Bin API] GET error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
