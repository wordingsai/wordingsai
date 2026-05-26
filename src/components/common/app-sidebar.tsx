"use client";
import * as React from "react";
import {
  IconChartBar,
  IconDashboard,
  IconFileDescription,
  IconGavel,
  IconBooks,
  IconSettings,
} from "@tabler/icons-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { usePathname } from "next/navigation";
import {
  type Icon as TablerIcon,
  IconLogout as LogOut,
} from "@tabler/icons-react";
import Link from "next/link";
import Image from "next/image";
import { authClient } from "@/lib/auth-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCurrentPlan } from "@/hooks/use-current-plan";
import { WorkspaceSwitcher } from "../workspace-switcher";

import { NavUser } from "./nav-user";

const navMain = [
  { title: "Dashboard", url: "/dashboard", icon: IconDashboard },
  { title: "Contracts", url: "/contracts", icon: IconFileDescription },
  { title: "Rules", url: "/rules", icon: IconGavel },
  { title: "Clause Library", url: "/clause-library", icon: IconBooks },
  { title: "Analytics", url: "/analytics", icon: IconChartBar },
  { title: "Settings", url: "/settings", icon: IconSettings },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: session } = authClient.useSession();
  const { plan: currentPlan, isPending: isPlanPending } = useCurrentPlan();

  const user = {
    name: session?.user?.name ?? "User",
    email: session?.user?.email ?? "",
    avatar: session?.user?.image || null,
  };

  return (
    <Sidebar
      collapsible="offcanvas"
      className="border-r"
      variant="inset"
      {...props}
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              className="hover:bg-transparent"
            >
              <Link href="/" className="flex items-center gap-3 group">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-secondary/60 text-primary-foreground transition-transform group-hover:scale-110">
                  <Image
                    src="/logo.png"
                    alt="Logo"
                    width={24}
                    height={24}
                    style={{ width: "auto", height: "auto" }}
                  />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold uppercase tracking-tighter">
                    WordingsAI
                  </span>
                  <span className="truncate text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
                    Neural Engine
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="px-2 mt-2">
          <WorkspaceSwitcher />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <NavMain
          items={navMain}
          plan={currentPlan}
          isPlanPending={isPlanPending}
        />
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}

function NavMain({
  items,
  plan = "basic",
  isPlanPending = false,
}: {
  items: {
    title: string;
    url: string;
    icon?: TablerIcon;
  }[];
  plan?: string;
  isPlanPending?: boolean;
}) {
  const pathname = usePathname();

  const filteredItems = items.filter((item) => {
    if (plan === "fast") {
      return item.title !== "Rules" && item.title !== "Analytics";
    }
    if (plan === "basic") {
      return item.title !== "Rules";
    }
    return true;
  });

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2 px-0 py-4">
        <SidebarMenu>
          {filteredItems.map((item) => {
            const isActive = pathname === item.url;

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  tooltip={item.title}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors
                  ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  <Link
                    href={item.url}
                    className="flex items-center gap-3 w-full"
                  >
                    {item.icon && <item.icon className="size-5 shrink-0" />}
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
