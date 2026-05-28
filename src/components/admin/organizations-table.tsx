"use client";

import React, { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export function OrganizationsTable({
  orgs,
}: {
  orgs: Array<{
    id: string;
    name: string;
    slug: string;
    plan: string;
    memberCount: number;
    contractCount: number;
    createdAt: string;
  }>;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orgs;
    return orgs.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.slug.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q),
    );
  }, [orgs, search]);

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-low overflow-hidden">
      <div className="px-4 py-3 border-b border-outline-variant flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, slug, or id"
            className="pl-9 bg-background"
          />
        </div>
        <div className="text-xs text-on-surface-variant">
          {filtered.length} of {orgs.length}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-container-highest/30 border-b border-outline-variant">
            <tr className="text-left">
              <Th>Organization</Th>
              <Th>Slug</Th>
              <Th>Plan</Th>
              <Th className="text-center">Members</Th>
              <Th className="text-center">Contracts</Th>
              <Th>Created</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/40">
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-sm text-on-surface-variant"
                >
                  No organizations match your search.
                </td>
              </tr>
            ) : (
              filtered.map((o) => (
                <tr
                  key={o.id}
                  className="hover:bg-surface-container transition-colors"
                >
                  <Td>
                    <div className="font-medium text-on-surface">{o.name}</div>
                    <div className="text-xs text-on-surface-variant/70 font-mono mt-0.5">
                      {o.id.slice(0, 12)}…
                    </div>
                  </Td>
                  <Td>
                    <code className="text-xs text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded">
                      {o.slug}
                    </code>
                  </Td>
                  <Td>
                    <PlanBadge plan={o.plan} />
                  </Td>
                  <Td className="text-center">
                    <span className="inline-block bg-surface-container-highest rounded-full px-2 py-0.5 text-xs font-medium">
                      {o.memberCount}
                    </span>
                  </Td>
                  <Td className="text-center text-on-surface-variant">
                    {o.contractCount}
                  </Td>
                  <Td className="text-on-surface-variant">{o.createdAt}</Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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

function PlanBadge({ plan }: { plan: string }) {
  const isPlus = plan === "plus";
  return (
    <Badge
      variant="outline"
      className={
        isPlus
          ? "border-primary/30 bg-primary/10 text-primary text-[10px] font-medium uppercase tracking-wider"
          : "border-outline-variant bg-surface-container text-on-surface-variant text-[10px] font-medium uppercase tracking-wider"
      }
    >
      {plan}
    </Badge>
  );
}
