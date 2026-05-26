"use client";

import React, { useEffect, useState } from "react";
import { Link } from "next-view-transitions";
import { motion } from "framer-motion";
import {
  staggerContainer,
  staggerItem,
} from "@/components/common/page-transition";
import {
  Plus,
  FileText,
  Activity,
  ArrowUpRight,
  Search,
  BrainCircuit,
  History,
  Sparkles,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  Eye,
  Copy,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const recentTags = Array.from(
    new Set(
      activities
        .filter((a: any) => a.type === "contract")
        .flatMap((c: any) => c.tags || []),
    ),
  ).slice(0, 3);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [statsRes, activityRes] = await Promise.all([
          fetch("/api/analytics"),
          fetch("/api/activity"),
        ]);
        const statsData = await statsRes.json();
        const activityData = await activityRes.json();
        setStats(statsData);
        setActivities(activityData);
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  return (
    <main className="flex-1 p-6 lg:p-8 bg-background transition-colors duration-300">
      <TooltipProvider>
        {/* Page header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-8">
          <div className="space-y-1.5">
            <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-on-surface">
              Operational overview
            </h1>
            <p className="text-sm text-on-surface-variant max-w-2xl">
              WordingsAI is actively monitoring{" "}
              <span className="text-primary font-semibold">
                {stats?.summary?.totalContracts ?? 0}
              </span>{" "}
              active wordings.
            </p>
          </div>

          <div className="flex gap-2">
            <Link href="/contracts/upload">
              <Button size="lg" className="gap-2">
                <Plus className="size-4" />
                New wording
              </Button>
            </Link>
          </div>
        </div>

        {/* Quick stats */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8"
        >
          <motion.div variants={staggerItem} className="relative">
            {loading && (
              <Skeleton className="absolute inset-0 z-10 rounded-xl" />
            )}
            <Card className="bg-surface-container-low border-outline-variant rounded-xl overflow-hidden hover:border-primary/40 transition-all group p-5 h-full cursor-default">
              <CardHeader className="p-0 pb-3 space-y-3">
                <div className="flex justify-between items-center">
                  <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/15 transition-colors">
                    <FileText className="size-4 text-primary" />
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="outline"
                        className="bg-emerald-500/10 text-emerald-500 border-none font-medium text-[10px] uppercase tracking-wider cursor-help"
                      >
                        +
                        {
                          activities.filter((a: any) => a.type === "contract")
                            .length
                        }{" "}
                        new
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      New contracts in last session
                    </TooltipContent>
                  </Tooltip>
                </div>
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                  Central archive
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="text-3xl font-semibold text-on-surface tracking-tight">
                  {stats?.summary.totalContracts || 0}
                </div>
                <p className="text-xs text-on-surface-variant mt-1">
                  Total active contracts
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={staggerItem} className="relative">
            {loading && (
              <Skeleton className="absolute inset-0 z-10 rounded-xl" />
            )}
            <Card className="bg-surface-container-low border-outline-variant rounded-xl overflow-hidden hover:border-secondary/40 transition-all group p-5 h-full cursor-default">
              <CardHeader className="p-0 pb-3 space-y-3">
                <div className="flex justify-between items-center">
                  <div className="p-2 bg-secondary/15 rounded-lg group-hover:bg-secondary/20 transition-colors">
                    <TrendingUp className="size-4 text-secondary" />
                  </div>
                  <Badge
                    variant="outline"
                    className="bg-secondary/15 text-secondary border-none font-medium text-[10px] uppercase tracking-wider"
                  >
                    Optimal
                  </Badge>
                </div>
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                  Mean compliance
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="text-3xl font-semibold text-on-surface tracking-tight">
                  {Math.round(stats?.summary.avgRiskScore || 0)}%
                </div>
                <p className="text-xs text-on-surface-variant mt-1">
                  Aggregate portfolio health
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={staggerItem} className="relative">
            {loading && (
              <Skeleton className="absolute inset-0 z-10 rounded-xl" />
            )}
            <Card className="bg-destructive/5 border-destructive/15 rounded-xl overflow-hidden hover:border-destructive/40 transition-all group p-5 h-full cursor-default">
              <CardHeader className="p-0 pb-3 space-y-3">
                <div className="flex justify-between items-center">
                  <div className="p-2 bg-destructive/10 rounded-lg group-hover:bg-destructive/15 transition-colors">
                    <AlertCircle className="size-4 text-destructive" />
                  </div>
                  <Badge
                    variant="outline"
                    className="bg-destructive/10 text-destructive border-none font-medium text-[10px] uppercase tracking-wider"
                  >
                    Action required
                  </Badge>
                </div>
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-destructive/80">
                  Unresolved risks
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="text-3xl font-semibold text-destructive tracking-tight">
                  {(stats?.summary.riskDist.Red || 0) +
                    (stats?.summary.riskDist.Amber || 0)}
                </div>
                <p className="text-xs text-destructive/70 mt-1">
                  High-priority variances
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Detailed section */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Activity feed */}
          <div className="md:col-span-8 space-y-4">
            <div className="flex justify-between items-end px-1">
              <div className="space-y-0.5">
                <h2 className="text-lg font-semibold tracking-tight text-on-surface flex items-center gap-2">
                  <Activity className="size-4 text-primary" />
                  Activity
                </h2>
                <p className="text-xs text-on-surface-variant">
                  Continuous vetting stream
                </p>
              </div>
              <Link
                href="/contracts"
                className="text-xs font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
              >
                View archive <ArrowRight className="size-3" />
              </Link>
            </div>

            <Card className="bg-surface-container-low border border-outline-variant rounded-xl overflow-hidden">
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="show"
                className="p-2"
              >
                {loading
                  ? [1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-4 p-4">
                        <Skeleton className="size-10 rounded-lg" />
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-4 w-48" />
                          <Skeleton className="h-3 w-32" />
                        </div>
                      </div>
                    ))
                  : (activities as any[]).map((item) => (
                      <motion.div
                        key={item.id}
                        variants={staggerItem}
                        whileHover={{ x: 4 }}
                        transition={{
                          type: "spring",
                          stiffness: 300,
                          damping: 20,
                        }}
                      >
                        <ContextMenu>
                          <ContextMenuTrigger>
                            <Link
                              href={
                                item.type === "contract"
                                  ? `/contracts/${item.id}`
                                  : item.type === "rule"
                                    ? "/rules"
                                    : `/clause-library/${item.id}`
                              }
                              className="flex items-center justify-between group p-3 hover:bg-surface-container rounded-lg transition-all cursor-pointer border border-transparent hover:border-outline-variant/30"
                            >
                              <div className="flex items-center gap-3">
                                <div className="size-10 bg-surface-container-highest rounded-lg flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                                  {item.type === "contract" ? (
                                    <FileText className="size-4 text-on-surface-variant group-hover:text-primary transition-colors" />
                                  ) : item.type === "rule" ? (
                                    <BrainCircuit className="size-4 text-on-surface-variant group-hover:text-primary transition-colors" />
                                  ) : (
                                    <Sparkles className="size-4 text-on-surface-variant group-hover:text-primary transition-colors" />
                                  )}
                                </div>
                                <div>
                                  <h4 className="font-medium text-sm text-on-surface group-hover:text-primary transition-colors">
                                    {item.title}
                                  </h4>
                                  <p className="text-xs text-on-surface-variant mt-0.5">
                                    {item.action === "Created"
                                      ? "New"
                                      : "Updated"}{" "}
                                    {item.type === "contract"
                                      ? "contract"
                                      : item.type === "rule"
                                        ? "guardrail"
                                        : "clause"}{" "}
                                    ·{" "}
                                    {formatDistanceToNow(
                                      new Date(item.updatedAt),
                                    )}{" "}
                                    ago
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <Badge
                                  className={cn(
                                    "rounded-md font-medium text-[10px] uppercase tracking-wider px-2 py-0.5 border-none",
                                    item.type === "contract"
                                      ? "bg-emerald-500/10 text-emerald-500"
                                      : item.type === "rule"
                                        ? "bg-primary/10 text-primary"
                                        : "bg-amber-500/10 text-amber-500",
                                  )}
                                >
                                  {item.type}
                                </Badge>
                                <div className="size-7 rounded-md bg-surface-container-highest flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
                                  <ArrowUpRight className="size-3.5" />
                                </div>
                              </div>
                            </Link>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-48">
                            <ContextMenuItem
                              onClick={() => {
                                const url =
                                  item.type === "contract"
                                    ? `/contracts/${item.id}`
                                    : item.type === "rule"
                                      ? "/rules"
                                      : `/clause-library/${item.id}`;
                                window.location.href = url;
                              }}
                            >
                              <Eye className="mr-2 size-3.5 text-primary" />
                              View details
                            </ContextMenuItem>
                            <ContextMenuItem
                              onClick={() => {
                                navigator.clipboard.writeText(item.id);
                                toast.success("ID copied to clipboard");
                              }}
                            >
                              <Copy className="mr-2 size-3.5" />
                              Copy identifier
                            </ContextMenuItem>
                            <ContextMenuItem
                              onClick={() => {
                                const url =
                                  item.type === "contract"
                                    ? `/contracts/${item.id}`
                                    : item.type === "rule"
                                      ? "/rules"
                                      : `/clause-library/${item.id}`;
                                window.open(url, "_blank");
                              }}
                            >
                              <ExternalLink className="mr-2 size-3.5" />
                              Open in new tab
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      </motion.div>
                    ))}
                {!loading && activities.length === 0 && (
                  <div className="p-10 text-center text-sm text-on-surface-variant">
                    No recent activity.
                  </div>
                )}
              </motion.div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="md:col-span-4 space-y-4">
            <Card className="bg-primary p-6 rounded-xl shadow-lg shadow-primary/20 relative overflow-hidden group border-0">
              <div className="absolute -top-10 -right-10 size-32 bg-white/10 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-1000" />
              <div className="relative z-10 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-white/15 rounded-md">
                    <Sparkles className="size-3.5 text-white" />
                  </div>
                  <h3 className="text-white text-sm font-semibold tracking-tight">
                    AI insights
                  </h3>
                </div>
                <p className="text-white/85 text-sm leading-relaxed">
                  Our semantic engine detected a 15% deviation in non-standard
                  exclusion wordings across your latest treaty uploads.
                </p>
                <Link href="/analytics">
                  <Button
                    size="sm"
                    className="w-full bg-white text-primary hover:bg-white/90"
                  >
                    View analysis report
                  </Button>
                </Link>
              </div>
            </Card>

            <Card className="bg-surface-container-low border border-outline-variant p-5 rounded-xl space-y-4">
              <div className="space-y-0.5">
                <h3 className="text-on-surface text-sm font-semibold tracking-tight flex items-center gap-2">
                  <History className="size-4 text-secondary" />
                  History
                </h3>
                <p className="text-xs text-on-surface-variant">
                  Active search vectors
                </p>
              </div>

              <div className="space-y-2">
                {(recentTags.length > 0
                  ? recentTags
                  : ["Sanction clause", "LMA 5564", "Force majeure"]
                ).map((term) => (
                  <div
                    key={term}
                    className="flex items-center justify-between p-2.5 bg-background border border-outline-variant/30 rounded-md hover:bg-primary/5 hover:border-primary/30 transition-all cursor-pointer group"
                  >
                    <span className="text-sm text-on-surface group-hover:text-primary transition-colors">
                      {term}
                    </span>
                    <Search className="size-3.5 text-on-surface-variant group-hover:text-primary transition-colors" />
                  </div>
                ))}
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="w-full text-on-surface-variant"
              >
                Clear history
              </Button>
            </Card>
          </div>
        </div>
      </TooltipProvider>
    </main>
  );
}
