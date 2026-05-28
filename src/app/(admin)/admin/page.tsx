/**
 * /admin — Dashboard
 *
 * Platform-wide overview. Cross-org reads (no organization filter applied).
 * Numbers tally every organisation, every user, every contract, every rule
 * in the database. Counterpart of the legacy PSA admin's "Sovereign Overview".
 */
import { db } from "@/db/drizzle";
import { sql } from "drizzle-orm";
import {
  organization,
  user,
  contracts,
  rules,
  clauses,
} from "@/db/schema";
import {
  Building2,
  Users,
  FileText,
  Scale,
  BookOpen,
  Activity,
} from "lucide-react";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

async function loadStats() {
  const [[orgRow], [userRow], [contractRow], [ruleRow], [clauseRow]] =
    await Promise.all([
      db.select({ n: sql<number>`count(*)::int` }).from(organization),
      db.select({ n: sql<number>`count(*)::int` }).from(user),
      db.select({ n: sql<number>`count(*)::int` }).from(contracts),
      db.select({ n: sql<number>`count(*)::int` }).from(rules),
      db.select({ n: sql<number>`count(*)::int` }).from(clauses),
    ]);

  // Recent activity: last 10 user + org + contract creations
  const recentUsers = await db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    })
    .from(user)
    .orderBy(sql`${user.createdAt} desc`)
    .limit(5);

  const recentOrgs = await db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      createdAt: organization.createdAt,
    })
    .from(organization)
    .orderBy(sql`${organization.createdAt} desc`)
    .limit(5);

  return {
    organizations: orgRow?.n ?? 0,
    users: userRow?.n ?? 0,
    contracts: contractRow?.n ?? 0,
    rules: ruleRow?.n ?? 0,
    clauses: clauseRow?.n ?? 0,
    recentUsers,
    recentOrgs,
  };
}

export default async function AdminDashboardPage() {
  const stats = await loadStats();

  return (
    <div className="p-6 lg:p-8 space-y-8">
      <header className="space-y-1.5">
        <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight">
          Platform overview
        </h1>
        <p className="text-sm text-on-surface-variant">
          Global parameters and architectural integrity across every
          organization on WordingsAI.
        </p>
      </header>

      {/* Stat grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          label="Total organizations"
          value={stats.organizations}
          icon={Building2}
          tint="primary"
        />
        <StatCard
          label="Total users"
          value={stats.users}
          icon={Users}
          tint="secondary"
        />
        <StatCard
          label="Total contracts"
          value={stats.contracts}
          icon={FileText}
          tint="primary"
        />
        <StatCard
          label="Active rules"
          value={stats.rules}
          icon={Scale}
          tint="emerald"
          accent="Stable"
        />
        <StatCard
          label="Global clauses"
          value={stats.clauses}
          icon={BookOpen}
          tint="secondary"
        />
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActivityCard title="Latest users">
          {stats.recentUsers.length === 0 ? (
            <EmptyRow text="No users yet." />
          ) : (
            stats.recentUsers.map((u) => (
              <ActivityRow
                key={u.id}
                primary={u.name ?? u.email}
                secondary={u.email}
                date={u.createdAt}
              />
            ))
          )}
        </ActivityCard>

        <ActivityCard title="Latest organizations">
          {stats.recentOrgs.length === 0 ? (
            <EmptyRow text="No organizations yet." />
          ) : (
            stats.recentOrgs.map((o) => (
              <ActivityRow
                key={o.id}
                primary={o.name}
                secondary={`/${o.slug}`}
                date={o.createdAt}
              />
            ))
          )}
        </ActivityCard>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tint,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  tint: "primary" | "secondary" | "emerald";
  accent?: string;
}) {
  const tintMap = {
    primary: "bg-primary/10 text-primary",
    secondary: "bg-secondary/15 text-secondary",
    emerald: "bg-emerald-500/10 text-emerald-500",
  } as const;
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-low p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className={`p-2 rounded-lg ${tintMap[tint]}`}>
          <Icon className="size-4" />
        </div>
        {accent ? (
          <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md">
            {accent}
          </span>
        ) : null}
      </div>
      <div>
        <div className="text-3xl font-semibold tracking-tight">{value}</div>
        <div className="text-xs text-on-surface-variant mt-1 uppercase tracking-wider font-medium">
          {label}
        </div>
      </div>
    </div>
  );
}

function ActivityCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-low overflow-hidden">
      <div className="px-5 py-3 border-b border-outline-variant flex items-center gap-2">
        <Activity className="size-4 text-primary" />
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      </div>
      <div className="divide-y divide-outline-variant/40">{children}</div>
    </div>
  );
}

function ActivityRow({
  primary,
  secondary,
  date,
}: {
  primary: string;
  secondary: string;
  date: Date | string | null;
}) {
  return (
    <div className="px-5 py-3 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="text-sm text-on-surface truncate">{primary}</div>
        <div className="text-xs text-on-surface-variant truncate">
          {secondary}
        </div>
      </div>
      <div className="text-xs text-on-surface-variant/70 shrink-0">
        {date ? format(new Date(date), "d MMM yyyy") : "—"}
      </div>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="px-5 py-8 text-center text-sm text-on-surface-variant">
      {text}
    </div>
  );
}
