import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { db } from "@/db/drizzle";
import { contracts } from "@/db/schema";
import { eq, and, desc, isNull, isNotNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getActiveOrganization } from "@/server/organizations";

export async function GET(req: NextRequest) {
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
      if (!org) {
        return NextResponse.json(
          { error: "No active organization" },
          { status: 403 },
        );
      }
      userOrgId = org.id;
    }

    const { session } = sessionData as any;
    const activeWorkspaceId = session?.activeWorkspaceId;

    const whereClause = and(
      activeWorkspaceId
        ? and(
            eq(contracts.organizationId, userOrgId),
            eq(contracts.workspaceId, activeWorkspaceId),
          )
        : eq(contracts.organizationId, userOrgId),
      isNull(contracts.deletedAt),
      isNotNull(contracts.archivedAt),
    );

    const archivedContracts = await db
      .select()
      .from(contracts)
      .where(whereClause)
      .orderBy(desc(contracts.archivedAt));

    return NextResponse.json(archivedContracts);
  } catch (error) {
    console.error("[Archive API] GET error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
