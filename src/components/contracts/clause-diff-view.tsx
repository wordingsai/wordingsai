"use client";

/**
 * Side-by-side comparison of a clause extracted from a contract and the
 * matching company-standard library clause, with inline diff highlighting.
 *
 * Left column = contract version (deletions vs library shown in red strike).
 * Right column = library version (insertions vs contract shown in green).
 * Unchanged spans render as plain text in both columns.
 *
 * A "Plain" / "Diff" toggle lets the user collapse the highlighting when
 * they want to read the raw text without distractions.
 *
 * Uses diff-match-patch's semantic cleanup so the diff chunks are roughly
 * word-level rather than character-level. This is much more readable for
 * insurance clause text than a raw char diff.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { FileText, BookOpen, Eye, GitCompare, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
// diff-match-patch ships its own CommonJS export.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const DMP = require("diff-match-patch");

type DiffOp = -1 | 0 | 1;
type DiffChunk = [DiffOp, string];

interface Props {
  contractText: string | null | undefined;
  libraryText: string | null | undefined;
  emptyContractLabel?: string;
  emptyLibraryLabel?: string;
  /** Override the left column header. Defaults to "Extracted from Contract". */
  contractLabel?: string;
  /** Override the right column header. Defaults to "Company Standard (Library)". */
  libraryLabel?: string;
  /** Optional icon overrides for each column header. */
  contractIcon?: React.ReactNode;
  libraryIcon?: React.ReactNode;
  /**
   * Legend wording for the bottom badges. Useful when the comparison is
   * older-vs-newer (e.g. "Added in v3" / "Removed in v3") rather than
   * contract-vs-library.
   */
  addedLegend?: string;
  removedLegend?: string;
}

