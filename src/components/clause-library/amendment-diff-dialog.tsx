"use client";

/**
 * Amendment diff dialog: lets the user pick any two versions of a clause
 * from its revision history and see a side-by-side word-level diff. Reuses
 * ClauseDiffView with relabeled columns ("Older" / "Newer") and per-version
 * metadata badges.
 *
 * Opens from the "Full Differential View" button on the clause-detail page.
 * Defaults to showing the most recent change (latest vs previous).
 *
 * Width note: shadcn Dialog defaults to `sm:max-w-sm` (~24rem). For this
 * use-case that's far too small -- we need a wide diff view. The explicit
 * `sm:max-w-[1100px]` here defeats that default at the sm breakpoint and
 * up; on mobile the `w-[min(95vw,1100px)]` handles it.
 */

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ClauseDiffView } from "@/components/contracts/clause-diff-view";
import { GitCompare, Clock, ArrowRight, UserCircle2 } from "lucide-react";

export interface VersionRow {
  version: string;
  versionNumber: number;
  isActive: boolean;
  updatedAt: string;
  changeSummary: string;
  modifiedBy: string;
  clauseText: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versions: VersionRow[];
  /** If set, the dialog opens with this version preselected on the "newer" side. */
  initialNewerVersionNumber?: number;
}

export function AmendmentDiffDialog({
  open,
  onOpenChange,
  versions,
  initialNewerVersionNumber,
}: Props) {
  // versions arrive newest-first. Defaults: newer = latest, older = previous.
  const sorted = React.useMemo(
    () => [...versions].sort((a, b) => b.versionNumber - a.versionNumber),
    [versions],
  );

  const defaultNewer = initialNewerVersionNumber ?? sorted[0]?.versionNumber;
  const defaultOlder =
    sorted.find((v) => v.versionNumber !== defaultNewer)?.versionNumber ??
    defaultNewer;

  const [newerNum, setNewerNum] = React.useState<number | undefined>(
    defaultNewer,
  );
  const [olderNum, setOlderNum] = React.useState<number | undefined>(
    defaultOlder,
  );

  React.useEffect(() => {
    if (!open) return;
    setNewerNum(defaultNewer);
    setOlderNum(defaultOlder);
  }, [open, defaultNewer, defaultOlder]);

  const newer = sorted.find((v) => v.versionNumber === newerNum);
  const older = sorted.find((v) => v.versionNumber === olderNum);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          w-[min(95vw,1100px)]
          sm:max-w-[min(95vw,1100px)]
          max-h-[90vh]
          overflow-y-auto
          p-6
        "
      >
        <DialogHeader className="space-y-1.5">
          <DialogTitle className="flex items-center gap-2 text-base">
            <GitCompare className="size-4 text-primary" />
            Amendment history
          </DialogTitle>
          <DialogDescription className="text-xs">
            Compare any two versions of this clause to see exactly what
            changed and who changed it.
          </DialogDescription>
        </DialogHeader>

        {versions.length < 2 ? (
          <div className="py-16 text-center text-sm text-on-surface-variant">
            <Clock className="size-7 mx-auto mb-3 opacity-40" />
            Only one version exists for this clause yet — nothing to compare.
          </div>
        ) : (
          <div className="space-y-5">
            <VersionPickerRow
              sorted={sorted}
              olderNum={olderNum}
              newerNum={newerNum}
              setOlderNum={setOlderNum}
              setNewerNum={setNewerNum}
            />

            {newer && older ? (
              <ClauseDiffView
                contractText={newer.clauseText}
                libraryText={older.clauseText}
                contractLabel={`${newer.version}${newer.isActive ? " · Current" : ""}`}
                libraryLabel={older.version}
                emptyContractLabel="(Empty)"
                emptyLibraryLabel="(Empty)"
                addedLegend={`Added in ${newer.version}`}
                removedLegend={`Removed since ${older.version}`}
                maxHeightClassName="max-h-[44vh]"
              />
            ) : null}

            {newer && older ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <VersionMeta v={newer} />
                <VersionMeta v={older} />
              </div>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function VersionPickerRow({
  sorted,
  olderNum,
  newerNum,
  setOlderNum,
  setNewerNum,
}: {
  sorted: VersionRow[];
  olderNum?: number;
  newerNum?: number;
  setOlderNum: (n: number) => void;
  setNewerNum: (n: number) => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-2">
      <VersionPicker
        label="Older"
        versions={sorted}
        value={olderNum}
        onChange={setOlderNum}
      />
      <ArrowRight className="hidden sm:block size-4 text-on-surface-variant/40 mb-2 shrink-0" />
      <VersionPicker
        label="Newer"
        versions={sorted}
        value={newerNum}
        onChange={setNewerNum}
      />
    </div>
  );
}

function VersionPicker({
  label,
  versions,
  value,
  onChange,
}: {
  label: string;
  versions: VersionRow[];
  value: number | undefined;
  onChange: (n: number) => void;
}) {
  return (
    <div className="space-y-1 flex-1 min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
        {label}
      </div>
      <Select
        value={value != null ? String(value) : undefined}
        onValueChange={(v) => v && onChange(Number(v))}
      >
        <SelectTrigger className="h-9">
          <SelectValue placeholder="Pick a version" />
        </SelectTrigger>
        <SelectContent>
          {versions.map((v) => (
            <SelectItem key={v.versionNumber} value={String(v.versionNumber)}>
              <span className="font-medium">{v.version}</span>
              {v.isActive ? (
                <span className="text-primary ml-1">· Current</span>
              ) : null}
              <span className="text-on-surface-variant ml-2 text-xs">
                {new Date(v.updatedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function VersionMeta({ v }: { v: VersionRow }) {
  return (
    <div className="rounded-lg border border-outline-variant/40 bg-surface-container-low p-3 space-y-1.5 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <Badge
          variant="outline"
          className="text-[10px] font-semibold uppercase tracking-wider"
        >
          {v.version}
          {v.isActive ? " · Current" : ""}
        </Badge>
        <span className="text-[10px] text-on-surface-variant truncate">
          {new Date(v.updatedAt).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
      </div>
      {v.changeSummary ? (
        <div className="text-xs text-on-surface break-words [overflow-wrap:anywhere]">
          {v.changeSummary}
        </div>
      ) : null}
      {v.modifiedBy ? (
        <div className="text-[10px] text-on-surface-variant flex items-center gap-1">
          <UserCircle2 className="size-3" />
          {v.modifiedBy}
        </div>
      ) : null}
    </div>
  );
}
