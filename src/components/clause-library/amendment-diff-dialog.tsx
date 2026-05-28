"use client";

/**
 * Amendment diff dialog: lets the user pick any two versions of a clause
 * from its revision history and see a side-by-side word-level diff. Reuses
 * ClauseDiffView with relabeled columns ("Older" / "Newer") and per-version
 * metadata badges.
 *
 * Opens from the "Full Differential View" button on the clause-detail page.
 * Defaults to showing the most recent change (latest vs previous).
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
import { GitCompare, Clock } from "lucide-react";

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
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompare className="size-5 text-primary" />
            Amendment history
          </DialogTitle>
          <DialogDescription>
            Compare any two versions of this clause to see exactly what
            changed and who changed it.
          </DialogDescription>
        </DialogHeader>

        {versions.length < 2 ? (
          <div className="py-10 text-center text-sm text-on-surface-variant">
            <Clock className="size-6 mx-auto mb-3 opacity-40" />
            Only one version exists for this clause yet — nothing to compare.
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <VersionPicker
                label="Older"
                versions={sorted}
                value={olderNum}
                onChange={setOlderNum}
              />
              <VersionPicker
                label="Newer"
                versions={sorted}
                value={newerNum}
                onChange={setNewerNum}
              />
            </div>

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
              />
            ) : null}

            {newer && older ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <VersionMeta v={older} />
                <VersionMeta v={newer} />
              </div>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
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
    <div className="space-y-1.5">
      <div className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
        {label}
      </div>
      <Select
        value={value != null ? String(value) : undefined}
        onValueChange={(v) => v && onChange(Number(v))}
      >
        <SelectTrigger>
          <SelectValue placeholder="Pick a version" />
        </SelectTrigger>
        <SelectContent>
          {versions.map((v) => (
            <SelectItem key={v.versionNumber} value={String(v.versionNumber)}>
              {v.version}
              {v.isActive ? " · Current" : ""}
              {" — "}
              {new Date(v.updatedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function VersionMeta({ v }: { v: VersionRow }) {
  return (
    <div className="rounded-lg border border-outline-variant/30 bg-surface-container-low p-3 space-y-1.5">
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className="text-[10px] font-semibold uppercase tracking-wider"
        >
          {v.version}
          {v.isActive ? " · Current" : ""}
        </Badge>
        <span className="text-[10px] text-on-surface-variant">
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
        <div className="text-xs text-on-surface">{v.changeSummary}</div>
      ) : null}
      {v.modifiedBy ? (
        <div className="text-[10px] text-on-surface-variant">
          by {v.modifiedBy}
        </div>
      ) : null}
    </div>
  );
}
