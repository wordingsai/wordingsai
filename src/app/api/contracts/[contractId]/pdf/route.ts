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

    // Check if it's a Supabase URL and stream it through (don't buffer the
    // whole file in memory — for a 60+ page PDF that delays first paint and
    // bloats function memory). A signed URL lets us pipe the upstream body
    // straight to the client; same-origin so no CORS concerns for react-pdf.
    if (contract.fileURL.includes("supabase.co")) {
      const {
        getSupabaseSignedReadUrl,
        downloadFromSupabase,
        extractPathFromSupabaseUrl,
      } = await import("@/lib/supabase/storage");
      const filePath = extractPathFromSupabaseUrl(contract.fileURL);

      if (filePath) {
        const pdfHeaders = {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${contract.contractName || "contract"}.pdf"`,
          "Cache-Control": "public, max-age=31536000, immutable",
        };
        // Preferred: stream via signed URL (no server-side buffering).
        try {
          const signedUrl = await getSupabaseSignedReadUrl(filePath, 3600);
          if (signedUrl) {
            const upstream = await fetch(signedUrl);
            if (upstream.ok && upstream.body) {
              return new NextResponse(upstream.body, { headers: pdfHeaders });
            }
          }
        } catch (streamErr) {
          console.error("[PDF API] Signed-URL stream failed:", streamErr);
        }
        // Fallback: buffered download.
        try {
          const buffer = await downloadFromSupabase(filePath);
          return new NextResponse(new Blob([new Uint8Array(buffer)]), {
            headers: pdfHeaders,
          });
        } catch (downloadErr) {
          console.error("[PDF API] Supabase download failed:", downloadErr);
          // Fallback to fetch if download fails
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
