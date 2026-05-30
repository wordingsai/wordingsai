"use client";

import React, { useState, useEffect } from "react";
import {
  User,
  Palette,
  Save,
  ChevronRight,
  AtSign,
  Building2,
  Lock,
  Loader2,
  QrCode,
  RefreshCw,
  Copy,
  CheckCircle2,
  Clock,
  TriangleAlert,
  Info,
  CreditCard,
  Sparkles,
  ExternalLink,
  Zap,
  UserPlus,
  UserMinus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { ThemeButton } from "@/components/theme-button";
import { toast } from "sonner";
import imageCompression from "browser-image-compression";
import { uploadAvatar, deleteAvatarAction } from "@/server/users";
import Link from "next/link";
import { PLAN_DEFINITIONS } from "@/lib/plans";
import { useTransitionRouter } from "next-view-transitions";
import { useRouter } from "next/navigation";
import { useCurrentPlan } from "@/hooks/use-current-plan";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
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

function OrganizationSettingsTab() {
  const router = useTransitionRouter();
  const { plan } = useCurrentPlan();
  const { data: session } = authClient.useSession();
  const { data: activeOrg } = authClient.useActiveOrganization();
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmails, setInviteEmails] = useState<string[]>([""]);
  const [inviting, setInviting] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [requestingJoin, setRequestingJoin] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [confirmOrgName, setConfirmOrgName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<any>(null);
  const [inviteByEmailInput, setInviteByEmailInput] = useState("");
  const [invitingByEmail, setInvitingByEmail] = useState(false);

  const activeMember = activeOrg?.members?.find(
    (m: any) => m.userId === session?.user?.id,
  );
  const isSuperUser =
    (activeMember?.role as string) === "su" ||
    (activeMember?.role as string) === "psa";

  const fetchMembers = async () => {
    try {
      const res = await fetch("/api/organization/members");
      const data = await res.json();
      if (res.ok) {
        setMembers(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchInviteCode = async () => {
    try {
      const res = await fetch("/api/organization/gen-invite");
      const data = await res.json();
      if (res.ok) setInviteCode(data.inviteCode);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchJoinRequests = async () => {
    if (!isSuperUser) return;
    setLoadingRequests(true);
    try {
      const res = await fetch("/api/organization/join-requests");
      const data = await res.json();
      if (res.ok) setJoinRequests(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([
        fetchMembers(),
        fetchInviteCode(),
        fetchJoinRequests(),
      ]);
      setLoading(false);
    };
    init();
  }, [isSuperUser]);

  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      const res = await fetch("/api/organization/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, newRole }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(
          `Member role updated to ${newRole === "su" ? "Super User" : "User"}`,
        );
        fetchMembers();
      } else {
        toast.error(data.error || "Failed to update role");
      }
    } catch (err: any) {
      toast.error("An error occurred");
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
        fetchJoinRequests();
        if (status === "accepted") fetchMembers();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to update request");
      }
    } catch (err) {
      toast.error("An error occurred");
    }
  };

  const handleInviteByEmail = async () => {
    const email = inviteByEmailInput.trim().toLowerCase();
    if (!email) {
      toast.error("Please enter an email address");
      return;
    }
    setInvitingByEmail(true);
    try {
      const res = await fetch("/api/organization/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Invitation sent to ${email}`);
        setInviteByEmailInput("");
      } else {
        toast.error(data.error || "Failed to send invitation");
      }
    } catch (err) {
      toast.error("An error occurred");
    } finally {
      setInvitingByEmail(false);
    }
  };

  const handleGenerateCode = async () => {
    setGeneratingCode(true);
    try {
      const res = await fetch("/api/organization/gen-invite", {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setInviteCode(data.inviteCode);
        toast.success("Invitation code generated");
      } else {
        toast.error(data.error || "Failed to generate code");
      }
    } catch (err) {
      toast.error("An error occurred");
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleLeaveOrganization = async () => {
    try {
      const res = await fetch("/api/organization/leave", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success("You have left the organization");
        router.push("/onboarding");
      } else {
        toast.error(data.error || "Failed to leave organization");
      }
    } catch (err) {
      toast.error("An error occurred");
    }
  };

  const handleDeleteOrganization = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/organization/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmName: confirmOrgName }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Organization permanently deleted.");
        router.push("/onboarding");
      } else {
        toast.error(data.error || "Failed to delete organization");
      }
    } catch (err) {
      toast.error("An error occurred");
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
      setConfirmOrgName("");
    }
  };

  return (
    <div className="space-y-8">
      {/* Organization Identity Card */}
      <Card className="bg-gradient-to-br from-surface-container-low to-surface-container-highest border-outline-variant rounded-xl shadow-sm overflow-hidden text-left border-2 border-primary/10">
        <CardHeader className="p-8 border-b border-outline-variant bg-primary/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-6">
            <Avatar className="h-20 w-20 rounded-lg border-4 border-background shadow-xl shrink-0">
              <AvatarImage
                src={activeOrg?.logo ?? undefined}
                alt={activeOrg?.name}
              />
              <AvatarFallback className="text-lg font-semibold bg-primary/10 text-primary">
                {activeOrg?.name?.charAt(0).toUpperCase() || "O"}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-xl font-semibold text-on-surface tracking-tight flex items-center gap-3">
                <Building2 className="w-8 h-8 text-primary animate-pulse" />{" "}
                {activeOrg?.name || "Corporate Workspace"}
              </CardTitle>
              <CardDescription className="font-bold text-primary uppercase text-xs tracking-widest mt-1">
                Active Corporate Workspace
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0 bg-surface-container-high/50 px-5 py-3 rounded-2xl border border-outline-variant/30">
            <span className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">
              Intelligence Scope
            </span>
            <span className="text-xs font-semibold uppercase text-primary tracking-widest flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 fill-primary text-primary" />{" "}
              {plan || "FAST"} Plan
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-10 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 bg-surface-container-low border border-outline-variant/30 rounded-3xl space-y-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant/60 block">
                Workspace Name
              </span>
              <span className="text-sm font-semibold text-on-surface truncate block uppercase">
                {activeOrg?.name || "Corporate Workspace"}
              </span>
            </div>
            <div className="p-6 bg-surface-container-low border border-outline-variant/30 rounded-3xl space-y-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant/60 block">
                Active Member Seats
              </span>
              <span className="text-sm font-semibold text-primary block uppercase">
                {members.length}{" "}
                {members.length === 1 ? "Active User" : "Active Users"}
              </span>
            </div>
            <div className="p-6 bg-surface-container-low border border-outline-variant/30 rounded-3xl space-y-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant/60 block">
                Establishment Date
              </span>
              <span className="text-sm font-bold text-on-surface block">
                {activeOrg?.createdAt
                  ? new Date(activeOrg.createdAt).toLocaleDateString(
                      undefined,
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      },
                    )
                  : "N/A"}
              </span>
            </div>
          </div>
          <div className="p-6 bg-primary/5 border border-primary/20 rounded-3xl">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                  Workspace Statement
                </span>
                <p className="text-sm font-medium text-on-surface-variant">
                  This workspace holds all corporate reinsurance treaties, risk
                  guidelines, rules configurations, and scanned slips. All
                  changes and member seat additions made here apply across the
                  organization's entire neural engine boundary.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {isSuperUser && (
        <>
          {/* Invitation Code Management */}
          <Card className="bg-surface-container-low border-outline-variant rounded-xl shadow-sm overflow-hidden text-left border-2 border-primary/20">
            <CardHeader className="p-8 border-b border-outline-variant bg-primary/5">
              <CardTitle className="text-base font-semibold text-on-surface">
                Organization Invite Code
              </CardTitle>
              <CardDescription className="font-medium text-on-surface-variant">
                Share this code with people you want to join your team. They
                will appear in the requests list below.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex-1 w-full min-w-0">
                {inviteCode ? (
                  <div className="flex items-center gap-4 bg-surface-container-highest/20 p-6 rounded-3xl border-2 border-outline-variant">
                    <span className="text-xl font-semibold tracking-wide text-primary family-mono uppercase truncate">
                      {inviteCode}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(inviteCode);
                        toast.success("Code copied to clipboard");
                      }}
                      className="h-12 w-12 rounded-2xl hover:bg-primary/10 shrink-0"
                    >
                      <Copy className="w-5 h-5" />
                    </Button>
                  </div>
                ) : (
                  <div className="text-on-surface-variant font-medium opacity-50 italic">
                    No active invitation code. Generate one to allow users to
                    request joining.
                  </div>
                )}
              </div>
              <Button
                size="lg"
                onClick={handleGenerateCode}
                disabled={generatingCode}
                className="shrink-0 gap-2"
              >
                {generatingCode ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <RefreshCw className="size-4" />
                    {inviteCode ? "Regenerate code" : "Generate invite code"}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Invite Member by Email */}
          <Card className="bg-surface-container-low border-outline-variant rounded-xl shadow-sm overflow-hidden text-left border-2 border-primary/10">
            <CardHeader className="p-8 border-b border-outline-variant bg-primary/5">
              <CardTitle className="text-base font-semibold text-on-surface flex items-center gap-3">
                <UserPlus className="w-5 h-5 text-primary" /> Invite Member by Email
              </CardTitle>
              <CardDescription className="font-medium text-on-surface-variant">
                Send a direct invitation email with a unique invite code. The recipient goes to /onboarding/join and enters the code.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 md:p-10">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                  <Input
                    type="email"
                    value={inviteByEmailInput}
                    onChange={(e) => setInviteByEmailInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleInviteByEmail(); }}
                    placeholder="teammate@company.com"
                    className="pl-10 h-12 rounded-xl border-outline-variant font-medium"
                  />
                </div>
                <Button
                  size="lg"
                  onClick={handleInviteByEmail}
                  disabled={invitingByEmail || !inviteByEmailInput.trim()}
                  className="shrink-0 gap-2 rounded-xl"
                >
                  {invitingByEmail ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      <UserPlus className="size-4" />
                      Send Invitation
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Pending Join Requests */}
          <Card className="bg-surface-container-low border-outline-variant rounded-xl shadow-sm overflow-hidden text-left">
            <CardHeader className="p-8 border-b border-outline-variant bg-amber-50 dark:bg-amber-950/20">
              <CardTitle className="text-base font-semibold text-on-surface flex items-center gap-3">
                <Clock className="w-6 h-6 text-amber-500" /> Pending Join
                Requests
              </CardTitle>
              <CardDescription className="font-medium text-on-surface-variant">
                Users who have used your invite code and are waiting for
                approval.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 md:p-10 space-y-6">
              {loadingRequests ? (
                <div className="text-center py-10 opacity-50 font-semibold uppercase tracking-widest text-sm">
                  Loading Requests...
                </div>
              ) : joinRequests.length === 0 ? (
                <div className="text-center py-10 text-on-surface-variant opacity-50 flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-2xl bg-surface-container flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <span className="font-semibold uppercase tracking-widest text-xs">
                    All caught up! No pending requests.
                  </span>
                </div>
              ) : (
                joinRequests.map((req) => (
                  <ContextMenu key={req.id}>
                    <ContextMenuTrigger>
                      <div className="flex flex-col md:flex-row gap-4 items-center justify-between p-6 bg-surface-container-highest/20 rounded-3xl border border-outline-variant/30 hover:bg-surface-container-highest/40 transition-colors">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-12 w-12 rounded-2xl">
                            <AvatarImage src={req.user.image ?? undefined} />
                            <AvatarFallback className="font-semibold bg-primary/10 text-primary">
                              {req.user.name?.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h3 className="font-semibold text-on-surface">
                              {req.user.name}
                            </h3>
                            <p className="text-xs font-medium text-on-surface-variant">
                              {req.user.email}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() =>
                              handleRequestAction(req.id, "accepted")
                            }
                            className="h-10 px-4 rounded-xl bg-primary text-primary-foreground font-semibold uppercase text-[10px] tracking-widest shadow-lg shadow-primary/10"
                          >
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() =>
                              handleRequestAction(req.id, "rejected")
                            }
                            className="h-10 px-4 rounded-xl border-destructive/20 text-destructive font-semibold uppercase text-[10px] tracking-widest hover:bg-destructive/10"
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-56 rounded-2xl p-2 shadow-2xl border-outline-variant">
                      <ContextMenuItem
                        className="rounded-xl font-bold h-12 uppercase text-[11px] tracking-widest cursor-pointer text-emerald-600 focus:text-emerald-600"
                        onClick={() => handleRequestAction(req.id, "accepted")}
                      >
                        <UserPlus className="mr-2 size-4" />
                        Accept Request
                      </ContextMenuItem>
                      <ContextMenuItem
                        className="rounded-xl font-bold h-12 uppercase text-[11px] tracking-widest cursor-pointer text-destructive focus:text-destructive"
                        onClick={() => handleRequestAction(req.id, "rejected")}
                      >
                        <UserMinus className="mr-2 size-4" />
                        Reject Request
                      </ContextMenuItem>
                      <ContextMenuSeparator className="my-2" />
                      <ContextMenuItem
                        className="rounded-xl font-bold h-12 uppercase text-[11px] tracking-widest cursor-pointer"
                        onClick={() => {
                          navigator.clipboard.writeText(req.user.email);
                          toast.success("Email copied");
                        }}
                      >
                        <Copy className="mr-2 size-4" />
                        Copy Email
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Card className="bg-surface-container-low border-outline-variant rounded-xl shadow-sm overflow-hidden text-left">
        <CardHeader className="p-8 border-b border-outline-variant bg-surface-container-highest/10">
          <CardTitle className="text-base font-semibold text-on-surface">
            Organization Members
          </CardTitle>
          <CardDescription className="font-medium text-on-surface-variant">
            Manage organization seats and access levels.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 md:p-10 space-y-6">
          {loading ? (
            <div className="text-center text-on-surface-variant opacity-50 py-10 font-bold uppercase tracking-widest text-sm">
              Loading Members...
            </div>
          ) : (
            members.map((m) => (
              <ContextMenu key={m.id}>
                <ContextMenuTrigger>
                  <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between p-6 bg-surface-container-highest/20 rounded-3xl border border-outline-variant/30 transition-all hover:bg-surface-container-highest/40">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12 rounded-2xl border-2 border-background shadow-md">
                        <AvatarImage src={m.user.image ?? undefined} />
                        <AvatarFallback className="font-semibold bg-primary/10 text-primary">
                          {m.user.name?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold text-on-surface tracking-tight">
                          {m.user.name}{" "}
                          {session?.user?.id === m.user.id && "(You)"}
                        </h3>
                        <p className="text-xs font-medium text-on-surface-variant">
                          {m.user.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-xs font-medium uppercase tracking-wider px-3 py-1 rounded-full bg-surface-container border border-outline-variant">
                        {m.role === "su"
                          ? "Super User (SU)"
                          : m.role === "u"
                            ? "User (U)"
                            : m.role}
                      </div>

                      {isSuperUser && (
                        <div className="flex items-center gap-2">
                          {m.role === "su" ? (
                            <Button
                              variant="outline"
                              className="rounded-xl font-bold uppercase tracking-widest text-[10px] h-8 px-3 text-destructive border-destructive/20 hover:bg-destructive/10"
                              onClick={() => handleRoleChange(m.id, "u")}
                            >
                              Demote
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              className="rounded-xl font-bold uppercase tracking-widest text-[10px] h-8 px-3 text-primary border-primary/20 hover:bg-primary/10"
                              onClick={() => handleRoleChange(m.id, "su")}
                            >
                              Promote
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent className="w-56 rounded-2xl p-2 shadow-2xl border-outline-variant">
                  {isSuperUser && (
                    <>
                      {m.role === "su" ? (
                        <ContextMenuItem
                          className="rounded-xl font-bold h-12 uppercase text-[11px] tracking-widest cursor-pointer text-amber-600 focus:text-amber-600"
                          onClick={() => handleRoleChange(m.id, "u")}
                        >
                          <UserMinus className="mr-2 size-4" />
                          Demote to User
                        </ContextMenuItem>
                      ) : (
                        <ContextMenuItem
                          className="rounded-xl font-bold h-12 uppercase text-[11px] tracking-widest cursor-pointer text-primary focus:text-primary"
                          onClick={() => handleRoleChange(m.id, "su")}
                        >
                          <UserPlus className="mr-2 size-4" />
                          Promote to Super User
                        </ContextMenuItem>
                      )}
                      <ContextMenuSeparator className="my-2" />
                    </>
                  )}
                  <ContextMenuItem
                    className="rounded-xl font-bold h-12 uppercase text-[11px] tracking-widest cursor-pointer"
                    onClick={() => {
                      navigator.clipboard.writeText(m.user.email);
                      toast.success("Email copied");
                    }}
                  >
                    <Copy className="mr-2 size-4" />
                    Copy Email Address
                  </ContextMenuItem>
                  {isSuperUser && m.user.id !== session?.user?.id && (
                    <>
                      <ContextMenuSeparator className="my-2" />
                      <ContextMenuItem
                        className="rounded-xl font-bold h-12 uppercase text-[11px] tracking-widest cursor-pointer text-destructive focus:text-destructive"
                        onClick={() => setMemberToDelete(m)}
                      >
                        <Trash2 className="mr-2 size-4" />
                        Remove Member
                      </ContextMenuItem>
                    </>
                  )}
                </ContextMenuContent>
              </ContextMenu>
            ))
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="bg-destructive/5 border-destructive/20 rounded-xl shadow-sm overflow-hidden text-left border-2">
        <CardHeader className="p-8 border-b border-destructive/20 bg-destructive/5">
          <CardTitle className="text-xl font-semibold uppercase text-destructive flex items-center gap-2">
            <TriangleAlert className="w-5 h-5" /> Danger Zone
          </CardTitle>
          <CardDescription className="font-medium text-destructive/70">
            Irreversible actions related to your organization membership.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 md:p-10 space-y-6">
          {/* Leave Organization */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 rounded-2xl border border-destructive/10 bg-destructive/5">
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-on-surface uppercase tracking-tight text-sm">
                Leave Organization
              </h4>
              <p className="text-xs font-medium text-on-surface-variant max-w-md">
                You will lose access to all contracts, rules, and rulesets
                associated with this organization.
              </p>
            </div>
            <Button
              onClick={() => setShowLeaveDialog(true)}
              variant="destructive"
              className="rounded-md shrink-0"
            >
              Leave Organization
            </Button>
          </div>

          {/* Delete Organization — super users only */}
          {isSuperUser && (
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 rounded-2xl border-2 border-destructive/30 bg-destructive/10">
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-destructive uppercase tracking-tight text-sm flex items-center gap-2">
                  <Trash2 className="w-4 h-4" /> Delete Organization
                </h4>
                <p className="text-xs font-medium text-on-surface-variant max-w-md mt-1">
                  Permanently delete this organization and all its data —
                  contracts, rules, clause libraries, and members. This cannot
                  be undone.
                </p>
              </div>
              <Button
                onClick={() => {
                  setConfirmOrgName("");
                  setShowDeleteDialog(true);
                }}
                variant="destructive"
                className="rounded-md shrink-0 bg-destructive hover:bg-destructive/80"
              >
                Delete Organization
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Leave Dialog */}
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent className="rounded-xl p-10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-semibold tracking-tight">
              Are you absolutely sure?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-lg font-medium leading-relaxed">
              This will permanently remove your access to this organization. You
              will no longer be able to view its contracts, rules, or
              collaborate with its members.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-10 gap-4">
            <AlertDialogCancel className="rounded-md border-outline-variant">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeaveOrganization}
              className="rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-xl shadow-destructive/20"
            >
              Confirm Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Member Dialog */}
      <AlertDialog
        open={!!memberToDelete}
        onOpenChange={(open) => {
          if (!open) setMemberToDelete(null);
        }}
      >
        <AlertDialogContent className="rounded-xl p-10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-semibold tracking-tight text-destructive flex items-center gap-3">
              <Trash2 className="w-7 h-7" /> Remove Member
            </AlertDialogTitle>
            <AlertDialogDescription className="text-lg font-medium leading-relaxed">
              Are you sure you want to remove{" "}
              <strong>
                {memberToDelete?.user.name || memberToDelete?.user.email}
              </strong>{" "}
              from the organization? They will lose access to all resources.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-10 gap-4">
            <AlertDialogCancel className="rounded-md border-outline-variant">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!memberToDelete) return;
                try {
                  const { error } = await authClient.organization.removeMember({
                    memberIdOrEmail: memberToDelete.user.email,
                  });
                  if (error) {
                    toast.error(error.message || "Failed to remove member");
                  } else {
                    toast.success("Member removed successfully");
                    window.location.reload();
                  }
                } catch (err) {
                  toast.error("An error occurred");
                } finally {
                  setMemberToDelete(null);
                }
              }}
              className="rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-xl shadow-destructive/20"
            >
              Confirm Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Organization Dialog */}
      <AlertDialog
        open={showDeleteDialog}
        onOpenChange={(open) => {
          setShowDeleteDialog(open);
          if (!open) setConfirmOrgName("");
        }}
      >
        <AlertDialogContent className="rounded-xl p-10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-semibold tracking-tight text-destructive flex items-center gap-3">
              <TriangleAlert className="w-7 h-7" /> Delete Organization
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-0">
              <span className="text-base font-medium leading-relaxed block">
                This will <strong>permanently delete</strong> the entire
                organization, including all contracts, rules, clause libraries,
                members, and workspaces. This action{" "}
                <strong>cannot be undone</strong>.
              </span>
            </AlertDialogDescription>
            <div className="mt-4 space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-widest text-destructive">
                Type your organization name to confirm
              </Label>
              <div className="font-mono text-sm bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-2 text-destructive font-bold">
                {activeOrg?.name}
              </div>
              <Input
                value={confirmOrgName}
                onChange={(e) => setConfirmOrgName(e.target.value)}
                placeholder="Type organization name here..."
                className="h-12 rounded-xl border-outline-variant font-medium"
              />
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 gap-4">
            <AlertDialogCancel
              onClick={() => setConfirmOrgName("")}
              className="rounded-md border-outline-variant"
            >
              Cancel
            </AlertDialogCancel>
            <Button
              onClick={handleDeleteOrganization}
              disabled={
                confirmOrgName.trim() !== activeOrg?.name?.trim() || deleting
              }
              className="rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-xl shadow-destructive/20 disabled:opacity-40"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>Delete Forever</>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SubscriptionSettingsTab() {
  const { plan, refresh } = useCurrentPlan();
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("status") === "success") {
      refresh();
    }
  }, []);

  const handleSelectPlan = async (planId: string) => {
    if (planId === plan) return;
    if (planId === "enterprise") {
      window.location.href =
        "mailto:wordings.ai.uk@gmail.com?subject=Enterprise%20Plan%20Inquiry";
      return;
    }
    setLoadingPlan(planId);
    try {
      const res = await fetch("/api/subscription/select-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to select plan");
        return;
      }
      toast.success(`Plan updated to ${planId}`, {
        description: "Your plan has been activated.",
      });
      await refresh();
      // Force a full page reload so all layouts and routes refresh cleanly with the new plan's state
      window.location.reload();
    } catch (err) {
      toast.error("An error occurred");
    } finally {
      setLoadingPlan(null);
    }
  };

  const isPlus = plan === "plus";

  return (
    <div className="space-y-8">
      <Card className="bg-surface-container-low border-outline-variant rounded-xl shadow-sm overflow-hidden text-left">
        <CardHeader className="p-8 border-b border-outline-variant bg-primary/5">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-on-surface flex items-center gap-3">
                <CreditCard className="w-6 h-6 text-primary" /> Current Plan
              </CardTitle>
              <CardDescription className="font-medium text-on-surface-variant">
                Your organization is currently on the{" "}
                <strong className="text-primary uppercase">{plan}</strong> plan.
              </CardDescription>
            </div>
            <div
              className={cn(
                "px-4 py-2 rounded-full text-xs font-medium uppercase tracking-wider border-2",
                isPlus
                  ? "bg-primary/10 border-primary text-primary shadow-lg shadow-primary/10"
                  : "bg-surface-container border-outline-variant text-on-surface-variant",
              )}
            >
              {(plan as string) === "enterprise"
                ? "Enterprise"
                : plan === "plus"
                  ? "Intelligence Plus"
                  : plan === "basic"
                    ? "Intelligence"
                    : "Intelligence Fast"}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-10 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PLAN_DEFINITIONS.map((p) => {
              const isCurrent = plan === p.id;
              const isPlus = p.id === "plus";
              const isEnterprise = p.id === "enterprise";

              return (
                <div
                  key={p.id}
                  className={cn(
                    "p-6 rounded-lg border-2 transition-all relative flex flex-col justify-between overflow-hidden",
                    isCurrent
                      ? "border-primary bg-primary/5 shadow-xl"
                      : "border-outline-variant bg-surface-container-lowest hover:border-primary/40",
                  )}
                >
                  <div>
                    {isCurrent && (
                      <div className="absolute top-4 right-4 bg-primary text-primary-foreground px-3 py-1 rounded-full text-[8px] font-semibold tracking-widest uppercase">
                        ACTIVE
                      </div>
                    )}
                    <h3 className="font-semibold uppercase tracking-tight text-lg mb-2 flex items-center gap-2">
                      {p.name}{" "}
                      {isPlus && <Sparkles className="w-4 h-4 text-primary" />}
                    </h3>
                    <p className="text-xs font-medium text-on-surface-variant mb-4">
                      {p.description}
                    </p>
                    <div className="flex items-baseline gap-1 mb-6">
                      <span className="text-lg font-semibold text-on-surface">
                        {isEnterprise ? "Custom" : "Trial"}
                      </span>
                    </div>
                    <ul className="space-y-3 mb-8">
                      {p.features.map((f) => (
                        <li
                          key={f}
                          className="flex items-center gap-2 text-[11px] font-bold"
                        >
                          <CheckCircle2 className="w-4 h-4 text-primary" /> {f}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {isCurrent ? (
                    <Button
                      variant="outline"
                      className="w-full h-12 rounded-xl text-xs font-medium uppercase tracking-wider border-primary/20 cursor-default"
                      disabled
                    >
                      ✓ CURRENT PLAN
                    </Button>
                  ) : isEnterprise ? (
                    <Link
                      href="mailto:wordings.ai.uk@gmail.com?subject=Enterprise%20Plan%20Inquiry"
                      className="w-full"
                    >
                      <Button className="w-full h-12 rounded-xl text-xs font-medium uppercase tracking-wider bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                        CONTACT US
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      onClick={() => handleSelectPlan(p.id)}
                      disabled={loadingPlan !== null}
                      className="w-full h-12 rounded-xl text-xs font-medium uppercase tracking-wider bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                    >
                      {loadingPlan === p.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "SELECT"
                      )}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {!isPlus && (
        <Card className="bg-primary/5 border-primary/20 rounded-xl shadow-sm overflow-hidden text-left border-2">
          <CardContent className="p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-primary/10 rounded-2xl">
                <Zap className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold text-on-surface uppercase tracking-tight">
                  Unlock Premium Features
                </h4>
                <p className="text-xs font-medium text-on-surface-variant max-w-sm">
                  Get full access to Clause Library and Custom Rules to
                  streamline your contract vetting process.
                </p>
              </div>
            </div>
            <Link href="/upgrade">
              <Button className="rounded-md bg-primary text-primary-foreground shadow-xl shadow-primary/20 flex items-center gap-2">
                GO PREMIUM <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { data: session } = authClient.useSession();
  const [activeTab, setActiveTab] = useState("profile");
  const [name, setName] = useState("");
  const [image, setImage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (session?.user) {
      setName(session.user.name || "");
      setImage(session.user.image || "");
    }
  }, [session?.user]);

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (
      tab &&
      [
        "profile",
        "subscription",
        "organization",
        "security",
        "appearance",
      ].includes(tab)
    ) {
      setActiveTab(tab);
    }
  }, []);

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "subscription", label: "Subscription", icon: CreditCard },
    { id: "organization", label: "Organization", icon: Building2 },
    { id: "security", label: "Security", icon: Lock },
    { id: "appearance", label: "Appearance", icon: Palette },
  ];

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Options for compression - updated to 1MB
      const options = {
        maxSizeMB: 1.0,
        maxWidthOrHeight: 1200,
        useWebWorker: true,
      };

      const compressedFile = await imageCompression(file, options);

      // Send to server action
      const formData = new FormData();
      formData.append("file", compressedFile);

      const newUrl = await uploadAvatar(formData);
      setImage(newUrl);
      toast.success("Profile photo updated!");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAvatar = async () => {
    setUploading(true);
    try {
      await deleteAvatarAction();
      setImage("");
      toast.success("Profile photo removed!");
    } catch (error: any) {
      toast.error("Failed to remove photo");
    } finally {
      setUploading(false);
    }
  };

  const handleSaveChanges = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/user/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, image }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success("Profile updated successfully!");
        // Refresh session to show new name/image
        window.location.reload();
      } else {
        throw new Error(data.error || "Failed to save changes");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  if (!session?.user) return null;

  return (
    <div className="flex-1 p-4 md:p-8 lg:p-10 bg-background transition-colors duration-300">
      <div className="max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-on-surface">
            Account Settings
          </h1>
          <p className="text-sm text-on-surface-variant mt-1.5">
            Manage your personal identity, organization preferences, and
            security.
          </p>
        </div>

        <div className="grid grid-cols-12 gap-6 lg:gap-8">
          {/* Navigation Sidebar */}
          <div className="col-span-12 lg:col-span-3 space-y-0.5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-md transition-colors text-sm font-medium",
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground"
                    : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
                )}
              >
                <div className="flex items-center gap-2.5">
                  <tab.icon className="size-4" />
                  {tab.label}
                </div>
                <ChevronRight
                  className={cn(
                    "size-3.5 opacity-60",
                    activeTab === tab.id ? "opacity-100" : "",
                  )}
                />
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="col-span-12 lg:col-span-9">
            {activeTab === "profile" && (
              <Card className="bg-surface-container-low border-outline-variant rounded-xl overflow-hidden text-left">
                <CardHeader className="p-5 border-b border-outline-variant bg-surface-container-highest/10">
                  <CardTitle className="text-base font-semibold text-on-surface">
                    Profile
                  </CardTitle>
                  <CardDescription className="text-sm text-on-surface-variant">
                    Update your public profile and how wordings appear under
                    your name.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 space-y-6">
                  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center p-4 bg-surface-container-highest/20 rounded-lg border border-outline-variant/30">
                    <Avatar className="h-16 w-16 rounded-lg border border-outline-variant/40">
                      <AvatarImage src={image ?? undefined} />
                      <AvatarFallback className="text-base font-medium bg-primary/10 text-primary">
                        {name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-on-surface">
                        Profile picture
                      </h3>
                      <div className="flex gap-2">
                        <input
                          type="file"
                          ref={fileInputRef}
                          className="hidden"
                          accept="image/*"
                          onChange={handleImageUpload}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={uploading}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          {uploading ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            "Change image"
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={uploading}
                          onClick={handleDeleteAvatar}
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <Label
                        htmlFor="name"
                        className="text-xs font-medium uppercase tracking-wider text-on-surface-variant ml-1"
                      >
                        Full Name
                      </Label>
                      <div className="relative group">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant group-focus-within:text-primary transition-colors" />
                        <Input
                          id="name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="h-14 pl-12 bg-surface-container-low border-outline-variant rounded-2xl font-bold text-on-surface"
                        />
                      </div>
                    </div>
                    <div className="space-y-3 opacity-60">
                      <Label
                        htmlFor="email"
                        className="text-xs font-medium uppercase tracking-wider text-on-surface-variant ml-1"
                      >
                        Email Address
                      </Label>
                      <div className="relative">
                        <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                        <Input
                          id="email"
                          defaultValue={session.user.email}
                          disabled
                          className="h-14 pl-12 bg-surface-container-highest/50 border-outline-variant rounded-2xl font-bold italic"
                        />
                      </div>
                      <p className="text-[10px] text-on-surface-variant font-medium ml-1">
                        Contact administrators to change your email.
                      </p>
                    </div>
                  </div>

                  <div className="pt-8 border-t border-outline-variant flex justify-end">
                    <Button
                      onClick={handleSaveChanges}
                      disabled={saving}
                      className="bg-primary text-primary-foreground rounded-md flex items-center gap-2  transition-all"
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      SAVE CHANGES
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === "appearance" && (
              <Card className="bg-surface-container-low border-outline-variant rounded-xl shadow-sm overflow-hidden text-left">
                <CardHeader className="p-8 border-b border-outline-variant bg-surface-container-highest/10">
                  <CardTitle className="text-base font-semibold text-on-surface">
                    Visual Appearance
                  </CardTitle>
                  <CardDescription className="font-medium text-on-surface-variant">
                    Customize the design and theme of your workspace.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-10 space-y-10">
                  <div className="flex items-center justify-between p-8 bg-surface-container-highest/20 rounded-3xl border border-outline-variant/30">
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold text-on-surface uppercase tracking-tight">
                        Main Theme
                      </h3>
                      <p className="text-sm font-medium text-on-surface-variant">
                        Switch between light and dark modes.
                      </p>
                    </div>
                    <div className="scale-125">
                      <ThemeButton />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === "organization" && <OrganizationSettingsTab />}

            {activeTab === "subscription" && <SubscriptionSettingsTab />}

            {activeTab === "security" && (
              <Card className="bg-surface-container-low border-outline-variant rounded-xl shadow-sm overflow-hidden text-left">
                <CardHeader className="p-8 border-b border-outline-variant bg-surface-container-highest/10">
                  <CardTitle className="text-base font-semibold text-on-surface">
                    Security & Privacy
                  </CardTitle>
                  <CardDescription className="font-medium text-on-surface-variant">
                    Manage your account protection and sign-in methods.
                  </CardDescription>
                </CardHeader>
                <Link href="/reset-password">
                  <CardContent className="p-6 md:p-10 space-y-8">
                    <div className="flex items-center justify-between p-6 bg-surface-container-highest/10 rounded-2xl border border-outline-variant/20 group hover:border-primary/30 transition-all cursor-pointer">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-xl group-hover:bg-primary transition-colors">
                          <Lock className="w-5 h-5 text-primary group-hover:text-white" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-on-surface uppercase tracking-tight">
                            Reset Password
                          </h4>
                          <p className="text-xs font-medium text-on-surface-variant">
                            Securely update your login credentials.
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-on-surface-variant" />
                    </div>
                  </CardContent>
                </Link>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
