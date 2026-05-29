"use client";

import React, { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  AlertTriangle,
  Handshake,
  CheckCircle,
  FileText,
  Download,
  Filter,
  ShieldAlert,
  Flame,
  Clock,
  PieChart,
  Activity,
  ChevronRight,
  ShieldCheck,
  Zap,
} from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { useCurrentPlan } from "@/hooks/use-current-plan";
import { UpgradePaywall } from "@/components/common/upgrade-paywall";

type TrendingClause = {
  id: string;
  name: string;
  count: number;
};

type LatestClause = {
  id: string;
  name: string;
  createdAt: string;
};

type AnalyticsData = {
  summary: {
    totalContracts: number;
    avgRiskScore: number;
    activeContracts: number;
    riskDist: {
      Red: number;
      Amber: number;
      Green: number;
      Total: number;
    };
  };
  distributions: {
    typeMix: Array<{ contractType: string; count: number }>;
  };
  trendingApproved: TrendingClause[];
  trendingNotApproved: TrendingClause[];
  trendingVariations: TrendingClause[];
  latestClauses: LatestClause[];
  healthCheck: {
    approvedCount: number;
    unapprovedCount: number;
  };
  marketIntelligence?: Array<{
    title: string;
    trend: "up" | "down" | "neutral";
    detail: string;
    impact: "high" | "medium" | "low";
  }>;
};

