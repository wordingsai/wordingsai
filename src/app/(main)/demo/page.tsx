"use client";

import React, { useState, useMemo } from "react";
import {
  MessageSquare,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Search,
  Activity,
  Fingerprint,
  Scale,
  Hash,
  ChevronRight,
  ShieldCheck,
  LayoutGrid,
  FileText,
  Plus,
  ArrowRight,
  Building2,
  Cpu,
  RefreshCw,
  Eye,
  Settings2,
  BookOpen,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface RuleResult {
  id: string;
  name: string;
  category: string;
  status: "Red" | "Amber" | "Green";
  reasoning: string;
  wording: string;
  guideline: string;
  recommendation: string;
  keyTerms: string[];
  comments: string;
}

const initialRuleResults: RuleResult[] = [
  {
    id: "r1",
    name: "Sanctions Exclusion Clause Compliance",
    category: "Exclusions",
    status: "Red",
    reasoning:
      "The treaty slip does not contain a standard LMA sanctions exclusion clause, leaving the portfolio exposed to regulatory risks.",
    wording:
      "Worldwide coverage including full territorial limits. No specific trade sanction exclusions or carve-outs listed.",
    guideline:
      "Standard LMA3100 or equivalent sanctions exclusion clause must be explicitly incorporated into all worldwide policies.",
    recommendation:
      "Reject wording. Append standard LMA3100 sanctions exclusion clause immediately.",
    keyTerms: ["LMA3100", "Exclusion", "Worldwide"],
    comments:
      "Critical compliance issue. Checked with regulatory framework and confirmed carve-out is required.",
  },
  {
    id: "r2",
    name: "Reinstatement Provisions Assessment",
    category: "Premium & Payments",
    status: "Red",
    reasoning:
      "Unlimited free reinstatements allowed for natural perils. This exceeds the approved corporate risk tolerance policy.",
    wording:
      "Unlimited free reinstatements allowed for all layers covered under the windstorm section.",
    guideline:
      "Treaty standards mandate a maximum of 1 free reinstatement, with subsequent reinstatements paid at 100% additional premium.",
    recommendation:
      "Propose amendment: 1 free reinstatement and 1 paid reinstatement at 100% additional premium.",
    keyTerms: ["Reinstatement", "Windstorm", "Premium"],
    comments:
      "Must negotiate paid reinstatements to prevent excessive aggregate exposure.",
  },
  {
    id: "r3",
    name: "Premium Credit Period Variance",
    category: "Premium & Payments",
    status: "Amber",
    reasoning:
      "The 60-day premium credit period is longer than our recommended standard of 30 days, representing a collection risk.",
    wording:
      "All reinsurance balances shall be settled by the Cedant within 60 days from treaty inception date.",
    guideline:
      "Premium Payment Warranty should ideally be set to a maximum of 30 days post-inception.",
    recommendation:
      "Propose settlement period reduction to 45 days as a compromise.",
    keyTerms: ["Credit Period", "Warranty", "Inception"],
    comments:
      "Cedant requested 60 days due to operational constraints, but 45 is our maximum allowed under exception rules.",
  },
  {
    id: "r4",
    name: "Net Retention Requirement Alignment",
    category: "Placement & Subscription",
    status: "Green",
    reasoning:
      "The cedant preserves a 10% net retention, which matches our mandatory retention threshold.",
    wording:
      "The Cedant hereby covenants to retain for its own account a minimum of 10.0% of the treaty liabilities.",
    guideline:
      "Underwriting guidelines mandate that the Cedant must retain at least 10% net for Quota Share treaties.",
    recommendation: "Approved. Retention meets all corporate risk standards.",
    keyTerms: ["Retention", "Quota Share", "Liability"],
    comments: "Verified matching terms with prior year slips. No deviation.",
  },
  {
    id: "r5",
    name: "Ultimate Net Loss Definitonal Scope",
    category: "Claims",
    status: "Amber",
    reasoning:
      "Includes external legal defense fees inside the ultimate net loss definition, which could inflate claims totals.",
    wording:
      "Ultimate Net Loss includes gross paid losses and all external legal and claims defense fees.",
    guideline:
      "Guidelines advise capping legal defense expenses at 10% of gross loss or excluding them from aggregate totals.",
    recommendation:
      "Cap legal defense fees at 10% of gross loss or exclude entirely.",
    keyTerms: ["UNL", "Defense Cost", "Aggregates"],
    comments: "Need to raise this in the next underwriting committee session.",
  },
];

export default function DemoPage() {
  const [results, setResults] = useState<RuleResult[]>(initialRuleResults);
  const [selectedId, setSelectedId] = useState<string>("r1");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<
    "summary" | "rules" | "plus" | "map" | "view"
  >("summary");
  const [commentInput, setCommentInput] = useState("");

  const activeResult = useMemo(() => {
    return results.find((r) => r.id === selectedId) || results[0];
  }, [results, selectedId]);

  const filteredResults = useMemo(() => {
    return results.filter(
      (r) =>
        r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.category.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [results, searchTerm]);

  // Count stats
  const redCount = results.filter((r) => r.status === "Red").length;
  const amberCount = results.filter((r) => r.status === "Amber").length;
  const greenCount = results.filter((r) => r.status === "Green").length;

  const handleSaveComment = (id: string, text: string) => {
    setResults((prev) =>
      prev.map((r) => (r.id === id ? { ...r, comments: text } : r)),
    );
  };

  const handleAddKeyword = (id: string, word: string) => {
    if (!word.trim()) return;
    setResults((prev) =>
      prev.map((r) => {
        if (r.id === id && !r.keyTerms.includes(word)) {
          return { ...r, keyTerms: [...r.keyTerms, word] };
        }
        return r;
      }),
    );
  };

  const handleRemoveKeyword = (id: string, indexToRemove: number) => {
    setResults((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          return {
            ...r,
            keyTerms: r.keyTerms.filter((_, idx) => idx !== indexToRemove),
          };
        }
        return r;
      }),
    );
  };

  return (
    <main className="flex-1 pt-20 md:pt-24 pb-20 px-4 md:px-6 lg:px-10 min-h-screen bg-background text-on-surface transition-colors duration-300">
      {/* Sandbox Notice Banner */}
      <div className="mb-6 p-5 rounded-lg bg-primary/10 border border-primary/20 flex flex-col sm:flex-row items-center justify-between gap-4 max-w-6xl mx-auto shadow-sm shadow-primary/5 dark:shadow-none">
        <div className="flex items-center gap-4 text-primary text-left">
          <div className="size-11 bg-primary/25 rounded-2xl flex items-center justify-center shrink-0">
            <Activity className="size-5 animate-pulse" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] block">
              Sandbox Demo Mode
            </span>
            <span className="text-xs md:text-sm font-semibold text-on-surface-variant leading-relaxed block break-words">
              Explore our Flagship Wordings Assessment dashboard. Create an
              account to upload your own contracts.
            </span>
          </div>
        </div>

        <Link href="/login">
          <Button className="bg-primary text-primary-foreground font-black uppercase tracking-widest text-[9px] h-10 px-5 rounded-xl flex items-center gap-2 shadow-lg shadow-primary/20  transition-transform shrink-0">
            Try Full Platform <ArrowRight className="size-3.5" />
          </Button>
        </Link>
      </div>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header Section - Full Width Stacked Navigation */}
        <div className="space-y-6 text-left border-b border-outline-variant/30 pb-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-on-surface leading-tight break-words flex-1 min-w-0">
                Property_Quota_Share_Treaty.pdf
              </h1>
              <Badge
                variant="outline"
                className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 border-emerald-500/20 text-xs font-medium uppercase px-3 py-1 shrink-0 animate-pulse"
              >
                Audited Wording
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2 text-on-surface-variant font-bold text-sm">
                <Building2 className="size-4 text-primary" />
                Global Reinsurance Corp
              </div>
              <div className="flex items-center gap-2 text-on-surface-variant/60 text-xs font-medium uppercase tracking-wider">
                <LayoutGrid className="size-3" /> Property Quota Share
              </div>
            </div>
          </div>

          {/* Prominent Full-Width Segment Tab Selector */}
          <div className="w-full bg-surface-container p-1.5 rounded-2xl border border-outline-variant/30 shadow-inner">
            <div className="grid grid-cols-2 min-[500px]:grid-cols-3 md:grid-cols-5 gap-1.5 w-full">
              {(["summary", "rules", "plus", "map", "view"] as const).map(
                (tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "w-full py-3.5 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all duration-300 text-center select-none block truncate",
                      activeTab === tab
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                        : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest/20",
                    )}
                  >
                    {tab === "summary"
                      ? "Checklist"
                      : tab === "rules"
                        ? "Rules Evaluation"
                        : tab === "plus"
                          ? "Plus Analysis"
                          : tab === "map"
                            ? "Document Map"
                            : "Document View"}
                  </button>
                ),
              )}
            </div>
          </div>
        </div>

        {/* Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Panel (8 Columns) */}
          <div className="lg:col-span-8 space-y-8">
            {/* TAB 1: SUMMARY / CHECKLIST */}
            {activeTab === "summary" && (
              <Card className="rounded-lg border border-outline-variant/30 bg-surface-container shadow-md shadow-black/[0.03] dark:shadow-none p-6 lg:p-8 text-left space-y-6 animate-in fade-in duration-300">
                <CardHeader className="p-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <CardTitle className="text-base font-semibold tracking-tight">
                      Wording Compliance Checklist
                    </CardTitle>
                    <p className="text-xs text-on-surface-variant font-medium">
                      Automatic triage of key treaty specifications and
                      criteria.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Badge className="bg-rose-500/10 text-rose-500 border border-rose-500/20 font-black uppercase py-1 px-3 text-[9px] tracking-widest">
                      {redCount} Red
                    </Badge>
                    <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-500/20 font-black uppercase py-1 px-3 text-[9px] tracking-widest">
                      {amberCount} Amber
                    </Badge>
                    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 border border-emerald-500/20 font-black uppercase py-1 px-3 text-[9px] tracking-widest">
                      {greenCount} Green
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-0 space-y-6">
                  <div className="p-5 bg-surface-container-low border border-outline-variant/30 rounded-2xl shadow-inner">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                        Cognitive Scan Completion
                      </span>
                      <span className="text-xs font-black text-primary">
                        100%
                      </span>
                    </div>
                    <Progress
                      value={100}
                      className="h-2 bg-surface-container-highest"
                    />
                  </div>

                  {/* Checklist Rows with robust word wrap and responsive stacking */}
                  <div className="space-y-3">
                    {results.map((r, idx) => (
                      <div
                        key={r.id}
                        onClick={() => {
                          setSelectedId(r.id);
                          setActiveTab("rules");
                        }}
                        className="p-4 md:p-5 bg-surface-container-low border border-outline-variant/20 hover:border-primary/50 hover:bg-surface-container-high rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer transition-all duration-300 group shadow-sm"
                      >
                        <div className="flex items-start sm:items-center gap-4 flex-1 min-w-0">
                          <span className="text-xs font-mono font-black text-on-surface-variant/40 mt-0.5 sm:mt-0 shrink-0">
                            {String(idx + 1).padStart(2, "0")}
                          </span>
                          <span className="text-sm font-bold text-on-surface group-hover:text-primary transition-colors leading-snug break-words pr-2">
                            {r.name}
                          </span>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto shrink-0 border-t border-outline-variant/10 sm:border-none pt-2 sm:pt-0">
                          <span
                            className={cn(
                              "px-3 py-1 text-[10px] font-medium uppercase tracking-wider rounded-lg border",
                              r.status === "Red"
                                ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                                : r.status === "Amber"
                                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-500/20"
                                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 border-emerald-500/20",
                            )}
                          >
                            {r.status === "Red"
                              ? "Deviation"
                              : r.status === "Amber"
                                ? "Warning"
                                : "Compliant"}
                          </span>
                          <ChevronRight className="size-4 text-on-surface-variant/40 group-hover:translate-x-1 group-hover:text-primary transition-all shrink-0" />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* TAB 2: RULES EVALUATION */}
            {activeTab === "rules" && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 text-left animate-in fade-in duration-300">
                {/* List of rules */}
                <div className="md:col-span-5 space-y-3 max-h-[550px] overflow-y-auto pr-1">
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60 size-4" />
                    <input
                      type="text"
                      placeholder="Filter compliance rules..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full h-11 pl-10 pr-4 rounded-xl bg-surface-container border border-outline-variant/30 text-xs font-bold outline-none focus:border-primary/50 text-on-surface shadow-sm focus:ring-1 focus:ring-primary/10"
                    />
                  </div>

                  {filteredResults.map((r) => (
                    <div
                      key={r.id}
                      onClick={() => setSelectedId(r.id)}
                      className={cn(
                        "p-4 rounded-2xl border transition-all duration-300 cursor-pointer select-none",
                        selectedId === r.id
                          ? "bg-surface-container border-primary shadow-md shadow-black/[0.02] scale-[1.01]"
                          : "bg-surface-container-low border-outline-variant/20 hover:border-outline-variant/50",
                      )}
                    >
                      <div className="flex items-center justify-between mb-2 gap-2">
                        <span className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant/60 truncate flex-1">
                          {r.category}
                        </span>
                        <span
                          className={cn(
                            "size-2 rounded-full shrink-0",
                            r.status === "Red"
                              ? "bg-rose-500"
                              : r.status === "Amber"
                                ? "bg-amber-500"
                                : "bg-emerald-500",
                          )}
                        />
                      </div>
                      <span className="text-xs font-bold text-on-surface block leading-snug break-words">
                        {r.name}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Focus Area Details */}
                <div className="md:col-span-7">
                  <Card className="rounded-lg border border-outline-variant/30 bg-surface-container shadow-md shadow-black/[0.03] dark:shadow-none p-6 lg:p-8 space-y-6">
                    <div className="border-b border-outline-variant/30 pb-4">
                      <span
                        className={cn(
                          "px-3 py-1 text-[10px] font-medium uppercase tracking-wider rounded-lg w-fit block mb-3 border",
                          activeResult.status === "Red"
                            ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                            : activeResult.status === "Amber"
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-500/20"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 border-emerald-500/20",
                        )}
                      >
                        {activeResult.status === "Red"
                          ? "Deviation Warning"
                          : activeResult.status === "Amber"
                            ? "Potential Risk"
                            : "Compliant Clause"}
                      </span>
                      <h3 className="text-lg md:text-xl font-black text-on-surface uppercase leading-snug break-words">
                        {activeResult.name}
                      </h3>
                    </div>

                    <div className="space-y-5">
                      {/* Slip wording */}
                      <div>
                        <span className="text-[10px] font-black uppercase text-on-surface-variant tracking-widest block mb-2">
                          Extracted Slip Wording
                        </span>
                        <p className="text-xs font-semibold leading-relaxed text-on-surface bg-surface-container-low p-4 rounded-2xl border border-outline-variant/10 shadow-inner break-words">
                          {activeResult.wording}
                        </p>
                      </div>

                      {/* Corporate standard */}
                      <div>
                        <span className="text-[10px] font-black uppercase text-on-surface-variant tracking-widest block mb-2">
                          Corporate Standard Guideline
                        </span>
                        <p className="text-xs font-semibold leading-relaxed text-on-surface bg-surface-container-low p-4 rounded-2xl border border-outline-variant/10 shadow-inner break-words">
                          {activeResult.guideline}
                        </p>
                      </div>

                      {/* AI recommendation */}
                      <div className="p-5 rounded-2xl bg-primary/5 border border-primary/20 flex gap-4">
                        <Sparkles className="text-primary size-5 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-black uppercase text-primary tracking-widest block mb-1">
                            Cognitive Recommendation
                          </span>
                          <p className="text-xs font-bold leading-relaxed text-on-surface break-words">
                            {activeResult.recommendation}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {/* TAB 3: PLUS ANALYSIS */}
            {activeTab === "plus" && (
              <Card className="rounded-lg border border-outline-variant/30 bg-surface-container shadow-md shadow-black/[0.03] dark:shadow-none p-6 lg:p-8 text-left space-y-8 animate-in fade-in duration-300">
                <div className="border-b border-outline-variant/30 pb-4">
                  <CardTitle className="text-base font-semibold tracking-tight flex items-center gap-3">
                    <Cpu className="text-primary size-6 animate-pulse animate-duration-1000" />{" "}
                    Cognitive Plus Assessment
                  </CardTitle>
                  <p className="text-xs text-on-surface-variant font-medium mt-1">
                    Strategic analysis of liability aggregates, jurisdictional
                    exposures, and reinsurance contract concentrations.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-6 bg-surface-container-low border border-outline-variant/20 rounded-2xl space-y-3 shadow-inner">
                    <span className="text-[9px] font-black text-on-surface-variant/60 uppercase tracking-widest">
                      Risk Accumulation
                    </span>
                    <h5 className="text-sm font-bold text-on-surface break-words">
                      Natural Catastrophe Aggregates
                    </h5>
                    <p className="text-xs text-on-surface-variant leading-relaxed break-words">
                      Unlimited reinstatements represent a major risk of
                      vertical exhaust in natural catastrophe perils.
                      Recommending reinstatement caps to prevent uncontrolled
                      aggregates.
                    </p>
                  </div>

                  <div className="p-6 bg-surface-container-low border border-outline-variant/20 rounded-2xl space-y-3 shadow-inner">
                    <span className="text-[9px] font-black text-on-surface-variant/60 uppercase tracking-widest">
                      Compliance Audit
                    </span>
                    <h5 className="text-sm font-bold text-on-surface break-words">
                      OFAC Sanctions Alignment
                    </h5>
                    <p className="text-xs text-on-surface-variant leading-relaxed break-words">
                      Absence of an explicit Sanctions clause poses a critical
                      regulatory breach. The slip must include strict LMA
                      wording protecting the reinsurer from OFAC compliance
                      risks.
                    </p>
                  </div>
                </div>

                <div className="p-6 rounded-2xl bg-secondary/5 border border-secondary/20 flex gap-4">
                  <Sparkles className="text-primary size-5 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <h5 className="text-xs font-black text-primary uppercase tracking-widest mb-1.5">
                      Strategic Underwriting Advisory
                    </h5>
                    <p className="text-xs font-bold leading-relaxed text-on-surface break-words">
                      The Quota Share contract presents strong cedant retention
                      (10%) but high vertical risk. Do not sign slip in its
                      current state. Require immediate inclusion of the LMA3100
                      sanctions clause and limit natural peril reinstatements to
                      1 free and 1 paid at 100%.
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* TAB 4: DOCUMENT MAP */}
            {activeTab === "map" && (
              <Card className="rounded-lg border border-outline-variant/30 bg-surface-container shadow-md shadow-black/[0.03] dark:shadow-none p-6 lg:p-8 text-left space-y-6 animate-in fade-in duration-300">
                <div className="border-b border-outline-variant/30 pb-4">
                  <CardTitle className="text-base font-semibold tracking-tight flex items-center gap-3">
                    <BookOpen className="text-primary size-6" /> Document Map
                    Structure
                  </CardTitle>
                  <p className="text-xs text-on-surface-variant font-medium mt-1">
                    Visual structural mapping of sections, clauses, and
                    structural placement within the treaty document.
                  </p>
                </div>

                <div className="border border-outline-variant/30 rounded-2xl overflow-hidden shadow-inner">
                  <div className="p-4 bg-surface-container-low font-mono text-[10px] text-on-surface-variant/60 border-b border-outline-variant/30 tracking-widest font-black uppercase">
                    Detected Structure: 3 Main Sections, 5 Clauses Audited
                  </div>

                  <div className="divide-y divide-outline-variant/20 bg-surface-container-low">
                    <div className="p-5 flex items-center justify-between hover:bg-surface-container-high/40 transition-colors">
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <span className="text-xs font-mono font-black text-on-surface-variant/40 shrink-0">
                          01
                        </span>
                        <span className="text-xs font-black uppercase text-on-surface tracking-tight break-words pr-3">
                          SECTION I — CORE PARTICIPATION & RETENTION
                        </span>
                      </div>
                      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 border border-emerald-500/20 font-black text-[8px] uppercase tracking-widest shrink-0">
                        Matched
                      </Badge>
                    </div>

                    <div className="p-5 flex items-center justify-between hover:bg-surface-container-high/40 transition-colors">
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <span className="text-xs font-mono font-black text-on-surface-variant/40 shrink-0">
                          02
                        </span>
                        <span className="text-xs font-black uppercase text-on-surface tracking-tight break-words pr-3">
                          SECTION II — PREMIUM SETTLEMENT & ACCOUNTING
                        </span>
                      </div>
                      <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-500/20 font-black text-[8px] uppercase tracking-widest shrink-0">
                        Warning
                      </Badge>
                    </div>

                    <div className="p-5 flex items-center justify-between hover:bg-surface-container-high/40 transition-colors">
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <span className="text-xs font-mono font-black text-on-surface-variant/40 shrink-0">
                          03
                        </span>
                        <span className="text-xs font-black uppercase text-on-surface tracking-tight break-words pr-3">
                          SECTION III — EXCLUSIONS & SANCTIONS
                        </span>
                      </div>
                      <Badge className="bg-rose-500/10 text-rose-500 border border-rose-500/20 font-black text-[8px] uppercase tracking-widest shrink-0">
                        Deviation
                      </Badge>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* TAB 5: DOCUMENT VIEW */}
            {activeTab === "view" && (
              <Card className="rounded-lg border border-outline-variant/30 bg-surface-container shadow-md shadow-black/[0.03] dark:shadow-none p-6 lg:p-8 text-left space-y-6 animate-in fade-in duration-300">
                <div className="border-b border-outline-variant/30 pb-4">
                  <CardTitle className="text-base font-semibold tracking-tight flex items-center gap-3">
                    <FileText className="text-primary size-6" /> Digital Treaty
                    Viewer
                  </CardTitle>
                  <p className="text-xs text-on-surface-variant font-medium mt-1">
                    Extracted slip text with integrated compliance triggers and
                    highlighted deviations.
                  </p>
                </div>

                <div className="p-6 bg-surface-container-low border border-outline-variant/30 rounded-2xl font-mono text-xs text-on-surface-variant leading-relaxed space-y-6 max-h-[420px] overflow-y-auto shadow-inner">
                  <p className="font-black border-b border-outline-variant/20 pb-2 text-on-surface tracking-widest uppercase">
                    PROPERTY QUOTA SHARE REINSURANCE SLIP
                  </p>

                  <p className="break-words">
                    REINSURED: Global Reinsurance Corp (referred to herein as
                    the Cedant).
                  </p>

                  <div className="p-4 bg-emerald-500/5 border-l-4 border-emerald-500 rounded-xl space-y-1">
                    <span className="font-black text-emerald-600 dark:text-emerald-500 text-[10px] uppercase tracking-widest block">
                      Clause 1 - Cedant Net Retention
                    </span>
                    <p className="text-on-surface font-semibold break-words">
                      The Cedant hereby covenants to retain for its own account
                      a minimum of 10.0% of the treaty liabilities. No
                      reinsurances or protections shall be purchased which
                      reduce this net retention below the mandatory 10.0%
                      threshold.
                    </p>
                  </div>

                  <div className="p-4 bg-amber-500/5 border-l-4 border-amber-500 rounded-xl space-y-1">
                    <span className="font-black text-amber-600 dark:text-amber-500 text-[10px] uppercase tracking-widest block">
                      Clause 2 - Premium Settlement Warranty
                    </span>
                    <p className="text-on-surface font-semibold break-words">
                      All reinsurance balances, accounting reports, and premium
                      aggregates shall be settled by the Cedant within 60 days
                      from treaty inception date. Failures or delays represent a
                      warranty breach.
                    </p>
                  </div>

                  <div className="p-4 bg-rose-500/5 border-l-4 border-rose-500 rounded-xl space-y-1">
                    <span className="font-black text-rose-500 text-[10px] uppercase tracking-widest block">
                      Clause 3 - Territorial Boundaries & Sanctions Exclusions
                    </span>
                    <p className="text-on-surface font-semibold break-words">
                      Worldwide coverage is granted under this treaty slip.
                      Coverage encompasses worldwide premium operations and all
                      reinsured risk territories. No specific trade sanction
                      exclusions or carve-out wording are incorporated.
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Right Panel (4 Columns) */}
          <div className="lg:col-span-4 space-y-8 text-left">
            <Card className="rounded-lg border border-outline-variant/30 bg-surface-container shadow-md shadow-black/[0.03] dark:shadow-none p-6 lg:p-8 space-y-6">
              <h4 className="text-[10px] font-black uppercase text-on-surface-variant tracking-[0.2em] border-b border-outline-variant/30 pb-3">
                Selected Clause Context
              </h4>

              {/* Tagging */}
              <div className="space-y-3">
                <span className="text-[10px] font-black uppercase text-on-surface-variant tracking-widest block">
                  Identified Key Terms
                </span>
                <div className="flex flex-wrap gap-2">
                  {activeResult.keyTerms.map((term, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="bg-primary/10 text-primary border-none text-[9px] font-black py-1.5 px-3.5 rounded-lg uppercase flex items-center gap-1.5 shadow-sm"
                    >
                      <Fingerprint className="size-3 shrink-0" /> {term}
                      <button
                        onClick={() =>
                          handleRemoveKeyword(activeResult.id, index)
                        }
                        className="size-3 text-primary/60 hover:text-primary rounded-full hover:bg-primary/20 shrink-0 font-bold ml-1"
                        title="Remove term"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}

                  {/* tag insertion */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const input = form.elements.namedItem(
                        "newWord",
                      ) as HTMLInputElement;
                      handleAddKeyword(activeResult.id, input.value);
                      input.value = "";
                    }}
                    className="inline-flex"
                  >
                    <input
                      name="newWord"
                      type="text"
                      placeholder="+ Add Tag"
                      className="bg-surface-container-low border border-dashed border-outline-variant rounded-lg text-[9px] font-black uppercase px-2.5 py-1 outline-none focus:border-primary w-16 hover:w-24 focus:w-24 transition-all text-on-surface"
                    />
                  </form>
                </div>
              </div>

              <hr className="border-outline-variant/30" />

              {/* Interactive Note Taking */}
              <div className="space-y-4">
                <h4 className="text-xs font-medium uppercase tracking-wider text-on-surface-variant flex items-center gap-2">
                  <MessageSquare className="size-4 text-primary" /> Review
                  Discussion Notes
                </h4>

                <div className="bg-surface-container-low p-4 border border-outline-variant/20 rounded-2xl text-xs font-semibold leading-relaxed text-on-surface-variant shadow-inner break-words">
                  {activeResult.comments ? (
                    <p className="text-on-surface">{activeResult.comments}</p>
                  ) : (
                    <span className="italic text-on-surface-variant/60 font-medium">
                      No review notes committed. Enter your first note below.
                    </span>
                  )}
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSaveComment(activeResult.id, commentInput);
                    setCommentInput("");
                  }}
                  className="space-y-3"
                >
                  <Textarea
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    placeholder="Type internal review context..."
                    className="h-20 bg-surface-container-low border-outline-variant/30 rounded-2xl text-xs focus:ring-1 focus:ring-primary/20 p-4 leading-relaxed text-on-surface"
                  />
                  <Button
                    type="submit"
                    className="bg-primary text-primary-foreground font-black uppercase tracking-widest text-[9px] rounded-xl h-10 w-full shadow shadow-primary/10 hover:scale-[1.01] transition-transform"
                  >
                    Save Review Context
                  </Button>
                </form>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
