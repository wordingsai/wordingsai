"use client";

import React, { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Row = {
  id: string;
  name: string;
  category: string;
  status: string;
  approvalStatus: string;
  orgName: string | null;
  createdAt: string;
};

export function RulesAdminTable({ items }: { items: Row[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        (r.orgName ?? "").toLowerCase().includes(q),
    );
  }, [items, search]);

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-low overflow-hidden">
      <div className="px-4 py-3 border-b border-outline-variant flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, category, or org"
            className="pl-9 bg-background"
          />
        </div>
        <div className="text-xs text-on-surface-variant">
          {filtered.length} of {items.length}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-container-highest/30 border-b border-outline-variant">
            <tr className="text-left">
              <Th>Rule</Th>
              <Th>Category</Th>
              <Th>Organization</Th>
              <Th>Approval</Th>
              <Th>Created</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/40">
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-sm text-on-surface-variant"
                >
                  No rules match your search.
                </td>
              </tr>
            ) : (
              filtered.slice(0, 250).map((r) => (
                <tr
                  key={r.id}
                  className="hover:bg-surface-container transition-colors"
                >
                  <Td>
                    <div className="font-medium text-on-surface line-clamp-1">
                      {r.name}
                    </div>
                  </Td>
                  <Td className="text-on-surface-variant text-xs">
                    {r.category}
                  </Td>
                  <Td className="text-on-surface-variant">
                    {r.orgName ?? "—"}
                  </Td>
                  <Td>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-medium uppercase tracking-wider ${
                        r.approvalStatus === "Approved"
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                          : "border-amber-500/30 bg-amber-500/10 text-amber-500"
                      }`}
                    >
                      {r.approvalStatus}
                    </Badge>
                  </Td>
                  <Td className="text-on-surface-variant">{r.createdAt}</Td>
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
