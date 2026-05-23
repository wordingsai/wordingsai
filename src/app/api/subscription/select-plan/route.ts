import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db/drizzle";
import { organization } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getActiveOrganization } from "@/server/organizations";
import { PLAN_DEFINITIONS, type PlanId } from "@/lib/plans";

export const dynamic = "force-dynamic";

const VALID_PLAN_IDS = PLAN_DEFINITIONS.map((p) => p.id);

/**
 * POST /api/subscription/select-plan
 * Trial soft-launch: directly assigns a plan to the active org without payment.
 * Only available while billing is not enforced.
 */
export async function POST(req: NextRequest) {
  const sessionData = await auth.api.getSession({ headers: await headers() });
  if (!sessionData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { planId } = body as { planId?: string };

  if (!planId || !VALID_PLAN_IDS.includes(planId as any)) {
    return NextResponse.json(
      { error: `Invalid plan ID. Valid options: ${VALID_PLAN_IDS.join(", ")}` },
      { status: 400 },
    );
  }

  const org = await getActiveOrganization(
    sessionData.user.id,
    (sessionData.session as any).activeOrganizationId,
  );

  if (!org) {
    return NextResponse.json(
      { error: "No active organization" },
      { status: 403 },
    );
  }

  const dbPlanId = planId as "fast" | "basic" | "plus";

  await db
    .update(organization)
    .set({ plan: dbPlanId })
    .where(eq(organization.id, org.id));

  return NextResponse.json(
    { success: true, plan: planId, organizationId: org.id },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    },
  );
}
