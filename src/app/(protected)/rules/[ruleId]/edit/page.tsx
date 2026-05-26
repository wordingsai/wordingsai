"use client";

import React, { useState, useEffect } from "react";
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
import {
  Plus,
  Sparkles,
  ShieldCheck,
  Zap,
  AlertTriangle,
  ArrowLeft,
  Loader2,
  Trash2,
  ListChecks,
  BookOpen,
  Target,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KeywordPack, RuleDefinition } from "@/types/rule-types";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
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

export default function EditRulePage() {
  const router = useRouter();
  const params = useParams();
  const ruleId = params.ruleId as string;
  const { data: activeWorkspace, isPending: isWorkspacePending } =
    useActiveWorkspace();
  const { plan, isPending: isPlanPending } = useCurrentPlan();

  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);

  // Basic Info
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [isGlobal, setIsGlobal] = useState(false);

  // Structural Definition
  const [appliesTo, setAppliesTo] = useState("");
  const [whatToCheck, setWhatToCheck] = useState<string[]>([""]);
  const [clauseReferences, setClauseReferences] = useState<string[]>([""]);

  // Keyword Packs
  const [keywordPacks, setKeywordPacks] = useState<KeywordPack[]>([
    { bias: "Balanced", theme: "", keywords: [] },
  ]);

  // Scoring Criteria
  const [greenCriteria, setGreenCriteria] = useState("");
  const [amberCriteria, setAmberCriteria] = useState("");
  const [redCriteria, setRedCriteria] = useState("");

  const { data: session } = authClient.useSession();
  const isPSA = (session?.session as any)?.role === "psa";

  useEffect(() => {
    if (isWorkspacePending || isPlanPending) return;
    if (plan !== "plus" && !isPSA) {
      toast.error("Rule Configuration is a Plus feature.", {
        description: "Please upgrade your plan to manage organization rules.",
      });
      router.push("/dashboard");
      return;
    }
    // PSA can edit global rules directly
    if (!isPSA && activeWorkspace?.isGlobal) {
      toast.error("Global workspaces are read-only", {
        description: "Switch to a custom workspace to edit rules.",
      });
      router.push("/rules");
    }
  }, [activeWorkspace, isWorkspacePending, isPSA, router, plan, isPlanPending]);

  useEffect(() => {
    if (
      isWorkspacePending ||
      isPlanPending ||
      (!isPSA && activeWorkspace?.isGlobal)
    )
      return;

    async function fetchRule() {
      try {
        const res = await fetch(`/api/rules/${ruleId}`);
        if (!res.ok) throw new Error("Failed to load rule");

        const data = await res.json();
        setName(data.name || "");
        setDescription(data.description || "");
        setCategory(data.category || "");
        setIsGlobal(data.isGlobal || false);

        const definition: RuleDefinition =
          data.currentVersion?.ruleDefinition || {};

        setAppliesTo(definition.appliesTo || "");
        setWhatToCheck(
          Array.isArray(definition.whatToCheck) &&
            definition.whatToCheck.length > 0
            ? definition.whatToCheck
            : [""],
        );
        setClauseReferences(
          Array.isArray(definition.clauseReferences) &&
            definition.clauseReferences.length > 0
            ? definition.clauseReferences
            : [""],
        );
        setKeywordPacks(
          Array.isArray(definition.keywordPacks) &&
            definition.keywordPacks.length > 0
            ? definition.keywordPacks
            : [{ bias: "Balanced", theme: "", keywords: [] }],
        );

        if (Array.isArray(definition.greenCriteria))
          setGreenCriteria(definition.greenCriteria.join("\n"));
        if (Array.isArray(definition.amberCriteria))
          setAmberCriteria(definition.amberCriteria.join("\n"));
        if (Array.isArray(definition.redCriteria))
          setRedCriteria(definition.redCriteria.join("\n"));
      } catch (err) {
        toast.error("Failed to fetch rule data");
        router.push("/rules");
      } finally {
        setInitialLoading(false);
      }
    }
    fetchRule();
  }, [ruleId, router, activeWorkspace, isWorkspacePending]);

  const addField = (setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter((prev) => [...prev, ""]);
  };

  const removeField = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    index: number,
  ) => {
    setter((prev) => prev.filter((_, i) => i !== index));
  };

  const updateField = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    index: number,
    value: string,
  ) => {
    setter((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const addKeywordPack = () => {
    setKeywordPacks((prev) => [
      ...prev,
      { bias: "Balanced", theme: "", keywords: [] },
    ]);
  };

  const updateKeywordPack = (index: number, updates: Partial<KeywordPack>) => {
    setKeywordPacks((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  const removeKeywordPack = (index: number) => {
    setKeywordPacks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !category) {
      toast.error("Name and Category are required");
      return;
    }

    setLoading(true);
    try {
      const definition: RuleDefinition = {
        appliesTo,
        whatToCheck: whatToCheck.filter((i) => i.trim()),
        clauseReferences: clauseReferences.filter((i) => i.trim()),
        keywordPacks: keywordPacks.filter(
          (p) => p.theme || p.keywords.length > 0,
        ),
        greenCriteria: greenCriteria.split("\n").filter((c) => c.trim()),
        amberCriteria: amberCriteria.split("\n").filter((c) => c.trim()),
        redCriteria: redCriteria.split("\n").filter((c) => c.trim()),
      };

      const res = await fetch(`/api/rules/${ruleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          category,
          isGlobal,
          ruleDefinition: definition,
        }),
      });

      if (res.ok) {
        toast.success("Rule architectural logic updated");
        router.push("/rules");
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to update rule");
      }
    } catch (err) {
      toast.error("Connection failure to neural engine");
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <main className="flex-1 p-6 lg:p-10 bg-background flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
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
                  href="/rules"
                  className="text-[10px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant hover:text-primary transition-colors"
                >
                  Rule Configuration
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-on-surface-variant" />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-[10px] font-semibold uppercase tracking-[0.2em] text-on-surface">
                  Edit Logic Definition
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-on-surface">
              Revise Rule
            </h1>
            <p className="text-on-surface-variant text-lg font-medium max-w-2xl">
              Modify high-fidelity regulatory logic for automated treaty
              vetting.
            </p>
          </div>

          <Button
            variant="ghost"
            className="rounded-2xl text-xs font-medium uppercase tracking-wider py-6 px-8 hover:bg-surface-container-highest"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> DISCARD CHANGES
          </Button>
        </div>
      </div>

      <div className="mt-12 max-w-6xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-8">
          <Tabs defaultValue="base" className="w-full">
            <TabsList className="bg-surface-container-low p-1 rounded-2xl h-14 border border-outline-variant grid grid-cols-3 mb-8">
              <TabsTrigger
                value="base"
                className="rounded-xl text-xs font-medium uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                1. Core Configuration
              </TabsTrigger>
              <TabsTrigger
                value="logic"
                className="rounded-xl text-xs font-medium uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                2. Semantic Logic
              </TabsTrigger>
              <TabsTrigger
                value="criteria"
                className="rounded-xl text-xs font-medium uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                3. Scoring Benchmarks
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="base"
              className="space-y-8 focus-visible:outline-none"
            >
              <div className="bg-surface-container-low border border-outline-variant rounded-xl p-8 lg:p-12 shadow-sm space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <Label className="text-xs font-medium uppercase tracking-wider text-on-surface-variant ml-1">
                      Rule Name
                    </Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Accounts & Bordereaux"
                      className="bg-background transition-all focus:ring-4 focus:ring-primary/10"
                      required
                    />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-xs font-medium uppercase tracking-wider text-on-surface-variant ml-1">
                      Logic Domain (Category)
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

                <div className="space-y-3">
                  <Label className="text-xs font-medium uppercase tracking-wider text-on-surface-variant ml-1">
                    Functional Description
                  </Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe how this rule identifies risk or compliance..."
                    className="min-h-[120px] bg-background border-outline-variant rounded-2xl font-medium p-4 transition-all focus:ring-4 focus:ring-primary/10"
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-xs font-medium uppercase tracking-wider text-on-surface-variant ml-1">
                    Applies To (Target Mechanism)
                  </Label>
                  <Input
                    value={appliesTo}
                    onChange={(e) => setAppliesTo(e.target.value)}
                    placeholder="e.g. All treaties with an Accounts mechanism..."
                    className="h-14 bg-background border-outline-variant rounded-2xl font-medium"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent
              value="logic"
              className="space-y-8 focus-visible:outline-none"
            >
              <div className="bg-surface-container-low border border-outline-variant rounded-xl p-8 lg:p-12 shadow-sm space-y-12">
                {/* Checklists */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ListChecks className="w-4 h-4 text-primary" />
                        <Label className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                          What to Check
                        </Label>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => addField(setWhatToCheck)}
                        className="h-7 text-[9px] font-semibold uppercase"
                      >
                        Add Step
                      </Button>
                    </div>
                    {whatToCheck.map((val, i) => (
                      <div key={i} className="flex gap-2">
                        <Input
                          value={val}
                          onChange={(e) =>
                            updateField(setWhatToCheck, i, e.target.value)
                          }
                          placeholder="Analysis breakpoint..."
                          className="h-10 bg-background border-outline-variant rounded-xl text-sm"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeField(setWhatToCheck, i)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-primary" />
                        <Label className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                          Clause References
                        </Label>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => addField(setClauseReferences)}
                        className="h-7 text-[9px] font-semibold uppercase"
                      >
                        Add Ref
                      </Button>
                    </div>
                    {clauseReferences.map((val, i) => (
                      <div key={i} className="flex gap-2">
                        <Input
                          value={val}
                          onChange={(e) =>
                            updateField(setClauseReferences, i, e.target.value)
                          }
                          placeholder="Contract heading search term..."
                          className="h-10 bg-background border-outline-variant rounded-xl text-sm"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeField(setClauseReferences, i)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Keyword Packs */}
                <div className="space-y-6 pt-10 border-t border-outline-variant/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target className="w-5 h-5 text-primary" />
                      <h2 className="text-xl font-semibold tracking-tight uppercase">
                        Keyword packages (Biased Semantics)
                      </h2>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={addKeywordPack}
                      className="rounded-xl text-xs font-medium uppercase tracking-wider"
                    >
                      <Plus className="w-3 h-3 mr-2" /> Add Package
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    {keywordPacks.map((pack, i) => (
                      <div
                        key={i}
                        className="p-6 bg-background/50 border border-outline-variant rounded-lg space-y-4 relative group"
                      >
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeKeywordPack(i)}
                          className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                        <div className="flex flex-col md:flex-row gap-4">
                          <div className="w-full md:w-1/4">
                            <Label className="text-[10px] font-medium uppercase tracking-wider mb-1 block ml-1">
                              Perspective Bias
                            </Label>
                            <Select
                              value={pack.bias}
                              onValueChange={(val: any) =>
                                updateKeywordPack(i, { bias: val })
                              }
                            >
                              <SelectTrigger className="h-10 rounded-xl bg-background border-outline-variant text-xs font-medium uppercase">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Balanced">
                                  Balanced
                                </SelectItem>
                                <SelectItem value="Cedant">
                                  Cedant (Insurer)
                                </SelectItem>
                                <SelectItem value="Reinsurer">
                                  Reinsurer
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="w-full md:w-3/4">
                            <Label className="text-[10px] font-medium uppercase tracking-wider mb-1 block ml-1">
                              Package Theme / Context
                            </Label>
                            <Input
                              value={pack.theme}
                              onChange={(e) =>
                                updateKeywordPack(i, { theme: e.target.value })
                              }
                              placeholder="e.g. Reporting Frequency, Late Payment..."
                              className="h-10 rounded-xl bg-background border-outline-variant"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-medium uppercase tracking-wider mb-1 block ml-1">
                            Keywords (Comma separated)
                          </Label>
                          <Input
                            value={pack.keywords.join(", ")}
                            onChange={(e) =>
                              updateKeywordPack(i, {
                                keywords: e.target.value
                                  .split(",")
                                  .map((k) => k.trim()),
                              })
                            }
                            placeholder="keyword1, keyword2, keyword3..."
                            className="h-10 rounded-xl bg-background border-outline-variant text-sm"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent
              value="criteria"
              className="space-y-8 focus-visible:outline-none"
            >
              <div className="bg-surface-container-low border border-outline-variant rounded-xl p-8 lg:p-12 shadow-sm space-y-12">
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5 text-emerald-500" />
                    <Label className="text-xs font-medium uppercase tracking-wider text-emerald-500">
                      Green Criteria (One per line)
                    </Label>
                  </div>
                  <Textarea
                    value={greenCriteria}
                    onChange={(e) => setGreenCriteria(e.target.value)}
                    placeholder="Full compliance benchmarks..."
                    className="min-h-[120px] bg-emerald-500/5 border-emerald-500/20 rounded-2xl font-medium p-4 focus:ring-emerald-500/10"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <Zap className="w-5 h-5 text-amber-500" />
                      <Label className="text-xs font-medium uppercase tracking-wider text-amber-500">
                        Amber Criteria (One per line)
                      </Label>
                    </div>
                    <Textarea
                      value={amberCriteria}
                      onChange={(e) => setAmberCriteria(e.target.value)}
                      placeholder="Mild deviations or warnings..."
                      className="min-h-[150px] bg-amber-500/5 border-amber-500/20 rounded-2xl font-medium p-4 focus:ring-amber-500/10"
                    />
                  </div>
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5 text-destructive" />
                      <Label className="text-xs font-medium uppercase tracking-wider text-destructive">
                        Red Criteria (One per line)
                      </Label>
                    </div>
                    <Textarea
                      value={redCriteria}
                      onChange={(e) => setRedCriteria(e.target.value)}
                      placeholder="High risk deviations or exclusions..."
                      className="min-h-[150px] bg-destructive/5 border-destructive/20 rounded-2xl font-medium p-4 focus:ring-destructive/10"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

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
                  <Loader2 className="w-5 h-5 animate-spin" /> COMMITTING
                  LOGIC...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" /> UPDATE RULE
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}
