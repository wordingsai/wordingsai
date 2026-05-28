/**
 * /admin/global-rules
 *
 * Cross-org view of all rules. Rules don't have an isGlobal flag like
 * clauses do; they're org-scoped. This view shows ALL rules platform-wide
 * with their owning org.
 */
import { db } from "@/db/drizzle";
import { sql } from "drizzle-orm";
import { rules, organization } from "@/db/schema";
import { format } from "date-fns";
import { RulesAdminTable } from "@/components/admin/rules-admin-table";

export const dynamic = "force-dynamic";

async function loadRules() {
  const data = await db.execute(sql`
    SELECT
      r.id,
      r.name,
      r.category,
      r.status,
      r.approval_status,
      r.organization_id,
      r.created_at,
      o.name AS org_name
    FROM rules r
    LEFT JOIN organization o ON o.id = r.organization_id
    ORDER BY r.created_at DESC
    LIMIT 1000
  `);

  const rows = (data as any).rows ?? data;
  return (rows as Array<Record<string, any>>).map((r) => ({
    id: r.id,
    name: r.name as string,
    category: (r.category as string) ?? "—",
    status: (r.status as string) ?? "—",
    approvalStatus: (r.approval_status as string) ?? "Approved",
    orgName: r.org_name as string | null,
    createdAt: r.created_at
      ? format(new Date(r.created_at), "d MMM yyyy")
      : "—",
  }));
}

export default async function AdminGlobalRulesPage() {
  const items = await loadRules();

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header className="space-y-1.5">
        <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight">
          Rules
        </h1>
        <p className="text-sm text-on-surface-variant">
          Every analysis rule on the platform. Filter by org to drill into a
          specific tenant's rulebook.
        </p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <SummaryCard label="Total rules" value={items.length} />
        <SummaryCard
          label="Approved"
          value={items.filter((r) => r.approvalStatus === "Approved").length}
          tint="emerald"
        />
        <SummaryCard
          label="Pending review"
          value={items.filter((r) => r.approvalStatus !== "Approved").length}
          tint="amber"
        />
      </div>

      <RulesAdminTable items={items} />
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
  tint?: "emerald" | "amber";
}) {
  const tintCls =
    tint === "emerald"
      ? "text-emerald-500"
      : tint === "amber"
        ? "text-amber-500"
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
