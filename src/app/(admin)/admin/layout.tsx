/**
 * Admin route layout.
 *
 * Server-side role gate: any non `psa` / `su` user is redirected to /dashboard.
 * Renders the admin chrome (sidebar + top bar). All pages under /admin/* live here.
 *
 * The admin panel reads CROSS-ORG data (every organisation, every user, every
 * clause). The non-admin product surfaces (/contracts, /clause-library, etc.)
 * remain org-scoped — those routes are unaffected by this layout.
 */
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
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

  const role = (session.user as any).role as string | null | undefined;
  const allowed = role === "psa" || role === "su";
  if (!allowed) {
    redirect("/dashboard");
  }

  return (
    <AdminShell
      userName={session.user.name ?? ""}
      userEmail={session.user.email}
      userImage={(session.user as any).image ?? null}
      role={role ?? "u"}
    >
      {children}
    </AdminShell>
  );
}
