/**
 * /admin/organizations
 *
 * Cross-org list of every tenant on the platform with member counts and
 * lifecycle dates. Search filter on the client.
 */
import { db } from "@/db/drizzle";
import { sql, eq } from "drizzle-orm";
import { organization, member, contracts } from "@/db/schema";
import { format } from "date-fns";
import { OrganizationsTable } from "@/components/admin/organizations-table";

export const dynamic = "force-dynamic";

async function loadOrganizations() {
  const rows = await db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      plan: organization.plan,
      createdAt: organization.createdAt,
      memberCount: sql<number>`(SELECT count(*)::int FROM ${member} WHERE ${member.organizationId} = ${organization.id})`,
      contractCount: sql<number>`(SELECT count(*)::int FROM ${contracts} WHERE ${contracts.organizationId} = ${organization.id})`,
    })
    .from(organization)
    .orderBy(sql`${organization.createdAt} desc`);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug ?? "",
    plan: r.plan ?? "basic",
    memberCount: r.memberCount ?? 0,
    contractCount: r.contractCount ?? 0,
    createdAt: r.createdAt
      ? format(new Date(r.createdAt), "d MMM yyyy")
      : "—",
  }));
}

export default async function AdminOrganizationsPage() {
  const orgs = await loadOrganizations();

  const totalOrgs = orgs.length;
  const enterpriseCount = orgs.filter((o) => o.plan === "plus").length;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header className="space-y-1.5">
        <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight">
          Organizations
        </h1>
        <p className="text-sm text-on-surface-variant">
          Every tenant on WordingsAI: their plan, member count, and contracts
          in flight.
        </p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <SummaryCard label="Total organizations" value={totalOrgs} />
        <SummaryCard label="On Plus plan" value={enterpriseCount} />
        <SummaryCard
          label="Active now"
          value={
            orgs.filter((o) => o.contractCount > 0).length
          }
          suffix={`/ ${totalOrgs}`}
        />
      </div>

      <OrganizationsTable orgs={orgs} />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-low p-5">
      <div className="text-xs text-on-surface-variant uppercase tracking-wider font-medium mb-1.5">
        {label}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold tracking-tight">{value}</span>
        {suffix ? (
          <span className="text-sm text-on-surface-variant">{suffix}</span>
        ) : null}
      </div>
    </div>
  );
}
