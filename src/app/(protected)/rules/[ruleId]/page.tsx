"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { useRouter, useParams } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbLink,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ShieldCheck,
  Globe,
  Zap,
  AlertTriangle,
  FileText,
  Settings,
  History,
  Scale,
  Plus,
  Target,
  ListChecks,
  BookOpen,
  Fingerprint,
  TrendingDown,
  ChevronRight,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { authClient } from "@/lib/auth-client";
import { useCurrentPlan } from "@/hooks/use-current-plan";
import { RuleDefinition } from "@/types/rule-types";

type RuleVersion = {
  id: string;
  versionNumber: number;
  ruleDefinition: RuleDefinition;
  createdAt: string;
};

type Rule = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  isGlobal: boolean;
  status: string;
  currentVersionId: string | null;
  currentVersion?: RuleVersion | null;
  createdAt: string;
  updatedAt: string;
  isEditable?: boolean;
};

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

export default function IndividualRulePage(props: {
  params: Promise<any>;
  searchParams: Promise<any>;
}) {
  const router = useRouter();
  const { plan, isPending: isPlanPending } = useCurrentPlan();
  const { data: activeOrg, isPending: isOrgPending } =
    authClient.useActiveOrganization();
  const { ruleId } = useParams() as { ruleId: string };

  const [rule, setRule] = useState<Rule | null>(null);
  const [loading, setLoading] = useState(true);

  const { data: session } = authClient.useSession();
  const isPSA = (session?.session as any)?.role === "psa";

  useEffect(() => {
    if (!isOrgPending && !isPlanPending && activeOrg) {
      if (plan !== "plus" && !isPSA) {
        toast.error("Rule Configuration is a Plus feature.", {
          description: "Please upgrade your plan to manage organization rules.",
        });
        router.push("/dashboard");
      }
    }
  }, [activeOrg, isOrgPending, isPlanPending, plan, isPSA, router]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const ruleRes = await fetch(`/api/rules/${ruleId}`);
        if (!ruleRes.ok) throw new Error("Failed to load rule");
        setRule(await ruleRes.json());
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [ruleId]);

  if (loading) {
    return (
      <main className="flex-1 p-6 lg:p-10 bg-background">
        <div className="animate-pulse space-y-8">
          <Skeleton className="h-6 w-64 rounded-lg" />
          <Skeleton className="h-12 w-full max-w-lg rounded-2xl" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <Skeleton className="lg:col-span-7 h-[600px] rounded-xl" />
            <Skeleton className="lg:col-span-5 h-[600px] rounded-xl" />
          </div>
        </div>
      </main>
    );
  }

  if (!rule)
    return (
      <div className="p-20 text-center font-black uppercase tracking-widest opacity-20">
        Rule record not found
      </div>
    );

  const currentVersion = rule.currentVersion;
  const definition: RuleDefinition =
    (currentVersion?.ruleDefinition as RuleDefinition) ||
    ({} as RuleDefinition);

  return (
    <main className="flex-1 p-6 lg:p-10 bg-background transition-colors duration-300">
      {/* Page Header */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-6">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink
                  href="/rules"
                  className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant hover:text-primary transition-colors"
                >
                  Rule Configuration
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-on-surface-variant" />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface">
                  {rule.name}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-on-surface">
                {rule.name}
              </h1>
              <Badge
                variant="outline"
                className="rounded-full text-xs font-medium uppercase px-3 py-1 bg-surface-container text-on-surface-variant border-outline-variant"
              >
                {rule.category}
              </Badge>
              {rule.isGlobal && (
                <Badge className="rounded-full text-xs font-medium uppercase px-3 py-1 bg-primary/10 text-primary border-primary/20">
                  GLOBAL
                </Badge>
              )}
            </div>
            <p className="text-on-surface-variant font-medium flex items-center gap-2">
              <Scale className="w-4 h-4 text-primary" />
              HIGH-FIDELITY REGULATORY LOGIC
            </p>
          </div>

          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline"
              size="lg"
              disabled={!isPSA && (rule.isGlobal || rule.isEditable === false)}
              className="rounded-2xl border-outline-variant font-black uppercase tracking-widest text-[11px] h-12 px-6"
              onClick={() => (window.location.href = `/rules/${rule.id}/edit`)}
            >
              <Settings className="w-4 h-4 mr-2" /> Edit
            </Button>
            <Button
              size="lg"
              disabled={!isPSA && (rule.isGlobal || rule.isEditable === false)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-black px-6 h-12 rounded-2xl shadow-xl shadow-primary/20 flex items-center gap-2 transition-all "
              onClick={() => (window.location.href = `/rules/${rule.id}/edit`)}
            >
              <Plus className="w-5 h-5" /> NEW VERSION
            </Button>
          </div>
        </div>
      </div>

      {/* Two-column balanced layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT — Description + Scoring benchmarks */}
        <div className="lg:col-span-7 space-y-8">
          {/* Functional Summary */}
          <Card className="bg-surface-container-low border border-outline-variant rounded-xl overflow-hidden shadow-sm">
            <CardHeader className="p-7 border-b border-outline-variant/30 bg-surface-container-highest/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-primary" />
                  <CardTitle className="text-sm font-semibold uppercase tracking-widest text-on-surface">
                    Functional Summary
                  </CardTitle>
                </div>
                <Badge
                  variant="outline"
                  className="rounded-full text-[10px] font-medium uppercase tracking-wider px-3 border-outline-variant"
                >
                  v{currentVersion?.versionNumber || 1}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-8 lg:p-10 bg-background space-y-6">
              <p className="text-lg font-medium leading-relaxed text-on-surface tracking-tight">
                {rule.description ||
                  "No semantic description provided for this rule."}
              </p>
              {definition.appliesTo && (
                <div className="p-5 bg-surface-container-low border border-outline-variant rounded-2xl flex items-start gap-4">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-on-surface-variant shrink-0 mt-0.5">
                    <Fingerprint className="w-4 h-4" /> Scope:
                  </div>
                  <p className="text-sm font-bold text-on-surface tracking-tight">
                    {definition.appliesTo}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Vetting Benchmarks */}
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <TrendingDown className="w-5 h-5 text-primary" />
              <h3 className="text-base font-semibold tracking-tighter">
                Vetting Benchmarks
              </h3>
            </div>

            {/* Green */}
            <Card className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-7">
              <div className="flex items-center gap-4 mb-5">
                <div className="p-3 bg-emerald-500/10 rounded-2xl shrink-0">
                  <ShieldCheck className="w-5 h-5 text-emerald-500" />
                </div>
                <p className="text-xs font-medium uppercase tracking-wider text-emerald-500">
                  Tier 1 — Optimal
                </p>
              </div>
              <ul className="space-y-3">
                {definition.greenCriteria &&
                definition.greenCriteria.length > 0 ? (
                  definition.greenCriteria.map((item, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 text-sm font-medium text-on-surface"
                    >
                      <ChevronRight className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))
                ) : (
                  <p className="text-xs text-on-surface-variant italic">
                    No green criteria defined.
                  </p>
                )}
              </ul>
            </Card>

            {/* Amber */}
            <Card className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-7">
              <div className="flex items-center gap-4 mb-5">
                <div className="p-3 bg-amber-500/10 rounded-2xl shrink-0">
                  <Zap className="w-5 h-5 text-amber-500" />
                </div>
                <p className="text-xs font-medium uppercase tracking-wider text-amber-500">
                  Tier 2 — Warning
                </p>
              </div>
              <ul className="space-y-3">
                {definition.amberCriteria &&
                definition.amberCriteria.length > 0 ? (
                  definition.amberCriteria.map((item, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 text-sm font-medium text-on-surface"
                    >
                      <ChevronRight className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))
                ) : (
                  <p className="text-xs text-on-surface-variant italic">
                    No amber criteria defined.
                  </p>
                )}
              </ul>
            </Card>

            {/* Red */}
            <Card className="bg-destructive/5 border border-destructive/20 rounded-xl p-7">
              <div className="flex items-center gap-4 mb-5">
                <div className="p-3 bg-destructive/10 rounded-2xl shrink-0">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                </div>
                <p className="text-xs font-medium uppercase tracking-wider text-destructive">
                  Tier 3 — Critical
                </p>
              </div>
              <ul className="space-y-3">
                {definition.redCriteria && definition.redCriteria.length > 0 ? (
                  definition.redCriteria.map((item, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 text-sm font-medium text-on-surface"
                    >
                      <ChevronRight className="w-3.5 h-3.5 text-destructive mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))
                ) : (
                  <p className="text-xs text-on-surface-variant italic">
                    No red criteria defined.
                  </p>
                )}
              </ul>
            </Card>

            {/* Keyword Packs */}
            {definition.keywordPacks && definition.keywordPacks.length > 0 && (
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <Target className="w-4 h-4 text-primary" />
                  <h4 className="text-xs font-medium uppercase tracking-wider text-on-surface">
                    Semantic Keyword Packs
                  </h4>
                </div>
                <div className="space-y-4">
                  {definition.keywordPacks.map((pack, i) => (
                    <Card
                      key={i}
                      className="bg-surface-container-low border border-outline-variant rounded-lg p-5 space-y-3 overflow-hidden relative"
                    >
                      <div
                        className={cn(
                          "absolute top-0 right-0 w-20 h-20 bg-gradient-to-br opacity-5 -mr-6 -mt-6 rounded-full",
                          pack.bias === "Cedant"
                            ? "from-emerald-500"
                            : pack.bias === "Reinsurer"
                              ? "from-rose-500"
                              : "from-primary",
                        )}
                      />
                      <div className="flex items-center justify-between">
                        <Badge
                          className={cn(
                            "rounded-full text-[10px] font-medium uppercase tracking-wider px-2.5",
                            pack.bias === "Cedant"
                              ? "bg-emerald-500/10 text-emerald-500"
                              : pack.bias === "Reinsurer"
                                ? "bg-rose-500/10 text-rose-500"
                                : "bg-primary/10 text-primary",
                          )}
                        >
                          {pack.bias}
                        </Badge>
                        {pack.theme && (
                          <span className="text-[10px] font-bold text-on-surface-variant/70 tracking-wider line-clamp-1 max-w-[60%] text-right">
                            {pack.theme}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {pack.keywords.map((kw, ki) => (
                          <span
                            key={ki}
                            className="text-[10px] font-bold px-2 py-1 bg-background border border-outline-variant/30 rounded-lg whitespace-nowrap"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — Metadata + Checklist + Clause Refs + Keyword Packs */}
        <div className="lg:col-span-5 space-y-8">
          {/* Logic Attributes */}
          <Card className="bg-surface-container-low border border-outline-variant rounded-xl p-7 shadow-sm">
            <h3 className="text-xs font-medium uppercase tracking-wider text-on-surface-variant mb-6 flex items-center gap-2">
              <Globe className="w-3 h-3 text-primary" /> Logic Attributes
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-5">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wider text-on-surface-variant/60">
                  Status
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm font-bold text-on-surface uppercase tracking-tight">
                    Active
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wider text-on-surface-variant/60">
                  Version
                </span>
                <span className="text-sm font-bold text-on-surface uppercase tracking-tight flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-secondary" />
                  Build V{currentVersion?.versionNumber || 1}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wider text-on-surface-variant/60">
                  Scope
                </span>
                <span className="text-xs font-bold text-on-surface uppercase tracking-tight">
                  {rule.isGlobal ? "Portfolio-Wide" : "Org Specific"}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wider text-on-surface-variant/60">
                  Created
                </span>
                <span className="text-xs font-bold text-on-surface">
                  {formatDate(rule.createdAt)}
                </span>
              </div>
              <div className="col-span-2 flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wider text-on-surface-variant/60">
                  Category
                </span>
                <span className="text-xs font-bold text-on-surface uppercase tracking-tight">
                  {rule.category}
                </span>
              </div>
            </div>
          </Card>

          {/* Structural Checklist */}
          <Card className="bg-surface-container-low border border-outline-variant rounded-xl p-7 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ListChecks className="w-4 h-4 text-primary" />
                <h4 className="text-xs font-medium uppercase tracking-wider text-on-surface">
                  Structural Checklist
                </h4>
              </div>
              <Badge className="bg-primary/5 text-primary border-none text-[9px] font-black">
                {definition.whatToCheck?.length || 0} STEPS
              </Badge>
            </div>
            <ul className="space-y-3">
              {definition.whatToCheck && definition.whatToCheck.length > 0 ? (
                definition.whatToCheck.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 p-3.5 bg-background border border-outline-variant/50 rounded-2xl text-sm font-medium"
                  >
                    <span className="text-primary font-black text-[10px] mt-0.5 shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {item}
                  </li>
                ))
              ) : (
                <p className="text-xs text-on-surface-variant italic">
                  No verification steps defined.
                </p>
              )}
            </ul>
          </Card>

          {/* Clause References */}
          <Card className="bg-surface-container-low border border-outline-variant rounded-xl p-7 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BookOpen className="w-4 h-4 text-secondary" />
                <h4 className="text-xs font-medium uppercase tracking-wider text-on-surface">
                  Clause References
                </h4>
              </div>
              <Badge className="bg-secondary/5 text-secondary border-none text-[9px] font-black">
                {definition.clauseReferences?.length || 0} REFS
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {definition.clauseReferences &&
              definition.clauseReferences.length > 0 ? (
                definition.clauseReferences.map((item, i) => (
                  <Badge
                    key={i}
                    variant="secondary"
                    className="rounded-xl px-4 py-2 font-bold text-xs bg-surface-container-high border-outline-variant"
                  >
                    {item}
                  </Badge>
                ))
              ) : (
                <p className="text-xs text-on-surface-variant italic">
                  No clause references defined.
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
