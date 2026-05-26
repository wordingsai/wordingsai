"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Sparkles,
  ShieldCheck,
  ChevronRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Search,
  Zap,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";

type Rule = {
  id: string;
  name: string;
  category: string;
  description?: string;
  isRecommended?: boolean;
  matchReason?: string;
};

function isFastAnalysisComplete(data: {
  analysis?: { status?: string; summary?: string };
  analysisProgress?: number;
  analysisStage?: string;
}): boolean {
  const status = data.analysis?.status || "";
  const inDeepPhase =
    (status.includes("Deep Analysis") ||
      status.includes("Rules Evaluation") ||
      status.includes("Evaluating")) &&
    (data.analysisProgress ?? 0) < 100;

  if (inDeepPhase) return false;

  return Boolean(
    data.analysisStage === "completed" ||
    (data.analysisProgress ?? 0) === 100 ||
    data.analysis?.summary ||
    status.includes("Fast Analysis Complete") ||
    status.includes("Analysis Complete") ||
    ((data.analysisProgress ?? 0) >= 50 &&
      data.analysisStage === "fast" &&
      !status.includes("[5/5]")),
  );
}

export default function RuleRecommendationsPage() {
  const params = useParams();
  const router = useRouter();
  const contractId = params.contractId as string;

  const [loading, setLoading] = useState(true);
  const [contract, setContract] = useState<any>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [authorizing, setAuthorizing] = useState(false);
  const [autoProceeding, setAutoProceeding] = useState(true);
  const pipelineHandledRef = useRef(false);
  const [analysisStatus, setAnalysisStatus] = useState<string>(
    "Initializing Neural Intake...",
  );
  const [progress, setProgress] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);

  // Smooth Progress Logic - Follow backend progress closely without "creep"
  useEffect(() => {
    if (!loading && !autoProceeding) {
      setDisplayProgress(progress);
      return;
    }

    // Smooth transition to target
    const timer = setInterval(() => {
      setDisplayProgress((prev) => {
        if (prev < progress) {
          // Move 1% at a time for smoothness
          return prev + 1;
        }
        if (prev > progress) {
          // Sync immediately if backend somehow reports lower progress
          return progress;
        }
        return prev;
      });
    }, 100); // 100ms for smooth 1% increments

    return () => clearInterval(timer);
  }, [progress, loading, autoProceeding]);

  // Poll fast analysis, auto-authorize matched rules, start evaluation
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;

    const triggerEvaluation = async (ids: Set<string>) => {
      if (pipelineHandledRef.current) return;
      pipelineHandledRef.current = true;
      setAuthorizing(true);
      setAutoProceeding(true);

      try {
        const updateRes = await fetch(`/api/contracts/${contractId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ selectedRuleIds: Array.from(ids) }),
        });
        if (!updateRes.ok) throw new Error("Failed to save configuration");

        const triggerRes = await fetch(
          `/api/contracts/${contractId}/evaluate-rules`,
          { method: "POST" },
        );
        if (!triggerRes.ok) throw new Error("Failed to initiate deep analysis");

        toast.success(
          "Matched intelligence modules authorized. Starting evaluation...",
        );
        router.replace(`/contracts/${contractId}`);
      } catch (err: unknown) {
        pipelineHandledRef.current = false;
        toast.error(
          err instanceof Error ? err.message : "Authorization failed",
        );
        setAuthorizing(false);
        setAutoProceeding(false);
        setLoading(false);
      }
    };

    const fetchRecommendations = async () => {
      if (pipelineHandledRef.current) return;

      try {
        const res = await fetch(`/api/contracts/${contractId}/recommendations`);
        if (!res.ok) throw new Error("Failed to fetch recommendations");
        const data = await res.json();
        setRules(data.rules || []);

        const recommended = (data.rules as Rule[])
          .filter((r) => r.isRecommended)
          .map((r) => r.id);

        if (recommended.length > 0) {
          setSelectedIds(new Set(recommended));
          await triggerEvaluation(new Set(recommended));
        } else {
          pipelineHandledRef.current = true;
          toast.info(
            "No rules matched detected clauses. Returning to contract view.",
          );
          router.replace(`/contracts/${contractId}`);
        }
      } catch (err) {
        console.error("Recommendations fetch error:", err);
        pipelineHandledRef.current = false;
        setAutoProceeding(false);
        setLoading(false);
      }
    };

    const checkStatus = async () => {
      if (pipelineHandledRef.current) return;

      try {
        const res = await fetch(`/api/contracts/${contractId}?polling=true`);
        if (!res.ok) return;
        const data = await res.json();
        setContract(data);

        const status = data.analysis?.status || "";
        setAnalysisStatus(status);
        setProgress(data.analysisProgress || 0);

        if (isFastAnalysisComplete(data)) {
          clearInterval(pollInterval);
          await fetchRecommendations();
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    };

    checkStatus();
    pollInterval = setInterval(checkStatus, 2000);

    return () => clearInterval(pollInterval);
  }, [contractId, router]);

  const handleToggleRule = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleStartFullAnalysis = async () => {
    if (selectedIds.size === 0) {
      toast.error(
        "Please select at least one intelligence module to authorize.",
      );
      return;
    }

    setAuthorizing(true);

    const promise = (async () => {
      // 1. Update the contract with selected rules
      const updateRes = await fetch(`/api/contracts/${contractId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedRuleIds: Array.from(selectedIds),
        }),
      });

      if (!updateRes.ok) {
        const err = await updateRes.json();
        throw new Error(err.error || "Failed to save configuration");
      }

      // 2. Trigger the Rule Evaluation
      const triggerRes = await fetch(
        `/api/contracts/${contractId}/evaluate-rules`,
        {
          method: "POST",
        },
      );

      if (!triggerRes.ok) {
        const err = await triggerRes.json();
        throw new Error(err.error || "Failed to initiate deep analysis");
      }

      return "Success";
    })();

    toast.promise(promise, {
      loading:
        "Configuring intelligence layers and initializing neural evaluation...",
      success: () => {
        router.push(`/contracts/${contractId}`);
        return "Intelligence modules authorized. Starting deep analysis...";
      },
      error: (err) => {
        setAuthorizing(false);
        return err.message || "Authorization failed";
      },
    });
  };

  const { data: activeWorkspace } = useActiveWorkspace();

  const workspaceTypeLabel = useMemo(() => {
    if (!activeWorkspace?.type) return "Relevant Clauses";
    const type = activeWorkspace.type.toLowerCase();
    if (type.includes("property")) return "Property Clauses";
    if (type.includes("liability")) return "Liability Clauses";
    if (type.includes("reinsurance")) return "Reinsurance Clauses";
    return `${activeWorkspace.type} Clauses`;
  }, [activeWorkspace]);

  if (loading || autoProceeding) {
    return (
      <main className="flex-1 min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full space-y-8 animate-in fade-in duration-700">
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 animate-pulse" />
            <div className="relative bg-surface-container-low border border-outline-variant p-8 rounded-xl shadow-2xl">
              <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-6" />
              <h1 className="text-xl font-semibold tracking-tight text-on-surface mb-2">
                {authorizing
                  ? "Authorizing Matched Rules"
                  : "Neural Scan in Progress"}
              </h1>
              <p className="text-on-surface-variant font-medium text-sm mb-6">
                {authorizing
                  ? "Starting rule evaluation for clauses detected in your contract..."
                  : `Analyzing document structure and identifying ${workspaceTypeLabel.toLowerCase()}...`}
              </p>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium uppercase tracking-wider text-on-surface-variant mb-1">
                  <span>{analysisStatus}</span>
                  <span>{displayProgress}%</span>
                </div>
                <Progress
                  value={displayProgress}
                  className="h-2 rounded-full"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant/40">
            <div className="flex items-center gap-2">
              <Zap className="w-3 h-3" /> OCR Matrix
            </div>
            <div className="flex items-center gap-2">
              <Search className="w-3 h-3" /> Semantic Mapping
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-3 h-3" /> Risk Discovery
            </div>
          </div>
        </div>
      </main>
    );
  }

  const recommendedRules = rules.filter((r) => r.isRecommended);
  const otherRules = rules.filter((r) => !r.isRecommended);

  return (
    <main className="flex-1 p-4 md:p-8 lg:p-12 bg-background transition-all">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <span className="text-xs font-medium uppercase tracking-wider text-emerald-500">
                Neural Scan Complete
              </span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-on-surface">
              Brain Configuration
            </h1>
            <p className="text-on-surface-variant text-lg font-medium max-w-2xl">
              We&apos;ve identified the following clauses within{" "}
              <span className="text-on-surface font-bold">
                &quot;{contract?.contractName}&quot;
              </span>
              . Based on this, we recommend authorizing these intelligence
              modules.
            </p>
          </div>

          <Button
            onClick={handleStartFullAnalysis}
            disabled={authorizing || rules.length === 0}
            className="rounded-2xl h-16 px-10 font-semibold uppercase tracking-widest text-sm shadow-xl shadow-primary/20 hover:scale-105 transition-all group"
          >
            {authorizing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Authorize Evaluation
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Main Content: Recommendations */}
          <div className="lg:col-span-8 space-y-10">
            {/* Recommended Section */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-primary" />
                <h2 className="text-base font-semibold tracking-tight text-on-surface">
                  Recommended Intelligence Modules
                </h2>
                <Badge
                  variant="outline"
                  className="rounded-full px-3 py-1 bg-primary/5 text-primary border-primary/20 font-semibold uppercase text-[10px]"
                >
                  {recommendedRules.length} Matching
                </Badge>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {recommendedRules.length > 0 ? (
                  recommendedRules.map((rule) => (
                    <RuleCard
                      key={rule.id}
                      rule={rule}
                      selected={selectedIds.has(rule.id)}
                      onToggle={() => handleToggleRule(rule.id)}
                    />
                  ))
                ) : (
                  <div className="p-8 border-2 border-dashed border-outline-variant rounded-lg text-center space-y-3">
                    <p className="text-on-surface-variant font-medium">
                      No specific modules recommended based on current
                      detection.
                    </p>
                    <p className="text-xs text-on-surface-variant/60">
                      You can still authorize optional modules below if
                      available.
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* Other Rules Section */}
            {otherRules.length > 0 ? (
              <section className="space-y-6 opacity-60 hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-3">
                  <LayoutGrid className="w-5 h-5 text-on-surface-variant" />
                  <h2 className="text-lg font-bold uppercase tracking-tight text-on-surface-variant">
                    Additional Optional Modules
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {otherRules.map((rule) => (
                    <RuleCard
                      key={rule.id}
                      rule={rule}
                      selected={selectedIds.has(rule.id)}
                      onToggle={() => handleToggleRule(rule.id)}
                      compact
                    />
                  ))}
                </div>
              </section>
            ) : (
              recommendedRules.length === 0 && (
                <div className="p-12 bg-surface-container-low border border-outline-variant rounded-xl text-center space-y-6">
                  <div className="size-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
                    <AlertCircle className="w-8 h-8 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-base font-semibold tracking-tight text-on-surface">
                      No Intelligence Modules Found
                    </h3>
                    <p className="text-on-surface-variant font-medium max-w-sm mx-auto">
                      We couldn&apos;t find any active intelligence modules for
                      this workspace. Please ensure your Rule Registry is
                      populated.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="rounded-xl text-xs font-medium uppercase tracking-wider h-12"
                    onClick={() => router.push("/rules")}
                  >
                    Manage Rule Registry
                  </Button>
                </div>
              )
            )}
          </div>

          {/* Sidebar: Document Stats */}
          <div className="lg:col-span-4">
            <div className="sticky top-12 space-y-6">
              <div className="bg-surface-container-low border border-outline-variant rounded-lg p-8 space-y-6">
                <h3 className="text-base font-semibold text-on-surface flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" /> Document
                  Fingerprint
                </h3>

                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-background border border-outline-variant/50 space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                      Detected Clauses
                    </span>
                    <p className="text-lg font-semibold text-on-surface">
                      {contract?.analysis?.mandatory_registry_count || 0}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-background border border-outline-variant/50 space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                      Document Quality
                    </span>
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-semibold text-on-surface">
                        Optimal
                      </p>
                      <ShieldCheck className="w-5 h-5 text-emerald-500" />
                    </div>
                  </div>
                </div>

                <Separator className="bg-outline-variant/50" />

                <div className="space-y-3">
                  <p className="text-xs font-bold text-on-surface-variant italic">
                    &quot;Our system automatically identified{" "}
                    {recommendedRules.length} modules that are highly relevant
                    to the clauses found in your contract. Terminating
                    irrelevant rules saves processing time and increases
                    accuracy.&quot;
                  </p>
                </div>
              </div>

              <div className="p-6 bg-primary/5 border border-primary/10 rounded-lg flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-2xl">
                  <Zap className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold uppercase tracking-tight text-on-surface text-sm">
                    Neural Efficiency
                  </h4>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase">
                    Skipping {otherRules.length} redundant modules
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function RuleCard({
  rule,
  selected,
  onToggle,
  compact = false,
}: {
  rule: Rule;
  selected: boolean;
  onToggle: () => void;
  compact?: boolean;
}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "group relative flex items-center justify-between w-full p-6 rounded-3xl border text-left transition-all",
        selected
          ? "bg-primary/5 border-primary shadow-lg ring-1 ring-primary/20"
          : "bg-surface-container-low border-outline-variant hover:border-primary/50 hover:bg-surface-container-high/50",
        compact && "p-4 py-3",
      )}
    >
      <div className="flex items-center gap-6 flex-1 min-w-0">
        <div
          className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors",
            selected
              ? "bg-primary text-primary-foreground"
              : "bg-background text-on-surface-variant group-hover:bg-primary/10 group-hover:text-primary",
            compact && "w-10 h-10",
          )}
        >
          {selected ? (
            <CheckCircle2 className="w-6 h-6" />
          ) : (
            <Zap className="w-5 h-5" />
          )}
        </div>

        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h4
              className={cn(
                "font-semibold uppercase tracking-tight transition-colors truncate",
                selected
                  ? "text-on-surface"
                  : "text-on-surface-variant group-hover:text-on-surface",
                compact ? "text-xs" : "text-lg",
              )}
            >
              {rule.name}
            </h4>
            {rule.isRecommended && !compact && (
              <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-semibold uppercase text-[8px] tracking-[0.1em]">
                Recommended
              </Badge>
            )}
          </div>

          {!compact && rule.matchReason && (
            <p className="text-xs font-bold text-on-surface-variant/70 uppercase tracking-wide flex items-center gap-1.5">
              <Search className="w-3 h-3 text-primary" /> {rule.matchReason}
            </p>
          )}

          {!compact && rule.description && (
            <p className="text-sm font-medium text-on-surface-variant line-clamp-1 mt-1">
              {rule.description}
            </p>
          )}
        </div>
      </div>

      <div
        className={cn(
          "ml-4 p-2 rounded-xl border transition-all",
          selected
            ? "bg-primary/20 border-primary/30"
            : "bg-background border-outline-variant group-hover:border-primary/30",
        )}
      >
        <ChevronRight
          className={cn(
            "w-5 h-5 transition-transform",
            selected
              ? "text-primary rotate-90"
              : "text-on-surface-variant group-hover:text-primary",
          )}
        />
      </div>

      {rule.isRecommended && (
        <div className="absolute -top-2 -right-2">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-md rounded-full animate-pulse" />
            <div className="relative bg-primary text-primary-foreground p-1.5 rounded-full shadow-lg">
              <Sparkles className="w-3 h-3" />
            </div>
          </div>
        </div>
      )}
    </button>
  );
}

function LayoutGrid(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
    </svg>
  );
}
