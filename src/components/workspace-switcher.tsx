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
import { WorkspaceInviteDialog } from "./settings/workspace-invite-dialog";
import { UserPlus } from "lucide-react";

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
  const [inviteDialogOpen, setInviteDialogOpen] = React.useState(false);
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
              "w-full flex items-center justify-between bg-surface-container-low border border-outline-variant/60 hover:bg-surface-container-high px-2.5 h-10 rounded-md transition-colors group",
              open && "ring-1 ring-primary/30 border-primary/40",
            )}
          >
            <div className="flex items-center gap-2 text-left overflow-hidden">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <BrainCircuit className="h-3.5 w-3.5" />
              </div>
              <div className="flex flex-col gap-0 overflow-hidden leading-tight">
                <span className="text-[10px] text-on-surface-variant truncate">
                  Wordings AI
                </span>
                <span className="truncate text-xs font-medium text-on-surface">
                  {activeWorkspace?.name || "Active workspace"}
                </span>
              </div>
            </div>
            <ChevronsUpDown className="ml-1.5 h-3.5 w-3.5 shrink-0 opacity-40 group-hover:opacity-80 transition-opacity" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[280px] p-1 rounded-lg border-outline-variant/60 shadow-xl bg-popover"
          align="start"
          sideOffset={6}
        >
          <div className="px-2.5 py-2 flex items-center justify-between">
            <span className="text-[11px] font-medium text-on-surface-variant">
              Workspaces
            </span>
            <Badge className="bg-primary/10 text-primary border-none text-[10px] font-normal px-1.5 py-0 rounded">
              {workspaces.length}
            </Badge>
          </div>
          <Command className="bg-transparent">
            <CommandInput
              placeholder="Filter workspaces…"
              className="h-8 text-xs border-none focus:ring-0"
            />
            <CommandList className="max-h-[320px] mt-1 no-scrollbar">
              <CommandEmpty className="py-6 text-center">
                <Search className="size-5 mx-auto mb-2 opacity-20" />
                <p className="text-xs text-on-surface-variant">
                  No workspace found.
                </p>
              </CommandEmpty>
              <CommandGroup className="p-0">
                {workspaces.map((workspace) => (
                  <CommandItem
                    key={workspace.id}
                    onSelect={() => handleWorkspaceChange(workspace.id)}
                    className={cn(
                      "flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer transition-colors mb-0.5",
                      activeWorkspace?.id === workspace.id
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-surface-container-high",
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-md shrink-0",
                          activeWorkspace?.id === workspace.id
                            ? "bg-primary/20 text-primary"
                            : "bg-surface-container-highest text-on-surface-variant",
                        )}
                      >
                        <LayoutGrid className="h-3 w-3" />
                      </div>
                      <div className="flex flex-col min-w-0 leading-tight">
                        <span className="text-xs font-medium truncate">
                          {workspace.name}
                        </span>
                        <span className="text-[10px] text-on-surface-variant/70 capitalize truncate">
                          {workspace.type || "general"}
                        </span>
                      </div>
                    </div>
                    {activeWorkspace?.id === workspace.id ? (
                      <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            <CommandSeparator className="my-1 bg-outline-variant/30" />
            <div className="p-0.5 space-y-0.5">
              {activeWorkspace ? (
                <button
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-primary/5 transition-colors text-left"
                  onClick={() => {
                    setOpen(false);
                    setInviteDialogOpen(true);
                  }}
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
                    <UserPlus className="h-3 w-3" />
                  </div>
                  <div className="flex flex-col leading-tight min-w-0">
                    <span className="text-xs font-medium text-on-surface truncate">
                      Invite teammates
                    </span>
                    <span className="text-[10px] text-on-surface-variant truncate">
                      Share {activeWorkspace.name}
                    </span>
                  </div>
                </button>
              ) : null}
              <button
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-primary/5 transition-colors text-left"
                onClick={handleCreateWorkspace}
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
                  <Plus className="h-3 w-3" />
                </div>
                <div className="flex flex-col leading-tight min-w-0">
                  <span className="text-xs font-medium text-on-surface truncate">
                    New workspace
                  </span>
                  <span className="text-[10px] text-on-surface-variant truncate">
                    Add another environment
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

      {activeWorkspace ? (
        <WorkspaceInviteDialog
          open={inviteDialogOpen}
          onOpenChange={setInviteDialogOpen}
          workspaceId={activeWorkspace.id}
          workspaceName={activeWorkspace.name}
        />
      ) : null}
    </>
  );
}
