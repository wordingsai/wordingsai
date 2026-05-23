"use client";

import * as React from "react";

type ActiveWorkspaceContext = {
  workspaceId: string;
  name: string;
  type: string;
  isGlobal: boolean;
  isMutable: boolean;
};

export function useActiveWorkspace() {
  const [data, setData] = React.useState<ActiveWorkspaceContext | null>(null);
  const [isPending, setIsPending] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const res = await fetch("/api/workspaces/active", {
          cache: "no-store",
        });
        if (!res.ok) {
          if (mounted) setData(null);
          return;
        }
        const payload = (await res.json()) as ActiveWorkspaceContext;
        if (mounted) setData(payload);
      } finally {
        if (mounted) setIsPending(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  return { data, isPending };
}
