"use client";

import type { StructuredContract } from "@/lib/structured-contract";
import {
  ChevronDown,
  BookOpen,
  FileText,
  Layers,
  ListTree,
  Sparkles,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { ClauseMatchingModal } from "@/components/evidence/clause-matching-modal";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TruncatedText } from "@/components/ui/truncated-text";
import { Badge } from "@/components/ui/badge";

interface DocumentStructureProps {
  data: StructuredContract | null;
  onParagraphClick?: (text: string) => void;
  highlightText?: string | null;
  contractId?: string;
}

type SelectedNode = {
  kind: "section" | "subsection";
  sectionIndex: number;
  subsectionIndex?: number;
};

function countOutlineNodes(data: StructuredContract) {
  let sections = 0;
  let subsections = 0;
  for (const s of data.sections) {
    sections += 1;
    subsections += s.subsections?.length ?? 0;
  }
  return { sections, subsections };
}

function nodeMatchesHighlight(
  paragraphs: string[] | undefined,
  highlight: string,
): boolean {
  return (paragraphs ?? []).some((p) => p.includes(highlight));
}

export function DocumentStructure({
  data,
  onParagraphClick,
  highlightText,
  contractId,
}: DocumentStructureProps) {
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({});
  const [selected, setSelected] = useState<SelectedNode | null>(null);
  const [matchingClause, setMatchingClause] = useState<{
    text: string;
    section?: string;
  } | null>(null);
  const [isMatching, setIsMatching] = useState(false);

  const stats = useMemo(() => (data ? countOutlineNodes(data) : null), [data]);

  useEffect(() => {
    if (!highlightText || !data?.sections?.length) return;

    const nextExpanded: Record<string, boolean> = {};
    data.sections.forEach((section, sIdx) => {
      const id = `s-${sIdx}`;
      const inMain = nodeMatchesHighlight(section.paragraphs, highlightText);
      const inSub = section.subsections?.some((sub) =>
        nodeMatchesHighlight(sub.paragraphs, highlightText),
      );
      if (inMain || inSub) nextExpanded[id] = true;
    });
    setExpandedSections((prev) => ({ ...prev, ...nextExpanded }));
  }, [highlightText, data]);

  const handleSelectMatch = async (libraryClauseId: string) => {
    if (!contractId || !matchingClause) return;
    setIsMatching(true);
    try {
      const response = await fetch(
        `/api/contracts/${contractId}/match-clause`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentText: matchingClause.text,
            libraryClauseId,
            section: matchingClause.section,
          }),
        },
      );
      if (!response.ok) throw new Error("Failed to save match");
      toast.success("Clause successfully matched to library");
    } catch (error) {
      console.error("[DocumentStructure] Match error:", error);
      toast.error("Failed to save clause match");
    } finally {
      setIsMatching(false);
    }
  };

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center p-16 md:p-20 text-on-surface-variant/40">
        <FileText className="w-12 h-12 mb-4 opacity-20" />
        <p className="text-xs font-medium uppercase tracking-wider">
          No structural map available yet.
        </p>
      </div>
    );
  }

  if (!Array.isArray(data.sections) || data.sections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-16 md:p-20 text-on-surface-variant/40">
        <FileText className="w-12 h-12 mb-4 opacity-20" />
        <p className="text-xs font-medium uppercase tracking-wider text-center max-w-xs">
          Document map is incomplete. Re-run analysis to rebuild structure.
        </p>
      </div>
    );
  }

  const preview = selected ? getNodeContent(data, selected) : null;

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 md:p-5 bg-surface-container-low border border-outline-variant/30 rounded-2xl">
        <div className="min-w-0">
          {data.title ? (
            <h2 className="text-base md:text-base font-semibold text-on-surface flex items-center gap-2 truncate">
              <BookOpen className="w-4 h-4 shrink-0 text-primary" />
              <span className="truncate">{data.title}</span>
            </h2>
          ) : (
            <h2 className="text-base md:text-base font-semibold text-on-surface flex items-center gap-2">
              <ListTree className="w-4 h-4 shrink-0 text-primary" />
              Contract outline
            </h2>
          )}
          <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-widest mt-1">
            Articles, sections & subsections — headings only
          </p>
        </div>
        {stats && (
          <div className="flex flex-wrap gap-2 shrink-0">
            <Badge
              variant="outline"
              className="text-[10px] font-medium uppercase tracking-wider"
            >
              {stats.sections} sections
            </Badge>
            {stats.subsections > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] font-medium uppercase tracking-wider"
              >
                {stats.subsections} subsections
              </Badge>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(280px,380px)] gap-4 md:gap-6">
        <div className="border border-outline-variant/30 rounded-2xl overflow-hidden bg-surface-container-low/30 max-h-[min(70vh,720px)] overflow-y-auto">
          <div className="divide-y divide-outline-variant/20">
            {data.sections.map((section, sIdx) => {
              const sectionId = `s-${sIdx}`;
              const isExpanded = !!expandedSections[sectionId];
              const hasSubs = (section.subsections?.length ?? 0) > 0;
              const isSectionSelected =
                selected?.sectionIndex === sIdx && selected?.kind === "section";
              const sectionHighlighted =
                highlightText &&
                (nodeMatchesHighlight(section.paragraphs, highlightText) ||
                  section.subsections?.some((sub) =>
                    nodeMatchesHighlight(sub.paragraphs, highlightText),
                  ));

              return (
                <div key={sectionId} className="bg-surface-container-low/40">
                  <div className="flex items-stretch gap-0">
                    {hasSubs && (
                      <button
                        type="button"
                        onClick={() => toggleSection(sectionId)}
                        className="w-10 shrink-0 flex items-center justify-center text-primary/70 hover:bg-primary/5"
                        aria-label={isExpanded ? "Collapse" : "Expand"}
                      >
                        <ChevronDown
                          className={cn(
                            "size-4 transition-transform",
                            isExpanded ? "rotate-0" : "-rotate-90",
                          )}
                        />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setSelected({ kind: "section", sectionIndex: sIdx });
                        const first = section.paragraphs?.[0];
                        if (first) onParagraphClick?.(first);
                      }}
                      className={cn(
                        "flex-1 min-w-0 text-left px-3 py-3 md:py-3.5 transition-colors",
                        isSectionSelected || sectionHighlighted
                          ? "bg-primary/10 border-l-2 border-primary"
                          : "hover:bg-primary/5 border-l-2 border-transparent",
                        !hasSubs && "pl-4",
                      )}
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        {section.number && (
                          <span className="text-[10px] font-medium uppercase tracking-wider text-primary/50 shrink-0 pt-0.5">
                            {section.number}
                          </span>
                        )}
                        <span className="text-xs md:text-sm font-semibold text-on-surface uppercase tracking-tight leading-snug break-words">
                          {section.heading}
                        </span>
                      </div>
                    </button>
                  </div>

                  {hasSubs && isExpanded && (
                    <div className="pb-2 space-y-0.5 bg-surface-container/30">
                      {section.subsections!.map((sub, ssIdx) => {
                        const isSubSelected =
                          selected?.sectionIndex === sIdx &&
                          selected?.kind === "subsection" &&
                          selected.subsectionIndex === ssIdx;
                        const subHighlighted =
                          highlightText &&
                          nodeMatchesHighlight(sub.paragraphs, highlightText);

                        return (
                          <button
                            key={`${sectionId}-sub-${ssIdx}`}
                            type="button"
                            onClick={() => {
                              setSelected({
                                kind: "subsection",
                                sectionIndex: sIdx,
                                subsectionIndex: ssIdx,
                              });
                              const first = sub.paragraphs?.[0];
                              if (first) onParagraphClick?.(first);
                            }}
                            className={cn(
                              "w-full text-left pl-8 md:pl-10 pr-3 py-2.5 border-l-2 ml-4 md:ml-5 transition-colors",
                              isSubSelected || subHighlighted
                                ? "border-primary bg-primary/10"
                                : "border-outline-variant/30 hover:border-primary/30 hover:bg-primary/5",
                            )}
                          >
                            <div className="flex items-start gap-2 min-w-0">
                              {sub.number && (
                                <span className="text-[8px] font-semibold text-primary/60 uppercase shrink-0 pt-0.5">
                                  {sub.number}
                                </span>
                              )}
                              <span className="text-[11px] md:text-xs font-bold text-on-surface-variant uppercase tracking-tight leading-snug break-words">
                                {sub.heading}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="border border-outline-variant/30 rounded-2xl bg-surface-container-low/50 p-4 md:p-5 flex flex-col min-h-[200px] xl:min-h-0 xl:max-h-[min(70vh,720px)]">
          <div className="flex items-center gap-2 mb-3 shrink-0">
            <Layers className="size-4 text-primary" />
            <span className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">
              Provision preview
            </span>
          </div>
          {preview ? (
            <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-primary/70 mb-1">
                  {preview.breadcrumb}
                </p>
                <h3 className="text-sm font-semibold uppercase tracking-tight text-on-surface leading-snug">
                  {preview.heading}
                </h3>
              </div>
              <TruncatedText
                text={preview.combinedText}
                maxLines={12}
                className="text-[13px]"
                emptyLabel="No body text captured for this heading."
              />
              {preview.combinedText && contractId && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto text-[10px] font-medium uppercase tracking-wider"
                  onClick={() =>
                    setMatchingClause({
                      text: preview.combinedText.slice(0, 4000),
                      section: preview.breadcrumb,
                    })
                  }
                >
                  <Sparkles className="size-3 mr-1.5" />
                  Match with library
                </Button>
              )}
            </div>
          ) : (
            <p className="text-sm text-on-surface-variant/50 italic flex-1 flex items-center">
              Select a section or subsection to preview extracted text.
            </p>
          )}
        </div>
      </div>

      <ClauseMatchingModal
        isOpen={!!matchingClause}
        documentClauseText={matchingClause?.text || ""}
        section={matchingClause?.section}
        onClose={() => setMatchingClause(null)}
        onSelectMatch={handleSelectMatch}
        loading={isMatching}
      />
    </div>
  );
}

function getNodeContent(
  data: StructuredContract,
  node: SelectedNode,
): {
  heading: string;
  breadcrumb: string;
  combinedText: string;
} | null {
  const section = data.sections[node.sectionIndex];
  if (!section) return null;

  if (node.kind === "section") {
    const parts = [...(section.paragraphs ?? [])];
    for (const sub of section.subsections ?? []) {
      parts.push(...(sub.paragraphs ?? []));
    }
    return {
      heading: section.heading,
      breadcrumb: section.number ? `Section ${section.number}` : "Section",
      combinedText: parts.join("\n\n").trim(),
    };
  }

  const sub = section.subsections?.[node.subsectionIndex ?? -1];
  if (!sub) return null;
  return {
    heading: sub.heading,
    breadcrumb: [section.heading, sub.number || sub.heading]
      .filter(Boolean)
      .join(" › "),
    combinedText: (sub.paragraphs ?? []).join("\n\n").trim(),
  };
}
