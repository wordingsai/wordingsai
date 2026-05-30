"use client";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { createWorkspace } from "@/server/workspaces-actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Copy,
  Trash2,
  BrainCircuit,
  Loader2,
  Plus,
  Fingerprint,
  Cpu,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CreateWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaces: Array<{ id: string; name: string }>;
  activeOrgId?: string;
}

export function CreateWorkspaceDialog({
  open,
  onOpenChange,
  workspaces,
  activeOrgId,
}: CreateWorkspaceDialogProps) {
  const [loading, setLoading] = React.useState(false);
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState("reinsurance");
  const [mode, setMode] = React.useState<"scratch" | "duplicate">("scratch");
  const [sourceWorkspaceId, setSourceWorkspaceId] = React.useState("");
  const router = useRouter();

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Please enter a workspace name");
      return;
    }

    if (mode === "duplicate" && !sourceWorkspaceId) {
      toast.error("Please select a source workspace to duplicate from");
      return;
    }

    try {
      setLoading(true);
      const workspace = await createWorkspace(
        name,
        type,
        mode,
        sourceWorkspaceId,
      );
      await fetch("/api/auth/set-workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: workspace.id }),
      });
      toast.success("Workspace created successfully");
      onOpenChange(false);
      setName("");
      setSourceWorkspaceId("");
      setMode("scratch");
      router.refresh();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to create workspace";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-2xl bg-popover/95 backdrop-blur-xl border-outline-variant/50 rounded-xl shadow-lg p-0 overflow-hidden">
        <div className="bg-surface-container-low/50 p-5 sm:p-6 border-b border-outline-variant/30 flex items-center gap-3">
          <div className="size-10 shrink-0 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
            <BrainCircuit className="size-5" />
          </div>
          <div>
            <DialogTitle className="text-base font-semibold text-on-surface tracking-tight">
              New workspace
            </DialogTitle>
            <DialogDescription className="text-xs text-on-surface-variant mt-0.5">
              Start fresh or duplicate an existing workspace.
            </DialogDescription>
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-5">
              {/* Workspace Name */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-on-surface-variant flex items-center gap-1.5">
                  <Fingerprint className="size-3 text-primary" /> Workspace name
                </Label>
                <Input
                  placeholder="e.g., Q2 Renewal Strategy"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-background"
                />
              </div>

              {/* Type Selection */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-on-surface-variant flex items-center gap-1.5">
                  <Cpu className="size-3 text-primary" /> Type
                </Label>
                <Select
                  value={type}
                  onValueChange={(val) => val && setType(val)}
                >
                  <SelectTrigger className="h-8 w-full rounded-lg">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Property workspace removed per Richard (2026-05): it was
                        empty and only added confusion. Reinsurance is the sole
                        line for now; new lines can be reintroduced when there's
                        real content to scale into. */}
                    <SelectItem value="reinsurance">
                      <div className="flex items-center gap-2">
                        <Sparkles className="size-3 text-primary" /> Reinsurance
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-5">
              {/* Mode Selection */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-on-surface-variant flex items-center gap-1.5">
                  <Sparkles className="size-3 text-primary" /> Start from
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMode("scratch")}
                    className={cn(
                      "flex h-8 w-full items-center justify-center gap-2 rounded-lg border bg-transparent px-3 text-sm font-medium transition-colors",
                      mode === "scratch"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-outline-variant text-on-surface-variant hover:border-primary/40",
                    )}
                  >
                    <Trash2 className="size-4 shrink-0" />
                    <span>Scratch</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("duplicate")}
                    className={cn(
                      "flex h-8 w-full items-center justify-center gap-2 rounded-lg border bg-transparent px-3 text-sm font-medium transition-colors",
                      mode === "duplicate"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-outline-variant text-on-surface-variant hover:border-primary/40",
                    )}
                  >
                    <Copy className="size-4 shrink-0" />
                    <span>Duplicate</span>
                  </button>
                </div>
              </div>

              {/* Source Workspace Selection (only if Duplicate) */}
              {mode === "duplicate" && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                  <Label className="text-xs font-medium text-on-surface-variant">
                    Copy from
                  </Label>
                  <Select
                    value={sourceWorkspaceId}
                    onValueChange={(val) => val && setSourceWorkspaceId(val)}
                  >
                    <SelectTrigger className="h-8 w-full rounded-lg">
                      <SelectValue placeholder="Select source workspace…" />
                    </SelectTrigger>
                    <SelectContent>
                      {workspaces.map((ws) => (
                        <SelectItem key={ws.id} value={ws.id}>
                          {ws.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-on-surface-variant/70 px-0.5">
                    Rules and library clauses will be copied to the new workspace.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="bg-surface-container-high/50 p-4 sm:p-5 border-t border-outline-variant/30 sm:justify-end gap-2 flex-col sm:flex-row">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={loading}
            className="w-full sm:w-auto gap-2"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Create workspace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
