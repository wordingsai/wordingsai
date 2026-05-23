import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db/drizzle";
import { analysisEvents, contracts } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ contractId: string }> },
) {
  const authSession = await auth.api.getSession({
    headers: await headers(),
  });

  if (!authSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { contractId } = await params;

  const sessionOrgId = (authSession.session as any).activeOrganizationId;
  let orgId = sessionOrgId;

  if (!orgId) {
    const { getActiveOrganization } = await import("@/server/organizations");
    const org = await getActiveOrganization(authSession.user.id);
    if (!org) {
      return NextResponse.json(
        { error: "No active organization" },
        { status: 403 },
      );
    }
    orgId = org.id;
  }

  // Validate contract belongs to org
  const [contract] = await db
    .select({ organizationId: contracts.organizationId })
    .from(contracts)
    .where(eq(contracts.id, contractId))
    .limit(1);

  if (!contract || contract.organizationId !== orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const events = await db
    .select()
    .from(analysisEvents)
    .where(
      and(
        eq(analysisEvents.contractId, contractId),
        eq(analysisEvents.eventType, "clause_detected"),
      ),
    )
    .orderBy(analysisEvents.timestamp);

  return NextResponse.json(events);
}
