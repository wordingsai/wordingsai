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
  BookOpen,
  Filter,
  CheckCircle2,
  LayoutGrid,
  FileSearch,
  Globe,
  ChevronRight,
  Eye,
  Edit,
  Copy,
  Check,
  Sparkles,
  FileText,
  Trash2,
} from "lucide-react";
import type { Organization } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { useCurrentPlan } from "@/hooks/use-current-plan";
import { motion, AnimatePresence } from "framer-motion";
import {
  staggerContainer,
  staggerItem,
} from "@/components/common/page-transition";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { authClient } from "@/lib/auth-client";

const clauseCategories = [
  "Exclusions",
  "Claims",
  "Premium & Payments",
  "Placement & Subscription",
  "Compliance",
  "Information & Records",
  "Disputes",
  "Parties & Definitions",
  "Termination",
  "Other",
] as const;

type Clause = {
  id: string;
  clauseName: string;
  library: string;
  category: string;
  clauseText: string;
  heading: string | null;
  source: string | null;
  organizationId: string | null;
  isGlobal: boolean;
  status: "Approved" | "Not Approved";
  aiSummary?: string | null;
  aiFavorability?: string | null;
  aiRecommendedUse?: string[] | null;
  aiNote?: string | null;
  keywords?: string[] | null;
  code?: string | null;
};

