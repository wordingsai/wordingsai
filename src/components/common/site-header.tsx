"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import {
  Search,
  Bell,
  User,
  LogOut,
  Settings,
  Sparkles,
  BrainCircuit,
  FileText,
  Activity,
} from "lucide-react";
import { ThemeButton } from "@/components/theme-button";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, X as CloseIcon, ArrowUpRight } from "lucide-react";
import { CommandMenu } from "../command-menu";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export function SiteHeader() {
  const { data: session } = authClient.useSession();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [generalNotifications, setGeneralNotifications] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: activeOrg } = authClient.useActiveOrganization();
  const currentMember = activeOrg?.members?.find(
    (m: any) => m.userId === session?.user?.id,
  );
  const isSU =
    (currentMember?.role as string) === "su" ||
    (currentMember?.role as string) === "psa";

  const handleLogout = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = "/login";
        },
      },
    });
  };

  const fetchNotificationsData = async () => {
    setLoading(true);
    try {
      const promises = [
        fetch("/api/activity").then((r) => r.json()),
        fetch("/api/notifications").then((r) => r.json()),
      ];
      if (isSU) {
        promises.push(
          fetch("/api/organization/join-requests").then((r) => r.json()),
        );
      }

      const results = await Promise.all(promises);
      setActivities(results[0] || []);
      setGeneralNotifications(results[1] || []);
      if (isSU) setNotifications(results[2] || []);
    } catch (err) {
      console.error("Failed to fetch notifications", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user) {
      fetchNotificationsData();
    }
  }, [session?.user, isSU]);

  useEffect(() => {
    async function loadSessions() {
      try {
        const { data, error } =
          await authClient.multiSession.listDeviceSessions();
        if (data && session?.user?.id) {
          const uniqueSessions = data.reduce((acc: any[], current: any) => {
            const exists = acc.find((item) => item.user.id === current.user.id);
            if (!exists) {
              return acc.concat([current]);
            }
            return acc;
          }, []);

          const otherAccounts = uniqueSessions.filter(
            (s) => s.user.id !== session.user.id,
          );
          setSessions(otherAccounts);
        }
      } catch (error) {
        console.error("Failed to load sessions", error);
      }
    }
    if (session?.user?.id) {
      loadSessions();
    }
  }, [session?.user?.id]);

  const handleSwitchSession = async (sessionToken: string) => {
    try {
      await authClient.multiSession.setActive({ sessionToken });
      window.location.href = "/dashboard";
    } catch (error) {
      toast.error("Failed to switch account");
    }
  };

  const handleClearAll = async () => {
    try {
      const res = await fetch("/api/notifications", {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("All notifications cleared");
        fetchNotificationsData();
      }
    } catch (err) {
      toast.error("Failed to clear notifications");
    }
  };

  const handleRequestAction = async (
    requestId: string,
    status: "accepted" | "rejected",
  ) => {
    try {
      const res = await fetch("/api/organization/join-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, status }),
      });
      if (res.ok) {
        toast.success(`Request ${status}`);
        fetchNotificationsData();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to update request");
      }
    } catch (err) {
      toast.error("An error occurred");
    }
  };

  const totalNotifs =
    notifications.length +
    generalNotifications.length +
    activities.slice(0, 5).length;

  return (
    <header className="flex shrink-0 items-center py-4 border-b transition-[width,height] ease-linear bg-background/80 backdrop-blur-md sticky top-0 z-30">
      <div className="flex w-full items-center gap-4 px-4 lg:px-6">
        <SidebarTrigger className="-ml-1" />

        <Separator
          orientation="vertical"
          className="data-[orientation=vertical]:h-8"
        />

        {activeOrg?.name && (
          <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-surface-container-low border border-outline-variant/40 shadow-sm shrink-0">
            <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-on-surface truncate max-w-[160px]">
              {activeOrg.name}
            </span>
          </div>
        )}

        <div className="flex-1 flex items-center justify-center max-w-4xl mx-auto px-4">
          <div className="w-full max-w-md">
            <CommandMenu />
          </div>
        </div>

        <div className="flex items-center gap-2 lg:gap-4 shrink-0">
          <Popover onOpenChange={(open) => open && fetchNotificationsData()}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0 relative rounded-xl border-outline-variant hover:bg-surface-container-highest transition-all duration-300"
              >
                <Bell className="h-5 w-5 text-on-surface-variant" />
                {totalNotifs > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[8px] font-semibold text-primary-foreground shadow-lg shadow-primary/20">
                    {totalNotifs}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[380px] p-0 rounded-lg overflow-hidden border-outline-variant shadow-[0_32px_64px_-12px_rgba(0,0,0,0.4)] bg-popover"
              align="end"
              sideOffset={12}
            >
              <div className="bg-surface-container-highest/10 p-6 border-b border-outline-variant flex justify-between items-center">
                <div className="space-y-0.5">
                  <h3 className="font-semibold uppercase tracking-[0.25em] text-[10px] text-on-surface-variant/60">
                    Neural Updates
                  </h3>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-on-surface uppercase tracking-tight">
                      System Feed
                    </p>
                    {totalNotifs > 0 && (
                      <button
                        onClick={handleClearAll}
                        className="text-[9px] font-semibold text-primary uppercase tracking-widest hover:underline ml-2"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                </div>
                {(notifications.length > 0 ||
                  generalNotifications.length > 0) && (
                  <Badge className="bg-primary/10 text-primary border-none rounded-lg font-semibold text-[9px] uppercase tracking-widest">
                    {notifications.length + generalNotifications.length} New
                  </Badge>
                )}
              </div>

              <div className="max-h-[450px] overflow-y-auto no-scrollbar">
                {loading ? (
                  <div className="p-6 space-y-4">
                    <Skeleton className="h-20 w-full rounded-2xl" />
                    <Skeleton className="h-20 w-full rounded-2xl" />
                  </div>
                ) : totalNotifs === 0 ? (
                  <div className="p-12 text-center">
                    <div className="size-16 bg-surface-container rounded-[1.5rem] flex items-center justify-center mx-auto mb-4 opacity-20">
                      <Bell className="w-8 h-8 text-on-surface-variant" />
                    </div>
                    <p className="text-xs font-medium uppercase tracking-wider text-on-surface-variant/50">
                      No new transmissions detected.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-outline-variant/30">
                    {/* General Notifications Section */}
                    {Array.isArray(generalNotifications) &&
                      generalNotifications.map((notif) => (
                        <div
                          key={notif.id}
                          className="p-6 hover:bg-surface-container/50 transition-colors group"
                        >
                          <div className="flex gap-4">
                            <div
                              className={cn(
                                "size-12 rounded-2xl flex items-center justify-center shrink-0 shadow-md transition-colors",
                                notif.type === "error"
                                  ? "bg-red-500/10 text-red-500"
                                  : notif.type === "warning"
                                    ? "bg-amber-500/10 text-amber-500"
                                    : notif.type === "success"
                                      ? "bg-emerald-500/10 text-emerald-500"
                                      : "bg-primary/10 text-primary",
                              )}
                            >
                              <Bell className="w-6 h-6" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start mb-1">
                                <p className="text-[11px] font-semibold text-on-surface uppercase tracking-tight truncate">
                                  {notif.title}
                                </p>
                                <span className="text-[9px] font-bold text-on-surface-variant/40 uppercase whitespace-nowrap ml-2">
                                  {formatDistanceToNow(
                                    new Date(notif.createdAt),
                                    { addSuffix: false },
                                  )}
                                </span>
                              </div>
                              <p className="text-xs font-medium text-on-surface-variant leading-relaxed">
                                {notif.message}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}

                    {/* Join Requests Section */}
                    {Array.isArray(notifications) &&
                      notifications.map((notif) => (
                        <div
                          key={notif.id}
                          className="p-6 hover:bg-surface-container/50 transition-colors group"
                        >
                          <div className="flex gap-4">
                            <Avatar className="h-12 w-12 rounded-2xl shadow-md">
                              <AvatarImage
                                src={notif.user.image ?? undefined}
                              />
                              <AvatarFallback className="font-semibold bg-primary/10 text-primary uppercase">
                                {notif.user.name?.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start mb-1">
                                <p className="text-[11px] font-semibold text-on-surface uppercase tracking-tight truncate">
                                  {notif.user.name}
                                </p>
                                <span className="text-[9px] font-bold text-on-surface-variant/40 uppercase">
                                  Request
                                </span>
                              </div>
                              <p className="text-xs font-medium text-on-surface-variant mb-4 leading-relaxed">
                                Join request for {activeOrg?.name} organization.
                              </p>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  className="h-9 px-4 rounded-xl bg-primary text-xs font-medium uppercase tracking-wider shadow-lg shadow-primary/10"
                                  onClick={() =>
                                    handleRequestAction(notif.id, "accepted")
                                  }
                                >
                                  <Check className="w-3 h-3 mr-1.5" /> Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-9 px-4 rounded-xl text-xs font-medium uppercase tracking-wider border-outline-variant hover:bg-destructive hover:text-white hover:border-destructive transition-all"
                                  onClick={() =>
                                    handleRequestAction(notif.id, "rejected")
                                  }
                                >
                                  <CloseIcon className="w-3 h-3 mr-1.5" />{" "}
                                  Decline
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}

                    {/* Activities Section */}
                    {activities.slice(0, 8).map((activity) => (
                      <div
                        key={activity.id}
                        className="p-6 hover:bg-surface-container/50 transition-colors group cursor-pointer"
                        onClick={() => {
                          const url =
                            activity.type === "contract"
                              ? `/contracts/${activity.id}`
                              : activity.type === "rule"
                                ? "/rules"
                                : "/clause-library";
                          window.location.href = url;
                        }}
                      >
                        <div className="flex gap-4">
                          <div
                            className={cn(
                              "h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-105",
                              activity.type === "contract"
                                ? "bg-emerald-500/10 text-emerald-500"
                                : activity.type === "rule"
                                  ? "bg-primary/10 text-primary"
                                  : "bg-amber-500/10 text-amber-500",
                            )}
                          >
                            {activity.type === "contract" ? (
                              <FileText className="w-6 h-6" />
                            ) : activity.type === "rule" ? (
                              <BrainCircuit className="w-6 h-6" />
                            ) : (
                              <Sparkles className="w-6 h-6" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-1">
                              <p className="text-[11px] font-semibold text-on-surface uppercase tracking-tight truncate">
                                {activity.title}
                              </p>
                              <span className="text-[9px] font-bold text-on-surface-variant/40 uppercase whitespace-nowrap ml-2">
                                {formatDistanceToNow(
                                  new Date(activity.updatedAt),
                                  { addSuffix: false },
                                )}
                              </span>
                            </div>
                            <p className="text-xs font-medium text-on-surface-variant leading-relaxed">
                              {activity.action} {activity.type} detection
                              complete.
                            </p>
                          </div>
                          <ArrowUpRight className="size-4 text-on-surface-variant/20 group-hover:text-primary transition-colors mt-1" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 bg-surface-container-highest/10 border-t border-outline-variant text-center">
                <Link
                  href="/dashboard"
                  className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary hover:underline flex items-center justify-center gap-2"
                >
                  Access Neural Hub <ArrowUpRight className="size-3" />
                </Link>
              </div>
            </PopoverContent>
          </Popover>

          <ThemeButton />

          <Separator orientation="vertical" className="h-8 hidden sm:block" />

          {!mounted || !session ? (
            <div className="h-10 w-10 rounded-full animate-pulse bg-muted shrink-0" />
          ) : session.user ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "relative h-11 w-11 shrink-0 rounded-2xl border border-outline-variant p-0 overflow-hidden hover:border-primary/50 transition-all",
                )}
              >
                <Avatar className="h-full w-full rounded-none">
                  <AvatarImage
                    src={session.user.image ?? undefined}
                    alt={session.user.name || ""}
                  />
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold uppercase">
                    {session.user.name?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-64 rounded-[1.5rem] p-2 mt-2"
                align="end"
                sideOffset={8}
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-3 px-3 py-3 bg-surface-container-highest/10 rounded-xl mb-2">
                      <Avatar className="h-10 w-10 rounded-lg">
                        <AvatarImage src={session.user.image ?? undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                          {session.user.name?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-tight text-on-surface truncate">
                          {session.user.name}
                        </p>
                        <p className="text-[10px] font-medium text-on-surface-variant/70 truncate">
                          {session.user.email}
                        </p>
                        {activeOrg?.name && (
                          <p className="text-[10px] font-medium uppercase tracking-wider text-primary truncate mt-1">
                            {activeOrg.name}
                          </p>
                        )}
                      </div>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                {sessions.length > 0 && (
                  <DropdownMenuGroup className="space-y-1">
                    <DropdownMenuLabel className="px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant/40">
                      Switch Account
                    </DropdownMenuLabel>
                    {sessions.map((s) => (
                      <DropdownMenuItem
                        key={s.session.id}
                        className="cursor-pointer rounded-xl h-12 text-xs font-medium uppercase tracking-wider flex items-center gap-3"
                        onClick={() =>
                          handleSwitchSession(
                            s.session.token || s.session.sessionToken,
                          )
                        }
                      >
                        <Avatar className="h-6 w-6 rounded-lg">
                          <AvatarImage src={s.user.image} />
                          <AvatarFallback className="text-[10px] font-semibold bg-primary/10 text-primary">
                            {s.user.name?.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="font-semibold text-on-surface truncate normal-case">
                            {s.user.name || "User"}
                          </span>
                          <span className="text-[9px] text-on-surface-variant/70 truncate lowercase tracking-normal font-medium">
                            {s.user.email}
                          </span>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                )}
                <DropdownMenuSeparator className="my-2 opacity-30" />
                <DropdownMenuItem
                  className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10 rounded-xl h-12 text-xs font-medium uppercase tracking-wider"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-3 h-4 w-4" />
                  <span>Terminate Session</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={() => (window.location.href = "/login")}
              className="rounded-xl text-xs font-medium uppercase tracking-wider"
            >
              Sign In
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
