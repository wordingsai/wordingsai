"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { HoverBorderGradient } from "../ui/hover-border-gradient";
import {
  FileText,
  Search,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Play,
  ArrowRight,
  UploadCloud,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Clause {
  id: string;
  name: string;
  severity: "red" | "amber" | "green";
  wording: string;
  guideline: string;
  recommendation: string;
}

const docsData = {
  quota: {
    name: "Property Quota Share Treaty.pdf",
    clauses: [
      {
        id: "territorial",
        name: "Territorial Limits Wording",
        severity: "red",
        wording:
          "Worldwide coverage including full sanction-impacted regions without standard LMA carve-out clauses.",
        guideline:
          "Standard LMA5512 or equivalent sanctions exclusion clause must be explicitly incorporated.",
        recommendation:
          "Reject wording. Append standard LMA5512 sanctions exclusion clause immediately.",
      },
      {
        id: "net_retention",
        name: "Net Retention Requirement",
        severity: "green",
        wording:
          "The Cedant hereby covenants to retain for its own account a minimum of 10.0% of the treaty liabilities.",
        guideline:
          "Board policy mandates a minimum of 10% net retention for all quota share participations.",
        recommendation:
          "Fully compliant. Clause meets all corporate risk standards.",
      },
      {
        id: "credit_period",
        name: "Premium Payment Warranty",
        severity: "amber",
        wording:
          "All reinsurance balances shall be settled by the Cedant within 60 days from treaty inception.",
        guideline:
          "Standard credit risk guidelines recommend a maximum of 30 days premium payment warranty.",
        recommendation:
          "Warning: Premium credit period is double the standard. Propose settlement reduction to 45 days.",
      },
    ] as Clause[],
  },
  cat: {
    name: "Catastrophe Excess of Loss.pdf",
    clauses: [
      {
        id: "reinstatement",
        name: "Reinstatement Provisions",
        severity: "red",
        wording:
          "Unlimited free reinstatements allowed for all layers covered under the windstorm section.",
        guideline:
          "Policy mandates maximum 1 free reinstatement, with subsequent reinstatements paid at 100% AP.",
        recommendation:
          "Critical Deviation: Propose 1 free and 1 paid reinstatement at 100% additional premium.",
      },
      {
        id: "loss_occurrence",
        name: "Loss Occurrence Definition",
        severity: "green",
        wording:
          "Loss occurrence is defined under the standard 72-hour clause for atmospheric events.",
        guideline:
          "Core treaty guidelines require standard 72-hour provisions for natural peril aggregation.",
        recommendation:
          "Fully compliant. Clause matches standard treaty definitions.",
      },
      {
        id: "unl_definition",
        name: "Ultimate Net Loss Scope",
        severity: "amber",
        wording:
          "Ultimate Net Loss includes gross paid losses and all external legal and claims defense fees.",
        guideline:
          "Corporate risk standards advise capping or excluding general legal defense expenses from UNL.",
        recommendation:
          "Attention needed: Cap claims defense fees at 10% of gross loss or exclude entirely.",
      },
    ] as Clause[],
  },
};

export const HeroSection = () => {
  const [selectedDocKey, setSelectedDocKey] = useState<"quota" | "cat">(
    "quota",
  );
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(-1);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedClauseId, setExpandedClauseId] = useState<string | null>(null);

  const selectedDoc = docsData[selectedDocKey];

  const handleScan = () => {
    if (isScanning) return;
    setIsScanning(true);
    setScanProgress(0);
    setExpandedClauseId(null);
  };

  useEffect(() => {
    if (!isScanning) return;
    if (scanProgress < 100) {
      const timer = setTimeout(() => {
        setScanProgress((prev) => prev + 10);
      }, 150);
      return () => clearTimeout(timer);
    } else {
      setIsScanning(false);
    }
  }, [isScanning, scanProgress]);

  const filteredClauses = selectedDoc.clauses.filter((clause) =>
    clause.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <section className="relative pt-28 pb-20 overflow-hidden dark:bg-background transition-colors duration-300">
      <div className="max-w-6xl mx-auto px-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        {/* Left Copy Column */}
        <div className="flex flex-col gap-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/40 text-primary text-xs uppercase tracking-wider w-fit">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            Next-Gen Contract Tech
          </div>

          <h1 className="text-5xl lg:text-6xl font-black leading-[1.1] tracking-tight text-slate-900 dark:text-white">
            Analyze Contracts <span className="text-primary">Smarter</span> with
            AI
          </h1>

          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-lg leading-relaxed font-medium">
            Upload treaty slips, extract semantic clauses, compare with your
            corporate library guidelines, and flag risk exposure instantly using
            state-of-the-art AI.
          </p>

          <div className="flex flex-wrap gap-4">
            <HoverBorderGradient
              containerClassName="rounded-full"
              as="button"
              className="bg-primary dark:bg-primary border border-slate-200 dark:border-white/10 text-white dark:text-white hover:bg-primary/80 dark:hover:bg-primary/80 transition-all flex items-center space-x-2 px-8 py-4"
            >
              <Link href="/dashboard">
                <span className="font-bold flex items-center gap-1.5">
                  Get Started <ArrowRight className="size-4" />
                </span>
              </Link>
            </HoverBorderGradient>

            <HoverBorderGradient
              containerClassName="rounded-full"
              as="button"
              className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-all flex items-center space-x-2 px-8 py-4"
            >
              <Link href="/demo">
                <span className="font-bold">Try Sandbox Demo</span>
              </Link>
            </HoverBorderGradient>
          </div>
        </div>

        {/* Right Live Interactive Widget Column */}
        <div className="relative">
          <div className="relative z-10 rounded-[2.5rem] border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden bg-white dark:bg-zinc-950 p-6 lg:p-8 space-y-6">
            {/* Widget Header */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-primary/10 rounded-xl">
                  <Sparkles className="text-primary size-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider">
                    Treaty Risk Analyzer
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    Interactive Sandbox Widget
                  </p>
                </div>
              </div>

              {/* Document Selector */}
              <div className="flex bg-slate-100 dark:bg-zinc-900 p-0.5 rounded-lg border border-slate-200/50 dark:border-white/5">
                <button
                  onClick={() => {
                    setSelectedDocKey("quota");
                    setScanProgress(-1);
                    setExpandedClauseId(null);
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-all",
                    selectedDocKey === "quota"
                      ? "bg-primary text-white"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white",
                  )}
                >
                  Quota Share
                </button>
                <button
                  onClick={() => {
                    setSelectedDocKey("cat");
                    setScanProgress(-1);
                    setExpandedClauseId(null);
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-all",
                    selectedDocKey === "cat"
                      ? "bg-primary text-white"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white",
                  )}
                >
                  Excess of Loss
                </button>
              </div>
            </div>

            {/* Input / Scanner Window */}
            <div className="border border-dashed border-slate-200 dark:border-white/10 rounded-2xl p-4 bg-slate-50/50 dark:bg-zinc-900/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="text-primary size-5" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[180px] sm:max-w-none">
                    {selectedDoc.name}
                  </span>
                </div>

                <button
                  onClick={handleScan}
                  disabled={isScanning || scanProgress === 100}
                  className={cn(
                    "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all shadow-sm",
                    isScanning
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                      : scanProgress === 100
                        ? "bg-emerald-500 text-white"
                        : "bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200",
                  )}
                >
                  {scanProgress === 100 ? (
                    <>
                      <CheckCircle2 className="size-3" /> Scanned
                    </>
                  ) : isScanning ? (
                    "Analyzing..."
                  ) : (
                    <>
                      <Play className="size-2.5 fill-current" /> Analyze
                    </>
                  )}
                </button>
              </div>

              {/* Progress Line */}
              {scanProgress >= 0 && (
                <div className="mt-4 space-y-1.5">
                  <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    <span>Segmenting Clauses</span>
                    <span>{scanProgress}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${scanProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Results Grid / Output */}
            {scanProgress === 100 && (
              <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1 animate-in fade-in duration-300">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-3.5" />
                  <input
                    type="text"
                    placeholder="Search extracted clauses..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full h-8 pl-9 pr-4 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200/50 dark:border-white/5 text-[10px] font-bold outline-none focus:border-primary/50 text-slate-800 dark:text-slate-200"
                  />
                </div>

                {/* Extracted Clauses List */}
                <div className="space-y-2.5">
                  {filteredClauses.map((clause) => {
                    const isExpanded = expandedClauseId === clause.id;
                    return (
                      <div
                        key={clause.id}
                        className={cn(
                          "border rounded-xl transition-all overflow-hidden",
                          isExpanded
                            ? "bg-slate-50/50 dark:bg-zinc-900/30 border-primary"
                            : "bg-white dark:bg-zinc-950 border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10",
                        )}
                      >
                        {/* Header Accordion */}
                        <div
                          onClick={() =>
                            setExpandedClauseId(isExpanded ? null : clause.id)
                          }
                          className="p-3.5 flex items-center justify-between cursor-pointer select-none"
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className={cn(
                                "size-2 rounded-full",
                                clause.severity === "red"
                                  ? "bg-rose-500"
                                  : clause.severity === "amber"
                                    ? "bg-amber-500"
                                    : "bg-emerald-500",
                              )}
                            />
                            <span className="text-[10px] sm:text-xs font-bold text-slate-800 dark:text-slate-200">
                              {clause.name}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "px-2 py-0.5 text-[8px] font-black uppercase rounded",
                                clause.severity === "red"
                                  ? "bg-rose-500/10 text-rose-500"
                                  : clause.severity === "amber"
                                    ? "bg-amber-500/10 text-amber-500"
                                    : "bg-emerald-500/10 text-emerald-500",
                              )}
                            >
                              {clause.severity === "red"
                                ? "Deviation"
                                : clause.severity === "amber"
                                  ? "Warning"
                                  : "Compliant"}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="size-3 text-slate-400" />
                            ) : (
                              <ChevronDown className="size-3 text-slate-400" />
                            )}
                          </div>
                        </div>

                        {/* Extended Comparison Details */}
                        {isExpanded && (
                          <div className="px-3.5 pb-3.5 pt-1 text-[10px] border-t border-slate-200 dark:border-white/5 space-y-3 animate-in slide-in-from-top-2 duration-200">
                            <div>
                              <span className="font-black text-slate-400 uppercase tracking-widest block mb-0.5">
                                Treaty Wording
                              </span>
                              <p className="text-slate-700 dark:text-slate-300 font-medium bg-slate-100 dark:bg-zinc-900 p-2 rounded-lg leading-relaxed">
                                {clause.wording}
                              </p>
                            </div>
                            <div>
                              <span className="font-black text-slate-400 uppercase tracking-widest block mb-0.5">
                                Corporate Standard Guideline
                              </span>
                              <p className="text-slate-700 dark:text-slate-300 font-medium bg-slate-100 dark:bg-zinc-900 p-2 rounded-lg leading-relaxed">
                                {clause.guideline}
                              </p>
                            </div>
                            <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20 flex gap-2">
                              <Sparkles className="text-primary size-4 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-black text-primary uppercase tracking-widest block mb-0.5">
                                  AI Recommendation
                                </span>
                                <p className="text-slate-800 dark:text-slate-200 font-bold leading-relaxed">
                                  {clause.recommendation}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {scanProgress === -1 && (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                <UploadCloud className="text-slate-300 dark:text-zinc-800 size-12 animate-pulse" />
                <div>
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    Treaty analysis ready to execute
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1 max-w-[220px]">
                    Select Quota Share or Excess of Loss above and click
                    &quot;Analyze&quot; to begin the automated vetting sequence.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Decorative blur rings */}
          <div className="absolute -top-10 -right-10 w-48 h-48 bg-primary/20 dark:bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-primary/10 dark:bg-primary/5 rounded-full blur-3xl" />
        </div>
      </div>
    </section>
  );
};
