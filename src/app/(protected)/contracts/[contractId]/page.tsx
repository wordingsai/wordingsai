"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2,
  Sparkles,
  AlertTriangle,
  BrainCircuit,
  Download,
  Building2,
  Lock,
  ShieldCheck,
  LayoutGrid,
  FileText,
  Settings2,
  Target,
} from "lucide-react";

import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import Link from "next/link";
import {
  type StructuredContract,
  countDocumentMapHeadings,
} from "@/lib/structured-contract";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { PdfViewer } from "@/components/contracts/pdf-viewer";
import { useCurrentPlan } from "@/hooks/use-current-plan";
import { useAnalysisSync } from "@/hooks/use-analysis-sync";
import { Contract, AnalysisResult } from "@/types/analysis";
import { getAuditStatus } from "@/lib/analysis-utils";

// Extracted sub-components
import { SummaryPanel } from "./_components/summary-panel";
import { RulesEvaluationPanel } from "./_components/rules-evaluation-panel";
import { PlusAnalysisPanel } from "./_components/plus-analysis-panel";
import { DocumentMapPanel } from "./_components/document-map-panel";

export default function ContractAnalysisPage() {
  const { contractId } = useParams() as { contractId: string };
  const router = useRouter();
  const { plan } = useCurrentPlan();

  const {
    contract,
    checklistEvents,
    loading,
    analysisLoading,
    error,
    runAnalysis,
    runRulesEvaluation,
    isProcessing,
    progress,
    hasAnalysis,
    hasFastAnalysis,
    hasRuleResults,
    isRulesProcessing,
    setContract,
  } = useAnalysisSync(contractId);

  const [needsReanalysis, setNeedsReanalysis] = useState(false);

  // 5-Tab Architecture
  const [activeTab, setActiveTab] = useState<
    | "summary"
    | "rules-evaluation"
    | "plus-analysis"
    | "document-map"
    | "document-view"
  >("summary");

  const [highlightText, setHighlightText] = useState<string | null>(null);
  // Risk Drivers / Key Milestones brief panel. Default to HIDDEN -- most
  // contracts have nothing critical to surface here ("No critical risks
  // identified") and the empty 260px rail wasted screen real estate.
  const [isPanel1Open, setIsPanel1Open] = useState(false);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  /** When false, hide unidentified / not-matched rows (compact corporate view). Default: show all. */
  const [showUnidentifiedClauses, setShowUnidentifiedClauses] = useState(true);

  // "Save detected clause to my library" dialog state lives here so it can
  // be controlled from SummaryPanel without extra prop drilling.
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  // Keep-alive flag for the PDF tab: once the Document view is opened we keep
  // the (expensive) PdfViewer mounted and just toggle its visibility, so
  // switching tabs doesn't re-download/re-parse the PDF.
  const [pdfEverOpened, setPdfEverOpened] = useState(false);
  useEffect(() => {
    if (activeTab === "document-view") setPdfEverOpened(true);
  }, [activeTab]);

  const filteredEvents = useMemo(() => {
    if (showUnidentifiedClauses) return checklistEvents;
    return checklistEvents.filter(
      (e) =>
        e.status === "Matched" ||
        e.status === "Variation" ||
        e.status === "Green" ||
        e.status === "Amber",
    );
  }, [checklistEvents, showUnidentifiedClauses]);

  const selectedEvent = useMemo(() => {
    return checklistEvents.find((e) => e.id === selectedResultId);
  }, [checklistEvents, selectedResultId]);

  const showFastResults =
    hasFastAnalysis ||
    checklistEvents.length > 0 ||
    !!contract?.structuredContent;

  const expectedChecklistHeadings = useMemo(() => {
    if (contract?.analysis?.checklistExpectedCount != null) {
      return contract.analysis.checklistExpectedCount as number;
    }
    const map =
      contract?.structuredContent || contract?.analysis?.structuredContent;
    return map ? countDocumentMapHeadings(map as StructuredContract) : null;
  }, [contract]);

  const autoRunTriggered = useRef(false);

  // Auto-run fast analysis ONLY if this is a truly fresh contract (no prior progress at all)
  useEffect(() => {
    const isFreshContract =
      !contract?.analysisProgress || contract.analysisProgress === 0;
    if (
      !loading &&
      !showFastResults &&
      !isProcessing &&
      !autoRunTriggered.current &&
      contract &&
      isFreshContract
    ) {
      console.log("[Page] Auto-triggering full analysis for fresh contract...");
      autoRunTriggered.current = true;
      runAnalysis(false, "full");
    }
  }, [loading, showFastResults, isProcessing, contract, runAnalysis]);

  useEffect(() => {
    // Redirect logic removed - automated pipeline handles deep analysis now
  }, []);

  useEffect(() => {
    if (hasAnalysis && contract) {
      const rulesChanged =
        contract.analysisResults?.some(
          (r) => r.ruleVersionId !== r.rule.currentVersionId,
        ) || false;

      const rulesCountChanged =
        contract.currentRuleCount !== contract.totalRules;

      const contractUpdated = Boolean(
        contract.updatedAt &&
        contract.lastAnalyzedAt &&
        new Date(contract.updatedAt) > new Date(contract.lastAnalyzedAt),
      );

      setNeedsReanalysis(rulesChanged || rulesCountChanged || contractUpdated);
    }
  }, [hasAnalysis, contract]);

  const handleExport = () => {
    if (!contract || !contract.analysisResults) return;
    const headers = ["Rule Name", "Status", "Reasoning"];
    const rows = contract.analysisResults.map((r) => [
      `"${r.rule.name}"`,
      `"${r.status}"`,
      `"${r.reasoning.replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers, ...rows].map((e) => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${contract.contractName}_Analysis.csv`;
    link.click();
    toast.success("Report generated");
  };

  const handleSaveComment = async (ruleResultId: string, comments: string) => {
    try {
      const res = await fetch(
        `/api/contracts/${contractId}/rule-results/${ruleResultId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comments }),
        },
      );
      if (res.ok) {
        toast.success("Comment saved");
        if (contract) {
          const updatedResults = contract.analysisResults?.map((r) =>
            r.id === ruleResultId ? { ...r, comments } : r,
          );
          setContract({ ...contract, analysisResults: updatedResults });
        }
      }
    } catch (err) {
      toast.error("Network error saving comment");
    }
  };

  const handleSaveKeyTerms = async (
    ruleResultId: string,
    keyTerms: string[],
  ) => {
    try {
      const res = await fetch(
        `/api/contracts/${contractId}/rule-results/${ruleResultId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keyTerms }),
        },
      );
      if (res.ok) {
        toast.success("Keywords updated");
        if (contract) {
          const updatedResults = contract.analysisResults?.map((r) =>
            r.id === ruleResultId ? { ...r, keyTerms } : r,
          );
          setContract({ ...contract, analysisResults: updatedResults });
        }
      }
    } catch (err) {
      toast.error("Network error saving keywords");
    }
  };

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center bg-background p-8 min-h-[80vh]">
        <div className="flex flex-col items-center gap-4 text-primary animate-pulse">
          <BrainCircuit className="w-12 h-12 animate-spin-slow" />
          <span className="font-semibold uppercase tracking-widest text-xs">
            Accessing Neural Archive...
          </span>
        </div>
      </main>
    );
  }

  if (error || !contract) {
    return (
      <main className="flex-1 flex items-center justify-center bg-background p-8 min-h-[80vh]">
        <div className="max-w-md w-full bg-surface-container border border-outline-variant/30 rounded-lg p-10 text-center space-y-6">
          <div className="size-16 bg-destructive/10 rounded-2xl flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold uppercase tracking-widest text-on-surface">
              Data Access Error
            </h2>
            <p className="text-sm text-on-surface-variant font-medium leading-relaxed text-left">
              {error || "The requested contract could not be retrieved."}
            </p>
          </div>
          <div className="pt-4 flex flex-col gap-3">
            <Button
              className="bg-primary text-primary-foreground text-xs font-medium uppercase tracking-wider rounded-xl h-12 w-full"
              onClick={() => window.location.reload()}
            >
              Retry Connection
            </Button>
            <Link href="/contracts" className="block w-full">
              <Button
                variant="outline"
                className="text-xs font-medium uppercase tracking-wider rounded-xl h-12 w-full border-outline-variant"
              >
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const redCount =
    contract.analysisResults?.filter((r) => r.status === "Red").length || 0;
  const amberCount =
    contract.analysisResults?.filter((r) => r.status === "Amber").length || 0;
  const greenCount =
    contract.analysisResults?.filter((r) => r.status === "Green").length || 0;
  const riskScore = contract.riskScore ?? 100;

  const isBasic = plan === "basic";
  const isPlus = plan === "plus";
  const isFast = plan === "fast";

  // Tab access rules:
  // fast  → summary only works; rules-evaluation & plus-analysis shown but locked
  // basic → summary + rules-evaluation work; plus-analysis shown but locked
  // plus  → all tabs work
  const canAccessRulesEvaluation = isBasic || isPlus;
  const canAccessPlusAnalysis = isPlus;

  const handleTabClick = (tab: typeof activeTab) => {
    if (tab === "rules-evaluation" && !canAccessRulesEvaluation) {
      toast.info("Upgrade to Basic or Plus to access Rules Evaluation.");
      return;
    }
    if (tab === "plus-analysis" && !canAccessPlusAnalysis) {
      toast.info("Upgrade to Plus to access Plus Analysis.");
      return;
    }
    setActiveTab(tab);
  };

  const auditStatus = getAuditStatus(contract);
  const backendProgress = contract.analysisProgress ?? 0;
  const analysisStatusLabel =
    contract.analysisStatus ||
    contract.analysis?.status ||
    "Cognitive Analysis in Progress";

  return (
    <main className="flex-1 p-4 md:p-6 lg:p-10 overflow-x-hidden">
      {/* Background Decorative */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-[0.03] -z-10">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--primary)_0%,_transparent_70%)]" />
      </div>

      {/* Page Header */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-6">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink
                  href="/contracts"
                  className="text-[10px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant hover:text-primary transition-colors"
                >
                  Portfolio Archive
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-on-surface-variant" />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-[10px] font-semibold uppercase tracking-[0.2em] text-on-surface">
                  {contract.contractName}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-on-surface leading-tight">
                {contract.contractName}
              </h1>
              <Badge
                variant="outline"
                className={cn(
                  "rounded-md text-[11px] font-medium px-2 py-0.5 shrink-0",
                  auditStatus === "completed"
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                    : isProcessing
                      ? "bg-primary/10 text-primary border-primary/20 animate-pulse"
                      : "bg-primary/10 text-primary border-primary/20",
                )}
              >
                {auditStatus}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-on-surface-variant">
              <span className="flex items-center gap-1.5">
                <Building2 className="size-3.5 text-primary" />
                {contract.reinsured}
              </span>
              <span className="flex items-center gap-1.5">
                <LayoutGrid className="size-3" /> {contract.contractType}
              </span>
              <span className="flex items-center gap-1">
                Plan
                <span
                  className={cn(
                    "font-medium",
                    isPlus ? "text-primary" : "text-on-surface",
                  )}
                >
                  {plan?.toUpperCase() || "BASIC"}
                </span>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href={`/contracts/${contractId}/edit`}>
              <Button variant="outline" size="sm" className="gap-2">
                <Settings2 className="size-3.5" /> Edit
              </Button>
            </Link>
            {hasAnalysis && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleExport}
              >
                <Download className="size-3.5" /> Export
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => {
                // If we already have analysis or it stalled, we want to FORCE a reset
                runAnalysis(true);
              }}
              disabled={analysisLoading || isProcessing}
              className="gap-2"
            >
              {analysisLoading || isProcessing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              {isProcessing
                ? "Analysis in progress…"
                : hasAnalysis
                  ? "Re-run analysis"
                  : hasFastAnalysis
                    ? "Re-run analysis"
                    : "Run analysis"}
            </Button>
          </div>
        </div>
      </div>

      {/* Progress & Real-time State */}
      {isProcessing && (
        <div className="mb-10 bg-surface-container-low border border-primary/20 rounded-lg p-6 lg:p-8 shadow-xl animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-5 w-full md:w-auto">
              <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 shadow-inner">
                <Loader2 className="size-7 text-primary animate-spin" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-on-surface uppercase tracking-tight flex items-center gap-2">
                  {analysisStatusLabel}
                  <Sparkles className="size-3 text-primary animate-pulse" />
                </h3>
                <p className="text-[11px] font-medium text-on-surface-variant leading-relaxed">
                  {analysisStatusLabel.includes("[3/5]") ||
                  analysisStatusLabel.includes("Fast Analysis")
                    ? "Matching contract clauses against your library and building the executive summary. Large documents can take several minutes."
                    : analysisStatusLabel.includes("[5/5]") ||
                        analysisStatusLabel.includes("Deep Analysis")
                      ? "Evaluating rules and generating risk assessments. Results will appear as each rule completes."
                      : analysisStatusLabel.includes("OCR") ||
                          analysisStatusLabel.includes("[2/5]")
                        ? "Extracting text and structure from your document."
                        : "Processing your contract. This updates automatically when each pipeline stage completes."}
                </p>
              </div>
            </div>
            <div className="w-full md:w-80 space-y-3">
              <div className="flex justify-between items-center text-xs font-medium uppercase tracking-wider">
                <span className="text-on-surface-variant">Progress</span>
                {/* Show one authoritative number: prefer backend stage when
                    it's ahead, otherwise show the smoothed frontend value.
                    Never show two contradictory percentages (F9). */}
                <span className="text-primary">
                  {Math.max(progress || 0, backendProgress)}%
                </span>
              </div>
              <Progress value={progress || 5} className="h-2 bg-primary/5" />
              <div className="flex items-center gap-2 justify-end">
                <span className="size-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[9px] font-bold uppercase text-on-surface-variant tracking-wider italic">
                  {backendProgress < 55 &&
                  (progress ?? 0) >= backendProgress + 2
                    ? "Waiting for server — will auto-resume if stalled"
                    : `Evaluating ${progress}% complete`}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab nav */}
      <div className="mt-8">
        <div className="flex flex-wrap items-center gap-0.5 p-1 bg-surface-container-low border border-outline-variant/30 rounded-lg w-full max-w-fit mb-6">
          <button
            onClick={() => handleTabClick("summary")}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              activeTab === "summary"
                ? "bg-primary text-primary-foreground"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container",
            )}
          >
            <FileText className="size-3.5" /> Summary
          </button>

          <button
            onClick={() => handleTabClick("rules-evaluation")}
            title={
              isFast
                ? "Upgrade to Basic or Plus to unlock Rules Evaluation"
                : undefined
            }
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              isFast
                ? "opacity-50 cursor-not-allowed text-on-surface-variant"
                : activeTab === "rules-evaluation"
                  ? "bg-primary text-primary-foreground"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container",
            )}
          >
            <ShieldCheck className="size-3.5" />
            Rules evaluation
            {isFast && <Lock className="size-3" />}
          </button>

          <button
            onClick={() => handleTabClick("plus-analysis")}
            title={
              !canAccessPlusAnalysis
                ? "Upgrade to Plus to unlock Plus Analysis"
                : undefined
            }
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              !canAccessPlusAnalysis
                ? "opacity-50 cursor-not-allowed text-on-surface-variant"
                : activeTab === "plus-analysis"
                  ? "bg-secondary text-secondary-foreground"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container",
            )}
          >
            <Sparkles className="size-3.5" />
            Plus analysis
            {!canAccessPlusAnalysis && <Lock className="size-3" />}
          </button>

          <button
            onClick={() => handleTabClick("document-map")}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              activeTab === "document-map"
                ? "bg-primary text-primary-foreground"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container",
            )}
          >
            <Target className="size-3.5" /> Document map
          </button>

          <button
            onClick={() => handleTabClick("document-view")}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              activeTab === "document-view"
                ? "bg-primary text-primary-foreground"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container",
            )}
          >
            <FileText className="size-3.5" /> Document view
          </button>
        </div>

        {/* Tab Content */}
        <div className="animate-in fade-in duration-700 mt-6 w-full min-w-0">
          <AnimatePresence mode="wait">
            {activeTab === "summary" && (
              <motion.div
                key="summary-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="w-full"
              >
                <SummaryPanel
                  contract={contract}
                  contractId={contractId}
                  checklistEvents={checklistEvents}
                  filteredEvents={filteredEvents}
                  isProcessing={isProcessing}
                  isPanel1Open={isPanel1Open}
                  setIsPanel1Open={setIsPanel1Open}
                  showUnidentifiedClauses={showUnidentifiedClauses}
                  setShowUnidentifiedClauses={setShowUnidentifiedClauses}
                  selectedResultId={selectedResultId}
                  setSelectedResultId={setSelectedResultId}
                  selectedEvent={selectedEvent}
                  saveDialogOpen={saveDialogOpen}
                  setSaveDialogOpen={setSaveDialogOpen}
                  setHighlightText={setHighlightText}
                  setActiveTab={(tab) => setActiveTab(tab as typeof activeTab)}
                  expectedChecklistHeadings={expectedChecklistHeadings}
                />
              </motion.div>
            )}

            {activeTab === "rules-evaluation" && (
              <motion.div
                key="rules-evaluation-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <RulesEvaluationPanel
                  contract={contract}
                  contractId={contractId}
                  showFastResults={showFastResults}
                  hasRuleResults={hasRuleResults}
                  isProcessing={isProcessing}
                  analysisLoading={analysisLoading}
                  redCount={redCount}
                  amberCount={amberCount}
                  runAnalysis={runAnalysis as (force?: boolean, mode?: "fast" | "full") => void}
                  runRulesEvaluation={runRulesEvaluation}
                  handleSaveComment={handleSaveComment}
                  setHighlightText={setHighlightText}
                  setActiveTab={(tab) => setActiveTab(tab as typeof activeTab)}
                />
              </motion.div>
            )}

            {activeTab === "plus-analysis" && (
              <motion.div
                key="plus-analysis-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <PlusAnalysisPanel
                  contract={contract}
                  isPlus={isPlus}
                  hasAnalysis={hasAnalysis}
                  isProcessing={isProcessing}
                  analysisLoading={analysisLoading}
                  runAnalysis={runAnalysis as (force?: boolean, mode?: "fast" | "full") => void}
                  setHighlightText={setHighlightText}
                  setActiveTab={(tab) => setActiveTab(tab as typeof activeTab)}
                />
              </motion.div>
            )}

            {activeTab === "document-map" && (
              <motion.div
                key="document-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <DocumentMapPanel
                  structuredContent={contract.structuredContent}
                  analysisStructuredContent={contract.analysis?.structuredContent}
                  contractId={contractId}
                  highlightText={highlightText}
                  onParagraphClick={(text) => setHighlightText(text)}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* PERF: the PDF is expensive to fetch + parse, so we mount it once
              (on first open of the Document view) and then keep it alive,
              toggling visibility with CSS rather than unmounting. Switching
              tabs no longer re-downloads or re-parses the document. */}
          {pdfEverOpened ? (
            <div className={activeTab === "document-view" ? "block" : "hidden"}>
              <PdfViewer
                fileUrl={contract.fileURL || ""}
                contractId={contractId}
              />
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
