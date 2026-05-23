import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  generateSupabaseUploadUrl,
  getSupabasePublicUrl,
} from "@/lib/supabase/storage";
import { db } from "@/db/drizzle";
import { organization, contracts } from "@/db/schema";
import { eq, and, sql, gte } from "drizzle-orm";
import { getActiveOrganization } from "@/server/organizations";
import { getActiveWorkspace } from "@/server/workspaces";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const sessionData = await auth.api.getSession({ headers: await headers() });
    if (!sessionData || !sessionData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { fileName, fileType, fileHash } = await req.json();
    const userId = sessionData.user.id;

    if (!fileName || !fileType) {
      return NextResponse.json(
        { error: "fileName and fileType are required" },
        { status: 400 },
      );
    }

    // Determine organizational scope
    let orgId = (sessionData.session as any).activeOrganizationId;
    if (!orgId) {
      const orgRecord = await getActiveOrganization(userId);
      if (orgRecord) orgId = orgRecord.id;
    }

    if (!orgId) {
      return NextResponse.json(
        { error: "No active organization found" },
        { status: 400 },
      );
    }

    const workspace = await getActiveWorkspace(
      userId,
      orgId,
      (sessionData.session as any).activeWorkspaceId || null,
    );
    const activeWorkspaceId = workspace?.id;

    if (!activeWorkspaceId) {
      return NextResponse.json(
        { error: "No active workspace found" },
        { status: 400 },
      );
    }

    // Usage Limitations Enforcement
    const orgData = await db.query.organization.findFirst({
      where: eq(organization.id, orgId),
    });

    if (!orgData) {
      return NextResponse.json(
        { error: "Organization lookup failed" },
        { status: 500 },
      );
    }

    // Basic = 6/mo, Plus = 20/mo
    const usageLimit = orgData.plan === "plus" ? 20 : 6;

    // Fallback if not configured in dev
    const periodStart = orgData.stripeCurrentPeriodEnd
      ? new Date(
          orgData.stripeCurrentPeriodEnd.getTime() - 30 * 24 * 60 * 60 * 1000,
        )
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(contracts)
      .where(
        and(
          eq(contracts.organizationId, orgId),
          gte(contracts.createdAt, periodStart),
        ),
      );

    if (count >= usageLimit) {
      return NextResponse.json(
        {
          error: `Usage limit exceeded. Your plan limits you to ${usageLimit} processing runs per billing cycle.`,
        },
        { status: 403 },
      );
    }

    // Duplication Check (Silent duplicate routing logic should be injected into standard API upload flow or here)
    if (fileHash) {
      const existing = await db.query.contracts.findFirst({
        where: and(
          eq(contracts.organizationId, orgId),
          eq(contracts.workspaceId, activeWorkspaceId),
          eq(contracts.fileHash, fileHash),
        ),
      });

      if (existing) {
        console.log(
          `[Get Upload URL] Found duplicate file hash ${fileHash}. Silently cloning.`,
        );
        // Handled downstream via standard route, but signal frontend
        return NextResponse.json({ duplicateContractId: existing.id });
      }
    }

    const filePath = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;

    console.log(
      `[Get Upload URL] Generating Supabase Signed URL for ${filePath}`,
    );

    const { generateSupabaseUploadUrl, getSupabasePublicUrl } =
      await import("@/lib/supabase/storage");
    const result = await generateSupabaseUploadUrl(filePath);
    const publicUrl = getSupabasePublicUrl(result.path);

    return NextResponse.json({
      signedUrl: result.signedUrl,
      publicUrl: publicUrl,
      filePath: result.path,
      isSupabase: true,
      isGCS: false,
    });
  } catch (error: any) {
    console.error("[Get Upload URL] Internal error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 },
    );
  }
}
