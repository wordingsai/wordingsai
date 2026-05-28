"use client";

import React, { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type Row = {
  id: string;
  email: string;
  name: string;
  role: string;
  emailVerified: boolean;
  primaryOrgName: string | null;
  membershipCount: number;
  createdAt: string;
};

export function UsersTable({ users }: { users: Row[] }) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "su" | "psa" | "u">(
    "all",
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (!q) return true;
      return (
        u.email.toLowerCase().includes(q) ||
        u.name.toLowerCase().includes(q) ||
        (u.primaryOrgName ?? "").toLowerCase().includes(q)
      );
    });
  }, [users, search, roleFilter]);

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-low overflow-hidden">
      <div className="px-4 py-3 border-b border-outline-variant flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or org"
            className="pl-9 bg-background"
          />
        </div>
        <div className="flex gap-1 p-1 bg-surface-container rounded-md text-xs">
          {(["all", "su", "psa", "u"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-2.5 py-1 rounded-sm font-medium uppercase tracking-wider transition-colors ${
                roleFilter === r
                  ? "bg-primary text-primary-foreground"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="text-xs text-on-surface-variant">
          {filtered.length} of {users.length}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-container-highest/30 border-b border-outline-variant">
            <tr className="text-left">
              <Th>User</Th>
              <Th>Email</Th>
              <Th>Role</Th>
              <Th>Primary organization</Th>
              <Th className="text-center">Memberships</Th>
              <Th>Joined</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/40">
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-sm text-on-surface-variant"
                >
                  No users match your filters.
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr
                  key={u.id}
                  className="hover:bg-surface-container transition-colors"
                >
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <Avatar className="size-7 rounded-md">
                        <AvatarFallback className="text-[11px] font-medium bg-primary/10 text-primary">
                          {(u.name || u.email).charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="font-medium text-on-surface">
                        {u.name || "—"}
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <span className="text-on-surface-variant">{u.email}</span>
                    {u.emailVerified ? (
                      <span className="ml-1.5 text-[10px] text-emerald-500">
                        ✓ verified
                      </span>
                    ) : null}
                  </Td>
                  <Td>
                    <RoleBadge role={u.role} />
                  </Td>
                  <Td className="text-on-surface-variant">
                    {u.primaryOrgName ?? "—"}
                  </Td>
                  <Td className="text-center">
                    <span className="inline-block bg-surface-container-highest rounded-full px-2 py-0.5 text-xs font-medium">
                      {u.membershipCount}
                    </span>
                  </Td>
                  <Td className="text-on-surface-variant">{u.createdAt}</Td>
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

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    psa: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
    su: "border-primary/30 bg-primary/10 text-primary",
    u: "border-outline-variant bg-surface-container text-on-surface-variant",
  };
  const label: Record<string, string> = {
    psa: "Platform staff",
    su: "Super user",
    u: "User",
  };
  return (
    <Badge
      variant="outline"
      className={`text-[10px] font-medium uppercase tracking-wider ${styles[role] ?? styles.u}`}
    >
      {label[role] ?? role}
    </Badge>
  );
}
