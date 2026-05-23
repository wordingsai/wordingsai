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
    <main className="flex-1 p-4 lg:p-10 bg-background transition-colors duration-300 overflow-x-hidden">
      {/* Page Header */}
      <div className="mb-6 lg:mb-10">
        <div className="flex items-center gap-2 mb-4 lg:mb-6">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant">
                  Portfolio Management
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-3xl lg:text-5xl font-black tracking-tighter uppercase text-on-surface">
              {viewMode === "active"
                ? "Contract Portfolio"
                : viewMode === "archive"
                  ? "Archive"
                  : "Trash Bin"}
            </h1>
            <p className="text-on-surface-variant text-base lg:text-lg font-medium max-w-2xl">
              {viewMode === "active"
                ? "Centralized repository for all wordings and neural reinsurance documentation."
                : viewMode === "archive"
                  ? "Archived contracts are stored for reference. The 10 most recent stay in Active automatically."
                  : "Contracts here will be permanently deleted after 7 days."}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex gap-1 p-1 bg-surface-container-low border border-outline-variant rounded-2xl">
              <Button
                variant={viewMode === "active" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("active")}
                className={cn(
                  "h-10 px-6 rounded-xl font-black uppercase tracking-widest text-[10px]",
                  viewMode === "active" ? "shadow-lg shadow-primary/20" : "",
                )}
              >
                Active
              </Button>
              <Button
                variant={viewMode === "archive" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("archive")}
                className={cn(
                  "h-10 px-6 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2",
                  viewMode === "archive"
                    ? "bg-amber-500 text-white shadow-lg shadow-amber-500/20"
                    : "",
                )}
              >
                <Archive className="w-4 h-4" />
                Archive
              </Button>
              <Button
                variant={viewMode === "bin" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("bin")}
                className={cn(
                  "h-10 px-6 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2",
                  viewMode === "bin"
                    ? "bg-destructive text-destructive-foreground shadow-lg shadow-destructive/20"
                    : "",
                )}
              >
                <Trash2 className="w-4 h-4" />
                Bin
              </Button>
            </div>

            {isSuperUser && viewMode === "active" && (
              <Link href="/contracts/upload" className="w-full lg:w-auto">
                <Button
                  size="lg"
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-black px-8 py-7 rounded-2xl shadow-xl shadow-primary/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                >
                  <Plus className="w-5 h-5" />
                  ADD NEW WORDING
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-4 mb-6 lg:mb-8">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Search by name, reinsured, or broker..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-12 bg-surface-container-low border-outline-variant h-14 rounded-2xl text-base lg:text-lg font-medium shadow-sm transition-all focus:ring-4 focus:ring-primary/10"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Select
              value={typeFilter}
              onValueChange={(v) => setTypeFilter(v as string)}
            >
              <SelectTrigger className="flex-1 lg:w-[160px] h-14 bg-surface-container-low border-outline-variant rounded-2xl font-black uppercase tracking-widest text-[10px]">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4 text-primary" />
                  <SelectValue placeholder="Type" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="type">All Types</SelectItem>
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
              <SelectTrigger className="flex-1 lg:w-[160px] h-14 bg-surface-container-low border-outline-variant rounded-2xl font-black uppercase tracking-widest text-[10px]">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <SelectValue placeholder="Broker" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="broker">All Brokers</SelectItem>
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
                    "flex-1 lg:w-[200px] h-14 bg-surface-container-low border-outline-variant rounded-2xl font-black uppercase tracking-widest text-[10px] justify-start gap-2",
                    !dateFrom && !dateTo && "text-on-surface-variant",
                  )}
                >
                  <CalendarIcon className="w-4 h-4 text-primary" />
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
                    "Date Range"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-auto p-0 rounded-3xl overflow-hidden shadow-2xl border-outline-variant"
                align="end"
              >
                <div className="p-4 bg-surface-container-highest/10 border-b border-outline-variant/30 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest">
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
                      className="h-7 px-2 rounded-lg text-[9px] font-black uppercase"
                    >
                      Clear
                    </Button>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row">
                  <div className="p-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant mb-2 px-2">
                      From
                    </p>
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={setDateFrom}
                    />
                  </div>
                  <div className="p-2 border-l border-outline-variant/30">
                    <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant mb-2 px-2">
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
                className="h-14 w-14 rounded-2xl hover:bg-destructive/10 text-destructive transition-all"
              >
                <X className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="bg-surface-container-low border border-outline-variant rounded-[2rem] lg:rounded-[3rem] overflow-hidden shadow-sm">
        {/* Header (Desktop) */}
        <div className="hidden lg:grid grid-cols-[2.5fr_1.5fr_1fr_1fr_1.2fr_1.2fr_1fr] gap-4 px-10 py-7 bg-surface-container-highest/30 border-b border-outline-variant/50">
          <div className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
            Reference
          </div>
          <div className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
            Reinsured
          </div>
          <div className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant text-center">
            Type
          </div>
          <div className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
            From
          </div>
          <div className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
            Execution
          </div>
          <div className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant text-center">
            Status
          </div>
          <div className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant text-right">
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
              <div className="py-32 text-center">
                <div className="flex flex-col items-center gap-4 opacity-30">
                  <FileText className="w-20 h-20" />
                  <p className="text-xl font-bold uppercase tracking-widest">
                    {viewMode === "active"
                      ? "No results discovered."
                      : viewMode === "archive"
                        ? "Archive is empty."
                        : "Your trash bin is empty."}
                  </p>
                </div>
              </div>
            ) : (
              paginated.map((contract) => (
                <ContextMenu key={contract.id}>
                  <ContextMenuTrigger asChild>
                    <div className="group hover:bg-surface-container/50 transition-colors cursor-pointer">
                      {/* Desktop Row */}
                      <div className="hidden lg:grid grid-cols-[2.5fr_1.5fr_1fr_1fr_1.2fr_1.2fr_1fr] gap-4 px-10 py-8 items-center">
                        <div className="flex items-center gap-6 min-w-0">
                          <div className="size-14 bg-surface-container-highest rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                            <FileText className="w-6 h-6 text-on-surface-variant group-hover:text-primary transition-colors" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-black text-xl text-on-surface uppercase tracking-tight group-hover:text-primary transition-colors truncate">
                              {contract.contractName}
                            </span>
                            <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest mt-1">
                              ID: PL-{contract.id.slice(0, 8).toUpperCase()}
                            </span>
                          </div>
                        </div>

                        <div className="font-bold text-sm text-on-surface truncate">
                          {contract.reinsured}
                        </div>

                        <div className="flex justify-center">
                          <Badge
                            variant="outline"
                            className="font-black tracking-widest text-[10px] uppercase bg-surface-container p-2.5 border-outline-variant text-on-surface-variant rounded-full whitespace-nowrap"
                          >
                            {contract.contractType}
                          </Badge>
                        </div>

                        <div className="text-on-surface-variant font-bold text-sm uppercase">
                          {contract.periodFrom
                            ? format(new Date(contract.periodFrom), "dd MMM yy")
                            : "—"}
                        </div>

                        <div className="text-on-surface-variant font-bold text-sm uppercase flex items-center gap-2">
                          <CalendarIcon className="w-4 h-4 opacity-30" />
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
                              "rounded-full font-black text-[10px] uppercase tracking-tighter p-2.5 whitespace-nowrap",
                              getStatusStyle(contract.auditStatus || "pending"),
                            )}
                          >
                            {contract.auditStatus || "pending"}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/contracts/${contract.id}`}>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-11 rounded-2xl hover:bg-primary/10 text-on-surface-variant hover:text-primary transition-all"
                            >
                              <ChevronRight className="w-6 h-6" />
                            </Button>
                          </Link>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-11 rounded-2xl hover:bg-surface-container-highest transition-all"
                              >
                                <MoreHorizontal className="w-6 h-6" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="rounded-2xl w-56 p-2 border-outline-variant shadow-2xl"
                            >
                              <DropdownMenuItem
                                className="rounded-xl font-bold cursor-pointer h-12"
                                onClick={() =>
                                  router.push(`/contracts/${contract.id}`)
                                }
                              >
                                Access Portfolio
                              </DropdownMenuItem>

                              {isSuperUser && viewMode === "active" && (
                                <>
                                  <DropdownMenuItem
                                    className="rounded-xl font-bold cursor-pointer text-amber-600 h-12"
                                    onClick={() => handleArchive(contract.id)}
                                  >
                                    <Archive className="mr-2 w-4 h-4" />
                                    Move to Archive
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="rounded-xl font-bold cursor-pointer text-destructive h-12"
                                    onClick={() => setDeleteId(contract.id)}
                                  >
                                    Move to Bin
                                  </DropdownMenuItem>
                                </>
                              )}

                              {isSuperUser && viewMode === "archive" && (
                                <>
                                  <DropdownMenuItem
                                    className="rounded-xl font-bold cursor-pointer text-primary h-12"
                                    onClick={() => handleUnarchive(contract.id)}
                                  >
                                    <ArchiveRestore className="mr-2 w-4 h-4" />
                                    Restore to Active
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="rounded-xl font-bold cursor-pointer text-destructive h-12"
                                    onClick={() => setDeleteId(contract.id)}
                                  >
                                    <Trash2 className="mr-2 w-4 h-4" />
                                    Move to Bin
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
                              <span className="font-black text-lg text-on-surface uppercase tracking-tight truncate">
                                {contract.contractName}
                              </span>
                              <span className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest">
                                {contract.reinsured}
                              </span>
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-full font-black text-[8px] uppercase tracking-tighter px-2 py-1 h-fit",
                              getStatusStyle(contract.auditStatus || "pending"),
                            )}
                          >
                            {contract.auditStatus || "pending"}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-surface-container px-3 py-2 rounded-xl">
                            <span className="text-[8px] font-black text-on-surface-variant uppercase tracking-widest block mb-1">
                              Type
                            </span>
                            <span className="text-[10px] font-bold text-on-surface uppercase truncate block">
                              {contract.contractType}
                            </span>
                          </div>
                          <div className="bg-surface-container px-3 py-2 rounded-xl">
                            <span className="text-[8px] font-black text-on-surface-variant uppercase tracking-widest block mb-1">
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
        <div className="p-6 lg:p-10 border-t border-outline-variant flex flex-col sm:flex-row items-center justify-between gap-6 bg-surface-container-highest/20">
          <div className="text-[10px] lg:text-[11px] font-black uppercase tracking-widest text-on-surface-variant text-center sm:text-left">
            Capacity: <span className="text-on-surface">{filtered.length}</span>{" "}
            {viewMode === "active"
              ? "Active Wordings"
              : viewMode === "archive"
                ? "Archived Wordings"
                : "Deleted Wordings"}
          </div>

          <Pagination className="w-auto mx-0">
            <PaginationContent className="gap-1 lg:gap-2">
              <PaginationPrevious
                className="rounded-xl border-outline-variant hover:bg-background h-10 px-3 lg:px-4"
                onClick={() => page > 1 && setPage(page - 1)}
              />
              <div className="hidden sm:flex items-center gap-1.5 mx-2">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => (
                  <Button
                    key={i}
                    variant={page === i + 1 ? "default" : "outline"}
                    className={cn(
                      "h-10 w-10 rounded-xl font-black text-sm",
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
              <PaginationNext
                className="rounded-xl border-outline-variant hover:bg-background h-10 px-3 lg:px-4"
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
        <AlertDialogContent className="rounded-[2.5rem] p-10 max-w-[90vw] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl lg:text-3xl font-black uppercase tracking-tighter">
              {viewMode === "active" || viewMode === "archive"
                ? "Move to Bin"
                : "Confirm Permanent Deletion"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base lg:text-lg font-medium leading-relaxed">
              {viewMode === "active" || viewMode === "archive"
                ? "This document will be moved to the bin. You can restore it within 7 days before it is permanently deleted."
                : "This action is irreversible. The contract and all its associated neural analysis, extraction data, and audit history will be permanently removed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 lg:mt-10 gap-3">
            <AlertDialogCancel className="h-12 lg:h-14 px-6 rounded-2xl font-black uppercase tracking-widest text-[11px] border-outline-variant">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              className="h-12 lg:h-14 px-6 rounded-2xl font-black uppercase tracking-widest text-[11px] bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-xl shadow-destructive/20"
            >
              {isDeleting
                ? "Deleting..."
                : viewMode === "active" || viewMode === "archive"
                  ? "Move to Bin"
                  : "Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