export function ClauseDiffView({
  contractText,
  libraryText,
  emptyContractLabel = "No exact text snippet captured during scan.",
  emptyLibraryLabel = "No baseline standard available for this provision.",
  contractLabel = "Extracted from Contract",
  libraryLabel = "Company Standard (Library)",
  contractIcon,
  libraryIcon,
  addedLegend = "Added in contract",
  removedLegend = "Removed from library",
}: Props) {
  const [mode, setMode] = React.useState<"diff" | "plain">("diff");

  const left = (contractText ?? "").trim();
  const right = (libraryText ?? "").trim();
  const hasBoth = left.length > 0 && right.length > 0;

  const diffs = React.useMemo<DiffChunk[]>(() => {
    if (!hasBoth) return [];
    // diff_main expects (text1, text2). text1 = "before" (library), text2
    // = "after" (contract). That way INSERTIONS shown on the right belong
    // in the contract version, and DELETIONS belong in library. We swap
    // mentally per render side below.
    const dmp = new DMP.diff_match_patch();
    const raw = dmp.diff_main(right, left);
    dmp.diff_cleanupSemantic(raw);
    return raw as DiffChunk[];
  }, [left, right, hasBoth]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant">
          Clause comparison
        </h4>
        {hasBoth ? (
          <div className="flex items-center gap-1 p-1 rounded-md bg-surface-container text-[10px]">
            <ToggleBtn
              active={mode === "diff"}
              onClick={() => setMode("diff")}
              icon={<GitCompare className="size-3" />}
              label="Diff"
            />
            <ToggleBtn
              active={mode === "plain"}
              onClick={() => setMode("plain")}
              icon={<Eye className="size-3" />}
              label="Plain"
            />
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Column
          tone="contract"
          title={contractLabel}
          icon={contractIcon ?? <FileText className="size-3.5" />}
          emptyLabel={emptyContractLabel}
          text={left}
        >
          {hasBoth && mode === "diff" ? (
            <DiffSide diffs={diffs} side="contract" />
          ) : (
            <PlainText text={left} emptyLabel={emptyContractLabel} />
          )}
        </Column>

        <Column
          tone="library"
          title={libraryLabel}
          icon={libraryIcon ?? <BookOpen className="size-3.5" />}
          emptyLabel={emptyLibraryLabel}
          text={right}
        >
          {hasBoth && mode === "diff" ? (
            <DiffSide diffs={diffs} side="library" />
          ) : (
            <PlainText
              text={right}
              emptyLabel={emptyLibraryLabel}
              italic
            />
          )}
        </Column>
      </div>

      {hasBoth ? (
        <div className="text-[10px] text-on-surface-variant flex items-center gap-4 px-1">
          <LegendDot className="bg-emerald-500/30 border border-emerald-500/60" />
          {addedLegend}
          <LegendDot className="bg-rose-500/30 border border-rose-500/60" />
          {removedLegend}
        </div>
      ) : null}
    </div>
  );
}

function Column({
  tone,
  title,
  icon,
  text,
  children,
}: {
  tone: "contract" | "library";
  title: string;
  icon: React.ReactNode;
  emptyLabel: string;
  text: string;
  children: React.ReactNode;
}) {
  const isLibrary = tone === "library";
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-2">
        <h5
          className={cn(
            "text-[11px] font-semibold uppercase tracking-[0.2em] flex items-center gap-2",
            isLibrary ? "text-primary" : "text-on-surface",
          )}
        >
          <div
            className={cn(
              "size-6 rounded-lg flex items-center justify-center",
              isLibrary ? "bg-primary/10 text-primary" : "bg-primary/10 text-primary",
            )}
          >
            {icon}
          </div>
          {title}
        </h5>
        {text ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded-md"
            onClick={() => {
              navigator.clipboard.writeText(text);
              toast.success("Copied to clipboard");
            }}
            title="Copy this side"
          >
            <Copy className="size-3.5" />
          </Button>
        ) : null}
      </div>
      <div
        className={cn(
          "p-4 sm:p-6 rounded-2xl shadow-inner min-h-[120px] max-h-[40vh] overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap",
          isLibrary
            ? "bg-primary/5 border-2 border-primary/20"
            : "bg-surface-container-low border border-outline-variant/30",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function DiffSide({
  diffs,
  side,
}: {
  diffs: DiffChunk[];
  side: "contract" | "library";
}) {
  // Reminder: we ran diff_main(libraryText, contractText), so:
  //   -1 = DELETED from library  -> only render on the LIBRARY column
  //    1 = INSERTED in contract  -> only render on the CONTRACT column
  //    0 = unchanged             -> render on both
  return (
    <>
      {diffs.map(([op, chunk], i) => {
        if (op === 0) {
          return <span key={i}>{chunk}</span>;
        }
        if (op === 1 && side === "contract") {
          return (
            <span
              key={i}
              className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 rounded px-0.5"
            >
              {chunk}
            </span>
          );
        }
        if (op === -1 && side === "library") {
          return (
            <span
              key={i}
              className="bg-rose-500/15 text-rose-700 dark:text-rose-300 line-through decoration-rose-500/60 rounded px-0.5"
            >
              {chunk}
            </span>
          );
        }
        // Insertions on the library side and deletions on the contract
        // side are intentionally suppressed -- they belong only to the
        // other column.
        return null;
      })}
    </>
  );
}

function PlainText({
  text,
  emptyLabel,
  italic,
}: {
  text: string;
  emptyLabel: string;
  italic?: boolean;
}) {
  if (!text) {
    return (
      <span className="text-on-surface-variant text-xs italic">
        {emptyLabel}
      </span>
    );
  }
  return (
    <span className={italic ? "italic text-primary" : ""}>{text}</span>
  );
}

function ToggleBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 px-2 py-1 rounded-sm font-medium uppercase tracking-wider transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-on-surface-variant hover:text-on-surface",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function LegendDot({ className }: { className: string }) {
  return <span className={cn("inline-block size-3 rounded-sm", className)} />;
}
