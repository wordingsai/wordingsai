"use client";

/**
 * SummaryPanel — the "Summary" tab content.
 *
 * Renders:
 *  - Executive summary text + key highlights
 *  - Intelligence metadata grid
 *  - 3-panel checklist row (brief | clause list | clause detail)
 *
 * Extracted from the 2105-line page.tsx.
 */

import { useEffect } from "react";
import {
  FileText,
  Sparkles,
  ShieldCheck,
  Shield,
  Calendar,
  Zap,
  XCircle,
  BookmarkPlus,
  Info,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { AnalysisChecklist } from "@/components/contracts/analysis-checklist";
import { ClauseDiffView } from "@/components/contracts/clause-diff-view";
import { SaveClauseToLibraryDialog } from "@/components/contracts/save-clause-to-library-dialog";
import type { Contract, AnalysisEvent } from "@/types/analysis";
import type { StructuredContract } from "@/lib/structured-contract";
import { countDocumentMapHeadings } from "@/lib/structured-contract";

interface SummaryPanelProps {
  contract: Contract;
  contractId: string;
  checklistEvents: AnalysisEvent[];
  filteredEvents: AnalysisEvent[];
  isProcessing: boolean;
  isPanel1Open: boolean;
  setIsPanel1Open: (v: boolean) => void;
  showUnidentifiedClauses: boolean;
  setShowUnidentifiedClauses: (v: boolean) => void;
  selectedResultId: string | null;
  setSelectedResultId: (id: string | null) => void;
  selectedEvent: AnalysisEvent | undefined;
  saveDialogOpen: boolean;
  setSaveDialogOpen: (v: boolean) => void;
  setHighlightText: (text: string | null) => void;
  setActiveTab: (tab: string) => void;
  expectedChecklistHeadings: number | null;
}

export function SummaryPanel({
  contract,
  contractId,
  checklistEvents,
  filteredEvents,
  isProcessing,
  isPanel1Open,
  setIsPanel1Open,
  showUnidentifiedClauses,
  setShowUnidentifiedClauses,
  selectedResultId,
  setSelectedResultId,
  selectedEvent,
  saveDialogOpen,
  setSaveDialogOpen,
  setHighlightText,
  setActiveTab,
  expectedChecklistHeadings,
}: SummaryPanelProps) {
  // Auto-collapse brief when a clause is opened
  useEffect(() => {
    if (selectedResultId) setIsPanel1Open(false);
  }, [selectedResultId, setIsPanel1Open]);

  return (
    <div className="w-full space-y-8">
      {/* Executive summary */}
      {contract.analysis?.summary && (
        <div className="w-full bg-background border border-outline-variant/40 rounded-lg p-5 relative overflow-hidden">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              <h3 className="text-sm font-semibold text-on-surface">
                Executive summary
              </h3>
            </div>
            <p className="text-on-surface text-sm leading-relaxed whitespace-pre-wrap">
              {contract.analysis.summary}
            </p>
            {contract.analysis.keyHighlights &&
              contract.analysis.keyHighlights.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {contract.analysis.keyHighlights.map(
                    (highlight: string, i: number) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface-container-low border border-outline-variant/30 rounded-md text-xs text-on-surface"
                      >
                        <Sparkles className="size-3 text-primary" />
                        {highlight}
                      </span>
                    ),
                  )}
                </div>
              )}
          </div>
        </div>
      )}

      {/* Intelligence metadata grid */}
      {contract.analysis?.metadata &&
        Object.keys(contract.analysis.metadata).length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Object.entries(contract.analysis.metadata).map(([key, value]) => (
              <div
                key={key}
                className="bg-background border border-outline-variant/50 p-4 rounded-2xl shadow-sm space-y-2 group hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="size-6 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                    <Info className="size-3.5" />
                  </div>
                  <span className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant/70">
                    {key
                      .replace(/([A-Z])/g, " $1")
                      .replace(/^./, (ch) => ch.toUpperCase())
                      .trim()}
                  </span>
                </div>
                <p className="text-xs font-bold text-on-surface truncate" title={value as string}>
                  {value as string}
                </p>
              </div>
            ))}
          </div>
        )}

      {/* 3-Panel Architecture */}
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
                    {contract.analysis?.plus?.riskBreakdown?.categories ? (
                      Object.entries(
                        contract.analysis.plus.riskBreakdown.categories,
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

        {/* PANEL 2: Clause Navigation.
            Plain div on purpose: framer's `layout` here animates the resize by
            transform-scaling the whole text-heavy list, which visibly warps
            every clause card on open (the worse jank). We snap the width
            instantly and let Panel 3 slide in to carry the motion. */}
        <div
          className={cn(
            "flex-1 min-w-0 overflow-y-auto",
            selectedResultId
              ? "xl:flex-none xl:w-[320px] xl:max-w-[320px] xl:max-h-[min(70vh,640px)]"
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
        </div>

        {/* PANEL 3: Analysis Detail (Conditional).
            Slides in from the right with an easeOutQuint curve (fast in, gentle
            settle, no bounce) — the standard master→detail enter motion. No
            mode="wait": there's a single child, and waiting for the prior exit
            first is what made opening feel laggy. */}
        <AnimatePresence>
          {selectedResultId && selectedEvent && (
            <motion.div
              key="clause-detail"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="w-full xl:flex-1 xl:min-w-0 min-h-[320px] max-h-[min(85vh,720px)] xl:max-h-[min(70vh,640px)] bg-surface-container border border-primary/20 rounded-lg overflow-hidden flex flex-col shadow-sm z-20"
            >
              <ClauseDetailPanel
                selectedEvent={selectedEvent}
                onClose={() => setSelectedResultId(null)}
                onSaveToLibrary={() => setSaveDialogOpen(true)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Save-to-library dialog */}
      {selectedEvent && (
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
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ClauseDetailPanel — Panel 3 content (header + diff + AI verdict)
// ---------------------------------------------------------------------------
function ClauseDetailPanel({
  selectedEvent,
  onClose,
  onSaveToLibrary,
}: {
  selectedEvent: AnalysisEvent;
  onClose: () => void;
  onSaveToLibrary: () => void;
}) {
  const status = selectedEvent.status;
  const isGreen = status === "Green" || status === "Matched";
  const isAmber =
    status === "Amber" || status === "Custom" || status === "Variation";

  return (
    <>
      {/* Header */}
      <div className="bg-surface-container-high px-4 py-2.5 border-b border-outline-variant/50 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-7 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <Sparkles className="size-3.5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-on-surface leading-tight truncate">
              {selectedEvent.metadata?.clauseName || "Analysis detail"}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge
                className={cn(
                  "text-[10px] font-medium px-1.5 py-0 rounded border",
                  isGreen
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : isAmber
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      : "bg-red-500/10 text-red-400 border-red-500/20",
                )}
              >
                {status === "Variation" || status === "Amber"
                  ? "Variation"
                  : status === "Custom"
                    ? "Custom"
                    : status}
              </Badge>
              {selectedEvent.metadata?.clauseCode && (
                <Badge
                  variant="outline"
                  className="text-[10px] font-mono px-1.5 py-0 rounded border bg-primary/10 text-primary border-primary/30"
                  title={
                    selectedEvent.metadata?.matchType === "code"
                      ? "Matched by library code (incorporated by reference)"
                      : "Closest library clause by similarity"
                  }
                >
                  {selectedEvent.metadata.clauseCode}
                </Badge>
              )}
              <span className="text-[11px] text-on-surface-variant/60 truncate">
                {selectedEvent.metadata?.category || "General provision"}
              </span>
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 rounded-md hover:bg-primary/10 transition-colors shrink-0"
          onClick={onClose}
          aria-label="Close detail panel"
        >
          <XCircle className="size-4 text-on-surface-variant hover:text-destructive" />
        </Button>
      </div>

      {/* Body */}
      <div className="p-4 space-y-4 overflow-y-auto flex-1 bg-background/50">
        {/* Side-by-side diff */}
        <div className="space-y-3">
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 rounded-md font-medium uppercase text-[10px] tracking-wider text-on-surface-variant hover:text-primary"
              disabled={!selectedEvent.metadata?.documentText}
              onClick={onSaveToLibrary}
              title="Save this clause to your library so you can reuse it later"
            >
              <BookmarkPlus className="size-3.5 mr-1" />
              Save to library
            </Button>
          </div>
          <ClauseDiffView
            contractText={selectedEvent.metadata?.documentText}
            libraryText={selectedEvent.metadata?.libraryStandard}
            libraryLabel={
              selectedEvent.metadata?.clauseCode
                ? `Library standard · ${selectedEvent.metadata.clauseCode}`
                : undefined
            }
          />
        </div>

        {/* AI verdict */}
        <div className="bg-surface-container-low p-3 rounded-md border border-outline-variant/40 space-y-2.5">
          <div className="flex items-center gap-1.5">
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
          {selectedEvent.metadata?.confidence !== undefined && (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-on-surface-variant">
                  Match confidence
                </span>
                <span className="font-semibold text-primary">
                  {Math.round(selectedEvent.metadata.confidence * 100)}%
                </span>
              </div>
              <Progress
                value={selectedEvent.metadata.confidence * 100}
                className="h-1.5 bg-primary/10 rounded-full"
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
