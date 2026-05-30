"use client";

import {
  BadgeCheck,
  Bell,
  ChevronsUpDown,
  CreditCard,
  LogOut,
  Sparkles,
  Settings,
  ShieldCheck,
  Zap,
  Plus,
  Shield,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import * as React from "react";
import Link from "next/link";
import { useCurrentPlan } from "@/hooks/use-current-plan";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function NavUser({
  user,
}: {
  user: {
    name: string;
    email: string;
    avatar: string | null;
  } | null;
}) {
  const { isMobile } = useSidebar();
  const router = useRouter();
  const [showLogoutDialog, setShowLogoutDialog] = React.useState(false);
  const { plan, isPending } = useCurrentPlan();
  const [sessions, setSessions] = React.useState<any[]>([]);
  const { data: sessionData } = authClient.useSession();
  // Role is not in the Better Auth session payload — fetch it from /api/me
  // so we can conditionally surface the Admin panel link to psa users only.
  // The /admin layout enforces the gate server-side; this is purely UX.
  const [role, setRole] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!sessionData?.user?.id) return;
    let cancelled = false;
    fetch("/api/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.role) setRole(d.role);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [sessionData?.user?.id]);

  React.useEffect(() => {
    async function loadSessions() {
      try {
        const { data, error } =
          await authClient.multiSession.listDeviceSessions();
        if (data && sessionData?.user?.id) {
          // Filter to unique users to avoid showing duplicate accounts
          const uniqueSessions = data.reduce((acc: any[], current: any) => {
            const exists = acc.find((item) => item.user.id === current.user.id);
            if (!exists) {
              return acc.concat([current]);
            }
            return acc;
          }, []);

          // Hide current user
          const otherAccounts = uniqueSessions.filter(
            (s) => s.user.id !== sessionData.user.id,
          );
          setSessions(otherAccounts);
        }
      } catch (error) {
        console.error("Failed to load sessions", error);
      }
    }
    if (sessionData?.user?.id) {
      loadSessions();
    }
  }, [sessionData?.user?.id]);

  const handleSwitchSession = async (sessionToken: string) => {
    try {
      await authClient.multiSession.setActive({ sessionToken });
      // Use window.location.href to force a full reload and cookie flush
      window.location.href = "/dashboard";
    } catch (error) {
      toast.error("Failed to switch account");
    }
  };

  const handleLogout = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/login");
        },
      },
    });
  };

  if (!user || isPending) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <div className="flex items-center gap-3 px-3 py-2 animate-pulse">
            <div className="h-8 w-8 rounded-lg bg-surface-container-highest"></div>
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-24 rounded bg-surface-container-highest"></div>
              <div className="h-2 w-32 rounded bg-surface-container-highest"></div>
            </div>
          </div>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground transition-all duration-300 hover:bg-surface-container-highest/50 group h-14"
              >
                <Avatar className="h-9 w-9 rounded-xl shadow-sm group-hover:scale-105 transition-transform border border-outline-variant/30">
                  <AvatarImage src={user.avatar ?? undefined} alt={user.name} />
                  <AvatarFallback className="rounded-xl bg-primary/10 text-primary font-semibold uppercase text-xs">
                    {user.name?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight ml-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-semibold uppercase text-[11px] tracking-tight text-on-surface">
                      {user.name}
                    </span>
                    <Badge
                      className={cn(
                        "h-4 px-1.5 text-[8px] font-semibold uppercase tracking-tighter border-none",
                        plan === "plus"
                          ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                          : plan === "basic"
                            ? "bg-blue-600 text-white shadow-sm"
                            : "bg-amber-600 text-white shadow-sm",
                      )}
                    >
                      {plan === "plus"
                        ? "Plus"
                        : plan === "basic"
                          ? "Intelligence"
                          : plan === "fast"
                            ? "Fast"
                            : plan}
                    </Badge>
                  </div>
                  <span className="truncate text-[10px] font-medium text-on-surface-variant/70">
                    {user.email}
                  </span>
                </div>
                <ChevronsUpDown className="ml-auto size-4 text-on-surface-variant/50 group-hover:text-primary transition-colors" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-[--radix-dropdown-menu-trigger-width] min-w-64 rounded-lg p-3 border-outline-variant shadow-[0_32px_64px_-12px_rgba(0,0,0,0.4)] bg-popover"
              side={isMobile ? "bottom" : "right"}
              align="end"
              sideOffset={4}
            >
              <DropdownMenuGroup>
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-3 px-2 py-3 text-left">
                    <Avatar className="h-10 w-10 rounded-xl border border-outline-variant/30">
                      <AvatarImage
                        src={user.avatar ?? undefined}
                        alt={user.name}
                      />
                      <AvatarFallback className="rounded-xl bg-primary/10 text-primary font-semibold">
                        {user.name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold uppercase text-xs tracking-tight">
                          {user.name}
                        </span>
                        {plan === "plus" && (
                          <ShieldCheck className="size-3.5 text-primary" />
                        )}
                      </div>
                      <span className="truncate text-[10px] font-medium text-muted-foreground">
                        {user.email}
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator className="my-2 opacity-50" />
              <DropdownMenuGroup className="space-y-1">
                {plan !== "plus" && (
                  <Link href="/upgrade">
                    <DropdownMenuItem className="rounded-2xl text-xs font-medium uppercase tracking-[0.1em] py-3 cursor-pointer bg-primary/5 text-primary hover:bg-primary/10 transition-colors focus:bg-primary/10 focus:text-primary group">
                      <Sparkles className="mr-2 size-4 group-hover:animate-pulse" />
                      Upgrade to plus scope
                    </DropdownMenuItem>
                  </Link>
                )}
                <div className="px-2 py-2">
                  <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant/40">
                    Intelligence Level
                  </span>
                  <div className="mt-2 flex items-center justify-between p-2 rounded-xl bg-surface-container-low border border-outline-variant/20">
                    <div className="flex items-center gap-2">
                      <Zap
                        className={cn(
                          "size-3",
                          plan === "plus"
                            ? "text-primary"
                            : "text-on-surface-variant/40",
                        )}
                      />
                      <span className="text-xs font-medium uppercase tracking-wider">
                        {plan === "plus"
                          ? "Plus"
                          : plan === "basic"
                            ? "Intelligence"
                            : plan === "fast"
                              ? "Fast"
                              : plan}{" "}
                        engine
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[8px] font-bold border-outline-variant/30"
                    >
                      Active
                    </Badge>
                  </div>
                </div>
              </DropdownMenuGroup>
              <DropdownMenuSeparator className="my-2 opacity-50" />
              <DropdownMenuGroup className="space-y-1">
                <Link href="/settings">
                  <DropdownMenuItem className="cursor-pointer">
                    <BadgeCheck className="mr-2 size-4 opacity-60" />
                    Account settings
                  </DropdownMenuItem>
                </Link>
                <Link href="/settings?tab=subscription">
                  <DropdownMenuItem className="cursor-pointer">
                    <CreditCard className="mr-2 size-4 opacity-60" />
                    Billing & usage
                  </DropdownMenuItem>
                </Link>
                {role === "psa" ? (
                  <Link href="/admin">
                    <DropdownMenuItem className="cursor-pointer text-primary hover:bg-primary/5 focus:bg-primary/5 focus:text-primary">
                      <Shield className="mr-2 size-4" />
                      Admin panel
                    </DropdownMenuItem>
                  </Link>
                ) : null}
              </DropdownMenuGroup>
              <DropdownMenuSeparator className="my-2 opacity-50" />
              <DropdownMenuGroup className="space-y-1">
                <DropdownMenuLabel className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-on-surface-variant/50">
                  Switch Login
                </DropdownMenuLabel>
                {sessions.map((s) => (
                  <DropdownMenuItem
                    key={s.session.id}
                    className="cursor-pointer flex items-center gap-2.5"
                    onClick={() =>
                      handleSwitchSession(
                        s.session.token || s.session.sessionToken,
                      )
                    }
                  >
                    <div className="relative size-6 shrink-0">
                      <Avatar className="h-6 w-6 rounded-md border border-outline-variant">
                        <AvatarImage src={s.user.image || s.user.avatar} />
                        <AvatarFallback className="text-[10px] font-medium bg-primary/10 text-primary">
                          {s.user.name?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-sm text-on-surface truncate">
                        {s.user.name || "User"}
                      </span>
                      <span className="text-[11px] text-on-surface-variant/70 truncate">
                        {s.user.email}
                      </span>
                    </div>
                  </DropdownMenuItem>
                ))}
                <Link href="/add-account">
                  <DropdownMenuItem className="cursor-pointer text-primary hover:bg-primary/5 focus:bg-primary/5 focus:text-primary">
                    <Plus className="mr-2 size-4" />
                    Sign in with another account
                  </DropdownMenuItem>
                </Link>
              </DropdownMenuGroup>
              <DropdownMenuSeparator className="my-2 opacity-50" />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive cursor-pointer"
                onClick={() => setShowLogoutDialog(true)}
              >
                <LogOut className="mr-2 size-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent className="border-outline-variant">
          <AlertDialogHeader>
            <div className="size-10 bg-destructive/10 rounded-lg flex items-center justify-center mb-3">
              <LogOut className="size-5 text-destructive" />
            </div>
            <AlertDialogTitle className="text-base font-semibold tracking-tight">
              Sign out?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-on-surface-variant pt-1">
              You'll need to sign in again to access your workspace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogout}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sign out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
