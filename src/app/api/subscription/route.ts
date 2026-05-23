import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { getActiveOrganization } from "@/server/organizations";

export async function GET() {
  const sessionData = await auth.api.getSession({ headers: await headers() });
  if (!sessionData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const org = await getActiveOrganization(
    sessionData.user.id,
    (sessionData.session as any).activeOrganizationId,
  );
  if (!org) {
    return NextResponse.json(
      { error: "No organization context" },
      { status: 403 },
    );
  }

  // Revalidate protected routes to ensure fresh plan data is available
  revalidatePath("/");

  return NextResponse.json(
    {
      organizationId: org.id,
      plan: org.plan,
    },
    {
      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    },
  );
}
