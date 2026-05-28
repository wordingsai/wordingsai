/**
 * /admin/users
 *
 * Cross-org list of every user in the platform with their primary org
 * affiliation and lifecycle dates.
 *
 * Implementation note: we deliberately do two simple queries and aggregate in
 * JS instead of one big SQL with correlated subqueries. The dataset is small
 * (admin-only view), and the previous raw-SQL approach with `${member}`
 * interpolation was throwing on Neon serverless.
 */
import { db } from "@/db/drizzle";
import { desc, eq } from "drizzle-orm";
import { user, member, organization } from "@/db/schema";
import { format } from "date-fns";
import { UsersTable } from "@/components/admin/users-table";

export const dynamic = "force-dynamic";

async function loadUsers() {
  const [users, memberships] = await Promise.all([
    db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      })
      .from(user)
      .orderBy(desc(user.createdAt)),
    db
      .select({
        userId: member.userId,
        orgName: organization.name,
        memberCreatedAt: member.createdAt,
      })
      .from(member)
      .leftJoin(organization, eq(member.organizationId, organization.id)),
  ]);

  // Per-user index of memberships, newest first.
  const byUser = new Map<
    string,
    { orgName: string | null; memberCreatedAt: Date }[]
  >();
  for (const m of memberships) {
    const list = byUser.get(m.userId) ?? [];
    list.push({
      orgName: m.orgName,
      memberCreatedAt: m.memberCreatedAt as Date,
    });
    byUser.set(m.userId, list);
  }
  for (const list of byUser.values()) {
    list.sort(
      (a, b) =>
        new Date(b.memberCreatedAt).getTime() -
        new Date(a.memberCreatedAt).getTime(),
    );
  }

  return users.map((u) => {
    const ms = byUser.get(u.id) ?? [];
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role ?? "u",
      emailVerified: !!u.emailVerified,
      primaryOrgName: ms[0]?.orgName ?? null,
      membershipCount: ms.length,
      createdAt: u.createdAt
        ? format(new Date(u.createdAt), "d MMM yyyy")
        : "—",
    };
  });
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
