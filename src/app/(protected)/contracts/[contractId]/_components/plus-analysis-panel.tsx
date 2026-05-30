"use client";

/**
 * PlusAnalysisPanel — the "Plus Analysis" tab content.
 * Extracted from the 2105-line page.tsx.
 */

import {
  Loader2,
  Lock,
  Zap,
  BrainCircuit,
  Sparkles,
  Target,
  Shield,
  ListTodo,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FormattedEvidence } from "./helpers";
import type { Contract } from "@/types/analysis";
import type { StructuredContract } from "@/lib/structured-contract";

interface PlusAnalysisPanelProps {
  contract: Contract;
  isPlus: boolean;
  hasAnalysis: boolean;
  isProcessing: boolean;
  analysisLoading: boolean;
  runAnalysis: (force?: boolean, mode?: "fast" | "full") => void;
  setHighlightText: (text: string | null) => void;
  setActiveTab: (tab: string) => void;
}

export function PlusAnalysisPanel({
  contract,
  isPlus,
  hasAnalysis,
  isProcessing,
  analysisLoading,
  runAnalysis,
  setHighlightText,
  setActiveTab,
}: PlusAnalysisPanelProps) {
  if (!isPlus) {
    return (
      <div className="bg-primary/5 border-2 border-dashed border-primary/20 rounded-xl p-24 text-center">
        <div className="size-20 bg-primary rounded-lg flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-primary/20">
          <Lock className="size-10 text-white" />
        </div>
        <h2 className="text-lg font-semibold text-on-surface mb-4">
          Plus Layer Locked
        </h2>
        <p className="text-on-surface-variant text-lg font-medium max-w-sm mx-auto mb-12">
          Upgrade to Intelligence PLUS to unlock semantic matching, variance
          mapping, and legal intelligence.
        </p>
        <Link href="/upgrade">
          <Button size="lg" className="bg-primary text-primary-foreground">
            Upgrade plan
          </Button>
        </Link>
      </div>
    );
  }

  if (!hasAnalysis && !isProcessing) {
    return (
      <div className="bg-surface-container-low border border-outline-variant rounded-xl p-20 text-center flex flex-col items-center animate-in fade-in zoom-in duration-500">
        <div className="size-24 bg-secondary/10 rounded-full flex items-center justify-center mb-8 text-secondary">
          <BrainCircuit className="size-12" />
        </div>
        <h2 className="text-lg font-semibold text-on-surface mb-4">
          Deep Semantic Analysis Pending
        </h2>
        <p className="text-on-surface-variant text-lg font-medium max-w-md mb-10 text-center leading-relaxed">
          The foundational scan is complete. Run the full neural evaluation to
          unlock Plus Insights, including clause variance mapping and semantic
          risk assessments.
        </p>
        <Button
          size="lg"
          onClick={() => runAnalysis(true)}
          disabled={analysisLoading || isProcessing}
          className="gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/90 transition-all"
        >
          {analysisLoading || isProcessing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Zap className="size-4" />
          )}
          {isProcessing ? "Processing Deep Rules..." : "Run Full Analysis"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-on-surface uppercase tracking-tight flex items-center gap-3">
            <BrainCircuit className="size-7 text-secondary" />
            Semantic Intelligence
          </h2>
          {isProcessing && (
            <div className="flex items-center gap-2 px-3 py-1 bg-secondary/10 border border-secondary/20 rounded-lg">
              <Loader2 className="size-3 text-secondary animate-spin" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-secondary">
                Evaluating Deep Rules...
              </span>
            </div>
          )}
        </div>
        <span className="px-4 py-2 bg-secondary/10 text-secondary rounded-full font-semibold uppercase tracking-[0.2em] text-[9px] border border-secondary/20">
          {isProcessing ? "Processing Stream" : "Active Engine"}
        </span>
      </div>

      {!hasAnalysis && isProcessing && (
        <div className="bg-surface-container-low border border-dashed border-outline-variant/30 rounded-xl p-32 flex flex-col items-center justify-center gap-6 animate-pulse">
          <Sparkles className="size-12 text-secondary/40" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-on-surface-variant/40">
            Generating insights…
          </p>
        </div>
      )}

      {/* Synthesis Insights Row */}
      {contract.analysis?.plus && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* Coverage Card */}
          <div className="bg-surface-container-low border border-outline-variant/30 rounded-xl p-8 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="size-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
                  <Target className="size-5" />
                </div>
                <h3 className="text-sm font-semibold uppercase tracking-widest text-on-surface">
                  Clause Coverage
                </h3>
              </div>
              <div className="text-lg font-semibold text-emerald-500">
                {contract.analysis.plus.clauseCoverage?.coverageScore}%
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-on-surface-variant/60 mb-2">
                  Missing Clauses
                </p>
                <div className="flex flex-wrap gap-2">
                  {contract.analysis.plus.clauseCoverage?.missingClauses?.map(
                    (c: string) => (
                      <Badge
                        key={c}
                        variant="outline"
                        className="bg-red-500/5 text-red-500 border-red-500/20 text-[9px] font-semibold uppercase"
                      >
                        {c}
                      </Badge>
                    ),
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-on-surface-variant/60 mb-2">
                  Unusual Provisions
                </p>
                <div className="flex flex-wrap gap-2">
                  {contract.analysis.plus.clauseCoverage?.unusualClauses?.map(
                    (c: string) => (
                      <Badge
                        key={c}
                        variant="outline"
                        className="bg-amber-500/5 text-amber-500 border-amber-500/20 text-[9px] font-semibold uppercase"
                      >
                        {c}
                      </Badge>
                    ),
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Risk Card */}
          <div className="bg-surface-container-low border border-outline-variant/30 rounded-xl p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="size-10 bg-red-500/10 rounded-xl flex items-center justify-center text-red-500">
                <Shield className="size-5" />
              </div>
              <h3 className="text-sm font-semibold uppercase tracking-widest text-on-surface">
                Risk Drivers
              </h3>
            </div>
            <div className="space-y-4">
              {Object.entries(
                contract.analysis.plus.riskBreakdown?.categories || {},
              ).length > 0 ? (
                Object.entries(
                  contract.analysis.plus.riskBreakdown?.categories || {},
                ).map(([cat, risk]: [string, any]) => (
                  <div
                    key={cat}
                    className="flex items-center justify-between p-3 bg-background border border-outline-variant/30 rounded-xl"
                  >
                    <span className="text-[10px] font-semibold uppercase text-on-surface-variant">
                      {cat}
                    </span>
                    <Badge className="bg-red-500 text-white border-none rounded-lg font-semibold uppercase text-[8px]">
                      {risk}
                    </Badge>
                  </div>
                ))
              ) : contract.analysis.plus.riskBreakdown?.topDrivers?.length >
                0 ? (
                contract.analysis.plus.riskBreakdown.topDrivers.map(
                  (driver: string, idx: number) => (
                    <div
                      key={idx}
                      className="p-3 bg-background border border-outline-variant/30 rounded-xl"
                    >
                      <p className="text-[10px] font-semibold uppercase text-on-surface-variant">
                        {driver}
                      </p>
                    </div>
                  ),
                )
              ) : (
                <p className="text-xs font-medium uppercase tracking-wider text-on-surface-variant/40 text-center py-4">
                  No risk drivers identified.
                </p>
              )}
            </div>
          </div>

          {/* Obligations Card */}
          <div className="bg-surface-container-low border border-outline-variant/30 rounded-xl p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="size-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                <ListTodo className="size-5" />
              </div>
              <h3 className="text-sm font-semibold uppercase tracking-widest text-on-surface">
                Key Obligations
              </h3>
            </div>
            <div className="space-y-3">
              {contract.analysis.plus.obligations?.map(
                (obj: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-4 bg-background border border-outline-variant/30 rounded-xl space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase text-primary">
                        {obj.party}
                      </span>
                      <Badge
                        variant="ghost"
                        className="text-[8px] font-semibold uppercase"
                      >
                        {obj.type}
                      </Badge>
                    </div>
                    <p className="text-xs font-medium text-on-surface-variant">
                      {obj.task}
                    </p>
                    {obj.deadline && (
                      <p className="text-[9px] font-semibold text-on-surface-variant/40 uppercase">
                        Deadline: {obj.deadline}
                      </p>
                    )}
                  </div>
                ),
              )}
            </div>
          </div>

          {/* Timeline Card */}
          <div className="bg-surface-container-low border border-outline-variant/30 rounded-xl p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="size-10 bg-secondary/10 rounded-xl flex items-center justify-center text-secondary">
                <Calendar className="size-5" />
              </div>
              <h3 className="text-sm font-semibold uppercase tracking-widest text-on-surface">
                Event Timeline
              </h3>
            </div>
            <div className="space-y-4">
              {contract.analysis.plus.timeline?.map(
                (item: any, idx: number) => (
                  <div key={idx} className="flex gap-4 relative">
                    {idx !==
                      contract.analysis.plus.timeline.length - 1 && (
                      <div className="absolute left-[19px] top-8 bottom-0 w-px bg-outline-variant/30" />
                    )}
                    <div
                      className={cn(
                        "size-10 rounded-full flex items-center justify-center shrink-0 z-10",
                        item.isRisky
                          ? "bg-red-500/10 text-red-500"
                          : "bg-background border border-outline-variant/30 text-on-surface-variant",
                      )}
                    >
                      <div className="size-2 rounded-full bg-current" />
                    </div>
                    <div className="pt-1">
                      <p className="text-[10px] font-semibold uppercase text-on-surface-variant">
                        {item.date}
                      </p>
                      <p className="text-xs font-medium text-on-surface leading-snug">
                        {item.event}
                      </p>
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      )}

      {/* Granular Guidance Cards */}
      <div className="grid grid-cols-1 gap-6">
        {contract.analysisResults
          ?.filter((r) => r.granularGuidance)
          .map((result) => (
            <div
              key={result.id}
              className="bg-surface-container-low border border-secondary/20 rounded-xl p-10 shadow-sm relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/5 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700" />
              <div className="flex flex-col lg:flex-row gap-12 relative z-10 text-left">
                <div className="lg:w-1/2 space-y-8">
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-on-surface uppercase tracking-tight">
                      {result.rule.name}
                    </h3>
                    <Badge className="bg-emerald-500 text-white border-none rounded-lg font-semibold uppercase text-[10px] px-3">
                      {result.granularGuidance?.standardWordingMatch ||
                        "Aligned"}
                    </Badge>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-xs font-medium uppercase tracking-wider text-secondary">
                      Expert Reasoning
                    </h4>
                    <p className="text-sm font-medium leading-relaxed text-on-surface-variant italic">
                      &ldquo;
                      {result.granularGuidance?.legalCommentary ||
                        result.reasoning}
                      &rdquo;
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(
                      result.granularGuidance?.conditionMatrix || {},
                    ).map(([cond, assess]) => (
                      <div
                        key={cond}
                        className="p-4 bg-background border border-outline-variant/30 rounded-2xl flex justify-between items-center"
                      >
                        <span className="text-[10px] font-semibold uppercase tracking-tight text-on-surface-variant">
                          {cond}
                        </span>
                        <span className="text-[9px] font-semibold uppercase text-emerald-500">
                          {assess as string}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="lg:w-1/2 space-y-8">
                  <div className="space-y-4">
                    <h4 className="text-xs font-medium uppercase tracking-wider text-on-surface-variant flex items-center justify-between">
                      <span>Wording Comparison</span>
                      <Badge
                        variant="outline"
                        className="text-[8px] font-semibold tracking-tighter"
                      >
                        0% Variance
                      </Badge>
                    </h4>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="p-5 bg-background border border-outline-variant/50 rounded-2xl font-mono text-xs text-on-surface leading-relaxed shadow-inner">
                        <span className="text-[9px] font-semibold uppercase text-on-surface-variant/40 block mb-3">
                          Document Source
                        </span>
                        {result.evidence[0] ? (
                          <FormattedEvidence
                            evidence={result.evidence[0]}
                            structuredContent={
                              contract.structuredContent as StructuredContract | null
                            }
                            onLookup={(text) => {
                              setHighlightText(text);
                              setActiveTab("document-map");
                            }}
                          />
                        ) : (
                          "No source evidence available."
                        )}
                      </div>
                      <div className="p-5 bg-secondary/5 border border-secondary/20 rounded-2xl font-mono text-xs text-secondary/80 leading-relaxed shadow-inner">
                        <span className="text-[9px] font-semibold uppercase text-secondary/40 block mb-3">
                          Library Standard
                        </span>
                        {result.granularGuidance?.standardWordingText ||
                          "Consistent with LMA baseline."}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
