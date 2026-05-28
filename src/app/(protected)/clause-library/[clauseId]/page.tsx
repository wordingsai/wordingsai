"use client";

import React, { useEffect, useState } from "react";
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
import { useParams, useRouter } from "next/navigation";
import {
  MoreHorizontal,
  Copy,
  Download,
  CheckCircle2,
  History,
  FileText,
  BrainCircuit,
  Sparkles,
  ShieldCheck,
  Calendar,
  UserCircle,
  ChevronRight,
  ArrowLeft,
  X,
  Plus,
  Tag,
  BookCopy,
  Loader2,
  PencilLine,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import {
  AmendmentDiffDialog,
  type VersionRow,
} from "@/components/clause-library/amendment-diff-dialog";

type Clause = {
  id: string;
  clauseName: string;
  category: string;
  library: string;
  status: string;
  isGlobal: boolean;
  clauseText: string;
  heading: string | null;
  source: string | null;
  organizationId: string | null;
  aiSummary: string | null;
  aiFavorability: string | null;
  aiRecommendedUse: string[] | null;
  aiNote: string | null;
  keywords: string[] | null;
  createdAt: string;
  updatedAt: string;
  isEditable: boolean;
  code: string | null;
};

type VersionHistoryEntry = {
  version: string;
  versionNumber: number;
  isActive?: boolean;
  updatedAt: string;
  changeSummary: string;
  modifiedBy: string;
  /** Present when fetched from /api/clauses/[id]/versions; used for diffing. */
  clauseText?: string;
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

export default function IndividualClausePage() {
  const { clauseId } = useParams() as { clauseId: string };
  const router = useRouter();

  const [clause, setClause] = useState<Clause | null>(null);
  const [versionHistory, setVersionHistory] = useState<VersionHistoryEntry[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
  const [updatingKeywords, setUpdatingKeywords] = useState(false);
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [diffDialogOpen, setDiffDialogOpen] = useState(false);
  const [initialDiffVersion, setInitialDiffVersion] = useState<
    number | undefined
  >(undefined);
  const { data: activeWorkspace } = useActiveWorkspace();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const clauseRes = await fetch(`/api/clauses/${clauseId}`);
        if (!clauseRes.ok) throw new Error("Failed to load clause");
        const clauseData = await clauseRes.json();
        setClause(clauseData);

        const versionsRes = await fetch(`/api/clauses/${clauseId}/versions`);
        if (versionsRes.ok) {
          const versionsData = await versionsRes.json();
          setVersionHistory(versionsData);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [clauseId]);

  const copyText = async () => {
    if (!clause?.clauseText) return;
    await navigator.clipboard.writeText(clause.clauseText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyClause = async () => {
    if (!clause) return;
    setIsCopying(true);
    try {
      const res = await fetch(`/api/clauses/${clauseId}/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceType: activeWorkspace?.type || "general",
        }),
      });
      const data = await res.json();
      if (res.status === 409) {
        toast.info("A custom copy already exists in this workspace.", {
          action: {
            label: "View",
            onClick: () =>
              router.push(`/clause-library/${data.existingId}/edit`),
          },
        });
        setShowCopyDialog(false);
        return;
      }
      if (!res.ok) throw new Error(data.error || "Failed to create copy");
      toast.success(`Custom clause created: ${data.code}`, {
        description: data.clauseName,
      });
      setShowCopyDialog(false);
      // Automatic redirect for editing as requested by client
      router.push(`/clause-library/${data.id}/edit`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create custom copy");
    } finally {
      setIsCopying(false);
    }
  };

  const handleAddKeyword = async () => {
    if (!newKeyword.trim() || !clause || !clause.isEditable) return;
    const kv = newKeyword.trim().toUpperCase();
    const currentKeywords = clause.keywords || [];
    if (currentKeywords.includes(kv)) {
      setNewKeyword("");
      return;
    }

    setUpdatingKeywords(true);
    const updatedKeywords = [...currentKeywords, kv];
    try {
      const res = await fetch(`/api/clauses/${clauseId}/keywords`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: updatedKeywords }),
      });
      if (res.ok) {
        setClause({ ...clause, keywords: updatedKeywords });
        setNewKeyword("");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingKeywords(false);
    }
  };

  const handleRemoveKeyword = async (keywordToRemove: string) => {
    if (!clause || !clause.isEditable) return;
    setUpdatingKeywords(true);
    const updatedKeywords = (clause.keywords || []).filter(
      (k) => k !== keywordToRemove,
    );
    try {
      const res = await fetch(`/api/clauses/${clauseId}/keywords`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: updatedKeywords }),
      });
      if (res.ok) {
        setClause({ ...clause, keywords: updatedKeywords });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingKeywords(false);
    }
  };

  const exportClause = () => {
    if (!clause) return;
    const exportContent = `CLAUSE EXPORT\n====================\nName: ${clause.clauseName}\nCategory: ${clause.category}\n\nTEXT:\n${clause.clauseText}`;
    const blob = new Blob([exportContent], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${clause.clauseName}.txt`;
    link.click();
  };

  if (loading) {
    return (
      <main className="flex-1 p-6 lg:p-10 bg-background">
        <div className="animate-pulse space-y-8">
          <Skeleton className="h-6 w-64 rounded-lg" />
          <Skeleton className="h-12 w-full max-w-lg rounded-2xl" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Skeleton className="lg:col-span-2 h-[600px] rounded-xl" />
            <Skeleton className="h-[600px] rounded-xl" />
          </div>
        </div>
      </main>
    );
  }

  if (!clause)
    return (
      <div className="p-20 text-center font-semibold uppercase tracking-widest opacity-20">
        Clause record not found
      </div>
    );

  return (
    <>
      <main className="flex-1 p-6 lg:p-10 bg-background transition-colors duration-300">
        {/* Page Header */}
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
                    {clause.clauseName}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-on-surface">
                  {clause.clauseName}
                </h1>
                <Badge
                  variant="outline"
                  className="rounded-full text-xs font-medium uppercase px-3 py-1 bg-surface-container text-on-surface-variant border-outline-variant"
                >
                  {clause.category}
                </Badge>
                {clause.status && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-full text-xs font-medium uppercase px-3 py-1",
                      clause.status === "Approved"
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                        : "bg-red-500/10 text-red-600 border-red-500/20",
                    )}
                  >
                    {clause.status}
                  </Badge>
                )}
              </div>
              <p className="text-on-surface-variant text-lg font-medium max-w-2xl flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" /> Verified
                Standard Wording
              </p>
            </div>

            <div className="flex gap-2">
              {clause.isEditable && (
                <Button
                  variant="outline"
                  size="lg"
                  className="rounded-md border-outline-variant hover:bg-surface-container-highest"
                  onClick={() =>
                    router.push(`/clause-library/${clauseId}/edit`)
                  }
                >
                  <PencilLine className="w-4 h-4 mr-2" /> Edit Clause
                </Button>
              )}
              <Button
                variant="outline"
                size="lg"
                className="rounded-md border-primary/40 text-primary hover:bg-primary/5"
                onClick={() => setShowCopyDialog(true)}
              >
                <BookCopy className="w-4 h-4 mr-2" /> Copy Clause
              </Button>
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-md flex items-center gap-2 transition-all "
                onClick={exportClause}
              >
                <Download className="w-5 h-5" /> EXPORT ASSET
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-12">
          {/* Main Content: Wording & AI Insight */}
          <div className="lg:col-span-8 space-y-8">
            <Card className="bg-surface-container-low border border-outline-variant rounded-xl overflow-hidden shadow-sm">
              <CardHeader className="p-8 border-b border-outline-variant/30 flex flex-row items-center justify-between bg-surface-container-highest/10">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-primary" />
                  <CardTitle className="text-sm font-semibold uppercase tracking-widest text-on-surface">
                    Semantic Wording
                  </CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyText}
                  className="rounded-xl text-xs font-medium uppercase tracking-wider h-10 px-4 group"
                >
                  <Copy
                    className={cn(
                      "w-3 h-3 mr-2",
                      copied
                        ? "text-emerald-500"
                        : "text-on-surface-variant group-hover:text-primary",
                    )}
                  />
                  {copied ? "TRANSFERRED" : "DUPLICATE TEXT"}
                </Button>
              </CardHeader>
              <CardContent className="p-10 lg:p-14 bg-background">
                <div className="prose prose-slate dark:prose-invert max-w-none">
                  <p className="text-xl lg:text-2xl font-medium leading-relaxed text-on-surface tracking-tight whitespace-pre-wrap">
                    {clause.clauseText}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-primary/5 border border-primary/20 rounded-xl overflow-hidden">
              <CardHeader className="p-8 pb-4">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-6 h-6 text-primary" />
                  <CardTitle className="text-base font-semibold text-primary">
                    Neural Insights
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-8 pt-0 space-y-8">
                <div className="text-lg font-medium text-on-surface leading-snug">
                  <TextGenerateEffect
                    words={
                      clause.aiSummary ?? "Synthesizing semantic breakdown..."
                    }
                  />
                </div>

                {clause.aiRecommendedUse &&
                  clause.aiRecommendedUse.length > 0 && (
                    <div className="space-y-4 pt-6 border-t border-primary/10">
                      <h4 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
                        Suggested Implementation Domains
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {clause.aiRecommendedUse.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-xl text-primary text-xs font-medium uppercase tracking-wider"
                          >
                            <CheckCircle2 className="w-3 h-3" /> {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar Metadata & History */}
          <div className="lg:col-span-4 space-y-8">
            <Card className="bg-surface-container-low border border-outline-variant rounded-xl p-8 shadow-sm">
              <h3 className="text-xs font-medium uppercase tracking-wider text-on-surface-variant mb-8 flex items-center gap-2">
                <BrainCircuit className="w-3 h-3 text-secondary" /> Clause
                Meta-Data
              </h3>
              <div className="space-y-6">
                {clause.code && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-wider text-violet-500">
                      Professional Reference
                    </span>
                    <span className="text-sm font-semibold text-violet-600 uppercase tracking-widest">
                      {clause.code}
                    </span>
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wider text-on-surface-variant/60">
                    Heading Definition
                  </span>
                  <span className="text-sm font-bold text-on-surface uppercase tracking-tight">
                    {clause.heading || "UNDEFINED"}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wider text-on-surface-variant/60">
                    Source Archive
                  </span>
                  <span className="text-sm font-bold text-on-surface uppercase tracking-tight">
                    {clause.source || "GENERAL ARCHIVE"}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wider text-on-surface-variant/60">
                    Source Library
                  </span>
                  <span className="text-sm font-bold text-on-surface uppercase tracking-tight">
                    {clause.library}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wider text-on-surface-variant/60">
                    Approval Status
                  </span>
                  <span
                    className={cn(
                      "text-sm font-bold uppercase tracking-tight",
                      clause.status === "Approved"
                        ? "text-emerald-600"
                        : "text-red-600",
                    )}
                  >
                    {clause.status || "Approved"}
                  </span>
                </div>
                <div className="pt-4 grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-wider text-on-surface-variant/60">
                      Initialized
                    </span>
                    <span className="text-xs font-bold text-on-surface">
                      {formatDate(clause.createdAt)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-wider text-on-surface-variant/60">
                      Calibrated
                    </span>
                    <span className="text-xs font-bold text-on-surface">
                      {formatDate(clause.updatedAt)}
                    </span>
                  </div>
                </div>
              </div>

              {clause.organizationId && (
                <div className="mt-8 pt-8 border-t border-outline-variant/30">
                  <h4 className="text-xs font-medium uppercase tracking-wider text-on-surface-variant mb-4">
                    Verification Layer
                  </h4>
                  <div className="flex items-center gap-4 p-4 bg-surface-container rounded-2xl">
                    <UserCircle className="w-10 h-10 text-on-surface-variant" />
                    <div>
                      <p className="text-sm font-semibold text-on-surface">
                        Organization Approved
                      </p>
                      <p className="text-[10px] font-bold text-on-surface-variant">
                        Validated by Super User
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {/* Keywords Section */}
            <Card className="bg-surface-container-low border border-outline-variant rounded-xl p-8 shadow-sm">
              <h3 className="text-xs font-medium uppercase tracking-wider text-on-surface-variant mb-6 flex items-center gap-2">
                <Tag className="w-3 h-3 text-secondary" /> Semantic Keywords
              </h3>
              <div className="flex flex-wrap gap-2 mb-6">
                {(clause.keywords || []).map((kw, idx) => (
                  <div
                    key={idx}
                    className="flex items-center bg-primary/10 pl-3 pr-1 py-1 rounded-full border border-primary/20"
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
                      {kw}
                    </span>
                    {clause.isEditable && (
                      <button
                        onClick={() => handleRemoveKeyword(kw)}
                        disabled={updatingKeywords}
                        className="ml-2 hover:bg-primary/20 rounded-full p-1 transition-colors"
                      >
                        <X className="w-3 h-3 text-primary" />
                      </button>
                    )}
                  </div>
                ))}
                {(!clause.keywords || clause.keywords.length === 0) && (
                  <div className="text-xs font-bold text-on-surface-variant/50 uppercase tracking-widest">
                    No keywords assigned
                  </div>
                )}
              </div>

              {clause.isEditable && (
                <div className="relative">
                  <Input
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddKeyword();
                    }}
                    placeholder="ADD KEYWORD..."
                    disabled={updatingKeywords}
                    className="h-12 bg-background border-outline-variant rounded-xl text-xs font-semibold uppercase tracking-widest pr-12 focus-visible:ring-primary"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleAddKeyword}
                    disabled={updatingKeywords || !newKeyword.trim()}
                    className="absolute right-1 top-1 h-10 w-10 p-0 text-primary hover:bg-primary/10 rounded-lg"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </Card>

            <Card className="bg-surface-container-low border border-outline-variant rounded-xl shadow-sm overflow-hidden">
              <div className="p-8 border-b border-outline-variant/30 flex items-center justify-between">
                <h3 className="text-xs font-medium uppercase tracking-wider text-on-surface-variant flex items-center gap-2">
                  <History className="w-3 h-3 text-secondary" /> Version Control
                </h3>
                <Badge className="bg-secondary/10 text-secondary border-none font-semibold text-[9px]">
                  {versionHistory.length} ENTRIES
                </Badge>
              </div>
              <div className="divide-y divide-outline-variant/20">
                {versionHistory.slice(0, 3).map((v, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setInitialDiffVersion(v.versionNumber);
                      setDiffDialogOpen(true);
                    }}
                    disabled={versionHistory.length < 2}
                    className="w-full text-left p-6 hover:bg-surface-container-high transition-colors cursor-pointer group disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span
                        className={cn(
                          "text-xs font-semibold uppercase tracking-widest",
                          v.isActive
                            ? "text-primary"
                            : "text-on-surface-variant",
                        )}
                      >
                        {v.version} {v.isActive ? "• CURRENT" : ""}
                      </span>
                      <span className="text-[10px] font-bold text-on-surface-variant">
                        {formatDate(v.updatedAt)}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-on-surface-variant line-clamp-1 mb-2">
                      {v.changeSummary}
                    </p>
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity text-primary">
                      VIEW SNAPSHOT <ChevronRight className="w-3 h-3" />
                    </div>
                  </button>
                ))}
                {versionHistory.length === 0 && (
                  <div className="p-12 text-center text-xs font-medium uppercase tracking-wider opacity-20">
                    No revision history
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                disabled={versionHistory.length < 2}
                onClick={() => {
                  setInitialDiffVersion(undefined);
                  setDiffDialogOpen(true);
                }}
                className="w-full h-14 rounded-none font-semibold uppercase tracking-widest text-[11px] border-t border-outline-variant/30 hover:bg-surface-container-high disabled:opacity-40"
              >
                Full Differential View
              </Button>
            </Card>
          </div>
        </div>
      </main>

      {/* Copy Clause Confirmation Dialog */}
      <Dialog open={showCopyDialog} onOpenChange={setShowCopyDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader className="gap-2">
            <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center mb-1">
              <BookCopy className="size-5 text-primary" />
            </div>
            <DialogTitle className="text-base font-semibold tracking-tight">
              Copy to your library
            </DialogTitle>
            <DialogDescription className="text-sm text-on-surface-variant leading-relaxed">
              Creates a private, editable copy of{" "}
              <span className="font-medium text-on-surface">
                {clause.clauseName}
              </span>{" "}
              scoped to your active workspace. It will receive an
              auto-generated reference code (e.g.{" "}
              <span className="font-mono text-primary">WAI-001-PR</span>). Other
              workspaces won't see this copy.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCopyDialog(false)}
              disabled={isCopying}
            >
              Cancel
            </Button>
            <Button
              className="gap-2"
              onClick={handleCopyClause}
              disabled={isCopying}
            >
              {isCopying ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Creating…
                </>
              ) : (
                <>
                  <BookCopy className="size-4" /> Create copy
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Amendment history diff -- triggered from the Version Control card. */}
      <AmendmentDiffDialog
        open={diffDialogOpen}
        onOpenChange={setDiffDialogOpen}
        versions={versionHistory as VersionRow[]}
        initialNewerVersionNumber={initialDiffVersion}
      />
    </>
  );
}