export default function AnalyticsPage(props: {
  params: Promise<any>;
  searchParams: Promise<any>;
}) {
  const { plan, isPending: isPlanPending } = useCurrentPlan();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"trending" | "portfolio">(
    "trending",
  );

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await fetch("/api/analytics");
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error("Error fetching analytics:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading || isPlanPending) {
    return (
      <main className="flex-1 p-4 lg:p-6 min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin text-primary">
          <ShieldCheck className="h-8 w-8 text-primary" />
        </div>
      </main>
    );
  }

  if (plan === "fast") {
    return (
      <UpgradePaywall
        title="Access Denied"
        description="To access comprehensive portfolio risk and wording distribution reports, your organization needs higher intelligence tier features."
        featureName="Reports & KPIs"
      />
    );
  }

  const complianceScore = Math.max(0, 100 - (data?.summary?.avgRiskScore || 0));

  return (
    <main className="flex-1 p-4 lg:p-6 min-h-screen bg-background text-foreground transition-colors duration-300 overflow-x-hidden">
      <div className="mb-5">
        <Breadcrumb className="mb-2">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                Intelligence Dashboard
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h1 className="text-xl font-semibold tracking-tight text-on-surface">
              Reports & KPIs
            </h1>
            <p className="text-on-surface-variant text-sm max-w-2xl">
              Comprehensive portfolio risk and wording distribution analysis.
            </p>
          </div>
          <div className="flex bg-surface-container rounded-md p-0.5 border border-outline-variant/60">
            <button
              onClick={() => setActiveTab("trending")}
              className={cn(
                "px-4 py-1.5 rounded text-xs font-medium uppercase tracking-wider transition-all",
                activeTab === "trending"
                  ? "bg-primary text-primary-foreground"
                  : "text-on-surface-variant hover:text-on-surface",
              )}
            >
              Trending
            </button>
            <button
              onClick={() => setActiveTab("portfolio")}
              className={cn(
                "px-4 py-1.5 rounded text-xs font-medium uppercase tracking-wider transition-all",
                activeTab === "portfolio"
                  ? "bg-primary text-primary-foreground"
                  : "text-on-surface-variant hover:text-on-surface",
              )}
            >
              Portfolio
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard
          title="Total Contracts"
          value={data?.summary.totalContracts || 0}
          icon={<FileText className="size-4 text-primary" />}
          trend="+12% Trend"
        />
        <KpiCard
          title="Risk Exposure"
          value={data?.summary.riskDist.Red || 0}
          icon={<AlertTriangle className="size-4 text-rose-400" />}
          subValue={`${Math.round(((data?.summary.riskDist.Red || 0) / (data?.summary.riskDist.Total || 1)) * 100)}% High Risk`}
          isDestructive
        />
        <KpiCard
          title="Active Treaties"
          value={
            data?.distributions.typeMix.find(
              (m) => m.contractType === "reinsurance",
            )?.count || 0
          }
          icon={<Handshake className="size-4 text-secondary" />}
          subValue="Primary Structures"
        />
        <KpiCard
          title="Compliance"
          value={`${complianceScore}%`}
          icon={<ShieldCheck className="size-4 text-emerald-400" />}
          subValue={complianceScore > 80 ? "Optimized" : "Attention Required"}
        />
      </div>

      {activeTab === "trending" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-in fade-in duration-500">
          <ClauseTrendList
            title="Trending Clauses — Approved"
            items={data?.trendingApproved || []}
            status="Approved"
            color="emerald"
          />
          <ClauseTrendList
            title="Trending Clauses — Not Approved"
            items={data?.trendingNotApproved || []}
            status="Not Approved"
            color="rose"
          />
          <ClauseTrendList
            title="Semantic Variations"
            items={data?.trendingVariations || []}
            status="Variation"
            color="amber"
          />
          <LatestClauseList
            title="Latest Library Additions"
            items={data?.latestClauses || []}
          />
        </div>
      ) : (
        <div className="space-y-4 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-8 bg-surface-container-low border border-outline-variant/60 p-4 rounded-lg">
              <h3 className="text-sm font-semibold text-on-surface mb-4 flex items-center gap-2">
                <PieChart className="size-4 text-primary" /> Portfolio
                Composition
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="space-y-3">
                  {data?.distributions.typeMix.map((m, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                        <span className="truncate pr-2">{m.contractType}</span>
                        <span className="tabular-nums shrink-0">
                          {Math.round(
                            (m.count / (data?.summary.totalContracts || 1)) *
                              100,
                          )}
                          %
                        </span>
                      </div>
                      <div className="h-2 bg-surface-container-highest rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{
                            width: `${(m.count / (data?.summary.totalContracts || 1)) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-center">
                  <div className="size-28 rounded-full border-8 border-primary/10 flex items-center justify-center relative">
                    <div className="text-center">
                      <span className="text-2xl font-semibold text-on-surface tracking-tight tabular-nums">
                        {data?.summary.totalContracts}
                      </span>
                      <p className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">
                        Total assets
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 bg-primary/10 border border-primary/20 p-4 rounded-lg flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-on-surface mb-1.5">
                  Portfolio Health
                </h3>
                <p className="text-on-surface-variant text-xs leading-relaxed mb-5">
                  Current ratio of approved vs. unapproved clauses across the
                  entire digital portfolio.
                </p>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface">
                    Approved
                  </span>
                  <span className="text-base font-semibold text-on-surface tabular-nums">
                    {data?.healthCheck.approvedCount}
                  </span>
                </div>
                <div className="h-2 bg-surface-container-highest rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{
                      width: `${((data?.healthCheck.approvedCount || 0) / ((data?.healthCheck.approvedCount || 0) + (data?.healthCheck.unapprovedCount || 0) || 1)) * 100}%`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                    Requires Review
                  </span>
                  <span className="text-base font-semibold text-on-surface tabular-nums">
                    {data?.healthCheck.unapprovedCount}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function KpiCard({
  title,
  value,
  icon,
  subValue,
  trend,
  isDestructive = false,
}: any) {
  return (
    <div
      className={cn(
        "bg-surface-container-low border border-outline-variant/60 p-3.5 rounded-lg hover:border-primary/40 transition-all group",
        isDestructive && "hover:border-rose-500/40",
      )}
    >
      <div className="flex justify-between items-center mb-2.5">
        <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant group-hover:text-primary transition-colors">
          {title}
        </span>
        <div className="p-1.5 bg-surface-container-high rounded-md shrink-0">
          {icon}
        </div>
      </div>
      <div>
        <div
          className={cn(
            "text-2xl font-semibold tracking-tight tabular-nums",
            isDestructive ? "text-rose-400" : "text-on-surface",
          )}
        >
          {value}
        </div>
        {trend ? (
          <div className="mt-2 text-[10px] text-emerald-400 font-semibold uppercase tracking-wider flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 w-fit px-2 py-0.5 rounded">
            <TrendingUp className="w-3 h-3" /> {trend}
          </div>
        ) : (
          <div className="mt-2 text-[10px] text-on-surface-variant font-medium uppercase tracking-wider px-2 py-0.5 bg-surface-container rounded w-fit">
            {subValue}
          </div>
        )}
      </div>
    </div>
  );
}

function ClauseTrendList({ title, items, status, color }: any) {
  return (
    <div className="bg-surface-container-low border border-outline-variant/60 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-on-surface mb-3 uppercase tracking-wide flex items-center gap-2">
        <Flame
          className={cn(
            "size-4",
            color === "rose"
              ? "text-rose-400"
              : color === "amber"
                ? "text-amber-400"
                : "text-emerald-400",
          )}
        />{" "}
        {title}
      </h3>
      <div className="space-y-1.5">
        {items.map((item: any, i: number) => (
          <div
            key={i}
            className="flex items-center justify-between gap-3 p-2.5 rounded-md bg-surface-container-high/50 border border-outline-variant/30 group hover:border-primary/30 transition-all"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-xs font-semibold text-on-surface-variant/40 w-4 shrink-0">
                {i + 1}
              </span>
              <span className="text-sm font-medium text-on-surface group-hover:text-primary transition-colors truncate">
                {item.name}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge
                variant="outline"
                className={cn(
                  "text-[9px] font-semibold uppercase border",
                  color === "rose"
                    ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                    : color === "amber"
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                )}
              >
                {status}
              </Badge>
              <span className="text-sm font-semibold text-on-surface tabular-nums">
                {item.count}{" "}
                <span className="text-[9px] text-on-surface-variant">Hits</span>
              </span>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-center text-xs italic text-on-surface-variant py-6">
            No trending data for this period.
          </p>
        )}
      </div>
    </div>
  );
}

function LatestClauseList({ title, items }: any) {
  return (
    <div className="bg-surface-container-low border border-outline-variant/60 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-on-surface mb-3 uppercase tracking-wide flex items-center gap-2">
        <Clock className="size-4 text-indigo-400" /> {title}
      </h3>
      <div className="space-y-1.5">
        {items.map((item: any, i: number) => (
          <div
            key={i}
            className="flex items-center justify-between gap-3 p-2.5 rounded-md bg-surface-container-high/50 border border-outline-variant/30"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="size-8 bg-indigo-500/10 border border-indigo-500/20 rounded-md flex items-center justify-center shrink-0">
                <FileText className="size-4 text-indigo-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-on-surface truncate">
                  {item.name}
                </p>
                <p className="text-[9px] font-semibold uppercase text-on-surface-variant/60">
                  {format(new Date(item.createdAt), "dd MMM yyyy")}
                </p>
              </div>
            </div>
            <ChevronRight className="size-4 text-on-surface-variant shrink-0" />
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-center text-xs italic text-on-surface-variant py-6">
            No new clauses added recently.
          </p>
        )}
      </div>
    </div>
  );
}
