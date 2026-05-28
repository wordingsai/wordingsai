"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Users,
  BookOpen,
  Scale,
  Megaphone,
  Settings,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

/**
 * Chrome for the /admin/* surface.
 *
 * Layout choices that mirror the legacy PSA admin (admin-wordingsai.vercel.app):
 *  - Fixed left sidebar with brand mark + nav
 *  - Top bar with search + theme + user
 *  - Dark background throughout
 *
 * Differences from the legacy chrome (intentional):
 *  - The "← Back to product" link makes it explicit you can hop back to the
 *    user-facing app (since /admin lives inside the same deployment now).
 *  - Sentence-case nav labels (not the all-caps Hamza style).
 */
const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/organizations", label: "Organizations", icon: Building2 },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/clause-library", label: "Clause library", icon: BookOpen },
  { href: "/admin/global-rules", label: "Global rules", icon: Scale },
  { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminShell({
  children,
  userName,
  userEmail,
  userImage,
  role,
}: {
  children: React.ReactNode;
  userName: string;
  userEmail: string;
  userImage: string | null;
  role: string;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex bg-background text-on-surface">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 border-r border-outline-variant bg-surface-container-low flex flex-col">
        <div className="px-5 py-4 border-b border-outline-variant">
          <Link href="/admin" className="flex items-center gap-2">
            <div className="size-8 rounded-md bg-primary/15 flex items-center justify-center">
              <span className="text-primary text-sm font-semibold">W</span>
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight">
                WordingsAI
              </div>
              <div className="text-[10px] uppercase tracking-wider text-on-surface-variant">
                Admin panel
              </div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname?.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-3 border-t border-outline-variant space-y-2">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <ArrowLeft className="size-3.5" /> Back to product
          </Link>
          <div className="flex items-center gap-2 px-2">
            <Avatar className="size-7 rounded-md">
              <AvatarImage src={userImage ?? undefined} />
              <AvatarFallback className="text-[11px] font-medium bg-primary/10 text-primary">
                {userName.charAt(0).toUpperCase() ||
                  userEmail.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 leading-tight">
              <div className="text-sm font-medium truncate">
                {userName || "Admin"}
              </div>
              <div className="text-[11px] text-on-surface-variant/70 truncate">
                {role === "psa" ? "Platform staff" : "Super user"}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
    </div>
  );
}
