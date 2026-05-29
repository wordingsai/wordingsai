import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { contracts } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getActiveOrganization } from "@/server/organizations";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ contractId: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { contractId } = await context.params;

    // Validate UUID format and check for "undefined" string
    if (
      !contractId ||
      contractId === "undefined" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        contractId,
      )
    ) {
      return new NextResponse("Invalid Contract ID", { status: 400 });
    }

    const userId = session.user.id;
    const sessionOrgId = (session.session as any).activeOrganizationId;
    let orgId = sessionOrgId;

    if (!orgId) {
      const org = await getActiveOrganization(userId);
      if (!org) {
        return new NextResponse("No active organization", { status: 403 });
      }
      orgId = org.id;
    }

    const contract = await db.query.contracts.findFirst({
      where: and(
        eq(contracts.id, contractId),
        eq(contracts.organizationId, orgId),
      ),
    });

    if (!contract || !contract.fileURL) {
      return new NextResponse("Contract or file not found", { status: 404 });
    }

    console.log(`[PDF API] Retrieving PDF for contract ${contractId}`);

    // Supabase-stored PDFs: download with the service-role key (apikey auth).
    // We don't use signed URLs here — this project's key is the new sb_secret_
    // format that downloads objects fine but cannot mint signed URLs
    // ("Invalid Compact JWS"), so a signed-URL stream would just fail and fall
    // back anyway. The download is cached hard (immutable) so the buffering
    // cost is paid only once per contract per client.
    if (contract.fileURL.includes("supabase.co")) {
      const { downloadFromSupabase, extractPathFromSupabaseUrl } = await import(
        "@/lib/supabase/storage"
      );
      const filePath = extractPathFromSupabaseUrl(contract.fileURL);

      if (filePath) {
        try {
          const buffer = await downloadFromSupabase(filePath);
          return new NextResponse(new Blob([new Uint8Array(buffer)]), {
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `inline; filename="${contract.contractName || "contract"}.pdf"`,
              "Cache-Control": "public, max-age=31536000, immutable",
            },
          });
        } catch (downloadErr) {
          console.error("[PDF API] Supabase download failed:", downloadErr);
          // Fall through to the generic proxy fetch below.
        }
      }
    }

    // Fallback: Proxy the fetch if not Supabase or download failed
    const response = await fetch(contract.fileURL);
    if (!response.ok) {
      console.error(
        `[PDF API] Proxy fetch failed: ${response.status} ${response.statusText}`,
      );
      return new NextResponse("Failed to fetch PDF from storage", {
        status: 500,
      });
    }

    const blob = await response.blob();
    return new NextResponse(blob, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${contract.contractName || "contract"}.pdf"`,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("[PDF API] Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
