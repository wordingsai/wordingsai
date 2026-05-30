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
      toast.error("Could not save. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex-1 p-6 lg:p-10 bg-background transition-colors duration-300">
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink
                  href="/clause-library"
                  className="text-xs text-on-surface-variant hover:text-primary transition-colors"
                >
                  Clause library
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-on-surface-variant" />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-xs text-on-surface">
                  New clause
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl lg:text-2xl font-semibold tracking-tight text-on-surface">
              New clause
            </h1>
            <p className="text-on-surface-variant text-sm max-w-2xl">
              Add a standardized treaty wording to your organization's library.
            </p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
          >
            <ArrowLeft className="size-3.5" /> Back
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
                  Clause name
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
                  Category
                </Label>
                <Select
                  value={category}
                  onValueChange={(val) => setCategory(val || "")}
                  required
                >
                  <SelectTrigger className="h-10 bg-background border-outline-variant rounded-lg text-sm">
                    <SelectValue placeholder="Select category" />
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
            <div className="space-y-2">
              <div className="flex items-center justify-between ml-1">
                <Label className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                  Clause text
                </Label>
                <Badge variant="default" className="text-[9px]">
                  Required
                </Badge>
              </div>
              <Textarea
                value={clauseText}
                onChange={(e) => setClauseText(e.target.value)}
                placeholder="Paste the treaty wording here..."
                className="min-h-[250px] bg-background border-outline-variant rounded-lg text-sm p-4 transition-all focus:ring-4 focus:ring-primary/10 leading-relaxed"
                required
              />
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-6 border-t border-outline-variant/30">
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-on-surface-variant ml-1 flex items-center gap-1.5">
                  <FileText className="w-3 h-3" /> Heading
                </Label>
                <Input
                  value={heading}
                  onChange={(e) => setHeading(e.target.value)}
                  placeholder="e.g. Accounts and Reports"
                  className="h-10 bg-background border-outline-variant rounded-lg text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-on-surface-variant ml-1 flex items-center gap-1.5">
                  <Archive className="w-3 h-3" /> Source
                </Label>
                <Input
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="e.g. LMA 3100"
                  className="h-10 bg-background border-outline-variant rounded-lg text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-on-surface-variant ml-1 flex items-center gap-1.5">
                  <Tag className="w-3 h-3" /> Library
                </Label>
                <Input
                  value={library}
                  onChange={(e) => setLibrary(e.target.value)}
                  placeholder="e.g. Custom, Core, Lloyd's"
                  className="h-10 bg-background border-outline-variant rounded-lg text-sm"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-on-surface-variant ml-1 flex items-center gap-1.5">
                  <ShieldCheck className="w-3 h-3" /> Status
                </Label>
                <Select
                  value={status}
                  onValueChange={(val) => setStatus(val || "Approved")}
                  required
                >
                  <SelectTrigger className="h-10 bg-background border-outline-variant rounded-lg text-sm">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Approved">Approved</SelectItem>
                    <SelectItem value="Not Approved">Unapproved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isPSA && (
              <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-lg border border-primary/10">
                <Globe className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <Label className="text-xs font-medium text-primary block">
                    Global distribution
                  </Label>
                  <p className="text-[10px] text-on-surface-variant mt-0.5">
                    Make this wording available to all organizations.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={isGlobal ? "default" : "outline"}
                  role="switch"
                  aria-checked={isGlobal}
                  onClick={() => setIsGlobal(!isGlobal)}
                >
                  {isGlobal ? "Global" : "Custom only"}
                </Button>
              </div>
            )}
          </div>

          <div className="pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-on-surface-variant">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <p className="text-xs text-on-surface-variant">
                Changes are saved to your organization's library
              </p>
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Sparkles className="size-4" /> Create clause
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}
