/**
 * /admin/clause-library
 *
 * Cross-org view of all clauses with admin filters (global / org-shared /
 * user-private). The org-side clause library at /clause-library remains
 * org-scoped; this view is the only place to see everything.
 */
import { db } from "@/db/drizzle";
import { sql, desc } from "drizzle-orm";
import { clauses, organization, user } from "@/db/schema";
import { format } from "date-fns";
import { ClausesAdminTable } from "@/components/admin/clauses-admin-table";

export const dynamic = "force-dynamic";

async function loadClauses() {
  const rows = await db.execute(sql`
    SELECT
      c.id,
      c.clause_name,
      c.clause_category,
      c.status,
      c.library,
      c.code,
      c.is_global,
      c.organization_id,
      c.owner_user_id,
      c.created_at,
      o.name AS org_name,
      u.email AS owner_email
    FROM clauses c
    LEFT JOIN organization o ON o.id = c.organization_id
    LEFT JOIN "user" u ON u.id = c.owner_user_id
    ORDER BY c.created_at DESC
    LIMIT 1000
  `);

  const data = (rows as any).rows ?? rows;
  return (data as Array<Record<string, any>>).map((r) => ({
    id: r.id,
    name: r.clause_name,
    category: r.clause_category,
    status: r.status,
    approvalStatus: r.status,
    library: r.library,
    code: r.code as string | null,
    scope: r.is_global
      ? ("global" as const)
      : r.owner_user_id
        ? ("user" as const)
        : r.organization_id
          ? ("org" as const)
          : ("orphan" as const),
    orgName: r.org_name as string | null,
    ownerEmail: r.owner_email as string | null,
    createdAt: r.created_at
      ? format(new Date(r.created_at), "d MMM yyyy")
      : "—",
  }));
}

export default async function AdminClauseLibraryPage() {
  const items = await loadClauses();

  const byScope = items.reduce(
    (acc, c) => {
      acc[c.scope] = (acc[c.scope] ?? 0) + 1;
      return acc;
    },
    { global: 0, org: 0, user: 0, orphan: 0 } as Record<string, number>,
  );

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header className="space-y-1.5">
        <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight">
          Clause library
        </h1>
        <p className="text-sm text-on-surface-variant">
          All clauses across the platform. Filter by scope to drill into
          global library entries, org-shared clauses, or private user
          additions.
        </p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Total clauses" value={items.length} />
        <SummaryCard label="Global library" value={byScope.global} tint="primary" />
        <SummaryCard label="Org-shared" value={byScope.org} tint="secondary" />
        <SummaryCard label="User-private" value={byScope.user} tint="emerald" />
      </div>

      <ClausesAdminTable items={items} />
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
  tint?: "primary" | "secondary" | "emerald";
}) {
  const tintCls =
    tint === "primary"
      ? "text-primary"
      : tint === "secondary"
        ? "text-secondary"
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
