"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  MessageSquare,
  Loader2,
  Plus,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Search,
  Activity,
  BrainCircuit,
  Zap,
  Download,
  Building2,
  Cpu,
  Fingerprint,
  BookOpen,
  Scale,
  Hash,
  Lock,
  ChevronRight,
  ShieldCheck,
  LayoutGrid,
  FileText,
  Edit,
  Settings2,
  Target,
  Shield,
  ListTodo,
  Calendar,
  Quote,
  XCircle,
  Copy,
  Info,
  BookmarkPlus,
} from "lucide-react";

import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import Link from "next/link";
import { DocumentStructure } from "@/components/contracts/document-structure";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { AnalysisChecklist } from "@/components/contracts/analysis-checklist";
import { SaveClauseToLibraryDialog } from "@/components/contracts/save-clause-to-library-dialog";
import { ClauseDiffView } from "@/components/contracts/clause-diff-view";
import { useCurrentPlan } from "@/hooks/use-current-plan";
import { authClient } from "@/lib/auth-client";
import { useAnalysisSync } from "@/hooks/use-analysis-sync";
import { Contract, AnalysisResult } from "@/types/analysis";
import { getAuditStatus, getStatusFromData } from "@/lib/analysis-utils";
import { PdfViewer } from "@/components/contracts/pdf-viewer";
import { TruncatedText } from "@/components/ui/truncated-text";
import { Switch } from "@/components/ui/switch";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

