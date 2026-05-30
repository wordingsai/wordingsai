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
      <div className="flex flex-wrap items-center gap-2">
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
                    "w-full text-left px-3 py-2 rounded-md border transition-colors min-w-0",
                    isActive
                      ? "ring-1 ring-primary border-transparent bg-surface-container"
                      : "bg-surface-container-low border-outline-variant/40 hover:border-primary/40",
                  )}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div
                      className={cn(
                        "size-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 border",
                        isGreen
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : isAmber
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : "bg-red-500/10 text-red-400 border-red-500/20",
                      )}
                    >
                      {isGreen ? (
                        <CheckCircle2 className="size-3" />
                      ) : isAmber ? (
                        <Scale className="size-3" />
                      ) : (
                        <XCircle className="size-3" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                        <h4 className="font-medium text-sm text-on-surface truncate max-w-full">
                          {clauseName}
                        </h4>
                        {/* Library reference/code — the identifying code of the
                            matched library clause (e.g. LSW307A). This is the
                            client's core requirement: every match shows which
                            library clause was detected. */}
                        {event.metadata.clauseCode && (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-mono px-1.5 py-0 border rounded shrink-0 bg-primary/10 text-primary border-primary/30"
                            title={
                              event.metadata.matchType === "code"
                                ? "Matched by library code (incorporated by reference)"
                                : "Closest library clause by similarity"
                            }
                          >
                            {event.metadata.clauseCode}
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-medium px-1.5 py-0 border rounded shrink-0",
                            isGreen
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : isAmber
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                : "bg-red-500/10 text-red-400 border-red-500/20",
                          )}
                        >
                          {isGreen
                            ? "Matched"
                            : status === "Variation" || status === "Amber"
                              ? "Variation"
                              : isAmber
                                ? "Custom"
                                : "Missing"}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-on-surface-variant/70 truncate mt-0.5">
                        {event.metadata.category || "General"}
                      </p>
                      {!isListMode && snippet && (
                        <p className="mt-1.5 text-xs text-on-surface-variant line-clamp-2 leading-snug">
                          {snippet}
                        </p>
                      )}
                      {isListMode && snippet && (
                        <p className="mt-1 text-[11px] text-on-surface-variant/80 line-clamp-1">
                          {snippet.slice(0, 120)}
                          {snippet.length > 120 ? "…" : ""}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-0 shrink-0">
                      <span
                        className={cn(
                          "text-[11px] font-semibold tabular-nums",
                          isGreen
                            ? "text-emerald-400"
                            : isAmber
                              ? "text-amber-400"
                              : "text-red-400",
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
                      className="mt-3 pt-3 border-t border-outline-variant/30 grid grid-cols-1 gap-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-1.5 text-on-surface-variant">
                          <FileText className="size-3 shrink-0" />
                          <span className="text-[10px] font-medium uppercase tracking-wider">
                            Contract provision
                          </span>
                        </div>
                        <div className="p-3 bg-surface-container-low rounded-md border border-outline-variant/40 min-w-0">
                          <TruncatedText
                            text={event.metadata.documentText}
                            maxLines={6}
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-1.5 text-primary flex-wrap">
                          <BookOpen className="size-3 shrink-0" />
                          <span className="text-[10px] font-medium uppercase tracking-wider">
                            Library standard
                          </span>
                          {event.metadata.clauseCode && (
                            <span className="text-[10px] font-mono text-primary/80">
                              · {event.metadata.clauseCode}
                            </span>
                          )}
                          {event.metadata.matchType && (
                            <span className="text-[9px] uppercase tracking-wider text-on-surface-variant/60">
                              {event.metadata.matchType === "code"
                                ? "· by code"
                                : "· by similarity"}
                            </span>
                          )}
                        </div>
                        <div className="p-3 bg-primary/5 rounded-md border border-primary/20 min-w-0">
                          <TruncatedText
                            text={event.metadata.libraryStandard}
                            maxLines={6}
                            emptyLabel="No baseline standard for this provision."
                            className="italic"
                          />
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
  const dot = {
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
  }[tone];
  const activeStyle = {
    emerald: "border-emerald-500/40 bg-emerald-500/5 text-on-surface",
    amber: "border-amber-500/40 bg-amber-500/5 text-on-surface",
    red: "border-red-500/40 bg-red-500/5 text-on-surface",
  }[tone];

  // Compact filter pill: status dot + label + count. Reads as a clean
  // filter bar rather than three oversized stat boxes.
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-2 h-8 pl-2.5 pr-3 rounded-md border text-sm transition-colors",
        active
          ? activeStyle
          : "border-outline-variant/40 bg-surface-container-low text-on-surface-variant/60 hover:text-on-surface-variant hover:border-outline-variant",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full shrink-0",
          dot,
          !active && "opacity-40",
        )}
      />
      <span className="font-medium">{label}</span>
      <span
        className={cn(
          "tabular-nums font-semibold",
          active ? "" : "opacity-70",
        )}
      >
        {count}
      </span>
    </button>
  );
}
