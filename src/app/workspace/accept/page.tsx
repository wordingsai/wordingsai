"use client";

/**
 * /workspace/accept?token=...
 *
 * Landing page hit from the invitation email. Reads the token from the URL,
 * calls /api/workspace/accept-invite, and routes the user into the
 * workspace on success or shows a clear error otherwise.
 *
 * If the user isn't signed in we bounce them through /login with a redirect
 * back here so the magic link "just works" both for existing accounts and
 * for first-time users (who'll sign up, log in, and land back here).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2, AlertCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export default function WorkspaceAcceptPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const { data: session, isPending: sessionPending } = authClient.useSession();

  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "ok"; workspaceName: string; workspaceId: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  useEffect(() => {
    if (sessionPending) return;
    if (!token) {
      setState({
        kind: "error",
        message:
          "This link is missing its invitation token. Please use the link in your email.",
      });
      return;
    }
    if (!session?.user) return; // wait for login redirect

    let cancelled = false;
    (async () => {
      setState({ kind: "loading" });
      try {
        const res = await fetch("/api/workspace/accept-invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setState({
            kind: "error",
            message: data?.error || "Could not accept this invitation",
          });
          return;
        }
        setState({
          kind: "ok",
          workspaceName: data.workspaceName,
          workspaceId: data.workspaceId,
        });
      } catch (e: any) {
        if (cancelled) return;
        setState({
          kind: "error",
          message: e?.message || "Could not accept this invitation",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, session?.user, sessionPending]);

  // Not logged in -> bounce to /login and come back here.
  useEffect(() => {
    if (sessionPending) return;
    if (!session?.user && token) {
      const redirect = encodeURIComponent(`/workspace/accept?token=${token}`);
      router.replace(`/login?redirect=${redirect}`);
    }
  }, [session?.user, sessionPending, token, router]);

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md rounded-2xl border border-outline-variant/40 bg-surface-container-low p-8 space-y-5">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Mail className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              Workspace invitation
            </h1>
            <p className="text-xs text-on-surface-variant">
              Joining via WordingsAI
            </p>
          </div>
        </div>

        {state.kind === "loading" || state.kind === "idle" ? (
          <div className="flex items-center gap-3 text-sm text-on-surface-variant py-6">
            <Loader2 className="size-4 animate-spin" />
            {sessionPending
              ? "Verifying your session…"
              : !session?.user
                ? "Redirecting you to sign in…"
                : "Accepting your invitation…"}
          </div>
        ) : null}

        {state.kind === "ok" ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-500 text-sm font-medium">
              <CheckCircle2 className="size-4" />
              You're in!
            </div>
            <p className="text-sm text-on-surface">
              You've joined the{" "}
              <span className="font-semibold">{state.workspaceName}</span>{" "}
              workspace.
            </p>
            <div className="flex gap-2">
              <Link href="/contracts">
                <Button>Open workspace</Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="ghost">Dashboard</Button>
              </Link>
            </div>
          </div>
        ) : null}

        {state.kind === "error" ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2 text-rose-500 text-sm">
              <AlertCircle className="size-4 mt-0.5 shrink-0" />
              <span>{state.message}</span>
            </div>
            <div className="flex gap-2">
              <Link href="/dashboard">
                <Button variant="ghost">Back to dashboard</Button>
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
