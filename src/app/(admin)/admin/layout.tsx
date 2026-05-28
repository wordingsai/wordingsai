/**
 * Admin route layout.
 *
 * Server-side role gate: any non `psa` / `su` user is redirected to /dashboard.
 * Renders the admin chrome (sidebar + top bar). All pages under /admin/* live here.
 *
 * The admin panel reads CROSS-ORG data (every organisation, every user, every
 * clause). The non-admin product surfaces (/contracts, /clause-library, etc.)
 * remain org-scoped — those routes are unaffected by this layout.
 *
 * Why we query the DB for role instead of trusting session.user.role:
 *   Better Auth's session only includes the user fields declared in the
 *   auth config. Our `role` column is on the user table but not in the
 *   session payload, so session.user.role is always undefined. Rather than
 *   reshape the whole session config (which would touch login flows), we
 *   just hit the DB once per admin page load — cheap, bulletproof, and the
 *   admin surface is low-traffic anyway.
 */
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/drizzle";
import { user as userTable } from "@/db/schema";
import { AdminShell } from "@/components/admin/admin-shell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/login?redirect=/admin");
  }

  const [userRow] = await db
    .select({
      role: userTable.role,
      name: userTable.name,
      email: userTable.email,
      image: userTable.image,
    })
    .from(userTable)
    .where(eq(userTable.id, session.user.id))
    .limit(1);

  const role = userRow?.role ?? null;
  const allowed = role === "psa" || role === "su";
  if (!allowed) {
    redirect("/dashboard");
  }

  return (
    <AdminShell
      userName={userRow?.name ?? session.user.name ?? ""}
      userEmail={userRow?.email ?? session.user.email}
      userImage={userRow?.image ?? null}
      role={role}
    >
      {children}
    </AdminShell>
  );
}
