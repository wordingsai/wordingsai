/**
 * /admin/users
 *
 * Cross-org list of every user in the platform with their primary org
 * affiliation and lifecycle dates.
 */
import { db } from "@/db/drizzle";
import { sql } from "drizzle-orm";
import { user, member, organization } from "@/db/schema";
import { format } from "date-fns";
import { UsersTable } from "@/components/admin/users-table";

export const dynamic = "force-dynamic";

async function loadUsers() {
  // Each user with their org membership count + most recent org name
  const rows = await db.execute(sql`
    SELECT
      u.id,
      u.email,
      u.name,
      u.role,
      u.email_verified,
      u.created_at,
      (SELECT count(*)::int FROM ${member} m WHERE m.user_id = u.id) AS membership_count,
      (
        SELECT o.name
        FROM ${member} m
        JOIN ${organization} o ON o.id = m.organization_id
        WHERE m.user_id = u.id
        ORDER BY m.created_at DESC
        LIMIT 1
      ) AS primary_org_name
    FROM "user" u
    ORDER BY u.created_at DESC
  `);

  // drizzle returns rows in `rows` property
  const data = (rows as any).rows ?? rows;
  return (data as Array<Record<string, any>>).map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name,
    role: r.role ?? "u",
    emailVerified: !!r.email_verified,
    primaryOrgName: r.primary_org_name as string | null,
    membershipCount: Number(r.membership_count ?? 0),
    createdAt: r.created_at
      ? format(new Date(r.created_at), "d MMM yyyy")
      : "—",
  }));
}

export default async function AdminUsersPage() {
  const users = await loadUsers();

  const byRole = users.reduce(
    (acc, u) => {
      acc[u.role] = (acc[u.role] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header className="space-y-1.5">
        <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight">
          Users
        </h1>
        <p className="text-sm text-on-surface-variant">
          Every account on the platform with their role and primary
          organization.
        </p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Total users" value={users.length} />
        <SummaryCard
          label="Super users"
          value={byRole["su"] ?? 0}
          tint="primary"
        />
        <SummaryCard
          label="Platform staff"
          value={byRole["psa"] ?? 0}
          tint="emerald"
        />
        <SummaryCard label="Standard users" value={byRole["u"] ?? 0} />
      </div>

      <UsersTable users={users} />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tint,
}: {
  label: string;
  value: number;
  tint?: "primary" | "emerald";
}) {
  const tintCls =
    tint === "primary"
      ? "text-primary"
      : tint === "emerald"
        ? "text-emerald-500"
        : "text-on-surface";
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-low p-5">
      <div className="text-xs text-on-surface-variant uppercase tracking-wider font-medium mb-1.5">
        {label}
      </div>
      <div className={`text-3xl font-semibold tracking-tight ${tintCls}`}>
        {value}
      </div>
    </div>
  );
}
