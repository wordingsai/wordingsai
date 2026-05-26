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
  LayoutGrid,
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
      <DialogContent className="w-[95vw] sm:max-w-3xl lg:max-w-4xl bg-popover/95 backdrop-blur-xl border-outline-variant/50 rounded-lg sm:rounded-xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.4)] p-0 overflow-hidden">
        <div className="bg-surface-container-low/50 p-6 sm:p-8 border-b border-outline-variant/30 flex items-center gap-4 sm:gap-6">
          <div className="size-12 sm:size-16 shrink-0 bg-surface-container-highest border border-outline-variant/50 rounded-xl sm:rounded-[1.5rem] flex items-center justify-center shadow-sm text-primary group-hover:scale-105 transition-transform duration-500">
            <BrainCircuit className="size-6 sm:size-8" />
          </div>
          <div>
            <DialogTitle className="text-xl sm:text-lg font-semibold text-on-surface uppercase tracking-tight">
              New Intelligence Scope
            </DialogTitle>
            <DialogDescription className="text-[10px] sm:text-[11px] font-bold text-on-surface-variant/60 uppercase tracking-widest mt-1 sm:mt-1.5 flex items-center gap-2">
              <span className="size-1.5 shrink-0 bg-primary rounded-full animate-pulse" />
              Initialize a fresh environment or duplicate an existing logic
              model
            </DialogDescription>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 lg:gap-10">
            <div className="space-y-8">
              {/* Workspace Name */}
              <div className="space-y-3">
                <Label className="text-xs font-medium uppercase tracking-wider text-on-surface-variant flex items-center gap-2">
                  <Fingerprint className="size-3 text-primary" /> Scope
                  Identifier
                </Label>
                <Input
                  placeholder="e.g., Q2 Renewal Strategy"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-14 bg-surface-container-low border-outline-variant rounded-2xl px-5 text-sm font-semibold uppercase tracking-widest focus:ring-2 focus:ring-primary/20 transition-all shadow-inner"
                />
              </div>

              {/* Type Selection */}
              <div className="space-y-3">
                <Label className="text-xs font-medium uppercase tracking-wider text-on-surface-variant flex items-center gap-2">
                  <Cpu className="size-3 text-primary" /> Engine Configuration
                </Label>
                <Select
                  value={type}
                  onValueChange={(val) => val && setType(val)}
                >
                  <SelectTrigger className="">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    <SelectItem value="reinsurance">
                      <div className="flex items-center gap-2">
                        <Sparkles className="size-3 text-primary" /> Reinsurance
                        Core
                      </div>
                    </SelectItem>
                    {activeOrgId === "c7BkNsHuGpIKHyEcrmgbySSP76uExuwf" && (
                      <SelectItem value="property">
                        <div className="flex items-center gap-2">
                          <LayoutGrid className="size-3 text-primary" />{" "}
                          Property Core
                        </div>
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-8">
              {/* Mode Selection */}
              <div className="space-y-4">
                <Label className="text-xs font-medium uppercase tracking-wider text-on-surface-variant flex items-center gap-2">
                  <Sparkles className="size-3 text-primary" /> Initialization
                  Protocol
                </Label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setMode("scratch")}
                    className={cn(
                      "flex flex-col items-center gap-4 p-6 rounded-lg border transition-all duration-300 group",
                      mode === "scratch"
                        ? "bg-primary/10 border-primary text-primary shadow-lg shadow-primary/5"
                        : "bg-surface-container-low border-outline-variant text-on-surface-variant hover:border-primary/40",
                    )}
                  >
                    <div
                      className={cn(
                        "size-12 rounded-2xl flex items-center justify-center transition-all",
                        mode === "scratch"
                          ? "bg-primary text-white"
                          : "bg-surface-container-highest group-hover:bg-primary/10",
                      )}
                    >
                      <Trash2 className="size-5" />
                    </div>
                    <span className="text-xs font-medium uppercase tracking-wider">
                      Scratch
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("duplicate")}
                    className={cn(
                      "flex flex-col items-center gap-4 p-6 rounded-lg border transition-all duration-300 group",
                      mode === "duplicate"
                        ? "bg-primary/10 border-primary text-primary shadow-lg shadow-primary/5"
                        : "bg-surface-container-low border-outline-variant text-on-surface-variant hover:border-primary/40",
                    )}
                  >
                    <div
                      className={cn(
                        "size-12 rounded-2xl flex items-center justify-center transition-all",
                        mode === "duplicate"
                          ? "bg-primary text-white"
                          : "bg-surface-container-highest group-hover:bg-primary/10",
                      )}
                    >
                      <Copy className="size-5" />
                    </div>
                    <span className="text-xs font-medium uppercase tracking-wider">
                      Duplicate
                    </span>
                  </button>
                </div>
              </div>

              {/* Source Workspace Selection (only if Duplicate) */}
              {mode === "duplicate" && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <Label className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                    Source Intelligence Model
                  </Label>
                  <Select
                    value={sourceWorkspaceId}
                    onValueChange={(val) => val && setSourceWorkspaceId(val)}
                  >
                    <SelectTrigger className="">
                      <SelectValue placeholder="Select source model..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      {workspaces.map((ws) => (
                        <SelectItem key={ws.id} value={ws.id}>
                          {ws.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="text-[9px] font-bold text-primary/60 uppercase tracking-tighter px-2 flex items-center gap-1.5">
                    <div className="size-1 bg-primary rounded-full" />
                    Full transfer of rules and library clauses
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="bg-surface-container-high/50 p-6 sm:p-8 border-t border-outline-variant/30 sm:justify-end gap-3 sm:gap-4 flex-col sm:flex-row">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="rounded-md w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={loading}
            className="bg-primary text-primary-foreground rounded-md  transition-all w-full sm:w-auto"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin mr-2" />
            ) : (
              <Plus className="size-4 mr-2" />
            )}
            Initialize Cognitive Scope
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
