"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbLink,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Sparkles,
  ShieldCheck,
  ArrowLeft,
  Loader2,
  BookOpen,
  FileText,
  Tag,
  Globe,
  Archive,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useCurrentPlan } from "@/hooks/use-current-plan";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";

const categories = [
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
];

export default function NewClausePage() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const { data: activeOrg, isPending: isOrgPending } =
    authClient.useActiveOrganization();
  const { plan, isPending: isPlanPending } = useCurrentPlan();
  const { data: activeWorkspace, isPending: isWorkspacePending } =
    useActiveWorkspace();

  const isPSA = (session?.session as any)?.role === "psa";

  // Plus-only restriction (except for PSA)
  useEffect(() => {
    if (!isOrgPending && !isPlanPending && !isWorkspacePending && session) {
      if (plan !== "plus" && !isPSA) {
        toast.error("Clause Library management is a Plus feature.", {
          description: "Please upgrade your plan to add custom clauses.",
        });
        router.push("/clause-library");
        return;
      }
    }
  }, [
    session,
    isOrgPending,
    isPlanPending,
    isWorkspacePending,
    plan,
    isPSA,
    router,
  ]);

  const [loading, setLoading] = useState(false);

  // Form State
  const [clauseName, setClauseName] = useState("");
  const [category, setCategory] = useState("");
  const [clauseText, setClauseText] = useState("");
  const [heading, setHeading] = useState("");
  const [source, setSource] = useState("");
  const [library, setLibrary] = useState("Custom");
  const [status, setStatus] = useState("Approved");
  const [isGlobal, setIsGlobal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clauseName || !category || !clauseText || !library) {
      toast.error("Please fill in all required fields");
      return;
    }

    let finalSource = source;
    if (!finalSource) {
      const match = clauseName.match(/\((?:LSW|LMA)[^)]*\)/i);
      if (match) {
        finalSource = match[0].replace(/[()]/g, "");
      }
    }

    setLoading(true);
    try {
      const res = await fetch("/api/clauses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clauseName,
          category,
          clauseText,
          heading: heading || null,
          source: finalSource || null,
          library,
          status,
          isGlobal: isPSA ? isGlobal : false,
        }),
      });

      if (res.ok) {
        toast.success("Clause successfully registered in library");
        router.push("/clause-library");
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to create clause");
      }
    } catch (err) {
      toast.error("Connection failure to neural engine");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex-1 p-6 lg:p-10 bg-background transition-colors duration-300">
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-6">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink
                  href="/clause-library"
                  className="text-[10px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant hover:text-primary transition-colors"
                >
                  Regulatory Framework
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-on-surface-variant" />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-[10px] font-semibold uppercase tracking-[0.2em] text-on-surface">
                  Initialize New Wording
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-on-surface">
              New Clause Entry
            </h1>
            <p className="text-on-surface-variant text-lg font-medium max-w-2xl">
              Register a standardized treaty wording for automated recognition
              and deployment.
            </p>
          </div>

          <Button
            variant="ghost"
            className="rounded-2xl text-xs font-medium uppercase tracking-wider py-6 px-8 hover:bg-surface-container-highest"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> DISCARD ENTRY
          </Button>
        </div>
      </div>

      <div className="mt-12 w-full">
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="bg-surface-container-low border border-outline-variant rounded-xl p-8 lg:p-12 shadow-sm space-y-10">
            {/* Base Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <Label className="text-xs font-medium uppercase tracking-wider text-on-surface-variant ml-1">
                  Clause Identification (Name)
                </Label>
                <Input
                  value={clauseName}
                  onChange={(e) => setClauseName(e.target.value)}
                  placeholder="e.g. Accounts & Bordereaux Standard"
                  className="bg-background transition-all focus:ring-4 focus:ring-primary/10"
                  required
                />
              </div>
              <div className="space-y-3">
                <Label className="text-xs font-medium uppercase tracking-wider text-on-surface-variant ml-1">
                  Regulatory Domain (Category)
                </Label>
                <Select
                  value={category}
                  onValueChange={(val) => setCategory(val || "")}
                  required
                >
                  <SelectTrigger className="h-14 bg-background border-outline-variant rounded-2xl font-semibold uppercase tracking-widest text-[11px]">
                    <SelectValue placeholder="Select Domain" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Content */}
            <div className="space-y-3">
              <div className="flex items-center justify-between ml-1">
                <Label className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                  Semantic Wording (Actual Text)
                </Label>
                <Badge className="bg-primary/5 text-primary border-primary/20 text-[9px] font-semibold uppercase px-2 py-0.5">
                  High Precision Required
                </Badge>
              </div>
              <Textarea
                value={clauseText}
                onChange={(e) => setClauseText(e.target.value)}
                placeholder="Paste the definitive treaty wording here..."
                className="min-h-[250px] bg-background border-outline-variant rounded-lg font-medium p-6 transition-all focus:ring-4 focus:ring-primary/10 leading-relaxed"
                required
              />
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 pt-6 border-t border-outline-variant/30">
              <div className="space-y-3">
                <Label className="text-xs font-medium uppercase tracking-wider text-on-surface-variant ml-1 flex items-center gap-2">
                  <FileText className="w-3 h-3" /> Heading Classification
                </Label>
                <Input
                  value={heading}
                  onChange={(e) => setHeading(e.target.value)}
                  placeholder="e.g. Accounts and Reports"
                  className="h-12 bg-background border-outline-variant rounded-xl font-bold text-sm"
                />
              </div>
              <div className="space-y-3">
                <Label className="text-xs font-medium uppercase tracking-wider text-on-surface-variant ml-1 flex items-center gap-2">
                  <Archive className="w-3 h-3" /> Source Archive
                </Label>
                <Input
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="e.g. LMA 3100"
                  className="h-12 bg-background border-outline-variant rounded-xl font-bold text-sm"
                />
              </div>
              <div className="space-y-3">
                <Label className="text-xs font-medium uppercase tracking-wider text-on-surface-variant ml-1 flex items-center gap-2">
                  <Tag className="w-3 h-3" /> Library Origin
                </Label>
                <Input
                  value={library}
                  onChange={(e) => setLibrary(e.target.value)}
                  placeholder="e.g. Custom, Core, Lloyd's"
                  className="h-12 bg-background border-outline-variant rounded-xl font-bold text-sm"
                  required
                />
              </div>
              <div className="space-y-3">
                <Label className="text-xs font-medium uppercase tracking-wider text-on-surface-variant ml-1 flex items-center gap-2">
                  <ShieldCheck className="w-3 h-3" /> Approval Status
                </Label>
                <Select
                  value={status}
                  onValueChange={(val) => setStatus(val || "Approved")}
                  required
                >
                  <SelectTrigger className="h-12 bg-background border-outline-variant rounded-xl font-bold text-sm">
                    <SelectValue placeholder="Select Status" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="Approved">Approved</SelectItem>
                    <SelectItem value="Not Approved">Not Approved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isPSA && (
              <div className="flex items-center gap-3 p-6 bg-primary/5 rounded-2xl border border-primary/10">
                <Globe className="w-5 h-5 text-primary" />
                <div className="flex-1">
                  <Label className="text-xs font-medium uppercase tracking-wider text-primary block">
                    Global Distribution
                  </Label>
                  <p className="text-[10px] font-bold text-on-surface-variant">
                    Make this wording available to all organizations across the
                    platform.
                  </p>
                </div>
                <Button
                  type="button"
                  variant={isGlobal ? "default" : "outline"}
                  onClick={() => setIsGlobal(!isGlobal)}
                  className="rounded-xl text-xs font-medium uppercase h-10 px-4 transition-all"
                >
                  {isGlobal ? "GLOBAL ACTIVE" : "CUSTOM ONLY"}
                </Button>
              </div>
            )}
          </div>

          <div className="pt-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3 text-on-surface-variant">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              <p className="text-xs font-bold uppercase tracking-widest">
                Authorized Neural Encoding
              </p>
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={loading}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-5 py-2 rounded-md flex items-center gap-3 text-lg transition-all "
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> SYNCHRONIZING...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" /> REGISTER CLAUSE
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}
