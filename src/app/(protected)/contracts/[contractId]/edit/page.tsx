"use client";

import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { useParams, useRouter } from "next/navigation";
import {
  CalendarIcon,
  FileText,
  CheckCircle2,
  Loader2,
  Sparkles,
  Building2,
  LayoutGrid,
  Lock,
  ArrowLeft,
  Users,
  BookOpen,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function EditContractPage() {
  const { contractId } = useParams() as { contractId: string };
  const router = useRouter();

  const [contractName, setContractName] = useState("");
  const [reinsured, setReinsured] = useState("");
  const [broker, setBroker] = useState("");
  const [contractType, setContractType] = useState<string>("");
  const [periodFrom, setPeriodFrom] = useState<Date | undefined>(undefined);
  const [periodTo, setPeriodTo] = useState<Date | undefined>(undefined);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [workspaceType, setWorkspaceType] = useState<string>("reinsurance");

  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<string>>(
    new Set(),
  );
  const [availableRules, setAvailableRules] = useState<any[]>([]);
  const [loadingRules, setLoadingRules] = useState(true);

  const { data: session } = authClient.useSession();
  const { data: activeOrg, isPending } = authClient.useActiveOrganization();
  const activeMember = activeOrg?.members?.find(
    (m: any) => m.userId === session?.user?.id,
  );
  const isSuperUser =
    (activeMember?.role as string) === "su" ||
    (activeMember?.role as string) === "psa";

  useEffect(() => {
    const fetchRules = async (workspaceId?: string) => {
      try {
        const url = workspaceId
          ? `/api/rules?workspaceId=${workspaceId}`
          : "/api/rules";
        const res = await fetch(url);
        const data = await res.json();
        const rules = Array.isArray(data) ? data : (data.rules ?? []);
        const activeRules = rules.filter((r: any) => r.status === "active");
        setAvailableRules(activeRules);
      } finally {
        setLoadingRules(false);
      }
    };

    const loadContract = async () => {
      try {
        const res = await fetch(`/api/contracts/${contractId}`);
        if (!res.ok) throw new Error("Failed to load contract");
        const data = await res.json();
        setContractName(data.contractName || "");
        setReinsured(data.reinsured || "");
        setBroker(data.broker || "");
        setContractType(data.contractType);
        setPeriodFrom(data.periodFrom ? new Date(data.periodFrom) : undefined);
        setPeriodTo(data.periodTo ? new Date(data.periodTo) : undefined);
        setSelectedRuleIds(new Set(data.selectedRuleIds || []));

        // Fetch rules for THIS contract's workspace
        if (data.workspaceId) {
          fetchRules(data.workspaceId);
        } else {
          fetchRules();
        }

        // Fetch workspace type
        try {
          const wsRes = await fetch("/api/workspaces/active");
          const wsData = await wsRes.json();
          if (wsData.type) setWorkspaceType(wsData.type);
        } catch (e) {
          console.error("Failed to fetch active workspace:", e);
        }
      } catch (err) {
        toast.error("Error loading contract details");
        router.push(`/contracts/${contractId}`);
      } finally {
        setLoading(false);
      }
    };

    if (contractId) {
      loadContract();
    }
  }, [contractId, router]);

  const handleToggleRule = (id: string) => {
    setSelectedRuleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getRuleKind = (rule: any): "exclusion" | "condition" => {
    const hay = `${rule.name ?? ""} ${rule.category ?? ""}`.toLowerCase();
    return hay.includes("exclusion") ? "exclusion" : "condition";
  };

  const handleSelectOnlyKind = (kind: "exclusion" | "condition") => {
    const matchingRules = availableRules.filter((r) => getRuleKind(r) === kind);
    setSelectedRuleIds(new Set(matchingRules.map((r) => r.id)));
    toast.success(`Selected only ${kind} rules`);
  };

  const handleSelectAll = () => {
    const allIds = new Set(availableRules.map((r) => r.id));
    setSelectedRuleIds(allIds);
    toast.success("All rules selected");
  };

  const handleDeselectAll = () => {
    setSelectedRuleIds(new Set());
    toast.info("All rules deselected");
  };

  if (!isPending && !isSuperUser) {
    return (
      <main className="flex-1 p-6 lg:p-10 bg-background flex items-center justify-center min-h-[80vh]">
        <div className="flex flex-col items-center max-w-md text-center space-y-4">
          <Lock className="w-16 h-16 text-primary mb-4" />
          <h1 className="text-3xl font-black uppercase text-on-surface tracking-tighter">
            Access Denied
          </h1>
          <p className="text-on-surface-variant font-medium">
            You do not have the required role to edit contracts.
          </p>
          <Button
            onClick={() => window.history.back()}
            className="mt-8 rounded-full font-black uppercase tracking-widest px-8"
          >
            Return
          </Button>
        </div>
      </main>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractName || !reinsured || !contractType) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/contracts/${contractId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractName,
          reinsured,
          broker,
          contractType,
          periodFrom: periodFrom?.toISOString(),
          periodTo: periodTo?.toISOString(),
          selectedRuleIds: Array.from(selectedRuleIds),
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to update contract");
      }

      toast.success("Contract re-calibrated successfully!");

      // Auto-trigger analysis re-run after recalculation
      try {
        await fetch(`/api/contracts/${contractId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ force: true }),
        });
        toast.info("AI Analysis restarted with new parameters.");
      } catch (e) {
        console.error("Failed to auto-restart analysis:", e);
      }

      router.push(`/contracts/${contractId}`);
      router.refresh();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Error updating contract");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center bg-background min-h-[50vh]">
        <div className="flex flex-col items-center gap-4 text-primary animate-pulse">
          <Loader2 className="w-12 h-12 animate-spin" />
          <span className="font-black uppercase tracking-widest text-xs">
            Loading Neural Data...
          </span>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 p-6 lg:p-10 bg-background transition-colors duration-300">
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-6">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink
                  href="/contracts"
                  className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant hover:text-primary transition-colors"
                >
                  Portfolio Archive
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-on-surface-variant" />
              <BreadcrumbItem>
                <BreadcrumbLink
                  href={`/contracts/${contractId}`}
                  className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant hover:text-primary transition-colors"
                >
                  {contractName || "Contract"}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-on-surface-variant" />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface">
                  Re-calibrate
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <Link href={`/contracts/${contractId}`}>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-on-surface">
                Re-Calibrate
              </h1>
            </div>
            <p className="text-on-surface-variant text-lg font-medium max-w-2xl ml-14">
              Adjust semantic metadata and core parameters for the analysis
              engine.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
        <div className="xl:col-span-12">
          <div className="bg-surface-container-low border border-outline-variant rounded-xl p-8 lg:p-12 shadow-sm">
            <div className="flex items-center gap-4 mb-12">
              <div className="p-3 bg-secondary/10 rounded-2xl">
                <Sparkles className="w-6 h-6 text-secondary" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-on-surface uppercase tracking-tight">
                  Metadata Edit
                </h2>
                <p className="text-on-surface-variant text-sm font-medium">
                  Update the core parameters for AI contextualization.
                </p>
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            >
              {/* Unique Market Reference */}
              <div className="space-y-3">
                <Label className="text-xs font-medium uppercase tracking-wider text-on-surface-variant ml-1 flex items-center gap-2">
                  <FileText className="w-3 h-3 text-primary" />{" "}
                  {workspaceType === "property"
                    ? "Policy Number"
                    : "Unique Market Reference"}
                </Label>
                <Input
                  value={contractName}
                  onChange={(e) => setContractName(e.target.value)}
                  placeholder="e.g. B133821CON0016"
                  className="bg-background transition-all focus:ring-4 focus:ring-primary/10"
                />
              </div>

              {/* Reinsured */}
              <div className="space-y-3">
                <Label className="text-xs font-medium uppercase tracking-wider text-on-surface-variant ml-1 flex items-center gap-2">
                  <Building2 className="w-3 h-3 text-secondary" />{" "}
                  {workspaceType === "property" ? "Policyholder" : "Reinsured"}
                </Label>
                <Input
                  value={reinsured}
                  onChange={(e) => setReinsured(e.target.value)}
                  placeholder="e.g. Global Re Corp"
                  className="bg-background transition-all focus:ring-4 focus:ring-secondary/10"
                />
              </div>

              {/* Broker */}
              <div className="space-y-3">
                <Label className="text-xs font-medium uppercase tracking-wider text-on-surface-variant ml-1 flex items-center gap-2">
                  <Users className="w-3 h-3 text-indigo-500" /> Broker
                </Label>
                <Input
                  value={broker}
                  onChange={(e) => setBroker(e.target.value)}
                  placeholder="e.g. Aon, Willis Towers Watson"
                  className="bg-background transition-all focus:ring-4 focus:ring-indigo-500/10"
                />
              </div>

              {/* Contract Type */}
              <div className="space-y-3">
                <Label className="text-xs font-medium uppercase tracking-wider text-on-surface-variant ml-1 flex items-center gap-2">
                  <LayoutGrid className="w-3 h-3 text-amber-500" />{" "}
                  {workspaceType === "property" ? "Type" : "Contract Type"}
                </Label>
                <Input
                  value={contractType}
                  onChange={(e) => setContractType(e.target.value)}
                  placeholder="e.g. Excess Aviation of Loss"
                  className="bg-background transition-all focus:ring-4 focus:ring-amber-500/10"
                />
              </div>

              {/* Period From */}
              <div className="space-y-3">
                <Label className="text-xs font-medium uppercase tracking-wider text-on-surface-variant ml-1 flex items-center gap-2">
                  <CalendarIcon className="w-3 h-3 text-violet-500" /> Period
                  From
                </Label>
                <Popover>
                  <PopoverTrigger className="h-14 w-full bg-background border-outline-variant rounded-2xl font-bold justify-start text-left px-4 flex items-center transition-all focus:ring-4 focus:ring-primary/10 hover:border-primary/50 text-on-surface">
                    <CalendarIcon className="mr-2 h-4 w-4 text-on-surface-variant group-hover:text-primary" />
                    {periodFrom
                      ? format(periodFrom, "dd MMM yyyy")
                      : "Pick Date"}
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-auto p-0 rounded-2xl"
                    align="start"
                  >
                    <Calendar
                      mode="single"
                      selected={periodFrom}
                      defaultMonth={periodFrom}
                      onSelect={setPeriodFrom}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Period To */}
              <div className="space-y-3">
                <Label className="text-xs font-medium uppercase tracking-wider text-on-surface-variant ml-1 flex items-center gap-2">
                  <CalendarIcon className="w-3 h-3 text-rose-500" /> Period To
                </Label>
                <Popover>
                  <PopoverTrigger className="h-14 w-full bg-background border-outline-variant rounded-2xl font-bold justify-start text-left px-4 flex items-center transition-all focus:ring-4 focus:ring-primary/10 hover:border-primary/50 text-on-surface">
                    <CalendarIcon className="mr-2 h-4 w-4 text-on-surface-variant group-hover:text-primary" />
                    {periodTo ? format(periodTo, "dd MMM yyyy") : "Pick Date"}
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-auto p-0 rounded-2xl"
                    align="start"
                  >
                    <Calendar
                      mode="single"
                      selected={periodTo}
                      defaultMonth={periodTo}
                      onSelect={setPeriodTo}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Rule Selection Architecture */}
              <div className="lg:col-span-3 space-y-6 pt-12 border-t border-outline-variant/30">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-xl font-black text-on-surface uppercase tracking-tight flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-primary" /> Rules List
                    </h3>
                    <p className="text-sm font-medium text-on-surface-variant">
                      Select specific rules for this contract analysis.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleSelectOnlyKind("exclusion")}
                      className="rounded-xl font-black uppercase tracking-widest text-[9px] h-10 px-4 border-rose-500/20 text-rose-500 hover:bg-rose-500/10 transition-colors"
                    >
                      Exclusion Rules
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleSelectOnlyKind("condition")}
                      className="rounded-xl font-black uppercase tracking-widest text-[9px] h-10 px-4 border-amber-500/20 text-amber-500 hover:bg-amber-500/10 transition-colors"
                    >
                      Condition Rules
                    </Button>

                    <div className="w-px h-10 bg-outline-variant/30 mx-2 hidden md:block" />

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAll}
                      className="rounded-xl font-black uppercase tracking-widest text-[9px] h-10 px-4 border-primary/20 text-primary hover:bg-primary/10 transition-colors"
                    >
                      Select All
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleDeselectAll}
                      className="rounded-xl font-black uppercase tracking-widest text-[9px] h-10 px-4 border-outline-variant text-on-surface-variant hover:bg-surface-container transition-colors"
                    >
                      Deselect All
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {loadingRules ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-24 bg-surface-container animate-pulse rounded-2xl"
                      />
                    ))
                  ) : availableRules.length === 0 ? (
                    <div className="col-span-full py-12 text-center bg-surface-container/50 rounded-lg border border-dashed border-outline-variant">
                      <p className="text-on-surface-variant font-black uppercase tracking-widest text-xs">
                        No rules found in this workspace
                      </p>
                    </div>
                  ) : (
                    availableRules.map((rule) => (
                      <div
                        key={rule.id}
                        className={cn(
                          "group relative p-5 rounded-2xl border transition-all duration-300 cursor-pointer flex items-start gap-4",
                          selectedRuleIds.has(rule.id)
                            ? "bg-primary/5 border-primary/40 shadow-sm"
                            : "bg-background border-outline-variant hover:border-primary/30",
                        )}
                        onClick={() => handleToggleRule(rule.id)}
                      >
                        <Checkbox
                          checked={selectedRuleIds.has(rule.id)}
                          onCheckedChange={() => handleToggleRule(rule.id)}
                          className="mt-1 rounded-md border-2"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-on-surface text-sm truncate uppercase tracking-tight">
                              {rule.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className="text-[8px] font-black uppercase px-2 py-0 h-4 border-outline-variant/50 text-on-surface-variant"
                            >
                              {rule.category}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="lg:col-span-3 pt-12 border-t border-outline-variant/30 flex flex-col md:flex-row items-center justify-end gap-6">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full md:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-black px-5 py-2 rounded-md flex items-center gap-3 text-lg  transition-all"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      UPDATING...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      SAVE RE-CALIBRATION
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
