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
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

function MetaRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] uppercase tracking-wider text-on-surface-variant/70">
        {label}
      </span>
      <span
        className={cn(
          "text-sm text-on-surface break-words",
          valueClassName,
        )}
      >
        {value}
      </span>
    </div>
  );
}

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
      <main className="flex-1 p-6 lg:px-8 lg:py-7 bg-background">
        {/* Page Header */}
        <div className="mb-6">
          <div className="mb-3">
            <Breadcrumb>
              <BreadcrumbList className="text-xs">
                <BreadcrumbItem>
                  <BreadcrumbLink
                    href="/clause-library"
                    className="text-on-surface-variant hover:text-primary transition-colors"
                  >
                    Clause library
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="text-on-surface-variant" />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-on-surface truncate max-w-[40ch]">
                    {clause.clauseName}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
            <div className="space-y-2 min-w-0">
              <h1 className="text-xl lg:text-2xl font-semibold tracking-tight text-on-surface">
                {clause.clauseName}
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge
                  variant="outline"
                  className="rounded-md font-medium px-2 py-0.5 bg-surface-container text-on-surface-variant border-outline-variant/60"
                >
                  {clause.category}
                </Badge>
                {clause.status && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-md font-medium px-2 py-0.5",
                      clause.status === "Approved"
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                        : "bg-red-500/10 text-red-600 border-red-500/20",
                    )}
                  >
                    {clause.status === "Approved" ? "Approved" : "Unapproved"}
                  </Badge>
                )}
                {clause.code ? (
                  <span className="text-on-surface-variant font-mono">
                    {clause.code}
                  </span>
                ) : null}
                <span className="text-on-surface-variant/60 flex items-center gap-1">
                  <ShieldCheck className="size-3 text-primary" />
                  Verified standard wording
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 shrink-0">
              {clause.isEditable && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    router.push(`/clause-library/${clauseId}/edit`)
                  }
                >
                  <PencilLine className="size-3.5 mr-1.5" />
                  Edit
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCopyDialog(true)}
              >
                <BookCopy className="size-3.5 mr-1.5" />
                Copy
              </Button>
              <Button size="sm" onClick={exportClause}>
                <Download className="size-3.5 mr-1.5" />
                Export
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-6">
          {/* Main Content: Wording & AI Insight */}
          <div className="lg:col-span-8 space-y-5">
            <Card className="bg-surface-container-low border border-outline-variant/60 rounded-xl overflow-hidden shadow-none p-0">
              <CardHeader className="px-5 py-3 border-b border-outline-variant/30 flex flex-row items-center justify-between gap-2 space-y-0">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="size-4 text-primary shrink-0" />
                  <CardTitle className="text-sm font-medium text-on-surface">
                    Clause wording
                  </CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyText}
                  className="h-7 px-2 text-xs"
                >
                  <Copy
                    className={cn(
                      "size-3 mr-1.5",
                      copied
                        ? "text-emerald-500"
                        : "text-on-surface-variant",
                    )}
                  />
                  {copied ? "Copied" : "Copy"}
                </Button>
              </CardHeader>
              <CardContent className="p-5">
                {clause.clauseText && clause.clauseText.trim() ? (
                  <p className="text-sm leading-relaxed text-on-surface whitespace-pre-wrap break-words">
                    {clause.clauseText}
                  </p>
                ) : (
                  <p className="text-sm italic text-on-surface-variant/60">
                    No clause text has been recorded for this entry.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-primary/5 border border-primary/20 rounded-xl overflow-hidden p-0">
              <CardHeader className="px-5 py-3 border-b border-primary/10 flex flex-row items-center gap-2 space-y-0">
                <Sparkles className="size-4 text-primary" />
                <CardTitle className="text-sm font-medium text-primary">
                  AI insights
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="text-sm leading-relaxed text-on-surface">
                  <TextGenerateEffect
                    words={
                      clause.aiSummary ?? "Synthesizing semantic breakdown..."
                    }
                  />
                </div>

                {clause.aiRecommendedUse &&
                  clause.aiRecommendedUse.length > 0 && (
                    <div className="space-y-2 pt-3 border-t border-primary/10">
                      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                        Recommended use
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {clause.aiRecommendedUse.map((item, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 bg-primary/10 px-2 py-0.5 rounded-md text-primary text-xs"
                          >
                            <CheckCircle2 className="size-3" /> {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar Metadata & History */}
          <div className="lg:col-span-4 space-y-5">
            <Card className="bg-surface-container-low border border-outline-variant/60 rounded-xl shadow-none p-0">
              <div className="px-5 py-3 border-b border-outline-variant/30 flex items-center gap-2">
                <BrainCircuit className="size-3.5 text-secondary" />
                <h3 className="text-sm font-medium text-on-surface">
                  Details
                </h3>
              </div>
              <div className="p-5 space-y-3 text-sm">
                <MetaRow label="Heading" value={clause.heading || "—"} />
                <MetaRow label="Source" value={clause.source || "General"} />
                <MetaRow label="Library" value={clause.library} />
                <MetaRow
                  label="Status"
                  value={
                    clause.status === "Approved" ? "Approved" : "Unapproved"
                  }
                  valueClassName={cn(
                    clause.status === "Approved"
                      ? "text-emerald-500"
                      : "text-red-500",
                  )}
                />
                <div className="pt-2 grid grid-cols-2 gap-3">
                  <MetaRow
                    label="Created"
                    value={formatDate(clause.createdAt)}
                  />
                  <MetaRow
                    label="Updated"
                    value={formatDate(clause.updatedAt)}
                  />
                </div>
              </div>

              {clause.organizationId && (
                <div className="px-5 py-3 border-t border-outline-variant/30 flex items-center gap-2.5">
                  <UserCircle className="size-5 text-on-surface-variant shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-on-surface">
                      Organization approved
                    </p>
                    <p className="text-[11px] text-on-surface-variant">
                      Validated by super user
                    </p>
                  </div>
                </div>
              )}
            </Card>

            {/* Keywords */}
            <Card className="bg-surface-container-low border border-outline-variant/60 rounded-xl shadow-none p-0">
              <div className="px-5 py-3 border-b border-outline-variant/30 flex items-center gap-2">
                <Tag className="size-3.5 text-secondary" />
                <h3 className="text-sm font-medium text-on-surface">Keywords</h3>
              </div>
              <div className="p-5 space-y-3">
                <div className="flex flex-wrap gap-1.5 min-h-[24px]">
                  {(clause.keywords || []).map((kw, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center bg-primary/10 pl-2 pr-1 py-0.5 rounded-md border border-primary/20"
                    >
                      <span className="text-[11px] font-medium text-primary">
                        {kw}
                      </span>
                      {clause.isEditable && (
                        <button
                          onClick={() => handleRemoveKeyword(kw)}
                          disabled={updatingKeywords}
                          className="ml-1 hover:bg-primary/20 rounded p-0.5 transition-colors"
                          aria-label={`Remove ${kw}`}
                        >
                          <X className="size-2.5 text-primary" />
                        </button>
                      )}
                    </span>
                  ))}
                  {(!clause.keywords || clause.keywords.length === 0) && (
                    <span className="text-xs italic text-on-surface-variant/60">
                      No keywords assigned
                    </span>
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
                      placeholder="Add keyword…"
                      disabled={updatingKeywords}
                      className="h-8 bg-background border-outline-variant/60 rounded-md text-xs pr-9 focus-visible:ring-primary"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleAddKeyword}
                      disabled={updatingKeywords || !newKeyword.trim()}
                      className="absolute right-0.5 top-0.5 size-7 p-0 text-primary hover:bg-primary/10 rounded-sm"
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>

            {/* Version history */}
            <Card className="bg-surface-container-low border border-outline-variant/60 rounded-xl shadow-none overflow-hidden p-0">
              <div className="px-5 py-3 border-b border-outline-variant/30 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <History className="size-3.5 text-secondary" />
                  <h3 className="text-sm font-medium text-on-surface">
                    Version history
                  </h3>
                </div>
                <Badge className="bg-secondary/10 text-secondary border-none font-medium text-[10px] rounded">
                  {versionHistory.length}
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
                    className="w-full text-left px-5 py-3 hover:bg-surface-container-high transition-colors cursor-pointer group disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div className="flex justify-between items-baseline gap-2 mb-1">
                      <span
                        className={cn(
                          "text-xs font-semibold",
                          v.isActive
                            ? "text-primary"
                            : "text-on-surface-variant",
                        )}
                      >
                        {v.version}
                        {v.isActive ? (
                          <span className="ml-1 font-normal text-[10px]">
                            · current
                          </span>
                        ) : null}
                      </span>
                      <span className="text-[10px] text-on-surface-variant">
                        {formatDate(v.updatedAt)}
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant line-clamp-1">
                      {v.changeSummary || "—"}
                    </p>
                  </button>
                ))}
                {versionHistory.length === 0 && (
                  <div className="p-6 text-center text-xs italic text-on-surface-variant/60">
                    No revisions yet
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
                className="w-full h-9 rounded-none text-xs font-medium border-t border-outline-variant/30 hover:bg-surface-container-high disabled:opacity-40"
              >
                Open full diff
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
