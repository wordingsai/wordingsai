"use client";

import * as React from "react";
import {
  Check,
  ChevronsUpDown,
  Plus,
  LayoutGrid,
  BrainCircuit,
  Search,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { getWorkspaces } from "@/server/workspaces";
import { Badge } from "@/components/ui/badge";
import { useCurrentPlan } from "@/hooks/use-current-plan";
import { CreateWorkspaceDialog } from "./contracts/create-workspace-dialog";

type Workspace = {
  id: string;
  name: string;
  type: string;
  isGlobal: boolean;
};

export function WorkspaceSwitcher() {
  const { data: session } = authClient.useSession();
  const { data: activeOrg } = authClient.useActiveOrganization();
  const { plan: currentPlan } = useCurrentPlan();
  const [open, setOpen] = React.useState(false);
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [workspaces, setWorkspaces] = React.useState<Workspace[]>([]);
  const router = useRouter();

  React.useEffect(() => {
    async function loadWorkspaces() {
      if (activeOrg?.id) {
        try {
          const res = await getWorkspaces(activeOrg.id);
          setWorkspaces(res);
        } catch (error) {
          console.error("Failed to load workspaces", error);
        }
      }
    }
    loadWorkspaces();
  }, [activeOrg?.id]);

  const sessionWorkspaceId = (
    session?.session as { activeWorkspaceId?: string } | undefined
  )?.activeWorkspaceId;
  const activeWorkspace =
    workspaces.find((w) => w.id === sessionWorkspaceId) ||
    workspaces.find((w) => w.name === "Reinsurance") ||
    workspaces?.[0];

  const handleWorkspaceChange = async (workspaceId: string) => {
    if (workspaceId === activeWorkspace?.id) {
      setOpen(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/set-workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });

      if (!res.ok) throw new Error("Failed to switch workspace");

      toast.success("Workspace switched");
      setOpen(false);

      // Force a full router refresh to re-sync server-side session/workspace data
      router.refresh();
      // Optionally reload the page for a guaranteed sync if refresh is not enough
      window.location.reload();
    } catch {
      toast.error("Error switching workspace");
    }
  };

  const handleCreateWorkspace = () => {
    if (currentPlan !== "plus") {
      toast.error("Upgrade to Plus plan to create workspaces");
      return;
    }
    setOpen(false); // Close switcher popover
    setCreateDialogOpen(true);
  };

  if (!activeOrg) return null;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "w-full flex items-center justify-between bg-surface-container-low border border-outline-variant hover:bg-surface-container-high px-3 h-16 rounded-[1.25rem] transition-all duration-300 shadow-sm group",
              open &&
                "ring-2 ring-primary/20 border-primary/50 bg-surface-container-high",
            )}
          >
            <div className="flex items-center gap-3 text-left overflow-hidden">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform duration-300">
                <BrainCircuit className="h-5 w-5" />
              </div>
              <div className="flex flex-col gap-0.5 overflow-hidden">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-black uppercase tracking-tight text-on-surface">
                    Wordings AI
                  </span>
                  <span className="text-on-surface-variant/40 font-bold text-[10px]">
                    —
                  </span>
                </div>
                <span className="truncate font-black text-[11px] uppercase tracking-widest text-primary">
                  {activeWorkspace?.name || "Active Workspace"}
                </span>
              </div>
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-30 group-hover:opacity-100 transition-opacity" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[300px] p-2 rounded-[2rem] border-outline-variant shadow-[0_32px_64px_-12px_rgba(0,0,0,0.4)] bg-popover"
          align="start"
          sideOffset={12}
        >
          <div className="px-4 py-4 mb-2 border-b border-outline-variant/30 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-on-surface-variant/60">
                Cognitive Scope
              </span>
              <p className="text-xs font-black text-on-surface uppercase tracking-tight">
                Active Environments
              </p>
            </div>
            <Badge className="bg-primary/10 text-primary border-none text-[8px] font-black uppercase tracking-tighter">
              {workspaces.length} Scopes
            </Badge>
          </div>
          <Command className="bg-transparent">
            <CommandInput
              placeholder="Filter environments..."
              className="h-11 text-[11px] font-black uppercase tracking-widest border-none focus:ring-0"
            />
            <CommandList className="max-h-[350px] mt-2 no-scrollbar">
              <CommandEmpty className="py-12 text-center">
                <Search className="size-8 mx-auto mb-3 opacity-10" />
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/40">
                  No matching scope found.
                </p>
              </CommandEmpty>
              <CommandGroup>
                {workspaces.map((workspace) => (
                  <CommandItem
                    key={workspace.id}
                    onSelect={() => handleWorkspaceChange(workspace.id)}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all duration-300 mb-1.5",
                      activeWorkspace?.id === workspace.id
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]"
                        : "hover:bg-primary/10 hover:text-primary",
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-300",
                          activeWorkspace?.id === workspace.id
                            ? "bg-white/20"
                            : "bg-surface-container-highest group-hover:bg-primary/10",
                        )}
                      >
                        <LayoutGrid className="h-5 w-5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[11px] font-black uppercase tracking-widest">
                          {workspace.name}
                        </span>
                        <span
                          className={cn(
                            "text-[9px] font-bold uppercase",
                            activeWorkspace?.id === workspace.id
                              ? "text-white/60"
                              : "text-on-surface-variant/40",
                          )}
                        >
                          {workspace.type || "General"} Engine
                        </span>
                      </div>
                    </div>
                    {activeWorkspace?.id === workspace.id ? (
                      <Check className="h-4 w-4 text-white animate-in zoom-in duration-300" />
                    ) : (
                      <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-40 transition-all -translate-x-2 group-hover:translate-x-0" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            <CommandSeparator className="my-3 bg-outline-variant/30" />
            <div className="p-1">
              <button
                className="w-full flex items-center gap-3 p-4 rounded-2xl cursor-pointer text-primary hover:bg-primary/5 transition-all duration-300 group"
                onClick={handleCreateWorkspace}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                  <Plus className="h-5 w-5" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[11px] font-black uppercase tracking-widest">
                    New Intelligence Scope
                  </span>
                  <span className="text-[9px] font-bold uppercase text-primary/40">
                    Expand Platform Capacity
                  </span>
                </div>
              </button>
            </div>
          </Command>
        </PopoverContent>
      </Popover>

      <CreateWorkspaceDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        workspaces={workspaces}
        activeOrgId={activeOrg.id}
      />
    </>
  );
}
