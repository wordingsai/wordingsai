"use client";

/**
 * RulesEvaluationPanel — the "Rules Evaluation" tab content.
 * Extracted from the 2105-line page.tsx.
 */

import {
  Loader2,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Activity,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { CommentBox } from "./comment-box";
import { SimpleMarkdown, FormattedEvidence } from "./helpers";
import type { Contract } from "@/types/analysis";
import type { StructuredContract } from "@/lib/structured-contract";

interface RulesEvaluationPanelProps {
  contract: Contract;
  contractId: string;
  showFastResults: boolean;
  hasRuleResults: boolean;
  isProcessing: boolean;
  analysisLoading: boolean;
  redCount: number;
  amberCount: number;
  runAnalysis: (force?: boolean, mode?: "fast" | "full") => void;
  runRulesEvaluation: () => void;
  handleSaveComment: (ruleResultId: string, comment: string) => void;
  setHighlightText: (text: string | null) => void;
  setActiveTab: (tab: string) => void;
}

export function RulesEvaluationPanel({
  contract,
  contractId,
  showFastResults,
  hasRuleResults,
  isProcessing,
  analysisLoading,
  redCount,
  amberCount,
  runAnalysis,
  runRulesEvaluation,
  handleSaveComment,
  setHighlightText,
  setActiveTab,
}: RulesEvaluationPanelProps) {
  if (!hasRuleResults) {
    return (
      <div className="bg-surface-container-low border border-outline-variant rounded-2xl md:rounded-xl p-10 md:p-20 text-center flex flex-col items-center">
        <div className="size-20 md:size-24 bg-primary/10 rounded-full flex items-center justify-center mb-6 md:mb-8">
          <Zap className="size-10 md:size-12 text-primary" />
        </div>
        <h2 className="text-2xl md:text-lg font-semibold text-on-surface mb-4">
          {showFastResults
            ? "Rules evaluation ready"
            : "Rule evaluation pending"}
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
              {isProcessing ? "Processing..." : "Start full analysis"}
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
              {isProcessing ? "Evaluating rules..." : "Run rules evaluation"}
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
    );
  }

  return (
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
            const reasoning = result.reasoning?.toLowerCase() || "";
            const noTerms = reasoning.includes("no relevant terms found");
            const noEvidence =
              !result.evidence || result.evidence.length === 0;
            if (result.status === "Red" && noTerms && noEvidence) return false;
            return true;
          })
          .map((result) => (
            <div
              key={result.id}
              className="bg-surface-container-low border border-outline-variant/50 rounded-lg overflow-hidden hover:border-primary/40 transition-all"
            >
              <Accordion {...({ type: "single" } as any)}>
                <AccordionItem value={result.id} className="border-0">
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
                          <SimpleMarkdown content={result.reasoning} />
                        </div>
                        <CommentBox
                          initialValue={result.comments || ""}
                          onSave={(v) => handleSaveComment(result.id, v)}
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
                                  contract.structuredContent as StructuredContract | null
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
  );
}
