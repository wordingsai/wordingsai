"use client";

import React, { useState, useEffect } from "react";
import type { ClauseMatchingResult } from "@/types/evidence";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, Loader2, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClauseMatchingModalProps {
  isOpen: boolean;
  documentClauseText: string;
  section?: string;
  clauseTypeHint?: string;
  onClose: () => void;
  onSelectMatch: (libraryClauseId: string) => Promise<void>;
  loading?: boolean;
}

export function ClauseMatchingModal({
  isOpen,
  documentClauseText,
  section,
  clauseTypeHint,
  onClose,
  onSelectMatch,
  loading = false,
}: ClauseMatchingModalProps) {
  const [matchResult, setMatchResult] = useState<ClauseMatchingResult | null>(
    null,
  );
  const [fetchLoading, setFetchLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const fetchMatches = async () => {
      setFetchLoading(true);
      try {
        const response = await fetch("/api/clauses/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: documentClauseText,
            section,
            clauseTypeHint,
            topN: 5,
            minConfidence: 0.5,
          }),
        });

        if (!response.ok) throw new Error("Failed to fetch matches");
        const result = await response.json();
        setMatchResult(result);

        if (result.recommendedMatch) {
          setSelectedId(result.recommendedMatch.id);
        }
      } catch (error) {
        console.error("[ClauseMatching] Error fetching matches:", error);
      } finally {
        setFetchLoading(false);
      }
    };

    fetchMatches();
  }, [isOpen, documentClauseText, section, clauseTypeHint]);

  const handleSelect = async () => {
    if (!selectedId) return;
    try {
      await onSelectMatch(selectedId);
      onClose();
    } catch (error) {
      console.error("[ClauseMatching] Error selecting match:", error);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(documentClauseText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "text-emerald-400";
    if (confidence >= 0.6) return "text-amber-400";
    return "text-slate-400";
  };

  const getConfidenceBg = (confidence: number) => {
    if (confidence >= 0.8) return "bg-emerald-500/10 border-emerald-500/30";
    if (confidence >= 0.6) return "bg-amber-500/10 border-amber-500/30";
    return "bg-slate-500/10 border-slate-500/30";
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Match Clause to Library</DialogTitle>
          <DialogDescription>
            Find the best matching clause from your library
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Document Clause */}
          <div className="bg-surface-container-high/50 border border-outline/50 rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="font-semibold text-sm text-on-surface">
                  Document Clause
                </h4>
                {(section || clauseTypeHint) && (
                  <p className="text-xs text-on-surface-variant/60 mt-1">
                    {section && <span>{section}</span>}
                    {section && clauseTypeHint && <span> • </span>}
                    {clauseTypeHint && <span>{clauseTypeHint}</span>}
                  </p>
                )}
              </div>
              <button
                onClick={copyToClipboard}
                className="p-1.5 hover:bg-surface-container-high rounded transition-colors"
                title="Copy text"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4 text-on-surface-variant/60" />
                )}
              </button>
            </div>
            <p className="text-sm leading-relaxed text-on-surface">
              {documentClauseText}
            </p>
          </div>

          {/* Matches */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm text-on-surface">
              Library Matches
            </h4>

            {fetchLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="ml-2 text-sm text-on-surface-variant">
                  Finding matches...
                </span>
              </div>
            ) : matchResult?.matches && matchResult.matches.length > 0 ? (
              <div className="space-y-2">
                {matchResult.matches.map((match, idx) => (
                  <button
                    key={match.id}
                    onClick={() => setSelectedId(match.id)}
                    className={cn(
                      "w-full p-3 rounded-lg border-2 text-left transition-all",
                      selectedId === match.id
                        ? "bg-primary/10 border-primary"
                        : "bg-surface hover:bg-surface-container-high/60 border-outline/50",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <h5 className="font-medium text-sm text-on-surface truncate">
                            {match.name}
                          </h5>
                          {/* Library reference code (e.g. LSW307A / WAI-061) —
                              the identifying code of the matched library clause.
                              Core requirement: every match shows which library
                              clause was detected. */}
                          {match.code && (
                            <span
                              className="inline-flex items-center px-1.5 py-0 rounded text-[10px] font-mono font-medium bg-primary/10 text-primary border border-primary/30"
                              title="Library reference code"
                            >
                              {match.code}
                            </span>
                          )}
                          {/* Approval status of the matched library standard so
                              the reviewer knows if it is an approved wording. */}
                          {match.approvalStatus && (
                            <span
                              className={cn(
                                "inline-flex items-center px-1.5 py-0 rounded text-[10px] font-medium border",
                                match.approvalStatus === "Approved"
                                  ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                                  : "bg-amber-500/10 text-amber-300 border-amber-500/30",
                              )}
                              title="Library clause approval status"
                            >
                              {match.approvalStatus === "Approved"
                                ? "Approved"
                                : "Unapproved"}
                            </span>
                          )}
                          {idx === 0 &&
                            matchResult.recommendedMatch?.id === match.id && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-500/20 text-emerald-300">
                                <CheckCircle2 className="w-3 h-3" />
                                Recommended
                              </span>
                            )}
                        </div>
                        {match.type && (
                          <p className="text-xs text-on-surface-variant/60 mb-2">
                            {match.type}
                          </p>
                        )}
                        {match.reason && (
                          <p className="text-xs text-on-surface-variant/70">
                            {match.reason}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium",
                            getConfidenceBg(match.confidence),
                            getConfidenceColor(match.confidence),
                          )}
                        >
                          {(match.confidence * 100).toFixed(0)}%
                        </div>
                        <div
                          className={cn(
                            "w-6 h-6 rounded border-2 transition-all",
                            selectedId === match.id
                              ? "bg-primary border-primary"
                              : "border-outline/50",
                          )}
                        >
                          {selectedId === match.id && (
                            <CheckCircle2 className="w-full h-full text-white" />
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 py-8 text-on-surface-variant/60">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">No matching clauses found</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSelect}
              disabled={!selectedId || loading || fetchLoading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Matching...
                </>
              ) : (
                "Confirm Match"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
