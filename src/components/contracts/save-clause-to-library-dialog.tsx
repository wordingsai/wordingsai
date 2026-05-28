"use client";

/**
 * Dialog: "Save detected clause to my library".
 *
 * Mounted from the contract-detail page when the user clicks the bookmark
 * button next to an extracted clause. POSTs the (potentially edited) name +
 * text + category + scope to /api/contracts/[contractId]/update-library,
 * which either updates an existing matching clause for the same scope or
 * creates a new one.
 *
 * Scope choices:
 *  - "private" -> stored as a user-private "My custom library" clause
 *    (ownerUserId = self, no other org member can see it)
 *  - "org"     -> stored as an org-shared "Custom" clause (visible to
 *    everyone in the org / workspace)
 */

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { BookmarkPlus, Loader2, Lock, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  "Exclusions",
  "Claims",
  "Premium & Payments",
  "Placement & Subscription",
  "Compliance",
  "Information & Records",
  "Disputes",
  "Parties & Definitions",
  "Termination",
  "Other",
] as const;

type Scope = "private" | "org";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId: string;
  defaultClauseName: string;
  defaultClauseText: string;
  defaultCategory?: string;
  /** Called after a successful save, in case the parent wants to refetch. */
  onSaved?: () => void;
}

export function SaveClauseToLibraryDialog({
  open,
  onOpenChange,
  contractId,
  defaultClauseName,
  defaultClauseText,
  defaultCategory,
  onSaved,
}: Props) {
  const [clauseName, setClauseName] = React.useState(defaultClauseName);
  const [clauseText, setClauseText] = React.useState(defaultClauseText);
  const [category, setCategory] = React.useState<string>(
    normalizeCategory(defaultCategory) ?? "Other",
  );
  const [scope, setScope] = React.useState<Scope>("private");
  const [loading, setLoading] = React.useState(false);

  // Re-sync local fields when the dialog re-opens for a different clause.
  React.useEffect(() => {
    if (!open) return;
    setClauseName(defaultClauseName);
    setClauseText(defaultClauseText);
    setCategory(normalizeCategory(defaultCategory) ?? "Other");
    setScope("private");
  }, [open, defaultClauseName, defaultClauseText, defaultCategory]);

  const handleSave = async () => {
    const trimmedName = clauseName.trim();
    const trimmedText = clauseText.trim();
    if (!trimmedName) {
      toast.error("Give the clause a short name.");
      return;
    }
    if (!trimmedText) {
      toast.error("Clause text can't be empty.");
      return;
    }

    setLoading(true);
    try {
      const isPrivate = scope === "private";
      const res = await fetch(
        `/api/contracts/${contractId}/update-library`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clauseName: trimmedName,
            clauseText: trimmedText,
            category,
            library: isPrivate ? "My custom library" : "Custom",
            isPrivate,
            scope: isPrivate ? "user" : "org",
          }),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Save failed (${res.status})`);
      }

      toast.success(
        isPrivate
          ? "Saved to your private library."
          : "Saved to the org Custom library.",
      );
      onSaved?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Could not save clause.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookmarkPlus className="size-5 text-primary" />
            Save to clause library
          </DialogTitle>
          <DialogDescription>
            Capture this clause so you can reuse it in future analyses. Edit
            the name or wording before saving — the original contract is
            unchanged.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="save-clause-name">Clause name</Label>
            <Input
              id="save-clause-name"
              value={clauseName}
              onChange={(e) => setClauseName(e.target.value)}
              placeholder="e.g. War Exclusion Clause"
              disabled={loading}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="save-clause-category">Category</Label>
            <Select
              value={category}
              onValueChange={(v) => v && setCategory(v)}
              disabled={loading}
            >
              <SelectTrigger id="save-clause-category">
                <SelectValue placeholder="Pick a category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="save-clause-text">Clause text</Label>
            <Textarea
              id="save-clause-text"
              value={clauseText}
              onChange={(e) => setClauseText(e.target.value)}
              rows={8}
              placeholder="The wording you want to remember…"
              disabled={loading}
              className="font-mono text-xs leading-relaxed"
            />
          </div>

          <div className="space-y-2">
            <Label>Visibility</Label>
            <div className="grid grid-cols-2 gap-2">
              <ScopeOption
                active={scope === "private"}
                onClick={() => setScope("private")}
                icon={<Lock className="size-4" />}
                title="Just me"
                subtitle="Only you can see this clause."
              />
              <ScopeOption
                active={scope === "org"}
                onClick={() => setScope("org")}
                icon={<Users className="size-4" />}
                title="Whole org"
                subtitle="Anyone in your organization can use it."
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" /> Saving
              </>
            ) : (
              <>
                <BookmarkPlus className="size-4 mr-2" /> Save clause
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScopeOption({
  active,
  onClick,
  icon,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-left p-3 rounded-lg border transition-colors",
        active
          ? "border-primary bg-primary/10 ring-1 ring-primary/40"
          : "border-outline-variant bg-surface-container-low hover:bg-surface-container",
      )}
    >
      <div className="flex items-center gap-2">
        <span className={active ? "text-primary" : "text-on-surface-variant"}>
          {icon}
        </span>
        <span
          className={cn(
            "text-sm font-medium",
            active ? "text-primary" : "text-on-surface",
          )}
        >
          {title}
        </span>
      </div>
      <div className="text-xs text-on-surface-variant mt-1 leading-snug">
        {subtitle}
      </div>
    </button>
  );
}

/**
 * The DB enum is rigid. If the analyzer returned "General Provision" or
 * anything else not in our list, fall through to undefined so the caller
 * defaults to "Other".
 */
function normalizeCategory(c?: string | null): string | undefined {
  if (!c) return undefined;
  return (CATEGORIES as readonly string[]).includes(c) ? c : undefined;
}
