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
  ShieldCheck,
  Activity,
  ArrowUpRight,
  Search,
  BrainCircuit,
  History,
  Zap,
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
    <main className="flex-1 p-6 lg:p-10 bg-background transition-colors duration-300">
      <TooltipProvider>
        {/* Page Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12">
          <div className="space-y-2">
            <h1 className="text-4xl lg:text-5xl font-black tracking-tighter uppercase text-on-surface">
              Operational Overview
            </h1>
            <p className="text-on-surface-variant text-lg font-medium max-w-2xl">
              WordingsAI neural engine is actively monitoring{" "}
              <span className="text-primary font-black">
                {stats?.summary?.totalContracts ?? 0}
              </span>{" "}
              active wordings.
            </p>
          </div>

          <div className="flex gap-3">
            <Link href="/contracts/upload">
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-black px-8 py-7 rounded-2xl shadow-xl shadow-primary/20 flex items-center gap-2 transition-all hover:scale-[1.02]"
              >
                <Plus className="w-5 h-5" />
                NEW WORDING
              </Button>
            </Link>
          </div>
        </div>

        {/* Quick Stats Bento */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12"
        >
          <motion.div variants={staggerItem} className="relative">
            {loading && (
              <Skeleton className="absolute inset-0 z-10 rounded-[2.5rem]" />
            )}
            <Card className="bg-surface-container-low border-outline-variant rounded-[2.5rem] overflow-hidden hover:border-primary/40 transition-all group p-4 h-full cursor-default shadow-sm hover:shadow-md">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center mb-6">
                  <div className="p-3 bg-primary/10 rounded-2xl group-hover:scale-110 transition-transform duration-500">
                    <FileText className="w-6 h-6 text-primary" />
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="outline"
                        className="bg-emerald-500/10 text-emerald-500 border-none font-black text-[10px] uppercase cursor-help"
                      >
                        +
                        {
                          activities.filter((a: any) => a.type === "contract")
                            .length
                        }{" "}
                        Detected
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent className="rounded-xl font-bold uppercase text-[10px] tracking-widest p-2 bg-on-surface text-surface-container-low">
                      New contracts detected in last session
                    </TooltipContent>
                  </Tooltip>
                </div>
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant">
                  Central Archive
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-6xl font-black text-on-surface tracking-tighter">
                  {stats?.summary.totalContracts || 0}
                </div>
                <p className="text-xs font-bold text-on-surface-variant mt-2 uppercase tracking-widest">
                  Total Active Contracts
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={staggerItem} className="relative">
            {loading && (
              <Skeleton className="absolute inset-0 z-10 rounded-[2.5rem]" />
            )}
            <Card className="bg-surface-container-low border-outline-variant rounded-[2.5rem] overflow-hidden hover:border-secondary/40 transition-all group p-4 h-full cursor-default shadow-sm hover:shadow-md">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center mb-6">
                  <div className="p-3 bg-secondary/20 rounded-2xl group-hover:scale-110 transition-transform duration-500">
                    <TrendingUp className="w-6 h-6 text-secondary" />
                  </div>
                  <Badge
                    variant="outline"
                    className="bg-secondary/20 text-secondary border-none font-black text-[10px] uppercase"
                  >
                    Optimal Range
                  </Badge>
                </div>
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant">
                  Mean Compliance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-6xl font-black text-on-surface tracking-tighter">
                  {Math.round(stats?.summary.avgRiskScore || 0)}%
                </div>
                <p className="text-xs font-bold text-on-surface-variant mt-2 uppercase tracking-widest">
                  Aggregate Portfolio Health
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={staggerItem} className="relative">
            {loading && (
              <Skeleton className="absolute inset-0 z-10 rounded-[2.5rem]" />
            )}
            <Card className="bg-destructive/5 border-destructive/10 rounded-[2.5rem] overflow-hidden hover:border-destructive/40 transition-all group p-4 h-full cursor-default shadow-sm hover:shadow-md">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center mb-6">
                  <div className="p-3 bg-destructive/10 rounded-2xl group-hover:scale-110 transition-transform duration-500">
                    <AlertCircle className="w-6 h-6 text-destructive" />
                  </div>
                  <Badge
                    variant="outline"
                    className="bg-destructive/10 text-destructive border-none font-black text-[10px] uppercase"
                  >
                    Action Required
                  </Badge>
                </div>
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-destructive/70">
                  Unresolved Risks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-6xl font-black text-destructive tracking-tighter">
                  {(stats?.summary.riskDist.Red || 0) +
                    (stats?.summary.riskDist.Amber || 0)}
                </div>
                <p className="text-xs font-bold text-destructive/60 mt-2 uppercase tracking-widest">
                  High-Priority Variances
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Detailed Analytics Section */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Activity Log */}
          <div className="md:col-span-8 space-y-6">
            <div className="flex justify-between items-end px-2">
              <div className="space-y-1">
                <h2 className="text-2xl font-black tracking-tight text-on-surface uppercase flex items-center gap-2">
                  <Activity className="w-6 h-6 text-primary" />
                  Neural Feed
                </h2>
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
                  Continuous Vetting Stream
                </p>
              </div>
              <Link
                href="/contracts"
                className="bg-surface-container rounded-full px-5 py-2 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all flex items-center gap-2"
              >
                Archive Access <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <Card className="bg-surface-container-low border border-outline-variant rounded-[3rem] overflow-hidden shadow-sm">
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="show"
                className="p-8 space-y-4"
              >
                {loading
                  ? [1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-6 p-6">
                        <Skeleton className="size-16 rounded-2xl" />
                        <div className="space-y-2">
                          <Skeleton className="h-6 w-48" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                      </div>
                    ))
                  : (activities as any[]).map((item) => (
                      <motion.div
                        key={item.id}
                        variants={staggerItem}
                        whileHover={{ x: 8 }}
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
                              className="flex items-center justify-between group p-6 hover:bg-surface-container rounded-[2rem] transition-all cursor-pointer border border-transparent hover:border-outline-variant/30 text-decoration-none"
                            >
                              <div className="flex items-center gap-6">
                                <div className="size-16 bg-surface-container-highest rounded-2xl flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                                  {item.type === "contract" ? (
                                    <FileText className="w-8 h-8 text-on-surface-variant group-hover:text-primary transition-colors" />
                                  ) : item.type === "rule" ? (
                                    <BrainCircuit className="w-8 h-8 text-on-surface-variant group-hover:text-primary transition-colors" />
                                  ) : (
                                    <Sparkles className="w-8 h-8 text-on-surface-variant group-hover:text-primary transition-colors" />
                                  )}
                                </div>
                                <div>
                                  <h4 className="font-black text-lg text-on-surface uppercase tracking-tight group-hover:text-primary transition-colors">
                                    {item.title}
                                  </h4>
                                  <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.1em] mt-1">
                                    {item.action === "Created"
                                      ? "New"
                                      : "Updated"}{" "}
                                    {item.type === "contract"
                                      ? "Contract"
                                      : item.type === "rule"
                                        ? "Guardrail"
                                        : "Clause"}{" "}
                                    •{" "}
                                    {formatDistanceToNow(
                                      new Date(item.updatedAt),
                                    )}{" "}
                                    ago
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-6">
                                <Badge
                                  className={cn(
                                    "rounded-full font-black text-[9px] uppercase px-3 py-1 border-none",
                                    item.type === "contract"
                                      ? "bg-emerald-500/10 text-emerald-500"
                                      : item.type === "rule"
                                        ? "bg-primary/10 text-primary"
                                        : "bg-amber-500/10 text-amber-500",
                                  )}
                                >
                                  {item.type}
                                </Badge>
                                <div className="size-10 rounded-full bg-surface-container-highest flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
                                  <ArrowUpRight className="w-5 h-5" />
                                </div>
                              </div>
                            </Link>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 rounded-2xl p-2 shadow-2xl border-outline-variant">
                            <ContextMenuItem
                              className="rounded-xl font-bold h-12 uppercase text-[11px] tracking-widest cursor-pointer"
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
                              <Eye className="mr-2 size-4 text-primary" />
                              View Details
                            </ContextMenuItem>
                            <ContextMenuItem
                              className="rounded-xl font-bold h-12 uppercase text-[11px] tracking-widest cursor-pointer"
                              onClick={() => {
                                navigator.clipboard.writeText(item.id);
                                toast.success("ID copied to clipboard");
                              }}
                            >
                              <Copy className="mr-2 size-4" />
                              Copy Identifier
                            </ContextMenuItem>
                            <ContextMenuItem
                              className="rounded-xl font-bold h-12 uppercase text-[11px] tracking-widest cursor-pointer"
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
                              <ExternalLink className="mr-2 size-4" />
                              Open in New Tab
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      </motion.div>
                    ))}
                {!loading && activities.length === 0 && (
                  <div className="p-12 text-center text-on-surface-variant font-bold">
                    No recent wording activities detected.
                  </div>
                )}
              </motion.div>
            </Card>
          </div>

          {/* Information Sidebar */}
          <div className="md:col-span-4 space-y-8">
            <Card className="bg-primary p-8 rounded-[3rem] shadow-2xl shadow-primary/30 relative overflow-hidden group border-0">
              <div className="absolute -top-10 -right-10 size-48 bg-white/10 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-1000" />
              <div className="relative z-10 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-white text-xl font-black uppercase tracking-tight">
                    AI Insights
                  </h3>
                </div>
                <p className="text-white/80 text-sm font-medium leading-relaxed">
                  Our semantic engine detected a 15% deviation in non-standard
                  exclusion wordings across your latest treaty uploads.
                </p>
                <Link href="/analytics">
                  <Button className="w-full bg-white text-primary font-black h-14 rounded-2xl hover:bg-white/90 transition-transform hover:-translate-y-1 shadow-lg">
                    ANALYSIS REPORT
                  </Button>
                </Link>
              </div>
            </Card>

            <Card className="bg-surface-container-low border border-outline-variant p-8 rounded-[3rem] space-y-8">
              <div className="space-y-1">
                <h3 className="text-on-surface font-black text-lg uppercase flex items-center gap-2">
                  <History className="w-5 h-5 text-secondary" />
                  History
                </h3>
                <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">
                  Active Search Vectors
                </p>
              </div>

              <div className="space-y-3">
                {(recentTags.length > 0
                  ? recentTags
                  : ["Sanction Clause", "LMA 5564", "Force Majeure"]
                ).map((term) => (
                  <div
                    key={term}
                    className="flex items-center justify-between p-4 bg-background border border-outline-variant/30 rounded-2xl hover:bg-primary/5 transition-all cursor-pointer group"
                  >
                    <span className="text-sm font-bold text-on-surface uppercase tracking-tight group-hover:text-primary transition-colors">
                      {term}
                    </span>
                    <Search className="w-4 h-4 text-on-surface-variant group-hover:text-primary transition-colors" />
                  </div>
                ))}
              </div>

              <Button
                variant="ghost"
                className="w-full font-black uppercase tracking-widest text-[10px] hover:bg-surface-container text-on-surface-variant"
              >
                Clear Vector History
              </Button>
            </Card>
          </div>
        </div>
      </TooltipProvider>
    </main>
  );
}
