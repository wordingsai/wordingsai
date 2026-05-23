"use client";

import { authClient } from "@/lib/auth-client";
import { useEffect, useMemo, useState } from "react";

export type OrganizationPlan = "fast" | "basic" | "plus";

export function useCurrentPlan() {
  const { data: activeOrg, refetch: refetchOrg } =
    authClient.useActiveOrganization();
  const { data: session } = authClient.useSession();

  const [serverPlan, setServerPlan] = useState<OrganizationPlan | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isPending, setIsPending] = useState(true);
  const [hasFetched, setHasFetched] = useState(false);

  // On client mount, mark as hydrated
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Extract plan from session first (more reliable than activeOrg during hydration)
  const sessionPlan = useMemo(() => {
    return (
      (((session as any)?.session?.activeOrganizationPlan ??
        (session as any)?.activeOrganizationPlan) as
        | OrganizationPlan
        | undefined) ?? null
    );
  }, [session]);

  // Extract plan from activeOrg as secondary source
  const orgPlan = useMemo(() => {
    return (
      (((activeOrg as any)?.plan ?? (activeOrg as any)?.organization?.plan) as
        | OrganizationPlan
        | undefined) ?? null
    );
  }, [activeOrg]);

  // Fetch plan from server and keep it in sync
  const fetchPlan = async (cancelled = false) => {
    try {
      setIsPending(true);
      const res = await fetch("/api/subscription", { cache: "no-store" });
      if (!res.ok) {
        setHasFetched(true);
        return;
      }
      const data = (await res.json()) as { plan?: OrganizationPlan };
      if (
        !cancelled &&
        (data.plan === "fast" || data.plan === "basic" || data.plan === "plus")
      ) {
        setServerPlan(data.plan);
      }
      setHasFetched(true);
    } catch (e) {
      setHasFetched(true);
    } finally {
      if (!cancelled) setIsPending(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetchPlan(cancelled);

    const handlePlanUpdated = () => {
      if (!cancelled) {
        fetchPlan(false);
      }
    };

    window.addEventListener("plan-updated", handlePlanUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener("plan-updated", handlePlanUpdated);
    };
  }, []);

  // Plan priority:
  // 1. If we have server plan from API, use it (most authoritative)
  // 2. Otherwise use session plan (from better-auth, should be fresh)
  // 3. Otherwise use org plan (from activeOrg query)
  // 4. Default to "basic"
  const plan: OrganizationPlan = serverPlan ?? sessionPlan ?? orgPlan ?? "fast";

  const isLoading = isPending || (!hasFetched && !sessionPlan && !orgPlan);

  const refresh = async () => {
    setIsPending(true);
    setServerPlan(null);
    setHasFetched(false);
    // Trigger better-auth refresh + then refresh DB-backed plan.
    await authClient.organization.list();
    // Refetch the active organization to get latest plan
    await refetchOrg();
    try {
      const res = await fetch("/api/subscription", { cache: "no-store" });
      if (!res.ok) {
        setHasFetched(true);
        return;
      }
      const data = (await res.json()) as { plan?: OrganizationPlan };
      if (
        data.plan === "fast" ||
        data.plan === "basic" ||
        data.plan === "plus"
      ) {
        setServerPlan(data.plan);
        // Notify other instances of useCurrentPlan (e.g. AppSidebar) to refetch immediately
        window.dispatchEvent(new Event("plan-updated"));
      }
      setHasFetched(true);
    } catch (e) {
      setHasFetched(true);
    } finally {
      setIsPending(false);
    }
  };

  return { plan, isPending: isLoading, refresh };
}
