/**
 * GET /api/me
 *
 * Returns the current user's profile fields that AREN'T included in the
 * Better Auth session payload by default (notably: role).
 *
 * Client components use this to gate role-aware UI (e.g. the Admin panel
 * link in nav-user). The /admin layout also enforces the gate
 * server-side so this endpoint is purely a UX optimisation — bypassing it
 * does not grant any access.
 */
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/drizzle";
import { user as userTable } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [row] = await db
    .select({
      id: userTable.id,
      email: userTable.email,
      name: userTable.name,
      role: userTable.role,
      emailVerified: userTable.emailVerified,
    })
    .from(userTable)
    .where(eq(userTable.id, session.user.id))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    emailVerified: row.emailVerified,
  });
}
