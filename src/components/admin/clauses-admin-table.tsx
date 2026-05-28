"use client";

import React, { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Scope = "global" | "org" | "user" | "orphan";

type Row = {
  id: string;
  name: string;
  category: string;
  status: string;
  approvalStatus: string;
  library: string;
  code: string | null;
  scope: Scope;
  orgName: string | null;
  ownerEmail: string | null;
  createdAt: string;
};

export function ClausesAdminTable({ items }: { items: Row[] }) {
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState<"all" | Scope>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((c) => {
      if (scopeFilter !== "all" && c.scope !== scopeFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.library.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        (c.code ?? "").toLowerCase().includes(q) ||
        (c.orgName ?? "").toLowerCase().includes(q) ||
        (c.ownerEmail ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, search, scopeFilter]);

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-low overflow-hidden">
      <div className="px-4 py-3 border-b border-outline-variant flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, library, code, org, or owner"
            className="pl-9 bg-background"
          />
        </div>
        <div className="flex gap-1 p-1 bg-surface-container rounded-md text-xs">
          {(["all", "global", "org", "user", "orphan"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScopeFilter(s)}
              className={`px-2.5 py-1 rounded-sm font-medium uppercase tracking-wider transition-colors ${
                scopeFilter === s
                  ? "bg-primary text-primary-foreground"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="text-xs text-on-surface-variant">
          {filtered.length} of {items.length}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-container-highest/30 border-b border-outline-variant">
            <tr className="text-left">
              <Th>Clause</Th>
              <Th>Category</Th>
              <Th>Library</Th>
              <Th>Scope</Th>
              <Th>Owner / Org</Th>
              <Th>Status</Th>
              <Th>Created</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/40">
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-sm text-on-surface-variant"
                >
                  No clauses match your filters.
                </td>
              </tr>
            ) : (
              filtered.slice(0, 250).map((c) => (
                <tr
                  key={c.id}
                  className="hover:bg-surface-container transition-colors"
                >
                  <Td>
                    <div className="font-medium text-on-surface line-clamp-1">
                      {c.name}
                    </div>
                    {c.code ? (
                      <div className="text-[10px] text-on-surface-variant/70 font-mono mt-0.5">
                        {c.code}
                      </div>
                    ) : null}
                  </Td>
                  <Td>
                    <span className="text-xs text-on-surface-variant">
                      {c.category}
                    </span>
                  </Td>
                  <Td className="text-on-surface-variant">{c.library}</Td>
                  <Td>
                    <ScopeBadge scope={c.scope} />
                  </Td>
                  <Td>
                    {c.scope === "user" ? (
                      <span className="text-xs text-on-surface-variant">
                        {c.ownerEmail ?? "—"}
                      </span>
                    ) : c.orgName ? (
                      <span className="text-xs text-on-surface-variant">
                        {c.orgName}
                      </span>
                    ) : (
                      <span className="text-xs text-on-surface-variant/60">
                        —
                      </span>
                    )}
                  </Td>
                  <Td>
                    <StatusBadge status={c.approvalStatus || c.status} />
                  </Td>
                  <Td className="text-on-surface-variant">{c.createdAt}</Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {filtered.length > 250 ? (
          <div className="px-4 py-3 text-xs text-on-surface-variant text-center border-t border-outline-variant">
            Showing first 250 of {filtered.length} matches. Refine your search
            to see more.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}

function ScopeBadge({ scope }: { scope: Scope }) {
  const map: Record<Scope, { label: string; cls: string }> = {
    global: {
      label: "Global",
      cls: "border-primary/30 bg-primary/10 text-primary",
    },
    org: {
      label: "Org-shared",
      cls: "border-secondary/30 bg-secondary/10 text-secondary",
    },
    user: {
      label: "User-private",
      cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
    },
    orphan: {
      label: "Orphan",
      cls: "border-destructive/30 bg-destructive/10 text-destructive",
    },
  };
  const m = map[scope];
  return (
    <Badge
      variant="outline"
      className={`text-[10px] font-medium uppercase tracking-wider ${m.cls}`}
    >
      {m.label}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isApproved = status === "Approved";
  return (
    <Badge
      variant="outline"
      className={`text-[10px] font-medium uppercase tracking-wider ${
        isApproved
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
          : "border-amber-500/30 bg-amber-500/10 text-amber-500"
      }`}
    >
      {status}
    </Badge>
  );
}
