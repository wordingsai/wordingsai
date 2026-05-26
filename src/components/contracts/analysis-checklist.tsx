"use client";

import { useState, useCallback, useMemo } from "react";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  FileText,
  BookOpen,
  Scale,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AnalysisEvent } from "@/types/analysis";
import React from "react";
import { TruncatedText } from "@/components/ui/truncated-text";

export function AnalysisChecklist({
  contractId: _contractId,
  events = [],
  isProcessing = false,
  mode = "full",
  selectedId: externalSelectedId,
  onSelect,
}: {
  contractId: string;
  events?: AnalysisEvent[];
  isProcessing?: boolean;
  onSearch?: (text: string) => void;
  mode?: "fast" | "full" | "list";
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
}) {
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(
    null,
  );
  const selectedId =
    externalSelectedId !== undefined ? externalSelectedId : internalSelectedId;
  const setSelectedId = onSelect || setInternalSelectedId;

  const [activeFilters, setActiveFilters] = useState<Set<string>>(
    new Set(["matched", "variation", "missing"]),
  );

  const isListMode = mode === "list";

  const toggleFilter = (filter: string) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(filter)) {
        if (next.size > 1) next.delete(filter);
      } else {
        next.add(filter);
      }
      return next;
    });
  };

  const matchedEvents = events.filter(
    (e) => e.status === "Matched" || e.status === "Green",
  );
  const variationEvents = events.filter(
    (e) =>
      e.status === "Amber" || e.status === "Custom" || e.status === "Variation",
  );
  const missingEvents = events.filter(
    (e) =>
      e.status === "Red" ||
      e.status === "Missing" ||
      e.status === "Not Found" ||
      e.status === "Not Matched",
  );

  const matchedCount = matchedEvents.length;
  const variationCount = variationEvents.length;
  const missingCount = missingEvents.length;

  const filteredEvents = events.filter((e) => {
    const isMatched = e.status === "Matched" || e.status === "Green";
    const isVariation =
      e.status === "Amber" || e.status === "Custom" || e.status === "Variation";
    const isMissing =
      e.status === "Red" ||
      e.status === "Missing" ||
      e.status === "Not Found" ||
      e.status === "Not Matched";

    if (activeFilters.has("matched") && isMatched) return true;
    if (activeFilters.has("variation") && isVariation) return true;
    if (activeFilters.has("missing") && isMissing) return true;
    return false;
  });

  const groupedEvents = useMemo(() => {
    const groups: Record<string, AnalysisEvent[]> = {};
    filteredEvents.forEach((e) => {
      const heading = e.metadata.clauseName || "General Provision";
      if (!groups[heading]) groups[heading] = [];
      groups[heading].push(e);
    });
    return groups;
  }, [filteredEvents]);

  if (events.length === 0 && isProcessing) {
    return (
      <div className="flex flex-col items-center justify-center p-12 md:p-20 bg-surface-container-low border border-dashed border-outline-variant/30 rounded-2xl">
        <Loader2 className="size-10 text-primary animate-spin mb-4" />
        <p className="text-xs font-medium uppercase tracking-wider text-on-surface-variant text-center max-w-sm">
          Scanning document layers and matching provisions against your clause
          library...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in duration-500 w-full min-w-0">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <FilterStat
          label="Matched"
          count={matchedCount}
          active={activeFilters.has("matched")}
          onClick={() => toggleFilter("matched")}
          tone="emerald"
        />
        <FilterStat
          label="Custom"
          count={variationCount}
          active={activeFilters.has("variation")}
          onClick={() => toggleFilter("variation")}
          tone="amber"
        />
        <FilterStat
          label="Unidentified"
          count={missingCount}
          active={activeFilters.has("missing")}
          onClick={() => toggleFilter("missing")}
          tone="red"
        />
      </div>

      <div
        className={cn(
          "flex flex-col gap-2 sm:gap-3 w-full min-w-0",
          !isListMode && "md:grid md:grid-cols-2 md:gap-4",
        )}
      >
        {Object.entries(groupedEvents).map(([heading, group]) => (
          <React.Fragment key={heading}>
            {group.map((event) => {
              const status = event.status;
              const clauseName = event.metadata?.clauseName || "Unknown Clause";
              const isActive = selectedId === event.id;

              const isGreen = status === "Green" || status === "Matched";
              const isAmber =
                status === "Amber" ||
                status === "Custom" ||
                status === "Variation";

              const matchPercentage = isGreen
                ? 100
                : event.metadata.confidence
                  ? Math.round(event.metadata.confidence * 100)
                  : isAmber
                    ? 85
                    : 0;

              const snippet = (event.metadata.documentText || "").trim();

              return (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => setSelectedId(isActive ? null : event.id)}
                  className={cn(
                    "w-full text-left p-3 sm:p-4 rounded-xl sm:rounded-2xl border transition-all duration-200 min-w-0",
                    isActive
                      ? "ring-2 ring-primary border-transparent shadow-lg bg-surface-container"
                      : "bg-surface-container-low border-outline-variant/50 hover:border-primary/40",
                    isGreen
                      ? "hover:bg-emerald-50/30 dark:hover:bg-emerald-950/10"
                      : isAmber
                        ? "hover:bg-amber-50/30 dark:hover:bg-amber-950/10"
                        : "hover:bg-red-50/30 dark:hover:bg-red-950/10",
                  )}
                >
                  <div className="flex items-start gap-2 sm:gap-3 min-w-0">
                    <div
                      className={cn(
                        "size-8 sm:size-9 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0",
                        isGreen
                          ? "bg-emerald-500/10 text-emerald-500"
                          : isAmber
                            ? "bg-amber-500/10 text-amber-500"
                            : "bg-red-500/10 text-red-500",
                      )}
                    >
                      {isGreen ? (
                        <CheckCircle2 className="size-4 sm:size-5" />
                      ) : isAmber ? (
                        <Scale className="size-4 sm:size-5" />
                      ) : (
                        <XCircle className="size-4 sm:size-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <h4 className="font-black text-xs sm:text-sm uppercase tracking-tight text-on-surface truncate max-w-full">
                          {clauseName}
                        </h4>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[8px] sm:text-[9px] uppercase font-black tracking-widest px-1.5 py-0 border-none shrink-0",
                            isGreen
                              ? "bg-emerald-500 text-white"
                              : isAmber
                                ? "bg-amber-500 text-white"
                                : "bg-red-500 text-white",
                          )}
                        >
                          {isGreen
                            ? "Matched"
                            : isAmber
                              ? "Custom"
                              : "Not Matched"}
                        </Badge>
                      </div>
                      <p className="text-[9px] font-bold text-on-surface-variant/60 uppercase tracking-widest mt-0.5 truncate">
                        {event.metadata.category || "General Provision"}
                      </p>
                      {!isListMode && snippet && (
                        <p className="mt-2 text-[11px] text-on-surface-variant line-clamp-2 leading-relaxed">
                          {snippet}
                        </p>
                      )}
                      {isListMode && snippet && (
                        <p className="mt-1.5 text-[10px] text-on-surface-variant/80 line-clamp-1">
                          {snippet.slice(0, 120)}
                          {snippet.length > 120 ? "…" : ""}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      <span
                        className={cn(
                          "text-[9px] sm:text-[10px] font-black",
                          isGreen
                            ? "text-emerald-500"
                            : isAmber
                              ? "text-amber-500"
                              : "text-red-500",
                        )}
                      >
                        {matchPercentage}%
                      </span>
                      {isListMode && (
                        <ChevronRight
                          className={cn(
                            "size-4 text-on-surface-variant/40",
                            isActive && "text-primary",
                          )}
                        />
                      )}
                    </div>
                  </div>

                  {!isListMode && isActive && (
                    <div
                      className="mt-4 pt-4 border-t border-outline-variant/30 space-y-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2 min-w-0">
                          <div className="flex items-center gap-2 text-primary">
                            <FileText className="size-3 shrink-0" />
                            <span className="text-[10px] font-medium uppercase tracking-wider">
                              Contract provision
                            </span>
                          </div>
                          <div className="p-3 sm:p-4 bg-surface-container-low rounded-xl border border-outline-variant/20 min-w-0">
                            <TruncatedText
                              text={event.metadata.documentText}
                              maxLines={6}
                            />
                          </div>
                        </div>
                        <div className="space-y-2 min-w-0">
                          <div className="flex items-center gap-2 text-emerald-600">
                            <BookOpen className="size-3 shrink-0" />
                            <span className="text-[10px] font-medium uppercase tracking-wider">
                              Library standard
                            </span>
                          </div>
                          <div className="p-3 sm:p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/20 min-w-0">
                            <TruncatedText
                              text={event.metadata.libraryStandard}
                              maxLines={6}
                              emptyLabel="No baseline standard for this provision."
                              className="italic"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      {filteredEvents.length === 0 && events.length > 0 && (
        <p className="text-center text-xs font-medium uppercase tracking-wider text-on-surface-variant/50 py-8">
          No items match the selected filters.
        </p>
      )}
    </div>
  );
}

function FilterStat({
  label,
  count,
  active,
  onClick,
  tone,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  tone: "emerald" | "amber" | "red";
}) {
  const styles = {
    emerald: {
      active: "bg-emerald-500/10 border-emerald-500/50",
      text: "text-emerald-600",
      sub: "text-emerald-500/40",
    },
    amber: {
      active: "bg-amber-500/10 border-amber-500/50",
      text: "text-amber-600",
      sub: "text-amber-500/40",
    },
    red: {
      active: "bg-red-500/10 border-red-500/50",
      text: "text-red-600",
      sub: "text-red-500/40",
    },
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "border p-2.5 sm:p-3 rounded-xl sm:rounded-2xl shadow-sm transition-all text-left min-w-0",
        active
          ? styles.active
          : "bg-surface-container-low border-outline-variant/50 opacity-60 hover:opacity-100",
      )}
    >
      <span
        className={cn(
          "text-[8px] sm:text-[10px] font-medium uppercase tracking-wider block mb-0.5 truncate",
          styles.text,
          "opacity-70",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "text-base sm:text-xl font-black tracking-tighter",
          styles.text,
        )}
      >
        {count}
      </span>
    </button>
  );
}
