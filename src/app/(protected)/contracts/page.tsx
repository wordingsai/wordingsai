"use client";

import React, { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  MoreHorizontal,
  Search,
  Plus,
  FileText,
  LayoutGrid,
  CalendarIcon,
  ChevronRight,
  Copy,
  Trash2,
  RotateCcw,
  Archive,
  ArchiveRestore,
  Filter,
  Users,
  X,
} from "lucide-react";
import { Link } from "next-view-transitions";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  staggerContainer,
  staggerItem,
} from "@/components/common/page-transition";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Contract = {
  id: string;
  contractName: string;
  reinsured: string;
  broker: string | null;
  contractType: string;
  periodFrom: string | null;
  periodTo: string | null;
  executionDate: string | null;
  auditStatus: string;
  createdAt: string;
};

export default function ContractsPage() {
  const router = useRouter();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("type");
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<"active" | "archive" | "bin">(
    "active",
  );

  // Advanced Filters
  const [brokerFilter, setBrokerFilter] = useState<string>("broker");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  const { data: session } = authClient.useSession();
  const { data: activeOrg, isPending } = authClient.useActiveOrganization();
  const activeMember = activeOrg?.members?.find(
    (m: any) => m.userId === session?.user?.id,
  );
  const isSuperUser =
    (activeMember?.role as string) === "su" ||
    (activeMember?.role as string) === "psa";

  const pageSize = 50;

  const availableContractTypes = useMemo(() => {
    const set = new Set<string>();
    for (const c of contracts) {
      const t = (c.contractType || "").trim();
      if (t) set.add(t);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [contracts]);

  const availableBrokers = useMemo(() => {
    const set = new Set<string>();
    for (const c of contracts) {
      const b = (c.broker || "").trim();
      if (b) set.add(b);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [contracts]);

  const fetchContracts = async () => {
    setLoading(true);
    try {
      const endpoint =
        viewMode === "bin"
          ? "/api/contracts/bin"
          : viewMode === "archive"
            ? "/api/contracts/archive"
            : "/api/contracts";
      const res = await fetch(endpoint);
      const data = await res.json();
      setContracts(Array.isArray(data) ? data : (data.contracts ?? []));
    } catch (err) {
      console.error("Error fetching contracts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContracts();
  }, [viewMode]);

  const handleRestore = async (id: string) => {
    try {
      const res = await fetch(`/api/contracts/${id}/restore`, {
        method: "POST",
      });
      if (res.ok) {
        toast.success("Contract restored successfully");
        fetchContracts();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to restore contract");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    }
  };

  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/contracts/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(
          viewMode === "active" || viewMode === "archive"
            ? "Contract moved to bin"
            : "Contract deleted permanently",
        );
        fetchContracts();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete contract");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  const handleArchive = async (id: string) => {
    try {
      const res = await fetch(`/api/contracts/${id}/archive`, {
        method: "POST",
      });
      if (res.ok) {
        toast.success("Contract archived");
        fetchContracts();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to archive contract");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    }
  };

  const handleUnarchive = async (id: string) => {
    try {
      const res = await fetch(`/api/contracts/${id}/archive`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Contract moved back to Active");
        fetchContracts();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to unarchive contract");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    }
  };

  const filtered = useMemo(() => {
    return contracts
      .filter(
        (c) =>
          (c.contractName || "").toLowerCase().includes(search.toLowerCase()) ||
          (c.reinsured || "").toLowerCase().includes(search.toLowerCase()) ||
          (c.broker || "").toLowerCase().includes(search.toLowerCase()),
      )
      .filter((c) =>
        typeFilter === "type" ? true : c.contractType === typeFilter,
      )
      .filter((c) =>
        brokerFilter === "broker" ? true : c.broker === brokerFilter,
      )
      .filter((c) => {
        if (!dateFrom) return true;
        const d = c.periodFrom ? new Date(c.periodFrom) : null;
        return d ? d >= dateFrom : false;
      })
      .filter((c) => {
        if (!dateTo) return true;
        const d = c.periodTo ? new Date(c.periodTo) : null;
        return d ? d <= dateTo : false;
      });
  }, [contracts, search, typeFilter, brokerFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return "bg-emerald-500/10 text-emerald-500 border-none";
      case "failed":
        return "bg-destructive/10 text-destructive border-none";
      case "reviewing":
        return "bg-blue-500/10 text-blue-500 border-none";
      case "pending":
      default:
        return "bg-amber-500/10 text-amber-500 border-none";
    }
  };

  return (
    <main className="flex-1 p-6 lg:px-8 lg:py-7 bg-background overflow-x-hidden">
      {/* Page Header */}
      <div className="mb-5">
        <div className="mb-2">
          <Breadcrumb>
            <BreadcrumbList className="text-xs">
              <BreadcrumbItem>
                <BreadcrumbPage className="text-on-surface-variant">
                  Contracts
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-xl lg:text-2xl font-semibold tracking-tight text-on-surface">
              {viewMode === "active"
                ? "Contract portfolio"
                : viewMode === "archive"
                  ? "Archive"
                  : "Trash bin"}
            </h1>
            <p className="text-on-surface-variant text-sm">
              {viewMode === "active"
                ? "Centralized repository for all wordings and reinsurance documentation."
                : viewMode === "archive"
                  ? "Archived contracts are stored for reference. The 10 most recent stay in Active automatically."
                  : "Contracts here will be permanently deleted after 7 days."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex gap-0.5 p-0.5 bg-surface-container-low border border-outline-variant/60 rounded-md">
              <Button
                variant={viewMode === "active" ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setViewMode("active")}
              >
                Active
              </Button>
              <Button
                variant={viewMode === "archive" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("archive")}
                className={cn(
                  "h-7 text-xs gap-1",
                  viewMode === "archive"
                    ? "bg-amber-500 text-white hover:bg-amber-500/90"
                    : "",
                )}
              >
                <Archive className="size-3" />
                Archive
              </Button>
              <Button
                variant={viewMode === "bin" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("bin")}
                className={cn(
                  "h-7 text-xs gap-1",
                  viewMode === "bin"
                    ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    : "",
                )}
              >
                <Trash2 className="size-3" />
                Bin
              </Button>
            </div>

            {isSuperUser && viewMode === "active" && (
              <Link href="/contracts/upload">
                <Button size="sm" className="gap-1.5">
                  <Plus className="size-3.5" />
                  Add new
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-col lg:flex-row gap-2">
          <div className="relative flex-1 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-on-surface-variant group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Search by name, reinsured, or broker…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 bg-surface-container-low border-outline-variant/60 focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Select
              value={typeFilter}
              onValueChange={(v) => setTypeFilter(v as string)}
            >
              <SelectTrigger className="flex-1 lg:w-[140px] h-9 bg-surface-container-low border-outline-variant/60 rounded-md text-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <LayoutGrid className="size-3.5 text-primary shrink-0" />
                  <SelectValue placeholder="Type" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="type">All types</SelectItem>
                {availableContractTypes.map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={brokerFilter}
              onValueChange={(v) => setBrokerFilter(v as string)}
            >
              <SelectTrigger className="flex-1 lg:w-[140px] h-9 bg-surface-container-low border-outline-variant/60 rounded-md text-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Users className="size-3.5 text-primary shrink-0" />
                  <SelectValue placeholder="Broker" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="broker">All brokers</SelectItem>
                {availableBrokers.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "flex-1 lg:w-[180px] h-9 bg-surface-container-low border-outline-variant/60 rounded-md text-xs font-normal justify-start gap-1.5",
                    !dateFrom && !dateTo && "text-on-surface-variant",
                  )}
                >
                  <CalendarIcon className="size-3.5 text-primary" />
                  {dateFrom ? (
                    dateTo ? (
                      <>
                        {format(dateFrom, "dd MMM")} -{" "}
                        {format(dateTo, "dd MMM")}
                      </>
                    ) : (
                      format(dateFrom, "dd MMM")
                    )
                  ) : (
                    "Date range"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-auto p-0 rounded-3xl overflow-hidden shadow-2xl border-outline-variant"
                align="end"
              >
                <div className="p-4 bg-surface-container-highest/10 border-b border-outline-variant/30 flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider">
                    Select Range
                  </span>
                  {(dateFrom || dateTo) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDateFrom(undefined);
                        setDateTo(undefined);
                      }}
                      className="h-7 px-2 rounded-lg text-[9px] font-semibold uppercase"
                    >
                      Clear
                    </Button>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row">
                  <div className="p-2">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant mb-2 px-2">
                      From
                    </p>
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={setDateFrom}
                    />
                  </div>
                  <div className="p-2 border-l border-outline-variant/30">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant mb-2 px-2">
                      To
                    </p>
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={setDateTo}
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {(search ||
              typeFilter !== "type" ||
              brokerFilter !== "broker" ||
              dateFrom ||
              dateTo) && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setSearch("");
                  setTypeFilter("type");
                  setBrokerFilter("broker");
                  setDateFrom(undefined);
                  setDateTo(undefined);
                }}
                className="rounded-md hover:bg-destructive/10 text-destructive transition-all"
              >
                <X className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="bg-surface-container-low border border-outline-variant/60 rounded-xl overflow-hidden">
        {/* Header (Desktop) */}
        <div className="hidden lg:grid grid-cols-[2.5fr_1.5fr_1fr_1fr_1.2fr_1.2fr_1fr] gap-3 px-4 h-9 items-center bg-surface-container-highest/30 border-b border-outline-variant/40">
          <div className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Reference
          </div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Reinsured
          </div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant text-center">
            Type
          </div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            From
          </div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Execution
          </div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant text-center">
            Status
          </div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant text-right">
            Actions
          </div>
        </div>

        <div className="divide-y divide-outline-variant/30">
          <AnimatePresence mode="popLayout">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="pointer-events-none border-b border-outline-variant/30 last:border-0"
                >
                  {/* Desktop Row Skeleton */}
                  <div className="hidden lg:grid grid-cols-[2.5fr_1.5fr_1fr_1fr_1.2fr_1.2fr_1fr] gap-4 px-10 py-8 items-center">
                    <div className="flex items-center gap-4">
                      <Skeleton className="size-14 rounded-2xl shrink-0" />
                      <div className="space-y-2">
                        <Skeleton className="h-6 w-48 rounded-lg" />
                        <Skeleton className="h-3 w-24 rounded-lg" />
                      </div>
                    </div>
                    <div>
                      <Skeleton className="h-4 w-32 rounded-lg" />
                    </div>
                    <div className="flex justify-center">
                      <Skeleton className="h-8 w-24 rounded-full" />
                    </div>
                    <div>
                      <Skeleton className="h-4 w-20 rounded-lg" />
                    </div>
                    <div>
                      <Skeleton className="h-4 w-24 rounded-lg" />
                    </div>
                    <div className="flex justify-center">
                      <Skeleton className="h-8 w-24 rounded-full" />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Skeleton className="size-11 rounded-2xl shrink-0" />
                      <Skeleton className="size-11 rounded-2xl shrink-0" />
                    </div>
                  </div>

                  {/* Mobile Card Skeleton */}
                  <div className="lg:hidden p-6 space-y-4">
                    <div className="flex items-center gap-4">
                      <Skeleton className="size-12 rounded-xl" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Skeleton className="h-8 rounded-lg" />
                      <Skeleton className="h-8 rounded-lg" />
                    </div>
                  </div>
                </div>
              ))
            ) : paginated.length === 0 ? (
              <div className="py-16 text-center">
                <div className="flex flex-col items-center gap-2 opacity-40">
                  <FileText className="size-8" />
                  <p className="text-sm">
                    {viewMode === "active"
                      ? "No contracts match your filters"
                      : viewMode === "archive"
                        ? "Archive is empty"
                        : "Your trash bin is empty"}
                  </p>
                </div>
              </div>
            ) : (
              paginated.map((contract) => (
                <ContextMenu key={contract.id}>
                  <ContextMenuTrigger asChild>
                    <div className="group hover:bg-surface-container/50 transition-colors cursor-pointer">
                      {/* Desktop Row */}
                      <div className="hidden lg:grid grid-cols-[2.5fr_1.5fr_1fr_1fr_1.2fr_1.2fr_1fr] gap-3 px-4 py-2.5 items-center">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="size-7 bg-surface-container-highest rounded-md flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                            <FileText className="size-3.5 text-on-surface-variant group-hover:text-primary transition-colors" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-medium text-on-surface group-hover:text-primary transition-colors truncate">
                              {contract.contractName}
                            </span>
                            <span className="text-[11px] text-on-surface-variant font-mono">
                              PL-{contract.id.slice(0, 8).toUpperCase()}
                            </span>
                          </div>
                        </div>

                        <div className="text-sm text-on-surface truncate">
                          {contract.reinsured}
                        </div>

                        <div className="flex justify-center">
                          <Badge
                            variant="outline"
                            className="text-[11px] font-medium px-2 py-0.5 bg-surface-container border-outline-variant/60 text-on-surface-variant rounded-md whitespace-nowrap"
                          >
                            {contract.contractType}
                          </Badge>
                        </div>

                        <div className="text-on-surface-variant text-xs">
                          {contract.periodFrom
                            ? format(new Date(contract.periodFrom), "dd MMM yy")
                            : "—"}
                        </div>

                        <div className="text-on-surface-variant text-xs flex items-center gap-1.5">
                          <CalendarIcon className="size-3 opacity-40" />
                          {contract.periodFrom || contract.executionDate
                            ? format(
                                new Date(
                                  (contract.periodFrom ||
                                    contract.executionDate)!,
                                ),
                                "dd MMM yy",
                              )
                            : format(new Date(contract.createdAt), "dd MMM yy")}
                        </div>

                        <div className="flex justify-center">
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-md text-[11px] font-medium px-2 py-0.5 whitespace-nowrap",
                              getStatusStyle(contract.auditStatus || "pending"),
                            )}
                          >
                            {contract.auditStatus || "pending"}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-end gap-0.5">
                          <Link href={`/contracts/${contract.id}`}>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7 rounded-md hover:bg-primary/10 text-on-surface-variant hover:text-primary transition-all"
                            >
                              <ChevronRight className="size-3.5" />
                            </Button>
                          </Link>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
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
                                  router.push(`/contracts/${contract.id}`)
                                }
                              >
                                Open
                              </DropdownMenuItem>

                              {isSuperUser && viewMode === "active" && (
                                <>
                                  <DropdownMenuItem
                                    className="cursor-pointer text-xs text-amber-600 focus:text-amber-600"
                                    onClick={() => handleArchive(contract.id)}
                                  >
                                    <Archive className="mr-2 size-3.5" />
                                    Archive
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="cursor-pointer text-xs text-destructive focus:text-destructive"
                                    onClick={() => setDeleteId(contract.id)}
                                  >
                                    <Trash2 className="mr-2 size-3.5" />
                                    Move to bin
                                  </DropdownMenuItem>
                                </>
                              )}

                              {isSuperUser && viewMode === "archive" && (
                                <>
                                  <DropdownMenuItem
                                    className="cursor-pointer text-xs text-primary focus:text-primary"
                                    onClick={() => handleUnarchive(contract.id)}
                                  >
                                    <ArchiveRestore className="mr-2 size-3.5" />
                                    Restore
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="cursor-pointer text-xs text-destructive focus:text-destructive"
                                    onClick={() => setDeleteId(contract.id)}
                                  >
                                    <Trash2 className="mr-2 size-3.5" />
                                    Move to bin
                                  </DropdownMenuItem>
                                </>
                              )}

                              {isSuperUser && viewMode === "bin" && (
                                <>
                                  <DropdownMenuItem
                                    className="rounded-xl font-bold cursor-pointer text-primary h-12"
                                    onClick={() => handleRestore(contract.id)}
                                  >
                                    <RotateCcw className="mr-2 w-4 h-4" />
                                    Restore Contract
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="rounded-xl font-bold cursor-pointer text-destructive h-12"
                                    onClick={() => setDeleteId(contract.id)}
                                  >
                                    <Trash2 className="mr-2 w-4 h-4" />
                                    Delete Permanently
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      {/* Mobile Card */}
                      <div
                        className="lg:hidden p-6 flex flex-col gap-4"
                        onClick={() => router.push(`/contracts/${contract.id}`)}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="size-12 bg-surface-container-highest rounded-xl flex items-center justify-center shrink-0">
                              <FileText className="w-5 h-5 text-primary" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm font-medium text-on-surface truncate">
                                {contract.contractName}
                              </span>
                              <span className="text-[10px] font-medium text-on-surface-variant uppercase tracking-wider">
                                {contract.reinsured}
                              </span>
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-full font-semibold text-[8px] uppercase tracking-tighter px-2 py-1 h-fit",
                              getStatusStyle(contract.auditStatus || "pending"),
                            )}
                          >
                            {contract.auditStatus || "pending"}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-surface-container px-3 py-2 rounded-xl">
                            <span className="text-[10px] font-medium text-on-surface-variant uppercase tracking-wider block mb-1">
                              Type
                            </span>
                            <span className="text-[10px] font-bold text-on-surface uppercase truncate block">
                              {contract.contractType}
                            </span>
                          </div>
                          <div className="bg-surface-container px-3 py-2 rounded-xl">
                            <span className="text-[10px] font-medium text-on-surface-variant uppercase tracking-wider block mb-1">
                              Execution
                            </span>
                            <span className="text-[10px] font-bold text-on-surface uppercase block">
                              {contract.executionDate
                                ? format(
                                    new Date(contract.executionDate),
                                    "dd MMM yy",
                                  )
                                : format(
                                    new Date(contract.createdAt),
                                    "dd MMM yy",
                                  )}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-72">
                    <ContextMenuItem
                      onClick={() => router.push(`/contracts/${contract.id}`)}
                    >
                      <FileText className="mr-2" /> Access Portfolio
                    </ContextMenuItem>
                    <ContextMenuItem
                      onClick={() => {
                        navigator.clipboard.writeText(contract.id);
                        toast.success("Contract ID copied");
                      }}
                    >
                      <Copy className="mr-2" /> Copy Identifier
                    </ContextMenuItem>
                    {isSuperUser && (
                      <>
                        <ContextMenuSeparator />
                        {viewMode === "active" ? (
                          <>
                            <ContextMenuItem
                              onClick={() => handleArchive(contract.id)}
                            >
                              <Archive className="mr-2" /> Move to Archive
                            </ContextMenuItem>
                            <ContextMenuItem
                              variant="destructive"
                              onClick={() => setDeleteId(contract.id)}
                            >
                              <Trash2 className="mr-2" /> Move to Bin
                            </ContextMenuItem>
                          </>
                        ) : viewMode === "archive" ? (
                          <>
                            <ContextMenuItem
                              onClick={() => handleUnarchive(contract.id)}
                            >
                              <ArchiveRestore className="mr-2" /> Restore to
                              Active
                            </ContextMenuItem>
                            <ContextMenuItem
                              variant="destructive"
                              onClick={() => setDeleteId(contract.id)}
                            >
                              <Trash2 className="mr-2" /> Move to Bin
                            </ContextMenuItem>
                          </>
                        ) : (
                          <>
                            <ContextMenuItem
                              onClick={() => handleRestore(contract.id)}
                            >
                              <RotateCcw className="mr-2" /> Restore Contract
                            </ContextMenuItem>
                            <ContextMenuItem
                              variant="destructive"
                              onClick={() => setDeleteId(contract.id)}
                            >
                              <Trash2 className="mr-2" /> Delete Permanently
                            </ContextMenuItem>
                          </>
                        )}
                      </>
                    )}
                  </ContextMenuContent>
                </ContextMenu>
              ))
            )}
          </AnimatePresence>
        </div>

        {/* Pagination Footer */}
        <div className="px-4 py-2.5 border-t border-outline-variant/40 flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface-container-highest/20">
          <div className="text-xs text-on-surface-variant">
            <span className="text-on-surface font-medium">{filtered.length}</span>{" "}
            {viewMode === "active"
              ? filtered.length === 1
                ? "active contract"
                : "active contracts"
              : viewMode === "archive"
                ? filtered.length === 1
                  ? "archived contract"
                  : "archived contracts"
                : filtered.length === 1
                  ? "deleted contract"
                  : "deleted contracts"}
          </div>

          <Pagination className="w-auto mx-0">
            <PaginationContent className="gap-1">
              <PaginationPrevious
                className="h-7 px-2.5 rounded-md border-outline-variant/60 hover:bg-background text-xs"
                onClick={() => page > 1 && setPage(page - 1)}
              />
              <div className="hidden sm:flex items-center gap-1 mx-1">
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
              <PaginationNext
                className="h-7 px-2.5 rounded-md border-outline-variant/60 hover:bg-background text-xs"
                onClick={() => page < totalPages && setPage(page + 1)}
              />
            </PaginationContent>
          </Pagination>
        </div>
      </div>

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold tracking-tight">
              {viewMode === "active" || viewMode === "archive"
                ? "Move to bin?"
                : "Delete permanently?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-on-surface-variant">
              {viewMode === "active" || viewMode === "archive"
                ? "This contract will be moved to the bin. You can restore it within 7 days before it is permanently deleted."
                : "This action cannot be undone. The contract and its analysis history will be permanently removed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting
                ? "Deleting…"
                : viewMode === "active" || viewMode === "archive"
                  ? "Move to bin"
                  : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