function CommentBox({
  initialValue,
  onSave,
  isLoading,
}: {
  initialValue: string;
  onSave: (val: string) => void;
  isLoading?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  if (!isEditing && !initialValue) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="text-xs font-medium uppercase tracking-wider text-on-surface-variant hover:text-primary mt-6"
        onClick={() => setIsEditing(true)}
      >
        <Plus className="w-3 h-3 mr-1" /> Add Internal Note
      </Button>
    );
  }

  if (!isEditing) {
    return (
      <div className="mt-8 p-6 bg-surface-container border border-outline-variant/30 rounded-lg group relative text-left">
        <div className="flex justify-between items-start mb-3">
          <h4 className="text-xs font-medium uppercase tracking-wider text-on-surface-variant flex items-center gap-2">
            <MessageSquare className="w-3 h-3 text-primary" /> Internal Review
            Discussion
          </h4>
          <Button
            variant="ghost"
            size="icon"
            className="opacity-0 group-hover:opacity-100 transition-opacity size-8 rounded-xl hover:bg-primary/10"
            onClick={() => setIsEditing(true)}
          >
            <Plus className="w-4 h-4 text-primary rotate-45" />
          </Button>
        </div>
        <p className="text-sm font-medium text-on-surface leading-relaxed">
          {initialValue}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 text-left">
      <h4 className="text-xs font-medium uppercase tracking-wider text-on-surface-variant flex items-center gap-2">
        <MessageSquare className="w-3 h-3 text-primary" /> Edit Review
        Discussion
      </h4>
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="bg-background border-outline-variant rounded-2xl text-sm min-h-[120px] focus:ring-2 focus:ring-primary/20 p-5 font-medium leading-relaxed"
        placeholder="Add professional context or internal notes..."
      />
      <div className="flex gap-3">
        <Button
          size="sm"
          className="bg-primary text-primary-foreground text-xs font-medium uppercase tracking-wider rounded-xl px-6 h-10 shadow-lg shadow-primary/20"
          onClick={() => {
            onSave(value);
            setIsEditing(false);
          }}
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : null}
          Commit Change
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs font-medium uppercase tracking-wider rounded-xl px-6 h-10 border-outline-variant"
          onClick={() => {
            setValue(initialValue);
            setIsEditing(false);
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

function EditableKeywords({
  initialKeywords,
  onSave,
  title = "Key Terms Identified",
}: {
  initialKeywords: string[];
  onSave: (val: string[]) => void;
  title?: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [keywords, setKeywords] = useState<string[]>(initialKeywords || []);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    setKeywords(initialKeywords || []);
  }, [initialKeywords]);

  const handleAddKeyword = (
    e:
      | React.KeyboardEvent<HTMLInputElement>
      | React.FocusEvent<HTMLInputElement>,
  ) => {
    if (e.type === "keydown" && (e as React.KeyboardEvent).key !== "Enter")
      return;
    e.preventDefault();
    const val = inputValue.trim();
    if (val && !keywords.includes(val)) {
      setKeywords([...keywords, val]);
    }
    setInputValue("");
  };

  const handleRemoveKeyword = (indexToRemove: number) => {
    setKeywords(keywords.filter((_, idx) => idx !== indexToRemove));
  };

  const handleUpdateKeyword = (index: number, newValue: string) => {
    const nextKeywords = [...keywords];
    nextKeywords[index] = newValue;
    setKeywords(nextKeywords);
  };

  if (!isEditing) {
    return (
      <div
        className="space-y-3 group relative cursor-pointer"
        onClick={() => setIsEditing(true)}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-on-surface-variant block">
            {title}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="opacity-0 group-hover:opacity-100 transition-opacity size-6 rounded-md hover:bg-primary/10"
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
          >
            <Plus className="w-3 h-3 text-primary" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {keywords.length > 0 ? (
            keywords.map((term) => (
              <Badge
                key={term}
                variant="secondary"
                className="bg-primary/10 text-primary border-none text-[9px] font-semibold py-1 px-3 rounded-lg uppercase"
              >
                <Fingerprint className="w-3 h-3 mr-1" /> {term}
              </Badge>
            ))
          ) : (
            <span className="text-xs text-on-surface-variant italic">
              No keywords yet. Click to add.
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 bg-surface-container/50 p-4 rounded-xl border border-outline-variant/30 animate-in fade-in duration-300">
      <span className="text-xs font-medium uppercase tracking-wider text-primary block">
        Editing {title}
      </span>
      <div className="flex flex-wrap gap-2 mb-3">
        {keywords.map((term, index) => (
          <div
            key={index}
            className="flex items-center gap-1 bg-primary/10 text-primary hover:bg-primary/20 transition-colors rounded-lg pr-1"
          >
            <input
              type="text"
              value={term}
              onChange={(e) => handleUpdateKeyword(index, e.target.value)}
              className="bg-transparent text-[9px] font-semibold uppercase border-none focus:outline-none focus:ring-1 focus:ring-primary/50 px-2 flex-1 rounded py-1 min-w-[60px]"
              style={{ width: `${Math.max(term.length + 2, 8)}ch` }}
            />
            <button
              onClick={() => handleRemoveKeyword(index)}
              className="opacity-60 hover:opacity-100 hover:bg-destructive/10 hover:text-destructive w-5 h-5 flex items-center justify-center rounded-full transition-colors"
              title="Remove keyword"
            >
              <Plus className="w-3 h-3 rotate-45" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleAddKeyword}
          onBlur={handleAddKeyword}
          className="flex-1 bg-background border border-outline-variant rounded-xl h-9 px-3 text-xs focus:outline-none focus:border-primary/50 text-foreground shadow-inner"
          placeholder="Type and press Enter to add..."
        />
        <Button
          size="sm"
          className="bg-primary text-primary-foreground h-9 px-4 rounded-xl text-[10px] uppercase font-semibold"
          onClick={() => {
            onSave(keywords);
            setIsEditing(false);
          }}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

function BoldText({ text }: { text: string }) {
  if (!text) return null;
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-extrabold text-primary">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return part;
      })}
    </>
  );
}

function SimpleMarkdown({ content }: { content: string }) {
  if (!content) return null;

  const sections = content.split(/\n\s*\n/);

  return (
    <div className="space-y-6">
      {sections.map((section, sIdx) => {
        const lines = section.split("\n");
        const firstLine = lines[0].trim();

        // Check for Header
        const headerMatch = firstLine.match(/^(#{1,6})\s+(.*)/);
        if (headerMatch) {
          const level = headerMatch[1].length;
          const text = headerMatch[2];
          const Tag = `h${Math.min(level + 2, 6)}` as any;
          return (
            <div key={sIdx} className="space-y-3">
              <Tag className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                <div className="w-1 h-3 bg-primary rounded-full" />
                <BoldText text={text} />
              </Tag>
              {lines.length > 1 && (
                <div className="space-y-3">
                  {lines.slice(1).map((line, lIdx) => (
                    <MarkdownLine key={lIdx} line={line} />
                  ))}
                </div>
              )}
            </div>
          );
        }

        return (
          <div key={sIdx} className="space-y-3">
            {lines.map((line, lIdx) => (
              <MarkdownLine key={lIdx} line={line} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function MarkdownLine({ line }: { line: string }) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const isList =
    trimmed.startsWith("*") ||
    trimmed.startsWith("-") ||
    trimmed.startsWith("•") ||
    trimmed.match(/^\d+\./);

  if (isList) {
    const listContent = trimmed.replace(/^([\*\-\•]|\d+\.)\s+/, "");
    return (
      <div className="flex gap-3 pl-2">
        <span className="text-primary font-semibold shrink-0">•</span>
        <span className="text-on-surface-variant text-sm lg:text-base font-medium leading-relaxed">
          <BoldText text={listContent} />
        </span>
      </div>
    );
  }

  return (
    <p className="text-on-surface-variant text-sm lg:text-base font-medium leading-relaxed">
      <BoldText text={line} />
    </p>
  );
}

function FormattedEvidence({
  evidence,
  structuredContent,
  onLookup,
}: {
  evidence: {
    content: string;
    similarity: number;
    sourceFileName?: string;
    headingLine?: string | null;
    clauseBody?: string | null;
  };
  structuredContent?: StructuredContract | null;
  onLookup?: (text: string) => void;
}) {
  const content = (evidence?.clauseBody || evidence?.content || "").trim();
  if (!content)
    return (
      <p className="text-xs lg:text-sm font-medium leading-relaxed text-on-surface-variant italic">
        No direct evidence fragment available.
      </p>
    );

  const findBreadcrumb = () => {
    if (!structuredContent || !structuredContent.sections) return null;
    try {
      for (const section of structuredContent.sections) {
        if (
          section.paragraphs?.some(
            (p) => p.includes(content) || content.includes(p),
          )
        ) {
          return { number: section.number, heading: section.heading };
        }
        for (const sub of section.subsections || []) {
          if (
            sub.paragraphs?.some(
              (p) => p.includes(content) || content.includes(p),
            )
          ) {
            return {
              number:
                sub.number || `${section.number}.${sub.heading ? "" : "?"}`,
              heading: sub.heading,
            };
          }
        }
      }
    } catch (e) {
      console.error("Error in findBreadcrumb:", e);
    }
    return null;
  };

  const breadcrumb = findBreadcrumb();
  const headingLine =
    evidence?.headingLine?.trim() || breadcrumb?.heading || null;

  return (
    <div className="space-y-4 relative group">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {headingLine ? (
          <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-xl border border-primary/20 w-fit shadow-sm">
            <Hash className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-tighter text-primary">
              {breadcrumb?.number ? `${breadcrumb.number} - ` : ""}
              {headingLine}
            </span>
          </div>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-2">
          {evidence.similarity > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/5 rounded-full border border-primary/10">
              <Sparkles className="size-3 text-primary" />
              <span className="text-xs font-medium uppercase tracking-wider text-primary">
                {Math.round(evidence.similarity * 100)}% Similarity
              </span>
            </div>
          )}
          {onLookup && (
            <button
              onClick={() => onLookup(content)}
              className="p-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 flex items-center gap-2 text-xs font-medium uppercase tracking-wider transition-all"
              title="Lookup in Document Map"
            >
              <Target className="size-3" /> Map to Document
            </button>
          )}
        </div>
      </div>

      <div className="bg-surface-container rounded-2xl p-6 border border-outline-variant/30">
        <SimpleMarkdown content={content} />
      </div>
    </div>
  );
}

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
  const [isPanel1Open, setIsPanel1Open] = useState(true);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  /** When false, hide unidentified / not-matched rows (compact corporate view). Default: show all. */
  const [showUnidentifiedClauses, setShowUnidentifiedClauses] = useState(true);

  // "Save detected clause to my library" dialog — opened from the bookmark
  // button next to the Extracted-from-Contract panel header.
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

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
  // If progress > 0, the user or a previous run has already touched this contract; let them decide
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
                    : "bg-primary/10 text-primary border-primary/20 animate-pulse",
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
                <span className="text-primary">
                  {progress || 0}%
                  {backendProgress > 0 ? ` (Stage: ${backendProgress}%)` : null}
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
                className="w-full space-y-8"
              >
                {/* Summary Widget */}
                {contract.analysis?.summary && (
                  <div className="w-full bg-background border border-outline-variant/50 rounded-xl p-8 lg:p-10 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.06] pointer-events-none">
                      <BookOpen className="size-32 rotate-12 text-primary" />
                    </div>
                    <div className="relative z-10 space-y-6">
                      <div className="flex items-center gap-4">
                        <div className="size-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                          <FileText className="size-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
                            Intelligence Summary
                          </h3>
                          <p className="text-xl font-semibold text-on-surface uppercase tracking-tight">
                            Executive Document Brief
                          </p>
                        </div>
                      </div>
                      <p className="text-on-surface text-base md:text-lg font-normal leading-relaxed whitespace-pre-wrap">
                        {contract.analysis.summary}
                      </p>
                      {contract.analysis.keyHighlights &&
                        contract.analysis.keyHighlights.length > 0 && (
                          <div className="flex flex-wrap gap-3 pt-4">
                            {contract.analysis.keyHighlights.map(
                              (highlight: string, i: number) => (
                                <div
                                  key={i}
                                  className="flex items-center gap-2 px-4 py-2 bg-surface-container-low border border-outline-variant/30 rounded-full text-xs font-medium uppercase tracking-wider text-on-surface"
                                >
                                  <Sparkles className="size-3 text-primary" />{" "}
                                  {highlight}
                                </div>
                              ),
                            )}
                          </div>
                        )}
                    </div>
                  </div>
                )}

                {/* Intelligence Metadata */}
                {contract.analysis?.metadata &&
                  Object.keys(contract.analysis.metadata).length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {Object.entries(contract.analysis.metadata).map(
                        ([key, value]) => (
                          <div
                            key={key}
                            className="bg-background border border-outline-variant/50 p-4 rounded-2xl shadow-sm space-y-2 group hover:border-primary/50 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <div className="size-6 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                                <Info className="size-3.5" />
                              </div>
                              <span className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant/70">
                                {key}
                              </span>
                            </div>
                            <p className="text-xs font-bold text-on-surface truncate">
                              {value as string}
                            </p>
                          </div>
                        ),
                      )}
                    </div>
                  )}

                {/* 3-Panel Architecture — stacks on mobile, side-by-side on xl */}
                <div className="w-full flex flex-col xl:flex-row gap-4 md:gap-6 relative min-h-0">
                  {/* PANEL 1: Intelligence Brief (Collapsible) */}
                  <AnimatePresence mode="wait">
                    {isPanel1Open && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="w-full xl:w-[260px] xl:shrink-0 max-h-[240px] xl:max-h-[min(70vh,640px)] bg-surface-container-low border border-outline-variant/40 rounded-lg overflow-y-auto"
                      >
                        <div className="p-3 space-y-4">
                          {/* Show-all toggle */}
                          <div className="flex items-center justify-between gap-2 p-2.5 bg-primary/5 border border-primary/20 rounded-md">
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-primary">
                                Unmatched clauses
                              </p>
                              <p className="text-[11px] text-on-surface-variant">
                                Show in checklist
                              </p>
                            </div>
                            <Switch
                              checked={showUnidentifiedClauses}
                              onCheckedChange={setShowUnidentifiedClauses}
                              className="data-[state=checked]:bg-emerald-500 shrink-0"
                            />
                          </div>

                          {/* Risk Drivers */}
                          <div className="space-y-2">
                            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-red-500 flex items-center gap-1.5">
                              <Shield className="size-3" /> Risk drivers
                            </h3>
                            <div className="space-y-1.5">
                              {contract.analysis?.plus?.riskBreakdown
                                ?.categories ? (
                                Object.entries(
                                  contract.analysis.plus.riskBreakdown
                                    .categories,
                                ).map(([cat, risk]) => (
                                  <div
                                    key={cat}
                                    className="flex items-center justify-between gap-2 px-2 py-1.5 bg-background border border-outline-variant/30 rounded-md"
                                  >
                                    <span className="text-xs text-on-surface-variant truncate">
                                      {cat}
                                    </span>
                                    <Badge className="bg-red-500/15 text-red-500 border border-red-500/30 rounded text-[10px] font-medium px-1.5 py-0">
                                      {risk as string}
                                    </Badge>
                                  </div>
                                ))
                              ) : (
                                <p className="text-xs italic text-on-surface-variant/60">
                                  No critical risks identified.
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Timeline Snippet */}
                          {contract.analysis?.plus?.timeline && (
                            <div className="space-y-2">
                              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-secondary flex items-center gap-1.5">
                                <Calendar className="size-3" /> Key milestones
                              </h3>
                              <div className="space-y-2">
                                {contract.analysis.plus.timeline
                                  .slice(0, 3)
                                  .map((item: any, idx: number) => (
                                    <div key={idx} className="flex gap-2">
                                      <div className="size-1.5 rounded-full bg-secondary mt-1.5 shrink-0" />
                                      <div className="min-w-0">
                                        <p className="text-[10px] font-medium uppercase tracking-wider text-secondary">
                                          {item.date}
                                        </p>
                                        <p className="text-xs text-on-surface leading-snug">
                                          {item.event}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* PANEL 2: Clause Navigation */}
                  <motion.div
                    layout
                    transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                    className={cn(
                      "flex-1 min-w-0 overflow-y-auto transition-all duration-500",
                      selectedResultId
                        ? "xl:flex-[0.4] xl:max-w-[42%]"
                        : "xl:flex-1",
                    )}
                  >
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="text-sm font-semibold text-on-surface flex items-center gap-2">
                          <ShieldCheck className="size-4 text-emerald-500 shrink-0" />
                          Foundational checklist
                          {checklistEvents.length > 0 && (
                            <span className="text-xs font-normal text-on-surface-variant">
                              ·{" "}
                              {checklistEvents.length}
                              {expectedChecklistHeadings != null
                                ? ` / ${expectedChecklistHeadings} headings`
                                : " provisions"}
                            </span>
                          )}
                        </h2>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setIsPanel1Open(!isPanel1Open)}
                        >
                          {isPanel1Open ? "Hide brief" : "Show brief"}
                        </Button>
                      </div>
                      <AnalysisChecklist
                        contractId={contractId}
                        events={filteredEvents}
                        isProcessing={isProcessing}
                        mode="list"
                        selectedId={selectedResultId}
                        onSelect={setSelectedResultId}
                        onSearch={(text) => {
                          setHighlightText(text);
                          setActiveTab("document-map");
                        }}
                      />
                    </div>
                  </motion.div>

                  {/* PANEL 3: Analysis Detail (Conditional) */}
                  <AnimatePresence mode="wait">
                    {selectedResultId && selectedEvent && (
                      <motion.div
                        initial={{ x: 300, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: 300, opacity: 0 }}
                        transition={{
                          type: "spring",
                          damping: 25,
                          stiffness: 200,
                        }}
                        className="w-full xl:flex-1 xl:min-w-0 min-h-[320px] max-h-[min(85vh,720px)] xl:max-h-[min(70vh,640px)] bg-surface-container border border-primary/20 rounded-lg overflow-hidden flex flex-col shadow-sm z-20"
                      >
                        <div className="bg-primary/5 px-4 py-3 border-b border-outline-variant/50 flex items-center justify-between gap-3 shrink-0">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="size-8 rounded-md bg-primary flex items-center justify-center text-white shrink-0">
                              <Sparkles className="size-4" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-sm font-semibold text-on-surface leading-tight truncate">
                                {selectedEvent.metadata?.clauseName ||
                                  "Analysis detail"}
                              </h3>
                              <div className="flex items-center gap-2 mt-0.5">
                                <Badge
                                  className={cn(
                                    "text-[10px] font-medium px-1.5 py-0 rounded border-none",
                                    selectedEvent.status === "Matched" ||
                                      selectedEvent.status === "Green"
                                      ? "bg-emerald-500/15 text-emerald-500"
                                      : selectedEvent.status === "Variation" ||
                                          selectedEvent.status === "Amber" ||
                                          selectedEvent.status === "Custom"
                                        ? "bg-amber-500/15 text-amber-500"
                                        : "bg-red-500/15 text-red-500",
                                  )}
                                >
                                  {selectedEvent.status === "Variation" ||
                                  selectedEvent.status === "Amber" ||
                                  selectedEvent.status === "Custom"
                                    ? "Custom"
                                    : selectedEvent.status}
                                </Badge>
                                <span className="text-[11px] text-on-surface-variant/60 truncate">
                                  {selectedEvent.metadata?.category ||
                                    "General provision"}
                                </span>
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 rounded-md hover:bg-primary/10 transition-colors shrink-0"
                            onClick={() => setSelectedResultId(null)}
                          >
                            <XCircle className="size-4 text-on-surface-variant hover:text-destructive" />
                          </Button>
                        </div>

                        <div className="p-4 md:p-5 space-y-5 overflow-y-auto no-scrollbar flex-1 bg-background/50">
                          {/* Side-by-side comparison: contract vs library
                              with inline word-level diff. The Save-to-library
                              action sits in this section's toolbar since it
                              operates on the contract side. */}
                          <div className="space-y-3">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 rounded-lg font-semibold uppercase text-[9px] tracking-widest text-on-surface-variant hover:text-primary"
                                disabled={!selectedEvent.metadata?.documentText}
                                onClick={() => setSaveDialogOpen(true)}
                                title="Save this clause to your library so you can reuse it later"
                              >
                                <BookmarkPlus className="size-3.5 mr-1" />
                                Save to library
                              </Button>
                            </div>
                            <ClauseDiffView
                              contractText={
                                selectedEvent.metadata?.documentText
                              }
                              libraryText={
                                selectedEvent.metadata?.libraryStandard
                              }
                            />
                          </div>

                          {/* AI verdict */}
                          <div className="bg-primary/5 p-4 rounded-lg border border-primary/20 space-y-3">
                            <div className="flex items-center gap-2">
                              <Zap className="size-3.5 text-primary" />
                              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                                AI verdict
                              </h4>
                            </div>
                            <p className="text-sm text-on-surface leading-relaxed italic pl-3 border-l-2 border-primary/30">
                              &ldquo;
                              {selectedEvent.metadata?.cognitiveReasoning ||
                                selectedEvent.metadata?.reasoning ||
                                "Verification complete. The provision aligns with standard operating procedures."}
                              &rdquo;
                            </p>

                            {selectedEvent.metadata?.confidence !==
                              undefined && (
                              <div className="space-y-1.5">
                                <div className="flex justify-between items-center text-xs">
                                  <span className="text-on-surface-variant">
                                    Match confidence
                                  </span>
                                  <span className="font-semibold text-primary">
                                    {Math.round(
                                      selectedEvent.metadata.confidence * 100,
                                    )}
                                    %
                                  </span>
                                </div>
                                <Progress
                                  value={
                                    selectedEvent.metadata.confidence * 100
                                  }
                                  className="h-1.5 bg-primary/10 rounded-full"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
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
                {!hasRuleResults ? (
                  <div className="bg-surface-container-low border border-outline-variant rounded-2xl md:rounded-xl p-10 md:p-20 text-center flex flex-col items-center">
                    <div className="size-20 md:size-24 bg-primary/10 rounded-full flex items-center justify-center mb-6 md:mb-8">
                      <Zap className="size-10 md:size-12 text-primary" />
                    </div>
                    <h2 className="text-2xl md:text-lg font-semibold text-on-surface mb-4">
                      {showFastResults
                        ? "Rules evaluation ready"
                        : "Neural evaluation pending"}
                    </h2>
                    <p className="text-on-surface-variant text-base md:text-lg font-medium max-w-md mb-8 md:mb-10">
                      {showFastResults
                        ? "Fast analysis is complete. Run rule evaluation to identify conflicts against your rule library."
                        : "Run analysis to extract the document map, checklist, and rule evaluation."}
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      {!showFastResults && (
                        <Button
                          onClick={() => runAnalysis(true)}
                          disabled={analysisLoading || isProcessing}
                          className="rounded-md flex items-center gap-3"
                        >
                          {analysisLoading || isProcessing ? (
                            <Loader2 className="size-5 animate-spin" />
                          ) : (
                            <Zap className="size-5" />
                          )}
                          {isProcessing
                            ? "Processing..."
                            : "Start full analysis"}
                        </Button>
                      )}
                      {showFastResults && (
                        <Button
                          onClick={() => runRulesEvaluation()}
                          disabled={analysisLoading || isProcessing}
                          className="rounded-md flex items-center gap-3"
                        >
                          {isProcessing ? (
                            <Loader2 className="size-5 animate-spin" />
                          ) : (
                            <Zap className="size-5" />
                          )}
                          {isProcessing
                            ? "Evaluating rules..."
                            : "Run rules evaluation"}
                        </Button>
                      )}
                      {showFastResults && (
                        <Button
                          variant="outline"
                          onClick={() => runAnalysis(true, "full")}
                          disabled={isProcessing}
                          className="rounded-md"
                        >
                          Re-run full pipeline
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-12">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-on-surface uppercase tracking-tight flex items-center gap-3">
                        <Activity className="size-7 text-primary" />
                        Conflict Identification
                      </h2>
                      <div className="flex items-center gap-6">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => runRulesEvaluation()}
                          disabled={isProcessing}
                          className="text-xs font-medium uppercase tracking-wider text-primary hover:bg-primary/5 flex items-center gap-2"
                        >
                          <Sparkles className="size-3" /> Re-evaluate rules
                        </Button>
                        <div className="flex gap-4">
                          <div className="flex items-center gap-2">
                            <div className="size-2 bg-red-500 rounded-full" />
                            <span className="text-[10px] font-semibold uppercase text-on-surface-variant">
                              {redCount} Red
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="size-2 bg-amber-500 rounded-full" />
                            <span className="text-[10px] font-semibold uppercase text-on-surface-variant">
                              {amberCount} Amber
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {contract.analysisResults
                        ?.filter((result) => {
                          // Hide rules that explicitly say nothing was found
                          const reasoning =
                            result.reasoning?.toLowerCase() || "";
                          const noTerms = reasoning.includes(
                            "no relevant terms found",
                          );
                          const noEvidence =
                            !result.evidence || result.evidence.length === 0;
                          // If it's red with no evidence and "no relevant terms", hide it
                          if (result.status === "Red" && noTerms && noEvidence)
                            return false;
                          return true;
                        })
                        .map((result) => (
                          <div
                            key={result.id}
                            className="bg-surface-container-low border border-outline-variant/50 rounded-lg overflow-hidden hover:border-primary/40 transition-all"
                          >
                            <Accordion {...({ type: "single" } as any)}>
                              <AccordionItem
                                value={result.id}
                                className="border-0"
                              >
                                <AccordionTrigger className="px-8 py-7 hover:no-underline">
                                  <div className="flex items-center gap-6 text-left">
                                    <div
                                      className={cn(
                                        "size-12 rounded-2xl flex items-center justify-center shrink-0",
                                        result.status === "Red"
                                          ? "bg-red-500/10 text-red-500"
                                          : result.status === "Amber"
                                            ? "bg-amber-500/10 text-amber-500"
                                            : "bg-emerald-500/10 text-emerald-500",
                                      )}
                                    >
                                      {result.status === "Red" ? (
                                        <AlertTriangle />
                                      ) : (
                                        <CheckCircle2 />
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-3 mb-1">
                                        <span className="text-sm font-medium text-on-surface">
                                          {result.rule.name}
                                        </span>
                                        <Badge
                                          className={cn(
                                            "rounded-lg uppercase text-[8px] font-semibold border-none",
                                            result.status === "Red"
                                              ? "bg-red-500"
                                              : result.status === "Amber"
                                                ? "bg-amber-500"
                                                : "bg-emerald-500",
                                          )}
                                        >
                                          {result.status}
                                        </Badge>
                                      </div>
                                      <p className="text-on-surface-variant text-sm font-medium line-clamp-1">
                                        {result.reasoning}
                                      </p>
                                    </div>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-8 pb-10 pt-4 border-t border-outline-variant/30">
                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                    <div className="space-y-6">
                                      <div className="text-left">
                                        <h4 className="text-xs font-medium uppercase tracking-wider text-primary mb-3">
                                          Assessment Reasoning
                                        </h4>
                                        <SimpleMarkdown
                                          content={result.reasoning}
                                        />
                                      </div>
                                      <CommentBox
                                        initialValue={result.comments || ""}
                                        onSave={(v) =>
                                          handleSaveComment(result.id, v)
                                        }
                                      />
                                    </div>
                                    <div className="space-y-6 text-left">
                                      <h4 className="text-xs font-medium uppercase tracking-wider text-on-surface-variant mb-3">
                                        Evidence Source
                                      </h4>
                                      <div className="space-y-4">
                                        {result.evidence?.map((e, idx) => (
                                          <div
                                            key={idx}
                                            className="bg-background p-6 rounded-3xl border border-outline-variant/50"
                                          >
                                            <FormattedEvidence
                                              evidence={e}
                                              structuredContent={
                                                contract.structuredContent
                                              }
                                              onLookup={(text) => {
                                                setHighlightText(text);
                                                setActiveTab("document-map");
                                              }}
                                            />
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            </Accordion>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
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
                {!isPlus ? (
                  <div className="bg-primary/5 border-2 border-dashed border-primary/20 rounded-xl p-24 text-center">
                    <div className="size-20 bg-primary rounded-lg flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-primary/20">
                      <Lock className="size-10 text-white" />
                    </div>
                    <h2 className="text-lg font-semibold text-on-surface mb-4">
                      Plus Layer Locked
                    </h2>
                    <p className="text-on-surface-variant text-lg font-medium max-w-sm mx-auto mb-12">
                      Upgrade to Intelligence PLUS to unlock semantic matching,
                      variance mapping, and legal intelligence.
                    </p>
                    <Link href="/upgrade">
                      <Button size="lg" className="bg-primary text-primary-foreground">
                        Upgrade plan
                      </Button>
                    </Link>
                  </div>
                ) : !hasAnalysis && !isProcessing ? (
                  <div className="bg-surface-container-low border border-outline-variant rounded-xl p-20 text-center flex flex-col items-center animate-in fade-in zoom-in duration-500">
                    <div className="size-24 bg-secondary/10 rounded-full flex items-center justify-center mb-8 text-secondary">
                      <BrainCircuit className="size-12" />
                    </div>
                    <h2 className="text-lg font-semibold text-on-surface mb-4">
                      Deep Semantic Analysis Pending
                    </h2>
                    <p className="text-on-surface-variant text-lg font-medium max-w-md mb-10 text-center leading-relaxed">
                      The foundational scan is complete. Run the full neural
                      evaluation to unlock Plus Insights, including clause
                      variance mapping and semantic risk assessments.
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
                      {isProcessing
                        ? "Processing Deep Rules..."
                        : "Run Full Analysis"}
                    </Button>
                  </div>
                ) : (
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
                          Synthesizing Neural Insights...
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
                              {
                                contract.analysis.plus.clauseCoverage
                                  ?.coverageScore
                              }
                              %
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
                              contract.analysis.plus.riskBreakdown
                                ?.categories || {},
                            ).length > 0 ? (
                              Object.entries(
                                contract.analysis.plus.riskBreakdown
                                  ?.categories || {},
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
                            ) : contract.analysis.plus.riskBreakdown?.topDrivers
                                ?.length > 0 ? (
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
                                    contract.analysis.plus.timeline.length -
                                      1 && (
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
                                    {result.granularGuidance
                                      ?.standardWordingMatch || "Aligned"}
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
                                    result.granularGuidance?.conditionMatrix ||
                                      {},
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
                                            contract.structuredContent
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
                                      {result.granularGuidance
                                        ?.standardWordingText ||
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
                )}
              </motion.div>
            )}

            {activeTab === "document-map" && (
              <motion.div
                key="document-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <div className="space-y-6">
                  <div className="flex items-center justify-between ml-2">
                    <h3 className="text-lg font-semibold text-on-surface uppercase tracking-tight flex items-center gap-3">
                      <FileText className="size-7 text-primary" />
                      Document Map
                    </h3>
                    <div className="flex items-center gap-2">
                      <div className="size-2 bg-emerald-500 rounded-full animate-pulse" />
                      <span className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                        Verified Mapping
                      </span>
                    </div>
                  </div>
                  <DocumentStructure
                    data={
                      contract.structuredContent ||
                      contract.analysis?.structuredContent ||
                      null
                    }
                    contractId={contractId}
                    highlightText={highlightText}
                    onParagraphClick={(text) => setHighlightText(text)}
                  />
                </div>
              </motion.div>
            )}

            {activeTab === "document-view" && (
              <motion.div
                key="document-view-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <PdfViewer
                  fileUrl={contract.fileURL || ""}
                  contractId={contractId}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Save-to-library prompt for the currently selected detected clause. */}
      {selectedEvent ? (
        <SaveClauseToLibraryDialog
          open={saveDialogOpen}
          onOpenChange={setSaveDialogOpen}
          contractId={contractId}
          defaultClauseName={
            selectedEvent.metadata?.clauseName?.trim() || "Untitled clause"
          }
          defaultClauseText={selectedEvent.metadata?.documentText || ""}
          defaultCategory={selectedEvent.metadata?.category}
        />
      ) : null}
    </main>
  );
}
