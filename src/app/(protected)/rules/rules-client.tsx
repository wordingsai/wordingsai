"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MoreHorizontal,
  Search,
  Plus,
  ShieldCheck,
  Scale,
  Globe,
  HardHat,
  Eye,
  Settings,
  Play,
  Pause,
  Copy,
  EyeOff,
  Trash2,
} from "lucide-react";
import { Link } from "next-view-transitions";
import { motion, AnimatePresence } from "framer-motion";
import {
  staggerContainer,
  staggerItem,
} from "@/components/common/page-transition";
import { Badge } from "@/components/ui/badge";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useCurrentPlan } from "@/hooks/use-current-plan";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { UpgradePaywall } from "@/components/common/upgrade-paywall";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";

type RuleVersion = {
  id: string;
  versionNumber: number;
  ruleDefinition: {
    appliesTo?: string;
    whatToCheck?: string[];
    clauseReferences?: string[];
    keywordPacks?: { bias: string; theme: string; keywords: string[] }[];
    greenCriteria?: string[];
    amberCriteria?: string[];
    redCriteria?: string[];
  };
};

type Rule = {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  isGlobal: boolean;
  status: "active" | "inactive";
  currentVersion?: RuleVersion | null;
};

export default function RulesClient() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const { data: activeOrg, isPending: isOrgPending } =
    authClient.useActiveOrganization();
  const { plan, isPending: isPlanPending } = useCurrentPlan();
  const { data: activeWorkspace, isPending: isWorkspacePending } =
    useActiveWorkspace();
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);

  // All other hooks MUST be declared before any early returns to avoid React hook violations
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("category");
  const [statusFilter, setStatusFilter] = useState<string>("status");
  const [scopeFilter, setScopeFilter] = useState<string>("scope");
  const [showHidden, setShowHidden] = useState(false);
  const [kindFilter, setKindFilter] = useState<Set<"exclusion" | "condition">>(
    () => new Set(["exclusion", "condition"]),
  );
  const [page, setPage] = useState(1);

  const getRuleKind = (rule: Rule): "exclusion" | "condition" => {
    const hay = `${rule.name ?? ""} ${rule.category ?? ""}`.toLowerCase();
    return hay.includes("exclusion") ? "exclusion" : "condition";
  };

  const handleToggleStatus = async (
    id: string,
    currentStatus: Rule["status"],
  ) => {
    const newStatus: Rule["status"] =
      currentStatus === "active" ? "inactive" : "active";
    setRules(rules.map((r) => (r.id === id ? { ...r, status: newStatus } : r)));

    try {
      const res = await fetch(`/api/rules/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to toggle status");
      toast.success(
        `Rule ${newStatus === "active" ? "activated" : "hidden from view"}`,
      );
    } catch {
      setRules(
        rules.map((r) => (r.id === id ? { ...r, status: currentStatus } : r)),
      );
      toast.error("Failed to update status");
    }
  };

  const availableCategories = useMemo(() => {
    const cats = new Set(
      rules
        .map((r) => r.category)
        .filter((c): c is string => typeof c === "string" && c.length > 0),
    );
    return Array.from(cats);
  }, [rules]);

  useEffect(() => {
    const fetchRules = async () => {
      try {
        const res = await fetch("/api/rules");
        const data = await res.json();
        setRules(Array.isArray(data) ? data : (data.rules ?? []));
      } finally {
        setLoading(false);
      }
    };
    fetchRules();
  }, []);

  const filtered = useMemo(() => {
    return rules
      .filter((r) => r.name?.toLowerCase().includes(search.toLowerCase()))
      .filter((r) =>
        categoryFilter === "category" ? true : r.category === categoryFilter,
      )
      .filter((r) =>
        statusFilter === "status" ? true : r.status === statusFilter,
      )
      .filter((r) => {
        if (scopeFilter === "scope") return true;
        if (scopeFilter === "global") return r.isGlobal === true;
        if (scopeFilter === "private") return r.isGlobal === false;
        return true;
      })
      .filter((r) => kindFilter.has(getRuleKind(r)))
      .filter((r) => (showHidden ? true : r.status === "active"));
  }, [
    rules,
    search,
    categoryFilter,
    statusFilter,
    scopeFilter,
    kindFilter,
    showHidden,
  ]);

  const pageSize = 9;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  // Don't show content while checking access
  if (isOrgPending || isPlanPending || isWorkspacePending) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] w-full">
        <div className="animate-spin">
          <ShieldCheck className="h-8 w-8 text-primary" />
        </div>
      </div>
    );
  }

  const isPlus = plan === "plus";
  const isPSA = (session?.session as any)?.role === "psa";

  if (!isPlus && !isPSA) {
    return (
      <UpgradePaywall
        title="Access Denied"
        description="To configure compliance rules and regulatory filters, your organization needs higher intelligence tier features."
        featureName="Rules Configuration"
      />
    );
  }

  const isWorkspaceMutable = activeWorkspace
    ? activeWorkspace.isMutable
    : false;
  // Plus users can create private rules even while browsing global workspaces.
  const canMutate = isPlus || isPSA;

  return (
    <main className="flex-1 p-4 lg:p-10 bg-background transition-colors duration-300 overflow-x-hidden">
      {/* Page Header */}
      <div className="mb-6 lg:mb-10">
        <div className="flex items-center gap-2 mb-4 lg:mb-6">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage className="text-[10px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant">
                  Rule Configuration
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-on-surface">
              Compliance Rules
            </h1>
            <p className="text-on-surface-variant text-base lg:text-lg font-medium max-w-2xl leading-relaxed">
              Manage semantic logic and regulatory filters for automatic treaty
              vetting.
            </p>
          </div>

          <div className="flex flex-col items-stretch lg:items-end gap-2 w-full lg:w-auto">
            {!isPlus && !isPSA && (
              <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 text-center">
                Upgrade to PLUS to create rules
              </span>
            )}
            {activeWorkspace?.isGlobal && (isPlus || isPSA) && (
              <span className="text-[10px] font-bold text-primary uppercase tracking-widest bg-primary/10 px-3 py-1 rounded-full border border-primary/20 text-center">
                Creating here saves privately to your org
              </span>
            )}
            {activeWorkspace?.isGlobal && !isPlus && !isPSA && (
              <span className="text-[10px] font-bold text-primary uppercase tracking-widest bg-primary/10 px-3 py-1 rounded-full border border-primary/20 text-center">
                Global workspace is read-only
              </span>
            )}
            <Button
              size="lg"
              disabled={!canMutate}
              onClick={() => canMutate && router.push("/rules/new")}
              className={cn(
                "bg-primary hover:bg-primary/90 text-primary-foreground rounded-md flex items-center justify-center gap-3 transition-all",
                canMutate
                  ? ""
                  : "opacity-50 cursor-not-allowed grayscale",
              )}
            >
              <Plus className="w-5 h-5" />
              <span className="tracking-widest uppercase text-xs">
                CREATE NEW RULE
              </span>
            </Button>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row gap-4 mb-6 lg:mb-8">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Search rules..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-surface-container-low border-outline-variant transition-all focus:ring-4 focus:ring-primary/10"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant={showHidden ? "default" : "outline"}
            onClick={() => setShowHidden(!showHidden)}
            className="h-14 px-6 rounded-2xl text-xs font-medium uppercase tracking-wider gap-2 transition-all"
          >
            {showHidden ? (
              <Eye className="size-4" />
            ) : (
              <EyeOff className="size-4" />
            )}
            {showHidden ? "Showing Hidden" : "Show Hidden Rules"}
          </Button>

          <Select
            value={scopeFilter}
            onValueChange={(v) => setScopeFilter(v ?? "scope")}
          >
            <SelectTrigger className="w-[160px] h-14 bg-surface-container-low border-outline-variant rounded-2xl text-xs font-medium uppercase tracking-wider">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" />
                <SelectValue placeholder="Scope" />
              </div>
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="scope">All Scope</SelectItem>
              <SelectItem value="global">Global</SelectItem>
              <SelectItem value="private">Custom</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={categoryFilter}
            onValueChange={(v) => setCategoryFilter(v ?? "category")}
          >
            <SelectTrigger className="w-[160px] h-14 bg-surface-container-low border-outline-variant rounded-2xl text-xs font-medium uppercase tracking-wider">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-primary" />
                <SelectValue placeholder="Category" />
              </div>
            </SelectTrigger>
            <SelectContent className="rounded-xl max-h-[300px]">
              <SelectItem value="category">All Domain</SelectItem>
              {availableCategories.map((c) => (
                <SelectItem key={c} value={c} className="capitalize">
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v ?? "status")}
          >
            <SelectTrigger className="w-[160px] h-14 bg-surface-container-low border-outline-variant rounded-2xl text-xs font-medium uppercase tracking-wider">
              <div className="flex items-center gap-2 text-on-surface-variant">
                <ShieldCheck className="w-4 h-4" />
                <SelectValue placeholder="Status" />
              </div>
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="status">Any Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Paused</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Rules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {loading ? (
            Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="h-64 lg:h-72 rounded-lg" />
            ))
          ) : paginated.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="col-span-full py-24 text-center bg-surface-container-low border border-dashed border-outline-variant rounded-xl"
            >
              <div className="flex flex-col items-center gap-4 opacity-40">
                <HardHat className="w-16 h-16" />
                <p className="text-xl font-bold uppercase tracking-widest px-4">
                  No rules discovered matching criteria.
                </p>
              </div>
            </motion.div>
          ) : (
            paginated.map((rule) => (
              <motion.div
                key={rule.id}
                variants={staggerItem}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="contents"
              >
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <div
                      className={cn(
                        "bg-surface-container-low border border-outline-variant h-full p-6 lg:p-8 rounded-lg lg:rounded-xl hover:border-primary/50 transition-all hover:shadow-xl group relative overflow-hidden cursor-pointer",
                        rule.status === "inactive" &&
                          "opacity-60 grayscale-[0.5]",
                      )}
                    >
                      <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "p-3 rounded-2xl",
                              rule.isGlobal
                                ? "bg-primary/10"
                                : "bg-amber-500/10",
                            )}
                          >
                            {rule.isGlobal ? (
                              <Globe className="w-6 h-6 text-primary" />
                            ) : (
                              <ShieldCheck className="w-6 h-6 text-amber-500" />
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-full size-10 hover:bg-surface-container-highest"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleStatus(rule.id, rule.status);
                            }}
                          >
                            {rule.status === "active" ? (
                              <Eye className="size-5 text-primary" />
                            ) : (
                              <EyeOff className="size-5 text-on-surface-variant" />
                            )}
                          </Button>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="rounded-full h-8 w-8 hover:bg-surface-container-highest transition-all"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            className="rounded-xl font-bold p-2 border-outline-variant shadow-xl"
                            align="end"
                          >
                            <DropdownMenuItem
                              className="cursor-pointer rounded-lg h-10 uppercase text-[10px] tracking-widest"
                              onClick={() => router.push(`/rules/${rule.id}`)}
                            >
                              Review Logic
                            </DropdownMenuItem>
                            {(isPSA ||
                              (!rule.isGlobal && isWorkspaceMutable)) && (
                              <DropdownMenuItem
                                className="cursor-pointer rounded-lg h-10 uppercase text-[10px] tracking-widest"
                                onClick={() =>
                                  router.push(`/rules/${rule.id}/edit`)
                                }
                              >
                                Configuration
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className={cn(
                                "cursor-pointer rounded-lg h-10 uppercase text-[10px] tracking-widest",
                                rule.status === "active"
                                  ? "text-destructive"
                                  : "text-emerald-500",
                              )}
                              onClick={() => {
                                handleToggleStatus(rule.id, rule.status);
                              }}
                            >
                              {rule.status === "active"
                                ? "Hide from view"
                                : "Activate Rule"}
                            </DropdownMenuItem>
                            {(isPSA ||
                              (!rule.isGlobal && isWorkspaceMutable)) && (
                              <DropdownMenuItem
                                className="cursor-pointer rounded-lg h-10 uppercase text-[10px] tracking-widest text-destructive"
                                onClick={async () => {
                                  if (confirm("Are you sure?")) {
                                    await fetch(`/api/rules/${rule.id}`, {
                                      method: "DELETE",
                                    });
                                    window.location.reload();
                                  }
                                }}
                              >
                                Delete Rule
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="space-y-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                              {rule.category}
                            </span>
                            <div className="w-1 h-1 rounded-full bg-outline-variant" />
                            <span className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                              {rule.isGlobal ? "Global" : "Organization"}
                            </span>
                          </div>
                          <h3 className="text-lg lg:text-xl font-semibold text-on-surface leading-tight group-hover:text-primary transition-colors line-clamp-2 min-h-[3rem] lg:min-h-[3.5rem]">
                            {rule.name.includes(" — ")
                              ? rule.name.split(" — ")[1]
                              : rule.name}
                          </h3>
                        </div>

                        {rule.description && (
                          <p className="text-sm text-on-surface-variant font-medium leading-relaxed line-clamp-2 min-h-[2.5rem]">
                            {rule.description}
                          </p>
                        )}

                        {rule.currentVersion?.ruleDefinition && (
                          <div className="space-y-2 pt-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {(rule.currentVersion.ruleDefinition.whatToCheck
                                ?.length ?? 0) > 0 && (
                                <span className="text-[9px] font-semibold px-2 py-1 rounded-full bg-primary/5 text-primary border border-primary/10">
                                  {
                                    rule.currentVersion.ruleDefinition
                                      .whatToCheck!.length
                                  }{" "}
                                  CHECKS
                                </span>
                              )}
                              {(rule.currentVersion.ruleDefinition
                                .clauseReferences?.length ?? 0) > 0 && (
                                <span className="text-[9px] font-semibold px-2 py-1 rounded-full bg-secondary/5 text-secondary border border-secondary/10">
                                  {
                                    rule.currentVersion.ruleDefinition
                                      .clauseReferences!.length
                                  }{" "}
                                  CLAUSES
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-4 border-t border-outline-variant/30 mt-auto">
                          <div className="flex gap-2">
                            <Badge
                              variant="outline"
                              className={cn(
                                "rounded-full font-semibold text-[9px] lg:text-[10px] uppercase tracking-tighter px-2.5",
                                rule.status === "active"
                                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                  : "bg-surface-container text-on-surface-variant",
                              )}
                            >
                              {rule.status === "active"
                                ? "Operational"
                                : "Hidden"}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={cn(
                                "rounded-full font-semibold text-[9px] lg:text-[10px] uppercase tracking-tighter px-2.5",
                                getRuleKind(rule) === "exclusion"
                                  ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                                  : "bg-sky-500/10 text-sky-500 border-sky-500/20",
                              )}
                            >
                              {getRuleKind(rule) === "exclusion"
                                ? "Exclusion"
                                : "Condition"}
                            </Badge>
                          </div>
                          <Link
                            href={`/rules/${rule.id}`}
                            className="text-primary text-[10px] lg:text-xs font-semibold uppercase tracking-widest hover:underline whitespace-nowrap"
                          >
                            Review
                          </Link>
                        </div>
                      </div>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-64 rounded-2xl p-2 shadow-2xl border-outline-variant">
                    <ContextMenuItem
                      className="rounded-xl font-bold h-12 uppercase text-[11px] tracking-widest cursor-pointer"
                      onClick={() => router.push(`/rules/${rule.id}`)}
                    >
                      <Eye className="mr-2 size-4 text-primary" />
                      Review Logic
                    </ContextMenuItem>
                    {(isPSA || (!rule.isGlobal && isWorkspaceMutable)) && (
                      <ContextMenuItem
                        className="rounded-xl font-bold h-12 uppercase text-[11px] tracking-widest cursor-pointer"
                        onClick={() => router.push(`/rules/${rule.id}/edit`)}
                      >
                        <Settings className="mr-2 size-4" />
                        Configuration
                      </ContextMenuItem>
                    )}
                    <ContextMenuSeparator className="my-2" />
                    <ContextMenuItem
                      className={cn(
                        "rounded-xl font-bold h-12 uppercase text-[11px] tracking-widest cursor-pointer",
                        rule.status === "active"
                          ? "text-amber-600"
                          : "text-emerald-600",
                      )}
                      onClick={() => handleToggleStatus(rule.id, rule.status)}
                    >
                      {rule.status === "active" ? (
                        <>
                          <EyeOff className="mr-2 size-4" />
                          Hide Rule
                        </>
                      ) : (
                        <>
                          <Play className="mr-2 size-4" />
                          Activate Rule
                        </>
                      )}
                    </ContextMenuItem>
                    <ContextMenuItem
                      className="rounded-xl font-bold h-12 uppercase text-[11px] tracking-widest cursor-pointer"
                      onClick={() => {
                        navigator.clipboard.writeText(rule.id);
                        toast.success("Rule ID copied");
                      }}
                    >
                      <Copy className="mr-2 size-4" />
                      Copy Rule ID
                    </ContextMenuItem>
                    {(isPSA || (!rule.isGlobal && isWorkspaceMutable)) && (
                      <ContextMenuItem
                        className="rounded-xl font-bold h-12 uppercase text-[11px] tracking-widest cursor-pointer text-destructive"
                        onClick={async () => {
                          if (confirm("Are you sure?")) {
                            await fetch(`/api/rules/${rule.id}`, {
                              method: "DELETE",
                            });
                            window.location.reload();
                          }
                        }}
                      >
                        <Trash2 className="mr-2 size-4" />
                        Delete Rule
                      </ContextMenuItem>
                    )}
                  </ContextMenuContent>
                </ContextMenu>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Pagination Footer */}
      <div className="mt-8 lg:mt-12 p-6 lg:p-8 border-t border-outline-variant flex flex-col sm:flex-row items-center justify-between gap-6 bg-surface-container-highest/20 rounded-lg">
        <div className="text-[10px] lg:text-xs font-medium uppercase tracking-wider text-on-surface-variant text-center sm:text-left">
          ENGINE: <span className="text-emerald-500">OPTIMIZED</span> —{" "}
          <span className="text-on-surface">{filtered.length}</span> ACTIVE
          RULES
        </div>

        <Pagination className="w-auto mx-0">
          <PaginationContent className="gap-1.5 lg:gap-2">
            <PaginationItem>
              <PaginationPrevious
                className="rounded-xl border-outline-variant hover:bg-background h-10 px-3 lg:px-4"
                onClick={() => page > 1 && setPage(page - 1)}
              />
            </PaginationItem>

            <div className="hidden sm:flex items-center gap-1.5 mx-2">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => (
                <Button
                  key={i}
                  variant={page === i + 1 ? "default" : "outline"}
                  className={cn(
                    "h-10 w-10 rounded-xl font-semibold text-xs",
                    page === i + 1
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                      : "bg-transparent border-outline-variant hover:bg-background",
                  )}
                  onClick={() => setPage(i + 1)}
                >
                  {i + 1}
                </Button>
              ))}
            </div>

            <div className="flex sm:hidden items-center px-4 font-semibold text-[11px] uppercase tracking-widest text-on-surface-variant">
              {page} / {totalPages}
            </div>

            <PaginationItem>
              <PaginationNext
                className="rounded-xl border-outline-variant hover:bg-background h-10 px-3 lg:px-4"
                onClick={() => page < totalPages && setPage(page + 1)}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </main>
  );
}
