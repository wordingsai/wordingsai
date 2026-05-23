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
        toast.success("Clause successfully recalibrated");
        router.push(`/clause-library/${clauseId}`);
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || "Failed to update clause");
      }
    } catch (err) {
      toast.error("Connection failure to neural engine");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-on-surface-variant">
            Retrieving Neural Record...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 p-6 lg:p-10 bg-background flex flex-col items-center justify-center">
        <div className="bg-red-500/5 border border-red-500/10 rounded-[2.5rem] p-12 text-center max-w-xl space-y-6">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-2xl font-black uppercase tracking-tight text-on-surface">
            Access Restriction
          </h2>
          <p className="text-on-surface-variant font-medium">{error}</p>
          <Button
            onClick={() => router.back()}
            className="rounded-2xl font-black uppercase tracking-widest text-[10px] h-12 px-8"
          >
            Return to Library
          </Button>
        </div>
      </div>
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
                  href="/clause-library"
                  className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant hover:text-primary transition-colors"
                >
                  Regulatory Framework
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-on-surface-variant" />
              <BreadcrumbItem>
                <BreadcrumbLink
                  href={`/clause-library/${clauseId}`}
                  className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant hover:text-primary transition-colors"
                >
                  Clause Details
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-on-surface-variant" />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface">
                  Recalibrate Wording
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-4xl lg:text-5xl font-black tracking-tighter uppercase text-on-surface">
              Modify Wording
            </h1>
            <p className="text-on-surface-variant text-lg font-medium max-w-2xl">
              Updating standard treaty wording for your organization. Changes
              will be versioned.
            </p>
          </div>

          <Button
            variant="ghost"
            className="rounded-2xl font-black uppercase tracking-widest text-[10px] py-6 px-8 hover:bg-surface-container-highest"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> REVERT CHANGES
          </Button>
        </div>
      </div>

      <div className="mt-12 w-full">
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="bg-surface-container-low border border-outline-variant rounded-[2.5rem] p-8 lg:p-12 shadow-sm space-y-10">
            {/* Base Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">
                  Clause Identification (Name)
                </Label>
                <Input
                  value={clauseName}
                  onChange={(e) => setClauseName(e.target.value)}
                  placeholder="e.g. Accounts & Bordereaux Standard"
                  className="h-14 bg-background border-outline-variant rounded-2xl font-bold transition-all focus:ring-4 focus:ring-primary/10"
                  required
                />
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">
                  Regulatory Domain (Category)
                </Label>
                <Select
                  value={category}
                  onValueChange={(val) => setCategory(val || "")}
                  required
                >
                  <SelectTrigger className="h-14 bg-background border-outline-variant rounded-2xl font-black uppercase tracking-widest text-[11px]">
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
                <Label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                  Semantic Wording (Actual Text)
                </Label>
                <Badge className="bg-primary/5 text-primary border-primary/20 text-[9px] font-black uppercase px-2 py-0.5">
                  Full Edit Permission Granted
                </Badge>
              </div>
              <Textarea
                value={clauseText}
                onChange={(e) => setClauseText(e.target.value)}
                placeholder="Paste the definitive treaty wording here..."
                className="min-h-[250px] bg-background border-outline-variant rounded-[2rem] font-medium p-6 transition-all focus:ring-4 focus:ring-primary/10 leading-relaxed"
                required
              />
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 pt-6 border-t border-outline-variant/30">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1 flex items-center gap-2">
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
                <Label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1 flex items-center gap-2">
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
                <Label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1 flex items-center gap-2">
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
                <Label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1 flex items-center gap-2">
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

            {/* Versioning */}
            <div className="space-y-3 pt-6 border-t border-outline-variant/30">
              <Label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">
                Recalibration Note (Version Commentary)
              </Label>
              <Input
                value={changeNote}
                onChange={(e) => setChangeNote(e.target.value)}
                placeholder="Describe the nature of this update..."
                className="h-12 bg-background border-outline-variant rounded-xl font-bold text-sm"
              />
            </div>
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
              disabled={saving}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-black px-12 py-8 rounded-2xl shadow-xl shadow-primary/20 flex items-center gap-3 text-lg transition-all hover:scale-[1.02]"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> SYNCHRONIZING...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" /> RE-CALIBRATE WORDING
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}
