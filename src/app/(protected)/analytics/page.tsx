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
      <main className="flex-1 p-4 lg:p-10 min-h-screen bg-background flex items-center justify-center">
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
    <main className="flex-1 p-4 lg:p-10 min-h-screen bg-background text-foreground transition-colors duration-300 overflow-x-hidden">
      <div className="mb-8 lg:mb-10">
        <Breadcrumb className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                Intelligence Dashboard
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-on-surface">
              Reports & KPIs
            </h1>
            <p className="text-on-surface-variant text-base lg:text-lg font-medium max-w-2xl">
              Comprehensive portfolio risk and wording distribution analysis.
            </p>
          </div>
          <div className="flex bg-surface-container rounded-xl p-1 border border-outline-variant">
            <button
              onClick={() => setActiveTab("trending")}
              className={cn(
                "px-6 py-2 rounded-lg text-xs font-medium uppercase tracking-wider transition-all",
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
                "px-6 py-2 rounded-lg text-xs font-medium uppercase tracking-wider transition-all",
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10 lg:mb-12">
        <KpiCard
          title="Total Contracts"
          value={data?.summary.totalContracts || 0}
          icon={<FileText className="text-primary" />}
          trend="+12% Trend"
        />
        <KpiCard
          title="Risk Exposure"
          value={data?.summary.riskDist.Red || 0}
          icon={<AlertTriangle className="text-destructive" />}
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
          icon={<Handshake className="text-secondary" />}
          subValue="Primary Structures"
        />
        <KpiCard
          title="Compliance"
          value={`${complianceScore}%`}
          icon={<ShieldCheck className="text-emerald-500" />}
          subValue={complianceScore > 80 ? "Optimized" : "Attention Required"}
        />
      </div>

      {activeTab === "trending" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-500">
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
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 bg-surface-container-low border border-outline-variant p-10 rounded-xl shadow-sm">
              <h3 className="text-2xl font-black text-on-surface mb-10 uppercase tracking-tight flex items-center gap-3">
                <PieChart className="size-7 text-primary" /> Portfolio
                Composition
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                  {data?.distributions.typeMix.map((m, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex justify-between text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                        <span>{m.contractType}</span>
                        <span>
                          {Math.round(
                            (m.count / (data?.summary.totalContracts || 1)) *
                              100,
                          )}
                          %
                        </span>
                      </div>
                      <div className="h-4 bg-surface-container-highest rounded-full overflow-hidden">
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
                  <div className="size-48 rounded-full border-[20px] border-primary/10 flex items-center justify-center relative">
                    <div className="text-center">
                      <span className="text-4xl font-black text-on-surface">
                        {data?.summary.totalContracts}
                      </span>
                      <p className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                        Total Assets
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 bg-primary p-10 rounded-xl text-white shadow-2xl shadow-primary/20 flex flex-col justify-between">
              <div>
                <h3 className="text-2xl font-black mb-4 uppercase tracking-tight">
                  Portfolio Health
                </h3>
                <p className="text-white/80 text-sm font-medium leading-relaxed mb-10">
                  Current ratio of approved vs. unapproved clauses across the
                  entire digital portfolio.
                </p>
              </div>
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-widest">
                    Approved
                  </span>
                  <span className="text-2xl font-black">
                    {data?.healthCheck.approvedCount}
                  </span>
                </div>
                <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white"
                    style={{
                      width: `${((data?.healthCheck.approvedCount || 0) / ((data?.healthCheck.approvedCount || 0) + (data?.healthCheck.unapprovedCount || 0) || 1)) * 100}%`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-widest text-white/60">
                    Requires Review
                  </span>
                  <span className="text-2xl font-black">
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
        "bg-surface-container-low border border-outline-variant p-8 rounded-xl shadow-sm hover:border-primary/50 transition-all group",
        isDestructive && "hover:border-destructive/50",
      )}
    >
      <div className="flex justify-between items-start mb-6">
        <span className="text-xs font-medium uppercase tracking-wider text-on-surface-variant group-hover:text-primary transition-colors">
          {title}
        </span>
        <div className="p-3 bg-surface-container-highest rounded-2xl">
          {icon}
        </div>
      </div>
      <div>
        <div
          className={cn(
            "text-5xl font-black tracking-tighter",
            isDestructive ? "text-destructive" : "text-on-surface",
          )}
        >
          {value}
        </div>
        {trend ? (
          <div className="mt-4 text-[10px] text-emerald-500 font-black uppercase tracking-widest flex items-center gap-1.5 bg-emerald-500/10 w-fit px-3 py-1 rounded-full">
            <TrendingUp className="w-3 h-3" /> {trend}
          </div>
        ) : (
          <div className="mt-4 text-[10px] text-on-surface-variant font-black uppercase tracking-widest px-3 py-1 bg-surface-container rounded-full w-fit">
            {subValue}
          </div>
        )}
      </div>
    </div>
  );
}

function ClauseTrendList({ title, items, status, color }: any) {
  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-xl p-10 shadow-sm">
      <h3 className="text-xl font-black text-on-surface mb-8 uppercase tracking-tight flex items-center gap-3">
        <Flame
          className={cn(
            "size-6",
            color === "rose"
              ? "text-rose-500"
              : color === "amber"
                ? "text-amber-500"
                : "text-emerald-500",
          )}
        />{" "}
        {title}
      </h3>
      <div className="space-y-4">
        {items.map((item: any, i: number) => (
          <div
            key={i}
            className="flex items-center justify-between p-4 rounded-2xl bg-surface-container-high/50 border border-outline-variant/30 group hover:border-primary/30 transition-all"
          >
            <div className="flex items-center gap-4">
              <span className="text-xs font-black text-on-surface-variant/40 w-4">
                {i + 1}
              </span>
              <span className="text-sm font-bold text-on-surface group-hover:text-primary transition-colors">
                {item.name}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Badge
                variant="outline"
                className={cn(
                  "text-[8px] font-black uppercase",
                  color === "rose"
                    ? "bg-rose-500/10 text-rose-500"
                    : color === "amber"
                      ? "bg-amber-500/10 text-amber-500"
                      : "bg-emerald-500/10 text-emerald-500",
                )}
              >
                {status}
              </Badge>
              <span className="text-sm font-semibold text-on-surface">
                {item.count}{" "}
                <span className="text-[9px] text-on-surface-variant">Hits</span>
              </span>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-center text-xs italic text-on-surface-variant py-10">
            No trending data for this period.
          </p>
        )}
      </div>
    </div>
  );
}

function LatestClauseList({ title, items }: any) {
  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-xl p-10 shadow-sm">
      <h3 className="text-xl font-black text-on-surface mb-8 uppercase tracking-tight flex items-center gap-3">
        <Clock className="size-6 text-indigo-500" /> {title}
      </h3>
      <div className="space-y-4">
        {items.map((item: any, i: number) => (
          <div
            key={i}
            className="flex items-center justify-between p-4 rounded-2xl bg-surface-container-high/50 border border-outline-variant/30"
          >
            <div className="flex items-center gap-4">
              <div className="size-10 bg-indigo-500/10 rounded-xl flex items-center justify-center">
                <FileText className="size-5 text-indigo-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-on-surface">{item.name}</p>
                <p className="text-[9px] font-black uppercase text-on-surface-variant/60">
                  {format(new Date(item.createdAt), "dd MMM yyyy")}
                </p>
              </div>
            </div>
            <ChevronRight className="size-4 text-on-surface-variant" />
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-center text-xs italic text-on-surface-variant py-10">
            No new clauses added recently.
          </p>
        )}
      </div>
    </div>
  );
}
