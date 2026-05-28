"use client";

/**
 * "Invite to workspace" dialog. Lives on the settings page (or wherever the
 * caller drops the trigger). POSTs to /api/workspace/[id]/invite which
 * creates an invite row + emails a magic link.
 *
 * The dialog shows a single email field, a member/admin role toggle, and
 * after success surfaces the magic link so the inviter can copy/paste it
 * even if the email never arrives.
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
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, UserPlus, Copy, CheckCircle2, Users, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  workspaceName: string;
}

type Role = "member" | "admin";

export function WorkspaceInviteDialog({
  open,
  onOpenChange,
  workspaceId,
  workspaceName,
}: Props) {
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<Role>("member");
  const [loading, setLoading] = React.useState(false);
  const [acceptUrl, setAcceptUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      // Reset state when the dialog closes so the next open starts fresh.
      setEmail("");
      setRole("member");
      setAcceptUrl(null);
      setLoading(false);
    }
  }, [open]);

  const handleSubmit = async () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      toast.error("Enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/workspace/${workspaceId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || `Invite failed (${res.status})`);
      }
      setAcceptUrl(data.acceptUrl ?? null);
      toast.success(`Invitation sent to ${trimmed}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not send invitation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(95vw,560px)] sm:max-w-[min(95vw,560px)] max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-5 text-primary" />
            Invite to {workspaceName}
          </DialogTitle>
          <DialogDescription>
            Send a magic link to a teammate to give them access to this
            workspace.
          </DialogDescription>
        </DialogHeader>

        {acceptUrl ? (
          <SentState
            email={email}
            acceptUrl={acceptUrl}
            onSendAnother={() => {
              setAcceptUrl(null);
              setEmail("");
            }}
            onDone={() => onOpenChange(false)}
          />
        ) : (
          <div className="space-y-5 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="teammate@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <div className="grid grid-cols-2 gap-2">
                <RoleOption
                  active={role === "member"}
                  onClick={() => setRole("member")}
                  icon={<Users className="size-4" />}
                  title="Member"
                  subtitle="Can view + create work."
                />
                <RoleOption
                  active={role === "admin"}
                  onClick={() => setRole("admin")}
                  icon={<Crown className="size-4" />}
                  title="Admin"
                  subtitle="Can also manage workspace settings."
                />
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
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" /> Sending
                  </>
                ) : (
                  <>
                    <UserPlus className="size-4 mr-2" /> Send invite
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SentState({
  email,
  acceptUrl,
  onSendAnother,
  onDone,
}: {
  email: string;
  acceptUrl: string;
  onSendAnother: () => void;
  onDone: () => void;
}) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="space-y-4 py-1">
      <div className="flex items-center gap-2 text-emerald-500 text-sm font-medium">
        <CheckCircle2 className="size-4" />
        Invitation sent to {email}
      </div>
      <p className="text-xs text-on-surface-variant">
        If the email doesn't arrive within a minute, share this link with them
        directly:
      </p>
      <div className="flex items-stretch gap-2">
        <Input
          readOnly
          value={acceptUrl}
          className="font-mono text-xs"
          onFocus={(e) => e.currentTarget.select()}
        />
        <Button
          variant="outline"
          onClick={() => {
            navigator.clipboard.writeText(acceptUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? (
            <>
              <CheckCircle2 className="size-4 mr-1" /> Copied
            </>
          ) : (
            <>
              <Copy className="size-4 mr-1" /> Copy
            </>
          )}
        </Button>
      </div>
      <DialogFooter className="gap-2 sm:gap-2">
        <Button variant="ghost" onClick={onSendAnother}>
          Invite another
        </Button>
        <Button onClick={onDone}>Done</Button>
      </DialogFooter>
    </div>
  );
}

function RoleOption({
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