export default function ClauseLibraryClient({
  organization,
}: {
  organization: Organization | null;
}) {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const { plan, isPending: isPlanPending } = useCurrentPlan();
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("category");
  const [libraryFilter, setLibraryFilter] = useState<string>("library");
  const [scopeFilter, setScopeFilter] = useState<string>("scope");
  const [statusFilter, setStatusFilter] = useState<string>("status");
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const { data: activeWorkspace } = useActiveWorkspace();

  const isPSA = (session?.session as any)?.role === "psa";

  const getCategoryBadgeClasses = (category: string) => {
    const base =
      "inline-flex items-center px-3 py-1 text-[10px] lg:text-xs font-bold rounded-full border uppercase tracking-widest";

    if (category === "Exclusions")
      return cn(base, "bg-red-500/10 text-red-500 border-red-500/20");
    if (category === "Claims")
      return cn(base, "bg-orange-500/10 text-orange-500 border-orange-500/20");
    if (category === "Premium & Payments")
      return cn(
        base,
        "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
      );
    if (category === "Placement & Subscription")
      return cn(base, "bg-violet-500/10 text-violet-500 border-violet-500/20");
    if (category === "Compliance")
      return cn(base, "bg-amber-500/10 text-amber-500 border-amber-500/20");
    if (category === "Information & Records")
      return cn(base, "bg-yellow-500/10 text-yellow-500 border-yellow-500/20");
    if (category === "Disputes")
      return cn(base, "bg-blue-500/10 text-blue-500 border-blue-500/20");
    if (category === "Parties & Definitions")
      return cn(base, "bg-slate-500/10 text-slate-500 border-slate-500/20");
    if (category === "Termination")
      return cn(base, "bg-rose-500/10 text-rose-500 border-rose-500/20");
    if (category === "Other")
      return cn(base, "bg-zinc-500/10 text-zinc-500 border-zinc-500/20");

    return cn(base, "bg-gray-500/10 text-gray-500 border-gray-500/20");
  };

  const availableLibraries = useMemo(() => {
    const libs = new Set(
      clauses
        .map((c) => c.library)
        .filter((l): l is string => typeof l === "string" && l.length > 0),
    );
    return Array.from(libs);
  }, [clauses]);

  useEffect(() => {
    // PERF: previously this also refetched every time the tab regained
    // focus, which pulled the entire clause list (often 500+ rows) on
    // every alt-tab. We now fetch once on mount; the user can pull
    // fresh data by navigating away and back, or by reloading.
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/clauses");
        const data = await res.json();
        if (cancelled) return;
        setClauses(Array.isArray(data) ? data : (data.clauses ?? []));
      } catch (err) {
        if (cancelled) return;
        console.error("Error fetching clauses:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return clauses
      .filter((c) => {
        if (plan === "fast" && !c.isGlobal) return false;
        if (!s) return true;
        return (
          (c.clauseName || "").toLowerCase().includes(s) ||
          (c.clauseText || "").toLowerCase().includes(s) ||
          (c.code || "").toLowerCase().includes(s) ||
          (c.source || "").toLowerCase().includes(s) ||
          (c.keywords || []).some((k) => k.toLowerCase().includes(s))
        );
      })
      .filter((c) =>
        categoryFilter === "category" ? true : c.category === categoryFilter,
      )
      .filter((c) =>
        libraryFilter === "library" ? true : c.library === libraryFilter,
      )
      .filter((c) =>
        statusFilter === "status" ? true : c.status === statusFilter,
      )
      .filter((c) => {
        if (scopeFilter === "scope") return true;
        if (scopeFilter === "global") return c.isGlobal === true;
        if (scopeFilter === "custom") return c.isGlobal === false;
        return true;
      });
  }, [
    clauses,
    search,
    categoryFilter,
    libraryFilter,
    scopeFilter,
    statusFilter,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  const isPlus = plan === "plus";
  // Plus and Basic users can edit the clause library.
  const canMutate = plan === "plus" || plan === "basic";

  return (
    <main className="flex-1 p-6 lg:px-8 lg:py-7 bg-background overflow-x-hidden">
      {/* Page Header */}
      <div className="mb-5">
        <div className="mb-2">
          <Breadcrumb>
            <BreadcrumbList className="text-xs">
              <BreadcrumbItem>
                <BreadcrumbPage className="text-on-surface-variant">
                  Clause library
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-xl lg:text-2xl font-semibold tracking-tight text-on-surface">
              Clause library
            </h1>
            <p className="text-on-surface-variant text-sm">
              Verified treaty wordings and standardized clauses for treaty construction.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!canMutate && !isPlanPending && (
              <span className="text-[11px] font-medium text-amber-500 bg-amber-500/10 px-2 py-1 rounded-md border border-amber-500/20">
                Upgrade to add clauses
              </span>
            )}
            {activeWorkspace?.isGlobal && isPlus && (
              <span className="text-[11px] font-medium text-primary bg-primary/10 px-2 py-1 rounded-md border border-primary/20">
                Saved privately to your org
              </span>
            )}
            {activeWorkspace?.isGlobal && !isPlus && (
              <span className="text-[11px] font-medium text-primary bg-primary/10 px-2 py-1 rounded-md border border-primary/20">
                Global workspace · read-only
              </span>
            )}
            <Button
              size="sm"
              disabled={!canMutate || isPlanPending}
              onClick={() => canMutate && router.push("/clause-library/new")}
              className={cn(
                "gap-1.5",
                canMutate && !isPlanPending
                  ? ""
                  : "opacity-50 cursor-not-allowed",
              )}
            >
              <BookOpen className="size-3.5" />
              Add to library
            </Button>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-on-surface-variant group-focus-within:text-primary transition-colors z-10" />
          <Input
            placeholder="Search clauses by name, code, or content…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 bg-surface-container-low border-outline-variant/60 focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <Select
            value={scopeFilter}
            onValueChange={(v) => setScopeFilter(v ?? "scope")}
          >
            <SelectTrigger className="w-full h-9 bg-surface-container-low border-outline-variant/60 rounded-md text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <Globe className="size-3.5 text-primary shrink-0" />
                <SelectValue placeholder="Scope" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="scope">All scopes</SelectItem>
              <SelectItem value="global">Global</SelectItem>
              {plan !== "fast" && (
                <SelectItem value="custom">Custom</SelectItem>
              )}
            </SelectContent>
          </Select>

          <Select
            value={categoryFilter}
            onValueChange={(v) => setCategoryFilter(v ?? "category")}
          >
            <SelectTrigger className="w-full h-9 bg-surface-container-low border-outline-variant/60 rounded-md text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <LayoutGrid className="size-3.5 text-primary shrink-0" />
                <SelectValue placeholder="Category" />
              </div>
            </SelectTrigger>
            <SelectContent className="max-h-[320px]">
              <SelectItem value="category">All categories</SelectItem>
              {clauseCategories.map((t) => (
                <SelectItem key={t} value={t} className="capitalize">
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={libraryFilter}
            onValueChange={(v) => setLibraryFilter(v ?? "library")}
          >
            <SelectTrigger className="w-full h-9 bg-surface-container-low border-outline-variant/60 rounded-md text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <Filter className="size-3.5 text-secondary shrink-0" />
                <SelectValue placeholder="Library" />
              </div>
            </SelectTrigger>
            <SelectContent className="max-h-[320px]">
              <SelectItem value="library">Any library</SelectItem>
              {availableLibraries.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v ?? "status")}
          >
            <SelectTrigger className="w-full h-9 bg-surface-container-low border-outline-variant/60 rounded-md text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                <SelectValue placeholder="Status" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="status">All statuses</SelectItem>
              <SelectItem value="Approved">Approved</SelectItem>
              <SelectItem value="Unapproved">Unapproved</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content Container */}
      <div className="bg-surface-container-low border border-outline-variant/60 rounded-xl overflow-hidden">
        {/* Mobile View: Cards */}
        <div className="block lg:hidden divide-y divide-outline-variant/30">
          <AnimatePresence mode="popLayout">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-6 space-y-4">
                  <div className="flex items-center gap-4">
                    <Skeleton className="size-12 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-3/4 rounded-lg" />
                      <Skeleton className="h-3 w-1/4 rounded-lg" />
                    </div>
                  </div>
                </div>
              ))
            ) : paginated.length === 0 ? (
              <div className="py-24 text-center px-6">
                <div className="flex flex-col items-center gap-4 opacity-30">
                  <FileSearch className="w-16 h-16" />
                  <p className="text-lg font-semibold uppercase tracking-widest leading-tight">
                    No wordings found in library.
                  </p>
                </div>
              </div>
            ) : (
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="show"
              >
                {paginated.map((clause) => (
                  <motion.div
                    key={clause.id}
                    variants={staggerItem}
                    className="p-6 space-y-4 group active:bg-surface-container-high transition-colors"
                  >
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div className="cursor-pointer">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-4 flex-1 min-w-0">
                              <div className="size-12 bg-surface-container-highest rounded-xl flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                                <BookOpen className="w-5 h-5 text-on-surface-variant group-hover:text-primary transition-colors" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  {clause.source && (
                                    <span className="text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-md uppercase tracking-widest border border-primary/20">
                                      #{clause.source}
                                    </span>
                                  )}
                                  <h3 className="text-sm font-medium text-on-surface line-clamp-2">
                                    {clause.clauseName}
                                  </h3>
                                  {clause.isGlobal && (
                                    <Badge className="h-4 px-1.5 text-[8px] font-semibold uppercase tracking-tighter bg-primary/10 text-primary border-primary/20 rounded-sm">
                                      Global
                                    </Badge>
                                  )}
                                  {clause.code && (
                                    <Badge className="h-4 px-1.5 text-[8px] font-semibold uppercase tracking-tighter bg-violet-500/10 text-violet-500 border-violet-500/20 rounded-sm">
                                      {clause.code}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest line-clamp-1">
                                  {clause.heading || "Standard Wording"}
                                </p>
                              </div>
                            </div>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-10 rounded-xl hover:bg-surface-container-highest transition-all shrink-0"
                                >
                                  <MoreHorizontal className="size-5 text-on-surface-variant" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="rounded-xl w-48 p-2 border-outline-variant shadow-xl"
                              >
                                <DropdownMenuItem
                                  className="rounded-xl font-bold h-12"
                                  onClick={() =>
                                    router.push(`/clause-library/${clause.id}`)
                                  }
                                >
                                  View wording
                                </DropdownMenuItem>
                                {(isPSA || !clause.isGlobal) &&
                                  plan !== "fast" && (
                                    <DropdownMenuItem
                                      className="rounded-xl font-bold h-12"
                                      onClick={() =>
                                        router.push(
                                          `/clause-library/${clause.id}/edit`,
                                        )
                                      }
                                    >
                                      Edit source
                                    </DropdownMenuItem>
                                  )}
                                {(isPSA || !clause.isGlobal) &&
                                  plan !== "fast" && (
                                    <DropdownMenuItem
                                      className="rounded-xl font-bold h-12 text-destructive"
                                      onClick={async () => {
                                        if (confirm("Are you sure?")) {
                                          await fetch(
                                            `/api/clauses/${clause.id}`,
                                            { method: "DELETE" },
                                          );
                                          window.location.reload();
                                        }
                                      }}
                                    >
                                      Delete clause
                                    </DropdownMenuItem>
                                  )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          <div className="flex items-center justify-between gap-4 pt-2">
                            <div className="flex flex-wrap gap-2">
                              <Badge
                                variant="outline"
                                className={getCategoryBadgeClasses(
                                  clause.category,
                                )}
                              >
                                {clause.category}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] font-medium uppercase tracking-wider py-1.5 px-3 rounded-full border",
                                  clause.status === "Approved"
                                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                    : "bg-red-500/10 text-red-500 border-red-500/20",
                                )}
                              >
                                {clause.status === "Approved"
                                  ? "Approved"
                                  : "Unapproved"}
                              </Badge>
                              <Badge
                                variant="outline"
                                className="text-[10px] font-medium uppercase tracking-wider bg-surface-container py-1.5 px-3 border-outline-variant text-on-surface-variant rounded-full"
                              >
                                {clause.library}
                              </Badge>
                            </div>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-10 rounded-xl group"
                              onClick={() =>
                                router.push(`/clause-library/${clause.id}`)
                              }
                            >
                              <ChevronRight className="size-5 text-on-surface-variant group-hover:text-primary" />
                            </Button>
                          </div>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-56 rounded-2xl p-2 shadow-2xl border-outline-variant">
                        <ContextMenuItem
                          className="rounded-xl font-bold h-12 uppercase text-[11px] tracking-widest cursor-pointer"
                          onClick={() =>
                            router.push(`/clause-library/${clause.id}`)
                          }
                        >
                          <Eye className="mr-2 size-4 text-primary" />
                          View Wording
                        </ContextMenuItem>
                        {(isPSA || !clause.isGlobal) && plan !== "fast" && (
                          <ContextMenuItem
                            className="rounded-xl font-bold h-12 uppercase text-[11px] tracking-widest cursor-pointer"
                            onClick={() =>
                              router.push(`/clause-library/${clause.id}/edit`)
                            }
                          >
                            <Edit className="mr-2 size-4" />
                            Edit Source
                          </ContextMenuItem>
                        )}
                        <ContextMenuItem
                          className="rounded-xl font-bold h-12 uppercase text-[11px] tracking-widest cursor-pointer"
                          onClick={() => {
                            navigator.clipboard.writeText(clause.clauseText);
                            toast.success("Clause text copied");
                          }}
                        >
                          <Copy className="mr-2 size-4" />
                          Copy Text
                        </ContextMenuItem>
                        {(isPSA || !clause.isGlobal) && plan !== "fast" && (
                          <ContextMenuItem
                            className="rounded-xl font-bold h-12 uppercase text-[11px] tracking-widest cursor-pointer text-destructive"
                            onClick={async () => {
                              if (confirm("Are you sure?")) {
                                await fetch(`/api/clauses/${clause.id}`, {
                                  method: "DELETE",
                                });
                                window.location.reload();
                              }
                            }}
                          >
                            <Trash2 className="mr-2 size-4" />
                            Delete Clause
                          </ContextMenuItem>
                        )}
                      </ContextMenuContent>
                    </ContextMenu>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Desktop View: Table */}
        <div className="hidden lg:block overflow-x-hidden">
          <Table>
            <TableHeader className="bg-surface-container-highest/20">
              <TableRow className="hover:bg-transparent border-outline-variant/40">
                <TableHead className="h-9 px-4 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant min-w-[280px]">
                  Clause
                </TableHead>
                <TableHead className="h-9 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant min-w-[140px]">
                  Category
                </TableHead>
                <TableHead className="h-9 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant min-w-[100px]">
                  Status
                </TableHead>
                <TableHead className="h-9 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant min-w-[140px]">
                  Library
                </TableHead>
                <TableHead className="h-9 text-right px-4 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant w-[80px]">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-outline-variant/30">
                    <TableCell className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Skeleton className="size-7 rounded-md" />
                        <Skeleton className="h-4 w-48 rounded" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-20 rounded" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-20 rounded" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-32 rounded" />
                    </TableCell>
                    <TableCell className="px-4 text-right">
                      <Skeleton className="size-7 ml-auto rounded" />
                    </TableCell>
                  </TableRow>
                ))
              ) : paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2 opacity-40">
                      <FileSearch className="size-8" />
                      <p className="text-sm">
                        No clauses match your filters
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((clause) => (
                  <ClauseRow
                    key={clause.id}
                    clause={clause}
                    activeWorkspace={activeWorkspace}
                    getCategoryBadgeClasses={getCategoryBadgeClasses}
                    router={router}
                    plan={plan}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Footer */}
        <div className="px-4 py-2.5 border-t border-outline-variant/40 flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface-container-highest/20">
          <div className="text-xs text-on-surface-variant">
            <span className="text-on-surface font-medium">{filtered.length}</span>{" "}
            {filtered.length === 1 ? "clause" : "clauses"}
          </div>

          <Pagination className="w-auto mx-0">
            <PaginationContent className="gap-1">
              <PaginationItem>
                <PaginationPrevious
                  className="h-7 px-2.5 rounded-md border-outline-variant/60 hover:bg-background text-xs"
                  onClick={() => page > 1 && setPage(page - 1)}
                />
              </PaginationItem>

              <div className="hidden lg:flex items-center gap-1 mx-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => (
                  <Button
                    key={i}
                    variant={page === i + 1 ? "default" : "outline"}
                    className={cn(
                      "h-7 w-7 rounded-md font-medium text-xs p-0",
                      page === i + 1
                        ? ""
                        : "bg-transparent border-outline-variant/60 hover:bg-background",
                    )}
                    onClick={() => setPage(i + 1)}
                  >
                    {i + 1}
                  </Button>
                ))}
              </div>

              <div className="flex lg:hidden items-center px-2 text-xs text-on-surface-variant">
                {page} / {totalPages}
              </div>

              <PaginationItem>
                <PaginationNext
                  className="h-7 px-2.5 rounded-md border-outline-variant/60 hover:bg-background text-xs"
                  onClick={() => page < totalPages && setPage(page + 1)}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>
    </main>
  );
}

