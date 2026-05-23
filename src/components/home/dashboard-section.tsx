"use client";

import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  AlertTriangle,
  Handshake,
  CheckCircle,
  FileText,
  PieChart,
  Activity,
  ChevronRight,
  ShieldCheck,
  Zap,
  Flame,
  Clock,
  RefreshCw,
  Sparkles,
} from "lucide-react";

export const DashboardSection = () => {
  const [activeTab, setActiveTab] = useState<
    "trending" | "portfolio" | "simulator"
  >("trending");
  const [selectedKpi, setSelectedKpi] = useState<string>("treaties");
  const [simStep, setSimStep] = useState<number>(-1);
  const [simLogs, setSimLogs] = useState<string[]>([]);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // Ingestion Simulator steps
  const simulationSteps = [
    "⚡ Initializing Treaty Intake Engine...",
    "📄 Ingesting Marine_Cargo_Slip_V4.pdf (24 Pages)...",
    "🔍 Scanning document layers & extracting plaintext structures...",
    "🧠 Aligning semantic clauses via Gemini-3.5-Flash...",
    "🧩 Segmenting treaty wording into 14 distinct clauses...",
    "⚖️ Running real-time evaluation against 8 portfolio rules...",
    "⚠️ Deviation Warning: 'Loss Notification' wording sets a 15-day limit. (Portfolio policy requires 30+ days).",
    "✅ Standard Match: 'Sanctions Exclusion LMA5092' verified at 98.4% library fidelity.",
    "🚀 Treaty Ingestion Completed: Risk Exposure Index 82/100 (Safe with 1 deviation warning).",
  ];

  const handleSimulate = () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setSimStep(0);
    setSimLogs([simulationSteps[0]]);
  };

  useEffect(() => {
    if (!isSimulating) return;
    if (simStep < simulationSteps.length - 1) {
      const timer = setTimeout(() => {
        setSimStep((prev) => prev + 1);
        setSimLogs((prev) => [...prev, simulationSteps[simStep + 1]]);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setIsSimulating(false);
    }
  }, [isSimulating, simStep]);

  return (
    <section className="py-24 bg-slate-50 dark:bg-background/40 transition-colors duration-300">
      <div className="max-w-6xl mx-auto px-10">
        {/* Header */}
        <div className="text-center mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-black uppercase tracking-widest">
            <Activity className="size-4 animate-pulse" /> Live System Simulation
          </div>
          <h2 className="text-4xl lg:text-5xl font-black tracking-tight text-slate-900 dark:text-white uppercase">
            Portfolio Risk Analytics
          </h2>
          <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto text-base font-medium">
            Explore a functional interactive simulation of our live intelligence
            dashboard. Toggle metrics, view structural trends, and test our
            cognitive ingestion engine.
          </p>
        </div>

        {/* Live KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <div
            onClick={() => setSelectedKpi("treaties")}
            className={cn(
              "p-8 rounded-[2.5rem] border transition-all cursor-pointer group relative overflow-hidden select-none",
              selectedKpi === "treaties"
                ? "bg-white dark:bg-zinc-900 border-primary shadow-lg scale-[1.02] shadow-primary/5"
                : "bg-white/80 dark:bg-zinc-900/50 border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10",
            )}
          >
            <div className="flex justify-between items-start mb-6">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-primary transition-colors">
                Treaties Audited
              </span>
              <div className="p-3 bg-primary/10 rounded-2xl">
                <FileText className="text-primary size-5" />
              </div>
            </div>
            <div className="text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tighter">
              24
            </div>
            <div className="mt-4 text-[10px] text-emerald-500 font-black uppercase tracking-widest flex items-center gap-1 bg-emerald-500/10 w-fit px-2.5 py-1 rounded-full">
              <TrendingUp className="size-3" /> +12% MoM
            </div>
          </div>

          <div
            onClick={() => setSelectedKpi("deviations")}
            className={cn(
              "p-8 rounded-[2.5rem] border transition-all cursor-pointer group relative overflow-hidden select-none",
              selectedKpi === "deviations"
                ? "bg-white dark:bg-zinc-900 border-rose-500 shadow-lg scale-[1.02] shadow-rose-500/5"
                : "bg-white/80 dark:bg-zinc-900/50 border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10",
            )}
          >
            <div className="flex justify-between items-start mb-6">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-rose-500 transition-colors">
                High Risk Exposure
              </span>
              <div className="p-3 bg-rose-500/10 rounded-2xl">
                <AlertTriangle className="text-rose-500 size-5" />
              </div>
            </div>
            <div className="text-4xl lg:text-5xl font-black text-rose-500 tracking-tighter">
              3
            </div>
            <div className="mt-4 text-[10px] text-rose-500 font-black uppercase tracking-widest flex items-center gap-1 bg-rose-500/10 w-fit px-2.5 py-1 rounded-full">
              Critical Alerts
            </div>
          </div>

          <div
            onClick={() => setSelectedKpi("clauses")}
            className={cn(
              "p-8 rounded-[2.5rem] border transition-all cursor-pointer group relative overflow-hidden select-none",
              selectedKpi === "clauses"
                ? "bg-white dark:bg-zinc-900 border-secondary shadow-lg scale-[1.02] shadow-secondary/5"
                : "bg-white/80 dark:bg-zinc-900/50 border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10",
            )}
          >
            <div className="flex justify-between items-start mb-6">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-secondary transition-colors">
                Approved Clauses
              </span>
              <div className="p-3 bg-secondary/10 rounded-2xl">
                <Handshake className="text-secondary size-5" />
              </div>
            </div>
            <div className="text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tighter">
              164
            </div>
            <div className="mt-4 text-[10px] text-slate-500 font-black uppercase tracking-widest px-3 py-1 bg-slate-100 dark:bg-white/5 rounded-full w-fit">
              94% Compliant
            </div>
          </div>

          <div
            onClick={() => setSelectedKpi("compliance")}
            className={cn(
              "p-8 rounded-[2.5rem] border transition-all cursor-pointer group relative overflow-hidden select-none",
              selectedKpi === "compliance"
                ? "bg-white dark:bg-zinc-900 border-emerald-500 shadow-lg scale-[1.02] shadow-emerald-500/5"
                : "bg-white/80 dark:bg-zinc-900/50 border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10",
            )}
          >
            <div className="flex justify-between items-start mb-6">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-emerald-500 transition-colors">
                Compliance Health
              </span>
              <div className="p-3 bg-emerald-500/10 rounded-2xl">
                <ShieldCheck className="text-emerald-500 size-5" />
              </div>
            </div>
            <div className="text-4xl lg:text-5xl font-black text-emerald-500 tracking-tighter">
              92.4%
            </div>
            <div className="mt-4 text-[10px] text-emerald-500 font-black uppercase tracking-widest px-3 py-1 bg-emerald-500/10 rounded-full w-fit">
              Highly Optimized
            </div>
          </div>
        </div>

        {/* Interactive Workspace Panel */}
        <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden">
          {/* Panel Controls */}
          <div className="p-8 border-b border-slate-200 dark:border-white/5 flex flex-wrap items-center justify-between gap-6">
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Treaty Ingestion System Simulator
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Interactive modeling of portfolio-wide risk profiles.
              </p>
            </div>

            <div className="flex bg-slate-100 dark:bg-zinc-950 rounded-xl p-1 border border-slate-200 dark:border-white/10">
              <button
                onClick={() => setActiveTab("trending")}
                className={cn(
                  "px-5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                  activeTab === "trending"
                    ? "bg-primary text-white"
                    : "text-slate-500 hover:text-slate-950 dark:hover:text-white",
                )}
              >
                Clause Trends
              </button>
              <button
                onClick={() => setActiveTab("portfolio")}
                className={cn(
                  "px-5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                  activeTab === "portfolio"
                    ? "bg-primary text-white"
                    : "text-slate-500 hover:text-slate-950 dark:hover:text-white",
                )}
              >
                Portfolio Composition
              </button>
              <button
                onClick={() => setActiveTab("simulator")}
                className={cn(
                  "px-5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5",
                  activeTab === "simulator"
                    ? "bg-primary text-white"
                    : "text-slate-500 hover:text-slate-950 dark:hover:text-white",
                )}
              >
                <Sparkles className="size-3" /> Live Simulator
              </button>
            </div>
          </div>

          {/* Panel Viewports */}
          <div className="min-h-[460px] bg-slate-50/50 dark:bg-black/10 flex flex-col">
            {/* VIEWPORT 1: TRENDS */}
            {activeTab === "trending" && (
              <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 animate-in fade-in duration-300">
                {/* Approved Trends */}
                <div className="bg-white dark:bg-zinc-900/30 border border-slate-200 dark:border-white/5 rounded-[2rem] p-6 lg:p-8 space-y-6">
                  <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <Flame className="text-emerald-500 size-5" /> Highly Aligned
                    Clauses
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-zinc-800/20 border border-slate-200/50 dark:border-white/5 rounded-xl hover:border-emerald-500/30 transition-all group">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-slate-400">
                          01
                        </span>
                        <span className="text-xs lg:text-sm font-bold text-slate-700 dark:text-white group-hover:text-primary transition-colors">
                          Sanctions Exclusion Clause (LMA5092)
                        </span>
                      </div>
                      <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-500 text-[9px] font-black rounded-lg uppercase">
                        98% Fit
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-zinc-800/20 border border-slate-200/50 dark:border-white/5 rounded-xl hover:border-emerald-500/30 transition-all group">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-slate-400">
                          02
                        </span>
                        <span className="text-xs lg:text-sm font-bold text-slate-700 dark:text-white group-hover:text-primary transition-colors">
                          Reinsurance Intermediary Authorization
                        </span>
                      </div>
                      <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-500 text-[9px] font-black rounded-lg uppercase">
                        96% Fit
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-zinc-800/20 border border-slate-200/50 dark:border-white/5 rounded-xl hover:border-emerald-500/30 transition-all group">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-slate-400">
                          03
                        </span>
                        <span className="text-xs lg:text-sm font-bold text-slate-700 dark:text-white group-hover:text-primary transition-colors">
                          Errors & Omissions Treaty Buffer
                        </span>
                      </div>
                      <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-500 text-[9px] font-black rounded-lg uppercase">
                        95% Fit
                      </span>
                    </div>
                  </div>
                </div>

                {/* Risk Deviations */}
                <div className="bg-white dark:bg-zinc-900/30 border border-slate-200 dark:border-white/5 rounded-[2rem] p-6 lg:p-8 space-y-6">
                  <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <AlertTriangle className="text-rose-500 size-5" /> Critical
                    Wording Deviations
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-zinc-800/20 border border-slate-200/50 dark:border-white/5 rounded-xl hover:border-rose-500/30 transition-all group">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-slate-400">
                          01
                        </span>
                        <span className="text-xs lg:text-sm font-bold text-slate-700 dark:text-white group-hover:text-rose-500 transition-colors">
                          15-Day Loss Notification Restriction
                        </span>
                      </div>
                      <span className="px-2.5 py-1 bg-rose-500/10 text-rose-500 text-[9px] font-black rounded-lg uppercase">
                        Critical
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-zinc-800/20 border border-slate-200/50 dark:border-white/5 rounded-xl hover:border-rose-500/30 transition-all group">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-slate-400">
                          02
                        </span>
                        <span className="text-xs lg:text-sm font-bold text-slate-700 dark:text-white group-hover:text-rose-500 transition-colors">
                          Arbitration Seat Clause Jurisdiction
                        </span>
                      </div>
                      <span className="px-2.5 py-1 bg-amber-500/10 text-amber-500 text-[9px] font-black rounded-lg uppercase">
                        Warning
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-zinc-800/20 border border-slate-200/50 dark:border-white/5 rounded-xl hover:border-rose-500/30 transition-all group">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-slate-400">
                          03
                        </span>
                        <span className="text-xs lg:text-sm font-bold text-slate-700 dark:text-white group-hover:text-rose-500 transition-colors">
                          Insolvency Clause Assessment
                        </span>
                      </div>
                      <span className="px-2.5 py-1 bg-amber-500/10 text-amber-500 text-[9px] font-black rounded-lg uppercase">
                        Warning
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* VIEWPORT 2: PORTFOLIO */}
            {activeTab === "portfolio" && (
              <div className="p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 animate-in fade-in duration-300">
                {/* Left Progress Bars */}
                <div className="lg:col-span-7 bg-white dark:bg-zinc-900/30 border border-slate-200 dark:border-white/5 rounded-[2rem] p-6 lg:p-8 space-y-6 flex flex-col justify-center">
                  <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <PieChart className="text-primary size-5" /> Treaty Segment
                    Distribution
                  </h4>

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                        <span>Property Damage & Business Interruption</span>
                        <span>42%</span>
                      </div>
                      <div className="h-3 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-1000"
                          style={{ width: "42%" }}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                        <span>Excess of Loss Casualty Treaties</span>
                        <span>35%</span>
                      </div>
                      <div className="h-3 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-secondary rounded-full transition-all duration-1000"
                          style={{ width: "35%" }}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                        <span>Marine, Cargo & Aviation Hull</span>
                        <span>23%</span>
                      </div>
                      <div className="h-3 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full transition-all duration-1000"
                          style={{ width: "23%" }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Circular Gauge */}
                <div className="lg:col-span-5 bg-white dark:bg-zinc-900/30 border border-slate-200 dark:border-white/5 rounded-[2rem] p-6 lg:p-8 flex flex-col items-center justify-center text-center">
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">
                    Audit Resolution Index
                  </h4>

                  <div className="relative size-40 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        className="text-slate-100 dark:text-zinc-800"
                        cx="80"
                        cy="80"
                        r="64"
                        fill="transparent"
                        stroke="currentColor"
                        strokeWidth="12"
                      />
                      <circle
                        className="text-emerald-500 transition-all duration-1000"
                        cx="80"
                        cy="80"
                        r="64"
                        fill="transparent"
                        stroke="currentColor"
                        strokeWidth="12"
                        strokeDasharray="402"
                        strokeDashoffset="48"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-black text-slate-900 dark:text-white">
                        88%
                      </span>
                      <span className="text-[9px] font-black uppercase text-emerald-500 tracking-wider">
                        Approved
                      </span>
                    </div>
                  </div>

                  <p className="mt-5 text-xs font-medium text-slate-500 dark:text-slate-400">
                    88% of analyzed treaty wordings successfully reconciled with
                    core company templates.
                  </p>
                </div>
              </div>
            )}

            {/* VIEWPORT 3: LIVE SIMULATOR */}
            {activeTab === "simulator" && (
              <div className="p-8 flex flex-col gap-6 flex-1 animate-in fade-in duration-300">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        "size-2 rounded-full",
                        isSimulating
                          ? "bg-amber-500 animate-ping"
                          : "bg-emerald-500",
                      )}
                    />
                    <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                      Ingestion Status:{" "}
                      {isSimulating ? "Analyzing Treaty Wordings" : "Ready"}
                    </span>
                  </div>

                  <button
                    onClick={handleSimulate}
                    disabled={isSimulating}
                    className={cn(
                      "px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all shadow-md select-none",
                      isSimulating
                        ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                        : "bg-primary text-white hover:bg-primary/95 hover:shadow-primary/10",
                    )}
                  >
                    <RefreshCw
                      className={cn("size-3.5", isSimulating && "animate-spin")}
                    />
                    {isSimulating ? "Analyzing..." : "Simulate Treaty Intake"}
                  </button>
                </div>

                {/* Console Output Window */}
                <div className="flex-1 bg-slate-950 rounded-2xl border border-slate-800 p-6 font-mono text-xs text-slate-300 min-h-[280px] shadow-inner flex flex-col justify-between overflow-y-auto">
                  <div className="space-y-2">
                    {simLogs.map((log, idx) => (
                      <p
                        key={idx}
                        className={cn(
                          "transition-all duration-300",
                          log.startsWith("✅") || log.includes("Completed")
                            ? "text-emerald-400"
                            : log.startsWith("⚠️")
                              ? "text-amber-400"
                              : "text-slate-300",
                        )}
                      >
                        {log}
                      </p>
                    ))}
                    {simStep === -1 && (
                      <p className="text-slate-500 italic text-center py-16">
                        Click &quot;Simulate Treaty Intake&quot; to initialize
                        cognitive analysis sequence.
                      </p>
                    )}
                  </div>
                  {isSimulating && (
                    <div className="mt-4 flex items-center gap-2 text-slate-500 text-[10px]">
                      <span className="animate-bounce">●</span>
                      <span className="animate-bounce delay-75">●</span>
                      <span className="animate-bounce delay-150">●</span>
                      <span>Processing vector pipeline...</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
