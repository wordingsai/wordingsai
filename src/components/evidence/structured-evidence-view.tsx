"use client";

import React, { useState, useMemo } from "react";
import type {
  StructuredEvidenceResult,
  StructuredEvidenceItem,
} from "@/types/evidence";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Zap,
  Link as LinkIcon,
  Unlink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface StructuredEvidenceViewProps {
  evidence: StructuredEvidenceResult | null;
  loading?: boolean;
  onManualMatch?: (
    evidenceId: string,
    libraryClauseId: string,
  ) => Promise<void>;
}

export function StructuredEvidenceView({
  evidence,
  loading = false,
  onManualMatch,
}: StructuredEvidenceViewProps) {
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({});
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>(
    {},
  );
  const [matchingState, setMatchingState] = useState<Record<string, boolean>>(
    {},
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin">
          <Zap className="w-6 h-6 text-primary" />
        </div>
        <span className="ml-3 text-sm font-medium">Loading evidence...</span>
      </div>
    );
  }

  if (!evidence) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <AlertCircle className="w-12 h-12 text-on-surface-variant/40 mb-4" />
        <p className="font-medium text-on-surface-variant">
          No evidence available
        </p>
        <p className="text-sm text-on-surface-variant/60 mt-1">
          Run a rule evaluation to generate evidence
        </p>
      </div>
    );
  }

  const toggleSection = (sectionName: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionName]: !prev[sectionName],
    }));
  };

  const toggleItem = (itemId: string) => {
    setExpandedItems((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const handleManualMatch = async (
    evidenceId: string,
    libraryClauseId: string,
  ) => {
    if (!onManualMatch) return;

    setMatchingState((prev) => ({ ...prev, [evidenceId]: true }));
    try {
      await onManualMatch(evidenceId, libraryClauseId);
    } finally {
      setMatchingState((prev) => ({ ...prev, [evidenceId]: false }));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Green":
        return "bg-emerald-500/10 border-emerald-500/30 text-emerald-400";
      case "Amber":
        return "bg-amber-500/10 border-amber-500/30 text-amber-400";
      case "Red":
        return "bg-red-500/10 border-red-500/30 text-red-400";
      default:
        return "bg-slate-500/10 border-slate-500/30 text-slate-300";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Green":
        return <CheckCircle2 className="w-4 h-4" />;
      case "Red":
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "text-emerald-400";
    if (confidence >= 0.6) return "text-amber-400";
    return "text-slate-400";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div
          className={cn(
            "flex items-center gap-3 p-4 rounded-lg border-l-4",
            getStatusColor(evidence.status),
          )}
        >
          {getStatusIcon(evidence.status)}
          <div className="flex-1">
            <h3 className="font-semibold text-sm">{evidence.status} Status</h3>
            <p className="text-xs opacity-75 mt-0.5">{evidence.reasoning}</p>
          </div>
          {evidence.confidence && (
            <div className="text-xs font-medium">
              {(evidence.confidence * 100).toFixed(0)}% confident
            </div>
          )}
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
            <div className="text-xs text-on-surface-variant/60 font-medium uppercase tracking-wide">
              Total Evidence
            </div>
            <div className="text-xl font-bold text-primary mt-1">
              {evidence.statistics.totalEvidence}
            </div>
          </div>
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
            <div className="text-xs text-on-surface-variant/60 font-medium uppercase tracking-wide">
              Matched
            </div>
            <div className="text-xl font-bold text-emerald-400 mt-1">
              {evidence.statistics.matchedToLibrary}
            </div>
          </div>
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
            <div className="text-xs text-on-surface-variant/60 font-medium uppercase tracking-wide">
              Sections
            </div>
            <div className="text-xl font-bold text-amber-400 mt-1">
              {evidence.statistics.totalSections}
            </div>
          </div>
          <div className="bg-slate-500/5 border border-slate-500/20 rounded-lg p-3">
            <div className="text-xs text-on-surface-variant/60 font-medium uppercase tracking-wide">
              Avg Confidence
            </div>
            <div
              className={cn(
                "text-xl font-bold mt-1",
                getConfidenceColor(evidence.statistics.averageConfidence),
              )}
            >
              {(evidence.statistics.averageConfidence * 100).toFixed(0)}%
            </div>
          </div>
        </div>
      </div>

      {/* Evidence by Section */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-on-surface">
          Evidence Breakdown
        </h3>

        {evidence.groupedEvidence.length === 0 ? (
          <div className="text-center py-8 text-on-surface-variant/60">
            <p>No evidence extracted</p>
          </div>
        ) : (
          evidence.groupedEvidence.map((group) => (
            <div
              key={group.section}
              className="border border-outline rounded-lg overflow-hidden"
            >
              {/* Section Header */}
              <button
                onClick={() => toggleSection(group.section)}
                className="w-full px-4 py-3 bg-surface-container-high/60 hover:bg-surface-container-high transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-3 flex-1 text-left">
                  {expandedSections[group.section] ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  <div>
                    <h4 className="font-semibold text-sm">{group.section}</h4>
                    <p className="text-xs text-on-surface-variant/60">
                      {group.count} piece{group.count !== 1 ? "s" : ""} of
                      evidence
                    </p>
                  </div>
                </div>
              </button>

              {/* Section Items */}
              <AnimatePresence>
                {expandedSections[group.section] && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="divide-y divide-outline/50"
                  >
                    {group.items.map((item, idx) => (
                      <div key={item.id || idx} className="p-4 space-y-3">
                        {/* Evidence Text */}
                        <div>
                          <p className="text-sm leading-relaxed text-on-surface">
                            {item.text}
                          </p>
                        </div>

                        {/* Evidence Metadata */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-primary/10 text-primary text-xs font-medium">
                            {item.clauseType}
                          </span>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium",
                              getConfidenceColor(item.matchConfidence),
                              item.matchConfidence >= 0.75
                                ? "bg-emerald-500/10"
                                : item.matchConfidence >= 0.6
                                  ? "bg-amber-500/10"
                                  : "bg-slate-500/10",
                            )}
                          >
                            {item.isManuallyMatched && (
                              <LinkIcon className="w-3 h-3" />
                            )}
                            {(item.matchConfidence * 100).toFixed(0)}% match
                          </span>
                          {item.libraryClauseId && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-500/10 text-slate-300 text-xs">
                              <CheckCircle2 className="w-3 h-3" />
                              Linked to library
                            </span>
                          )}
                        </div>

                        {/* Expandable Details */}
                        <button
                          onClick={() => toggleItem(item.id || idx.toString())}
                          className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                        >
                          {expandedItems[item.id || idx.toString()]
                            ? "Hide details"
                            : "Show details"}
                        </button>

                        <AnimatePresence>
                          {expandedItems[item.id || idx.toString()] && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="space-y-3 pt-2 border-t border-outline/30"
                            >
                              {/* Original Source */}
                              {item.source?.chunk && (
                                <div>
                                  <h5 className="text-xs font-semibold text-on-surface/60 uppercase tracking-wide mb-1">
                                    Original Source
                                  </h5>
                                  <p className="text-xs text-on-surface-variant/80 bg-surface-container-high/50 p-2 rounded rounded-lg font-mono">
                                    {item.source.chunk}
                                  </p>
                                </div>
                              )}

                              {/* Similarity */}
                              {item.similarity !== undefined && (
                                <div>
                                  <h5 className="text-xs font-semibold text-on-surface/60 uppercase tracking-wide mb-1">
                                    Similarity Score
                                  </h5>
                                  <div className="w-full bg-surface-container-high/50 rounded-full h-2">
                                    <div
                                      className="bg-primary h-2 rounded-full transition-all"
                                      style={{
                                        width: `${Math.min(100, (item.similarity ?? 0) * 100)}%`,
                                      }}
                                    />
                                  </div>
                                  <p className="text-xs text-on-surface-variant/60 mt-1">
                                    {(item.similarity ?? 0).toFixed(3)}
                                  </p>
                                </div>
                              )}

                              {/* Manual Match Action */}
                              {onManualMatch && !item.isManuallyMatched && (
                                <div className="pt-2">
                                  <button
                                    onClick={() =>
                                      handleManualMatch(
                                        item.id || "",
                                        item.libraryClauseId || "",
                                      )
                                    }
                                    disabled={
                                      matchingState[item.id || ""] ||
                                      !item.libraryClauseId
                                    }
                                    className="text-xs font-medium text-primary hover:text-primary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                                  >
                                    <LinkIcon className="w-3 h-3" />
                                    {matchingState[item.id || ""]
                                      ? "Linking..."
                                      : "Link to library"}
                                  </button>
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))
        )}
      </div>

      {/* Timestamp */}
      {evidence.evaluatedAt && (
        <div className="text-xs text-on-surface-variant/60 text-center pt-4 border-t border-outline/30">
          Evaluated at {new Date(evidence.evaluatedAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}
