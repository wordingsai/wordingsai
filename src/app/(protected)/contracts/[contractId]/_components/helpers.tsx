"use client";

/**
 * Shared helper components used across multiple tab panels.
 * Extracted from the 2105-line page.tsx to reduce cognitive overhead.
 */

import { Hash, Sparkles, Target } from "lucide-react";
import { type StructuredContract } from "@/lib/structured-contract";

// ---------------------------------------------------------------------------
// BoldText — renders **bold** markdown-style text inline
// ---------------------------------------------------------------------------
export function BoldText({ text }: { text: string }) {
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

// ---------------------------------------------------------------------------
// MarkdownLine — renders a single line; auto-detects list items
// ---------------------------------------------------------------------------
export function MarkdownLine({ line }: { line: string }) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const isList =
    trimmed.startsWith("*") ||
    trimmed.startsWith("-") ||
    trimmed.startsWith("•") ||
    /^\d+\./.test(trimmed);

  if (isList) {
    const listContent = trimmed.replace(/^([*\-•]|\d+\.)\s+/, "");
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

// ---------------------------------------------------------------------------
// SimpleMarkdown — renders a markdown-lite string as structured sections
// ---------------------------------------------------------------------------
export function SimpleMarkdown({ content }: { content: string }) {
  if (!content) return null;

  const sections = content.split(/\n\s*\n/);

  return (
    <div className="space-y-6">
      {sections.map((section, sIdx) => {
        const lines = section.split("\n");
        const firstLine = lines[0].trim();

        const headerMatch = firstLine.match(/^(#{1,6})\s+(.*)/);
        if (headerMatch) {
          const level = headerMatch[1].length;
          const text = headerMatch[2];
          const Tag = `h${Math.min(level + 2, 6)}` as "h3" | "h4" | "h5" | "h6";
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

// ---------------------------------------------------------------------------
// FormattedEvidence — renders a structured-evidence block with breadcrumb
// ---------------------------------------------------------------------------
export function FormattedEvidence({
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
              number: sub.number || `${section.number}.?`,
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
