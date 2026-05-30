"use client";

import React, { useEffect, useState } from "react";
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
  Sparkles,
  ShieldCheck,
  ArrowLeft,
  Loader2,
  FileText,
  Tag,
  Archive,
  AlertCircle,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useCurrentPlan } from "@/hooks/use-current-plan";

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

export default function EditClausePage() {
  const router = useRouter();
  const { clauseId } = useParams() as { clauseId: string };
  const { data: session } = authClient.useSession();
  const { plan, isPending: isPlanPending } = useCurrentPlan();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [clauseName, setClauseName] = useState("");
  const [category, setCategory] = useState("");
  const [clauseText, setClauseText] = useState("");
  const [heading, setHeading] = useState("");
  const [source, setSource] = useState("");
  const [library, setLibrary] = useState("");
  const [status, setStatus] = useState("Approved");
  const [changeNote, setChangeNote] = useState("Updated via library editor");

  useEffect(() => {
    const fetchClause = async () => {
      try {
        const res = await fetch(`/api/clauses/${clauseId}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to load clause");
        }
        const data = await res.json();

        if (!data.isEditable) {
          setError(
            "You do not have permission to edit this clause. This is a read-only standard wording.",
          );
          setLoading(false);
          return;
        }

        setClauseName(data.clauseName || "");
        setCategory(data.category || "");
        setClauseText(data.clauseText || "");
        setHeading(data.heading || "");
        setSource(data.source || "");
        setLibrary(data.library || "");
        setStatus(data.status || "Approved");
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (clauseId) fetchClause();
  }, [clauseId]);

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

    setSaving(true);
    try {
      const res = await fetch(`/api/clauses/${clauseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clauseName,
          category,
          clauseText,
          heading: heading || null,
          source: finalSource || null,
          library,
          status,
          changeNote,
        }),
      });

      if (res.ok) {
        toast.success("Clause updated");
        router.push(`/clause-library/${clauseId}`);
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || "Failed to update clause");
      }
    } catch (err) {
      toast.error("Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-xs text-on-surface-variant">
            Loading clause…
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 p-6 lg:p-10 bg-background flex flex-col items-center justify-center">
        <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-12 text-center max-w-xl space-y-6">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-lg font-semibold tracking-tight text-on-surface">
            Access Restriction
          </h2>
          <p className="text-on-surface-variant font-medium">{error}</p>
          <Button onClick={() => router.back()}>Return to library</Button>
        </div>
      </div>
    );
  }

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
                <BreadcrumbLink
                  href={`/clause-library/${clauseId}`}
                  className="text-xs text-on-surface-variant hover:text-primary transition-colors"
                >
                  Clause Details
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-on-surface-variant" />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-xs text-on-surface">
                  Edit clause
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl lg:text-2xl font-semibold tracking-tight text-on-surface">
              Edit clause
            </h1>
            <p className="text-on-surface-variant text-sm max-w-2xl">
              Editing treaty wording. Changes are versioned automatically.
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

      <div className="mt-8 w-full">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-surface-container-low border border-outline-variant rounded-xl p-6 lg:p-10 shadow-sm space-y-8">
            {/* Base Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
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
              <div className="space-y-2">
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
                  <SelectContent>
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
                  Editable
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

            {/* Versioning */}
            <div className="space-y-2 pt-6 border-t border-outline-variant/30">
              <Label className="text-xs font-medium uppercase tracking-wider text-on-surface-variant ml-1">
                Change note
              </Label>
              <Input
                value={changeNote}
                onChange={(e) => setChangeNote(e.target.value)}
                placeholder="Describe what changed..."
                className="h-10 bg-background border-outline-variant rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-on-surface-variant">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <p className="text-xs text-on-surface-variant">
                Changes are versioned automatically
              </p>
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Sparkles className="size-4" /> Save changes
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}
