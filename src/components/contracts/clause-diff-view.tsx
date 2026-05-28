"use client";

/**
 * Side-by-side comparison of two clause snippets with inline word-level diff
 * highlighting. Used in two places:
 *
 *  1. Contract analysis page  -- contract clause (LEFT) vs library standard (RIGHT)
 *  2. Amendment history dialog -- newer version  (LEFT) vs older version    (RIGHT)
 *
 * The labels, icons, and legend text are all configurable so the same
 * component fits both contexts cleanly.
 *
 * Diff engine: diff-match-patch with semantic cleanup (word-ish chunks).
 *
 * Rendering rules:
 *  - Unchanged spans -> rendered on both sides as plain text.
 *  - INSERTIONS (present in LEFT only) -> rendered on LEFT highlighted green.
 *  - DELETIONS  (present in RIGHT only) -> rendered on RIGHT highlighted red.
 *  This way each side stays readable as its own document, with the other
 *  side's exclusive content suppressed.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { FileText, BookOpen, Eye, GitCompare, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
// diff-match-patch ships only a CommonJS export.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const DMP = require("diff-match-patch");

type DiffOp = -1 | 0 | 1;
type DiffChunk = [DiffOp, string];

interface Props {
  /** Left column text (typically "newer" / contract / current). */
  contractText: string | null | undefined;
  /** Right column text (typically "older" / library / baseline). */
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
  /** Legend wording shown beneath the columns. */
  addedLegend?: string;
  removedLegend?: string;
  /** Cap the inner scroll height per column. Defaults to "max-h-[48vh]". */
  maxHeightClassName?: string;
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
  maxHeightClassName = "max-h-[48vh]",
}: Props) {
  const [mode, setMode] = React.useState<"diff" | "plain">("diff");

  const left = (contractText ?? "").trim();
  const right = (libraryText ?? "").trim();
  const hasBoth = left.length > 0 && right.length > 0;

  const diffs = React.useMemo<DiffChunk[]>(() => {
    if (!hasBoth) return [];
    // diff_main(text1=before, text2=after). text1=right (older/library),
    // text2=left (newer/contract). So:
    //   op=+1 = INSERTED in LEFT  -> show in LEFT, suppress in RIGHT
    //   op=-1 = DELETED from LEFT -> show in RIGHT, suppress in LEFT
    //   op= 0 = unchanged         -> show in both
    const dmp = new DMP.diff_match_patch();
    const raw = dmp.diff_main(right, left);
    dmp.diff_cleanupSemantic(raw);
    return raw as DiffChunk[];
  }, [left, right, hasBoth]);

  return (
    <div className="space-y-3 min-w-0">
      <div className="flex items-center justify-between gap-3 px-1">
        <h4 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant truncate">
          Clause comparison
        </h4>
        {hasBoth ? (
          <div className="flex items-center gap-0.5 p-0.5 rounded-md border border-outline-variant/40 bg-surface-container text-[10px] shrink-0">
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

      <div
        // `auto-fit` + minmax means: lay out as 2 columns when the parent
        // is wide enough for each column to be at least 280px, otherwise
        // stack to 1 column. This works for *container* width (not viewport)
        // so it adapts correctly inside the narrow PANEL 3 of the contract
        // page as well as inside the wide AmendmentDiffDialog.
        className="grid gap-3 md:gap-4 min-w-0 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]"
      >
        <Column
          tone="contract"
          title={contractLabel}
          icon={contractIcon ?? <FileText className="size-3.5" />}
          text={left}
          maxHeightClassName={maxHeightClassName}
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
          text={right}
          maxHeightClassName={maxHeightClassName}
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
        <div className="text-[10px] text-on-surface-variant flex flex-wrap items-center gap-x-4 gap-y-1 px-1 pt-1">
          <span className="flex items-center gap-1.5">
            <LegendDot className="bg-emerald-500/30 border border-emerald-500/60" />
            {addedLegend}
          </span>
          <span className="flex items-center gap-1.5">
            <LegendDot className="bg-rose-500/30 border border-rose-500/60" />
            {removedLegend}
          </span>
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
  maxHeightClassName,
}: {
  tone: "contract" | "library";
  title: string;
  icon: React.ReactNode;
  text: string;
  children: React.ReactNode;
  maxHeightClassName: string;
}) {
  const isLibrary = tone === "library";
  return (
    <div className="space-y-2 min-w-0">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <h5
          className={cn(
            "text-[10px] font-semibold uppercase tracking-[0.18em] flex items-center gap-1.5 min-w-0 flex-1",
            isLibrary ? "text-primary" : "text-on-surface",
          )}
        >
          <span
            className={cn(
              "size-5 rounded-md flex items-center justify-center shrink-0",
              "bg-primary/10 text-primary",
            )}
          >
            {icon}
          </span>
          <span className="truncate">{title}</span>
        </h5>
        {text ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-6 rounded-md shrink-0"
            onClick={() => {
              navigator.clipboard.writeText(text);
              toast.success("Copied to clipboard");
            }}
            title="Copy this side"
          >
            <Copy className="size-3" />
          </Button>
        ) : null}
      </div>
      <div
        className={cn(
          "p-4 rounded-xl text-[13px] leading-relaxed",
          "whitespace-pre-wrap break-words [overflow-wrap:anywhere]",
          "overflow-y-auto overflow-x-hidden min-w-0",
          "min-h-[140px]",
          maxHeightClassName,
          isLibrary
            ? "bg-primary/5 border border-primary/20"
            : "bg-surface-container-low border border-outline-variant/40",
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
              className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 rounded-sm px-0.5"
            >
              {chunk}
            </span>
          );
        }
        if (op === -1 && side === "library") {
          return (
            <span
              key={i}
              className="bg-rose-500/15 text-rose-700 dark:text-rose-300 line-through decoration-rose-500/60 rounded-sm px-0.5"
            >
              {chunk}
            </span>
          );
        }
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
      <span className="text-xs italic opacity-50">{emptyLabel}</span>
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
  return <span className={cn("inline-block size-2.5 rounded-sm", className)} />;
}