function ClauseRow({
  clause,
  activeWorkspace,
  getCategoryBadgeClasses,
  router,
  plan,
}: {
  clause: Clause;
  activeWorkspace: any;
  getCategoryBadgeClasses: any;
  router: any;
  plan?: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(clause.clauseText);
    setCopied(true);
    toast.success("Clause text copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <React.Fragment>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <TableRow
            className={cn(
              "border-outline-variant/30 group hover:bg-surface-container/50 transition-colors cursor-pointer",
              isExpanded && "bg-surface-container/30",
            )}
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <TableCell className="px-4 py-2.5">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "size-7 rounded-md flex items-center justify-center shrink-0 transition-colors",
                    isExpanded
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface-container-highest group-hover:bg-primary/10 group-hover:text-primary",
                  )}
                >
                  <BookOpen className="size-3.5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-medium text-on-surface group-hover:text-primary transition-colors truncate">
                      {clause.clauseName}
                    </span>
                    {clause.isGlobal && (
                      <Badge className="h-4 px-1.5 text-[9px] font-medium bg-primary/10 text-primary border border-primary/20 rounded">
                        Global
                      </Badge>
                    )}
                    {clause.code && (
                      <Badge className="h-4 px-1.5 text-[9px] font-mono font-normal bg-violet-500/10 text-violet-500 border border-violet-500/20 rounded">
                        {clause.code}
                      </Badge>
                    )}
                  </div>
                  <span className="text-[11px] text-on-surface-variant font-mono">
                    CL-{clause.id.slice(0, 8).toUpperCase()}
                  </span>
                </div>
              </div>
            </TableCell>

            <TableCell className="py-2.5">
              <Badge
                variant="outline"
                className={cn(
                  "text-[11px] font-medium px-2 py-0.5 rounded-md",
                  getCategoryBadgeClasses(clause.category),
                )}
              >
                {clause.category}
              </Badge>
            </TableCell>

            <TableCell className="py-2.5">
              <Badge
                variant="outline"
                className={cn(
                  "text-[11px] font-medium py-0.5 px-2 rounded-md border",
                  clause.status === "Approved"
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                    : "bg-red-500/10 text-red-500 border-red-500/20",
                )}
              >
                {clause.status}
              </Badge>
            </TableCell>

            <TableCell className="py-2.5 text-on-surface-variant text-xs">
              {clause.library}
            </TableCell>

            <TableCell className="px-4 py-2.5 text-right">
              <div className="flex items-center justify-end gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "size-7 rounded-md transition-all",
                    isExpanded
                      ? "rotate-90 text-primary bg-primary/10"
                      : "text-on-surface-variant",
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(!isExpanded);
                  }}
                >
                  <ChevronRight className="size-3.5" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    asChild
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 rounded-md hover:bg-surface-container-highest"
                    >
                      <MoreHorizontal className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-44 p-1 border-outline-variant/60"
                  >
                    <DropdownMenuItem
                      className="cursor-pointer text-xs"
                      onClick={() =>
                        router.push(`/clause-library/${clause.id}`)
                      }
                    >
                      View full
                    </DropdownMenuItem>
                    {!clause.isGlobal && plan !== "fast" && (
                      <DropdownMenuItem
                        className="cursor-pointer text-xs"
                        onClick={() =>
                          router.push(`/clause-library/${clause.id}/edit`)
                        }
                      >
                        Edit
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </TableCell>
          </TableRow>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48 p-1 border-outline-variant/60">
          <ContextMenuItem
            className="cursor-pointer text-xs"
            onClick={() => router.push(`/clause-library/${clause.id}`)}
          >
            <Eye className="mr-2 size-3.5 text-primary" />
            View full
          </ContextMenuItem>
          {!clause.isGlobal && plan !== "fast" && (
            <ContextMenuItem
              className="cursor-pointer text-xs"
              onClick={() => router.push(`/clause-library/${clause.id}/edit`)}
            >
              <Edit className="mr-2 size-3.5" />
              Edit
            </ContextMenuItem>
          )}
          {!clause.isGlobal && plan !== "fast" && (
            <ContextMenuItem
              className="cursor-pointer text-xs text-destructive focus:text-destructive"
              onClick={async () => {
                if (confirm("Are you sure?")) {
                  await fetch(`/api/clauses/${clause.id}`, {
                    method: "DELETE",
                  });
                  window.location.reload();
                }
              }}
            >
              <Trash2 className="mr-2 size-3.5" />
              Delete
            </ContextMenuItem>
          )}
          <ContextMenuSeparator className="my-2" />
          <ContextMenuItem
            className="rounded-xl font-bold h-12 uppercase text-[11px] tracking-widest cursor-pointer"
            onClick={handleCopy}
          >
            <Copy className="mr-2 size-4" />
            Copy Clause Text
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <AnimatePresence>
        {isExpanded && (
          <TableRow className="bg-surface-container-low/50 hover:bg-surface-container-low/50 border-none">
            <TableCell colSpan={6} className="p-0">
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="p-10 grid grid-cols-1 lg:grid-cols-12 gap-10 border-b border-outline-variant/30">
                  <div className="lg:col-span-8 space-y-6">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-medium uppercase tracking-wider text-primary flex items-center gap-2">
                        <FileText className="size-4" /> Full Clause Wording
                      </h4>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-lg text-[10px] font-medium uppercase tracking-wider gap-2"
                        onClick={handleCopy}
                      >
                        {copied ? (
                          <Check className="size-3 text-emerald-500" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                        {copied ? "Copied" : "Copy Text"}
                      </Button>
                    </div>
                    <div className="bg-background p-8 rounded-lg border border-outline-variant shadow-inner font-mono text-sm leading-relaxed text-on-surface whitespace-pre-wrap max-h-[400px] overflow-y-auto no-scrollbar">
                      {clause.clauseText}
                    </div>
                  </div>

                  <div className="lg:col-span-4 space-y-8">
                    <div className="space-y-4">
                      <h4 className="text-xs font-medium uppercase tracking-wider text-primary flex items-center gap-2">
                        <Sparkles className="size-4" /> Semantic Rules &
                        Intelligence
                      </h4>
                      <div className="space-y-3">
                        <div className="p-4 rounded-2xl bg-surface-container-highest/30 border border-outline-variant/30">
                          <span className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant block mb-1">
                            Heading
                          </span>
                          <p className="text-xs font-bold text-on-surface">
                            {clause.heading || "—"}
                          </p>
                        </div>
                        <div className="p-4 rounded-2xl bg-surface-container-highest/30 border border-outline-variant/30">
                          <span className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant block mb-1">
                            Source
                          </span>
                          <p className="text-xs font-bold text-on-surface">
                            {(clause.source || "General archive").toString()}
                          </p>
                        </div>
                        <div className="p-4 rounded-2xl bg-surface-container-highest/30 border border-outline-variant/30">
                          <span className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant block mb-1">
                            Semantic keywords
                          </span>
                          <p className="text-xs font-bold text-on-surface">
                            {(clause.keywords && clause.keywords.length > 0
                              ? clause.keywords.slice(0, 6).join(", ")
                              : "No keywords"
                            ).toString()}
                          </p>
                        </div>
                        <div className="p-4 rounded-2xl bg-surface-container-highest/30 border border-outline-variant/30">
                          <span className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant block mb-1">
                            Neural insight
                          </span>
                          <p className="text-xs font-bold text-on-surface line-clamp-3">
                            {(
                              clause.aiSummary ||
                              "No AI summary available for this clause yet."
                            ).toString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    <Button
                      className="w-full  text-xs font-medium uppercase tracking-wider shadow-lg shadow-primary/20"
                      onClick={() =>
                        router.push(`/clause-library/${clause.id}`)
                      }
                    >
                      View Full Analysis & History
                    </Button>
                  </div>
                </div>
              </motion.div>
            </TableCell>
          </TableRow>
        )}
      </AnimatePresence>
    </React.Fragment>
  );
}
