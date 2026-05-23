import type {
  AnalysisPipelineStep,
  AnalysisStage,
  ChecklistItem,
  ChecklistSummary,
  ContractAnalysis,
} from "@/types/contracts";

const STAGE_LABELS: Record<
  Exclude<AnalysisStage, "completed" | "failed">,
  string
> = {
  uploading: "Uploading",
  ocr: "OCR",
  fast: "Fast Analysis",
  basic: "Basic Analysis",
  plus: "Plus Analysis",
};

export const PIPELINE_STAGE_ORDER: Exclude<
  AnalysisStage,
  "completed" | "failed"
>[] = ["uploading", "ocr", "fast", "basic", "plus"];

export function buildPipelineSteps(
  stage: AnalysisStage,
  plan: "fast" | "basic" | "plus" = "basic",
): AnalysisPipelineStep[] {
  const enabledStages =
    plan === "plus"
      ? PIPELINE_STAGE_ORDER
      : plan === "basic"
        ? PIPELINE_STAGE_ORDER.filter((item) => item !== "plus")
        : PIPELINE_STAGE_ORDER.filter(
            (item) => item === "uploading" || item === "ocr" || item === "fast",
          );

  const activeIndex =
    stage === "completed"
      ? enabledStages.length - 1
      : stage === "failed"
        ? -1
        : enabledStages.indexOf(
            stage as Exclude<AnalysisStage, "completed" | "failed">,
          );

  return enabledStages.map((key, index) => {
    const status =
      stage === "failed" && index === Math.max(activeIndex, 0)
        ? "failed"
        : stage === "completed" || (activeIndex >= 0 && index < activeIndex)
          ? "completed"
          : index === activeIndex
            ? "active"
            : "pending";

    return {
      key,
      label: STAGE_LABELS[key],
      status,
    };
  });
}

export function summarizeChecklist(items: ChecklistItem[]): ChecklistSummary {
  return items.reduce<ChecklistSummary>(
    (summary, item) => {
      summary.total += 1;
      if (item.status === "Matched") summary.matched += 1;
      if (item.status === "Custom") summary.custom += 1;
      if (item.status === "Missing") summary.missing += 1;
      return summary;
    },
    { total: 0, matched: 0, custom: 0, missing: 0 },
  );
}

export function mergeAnalysisState(
  current: ContractAnalysis | null | undefined,
  patch: Partial<ContractAnalysis>,
): ContractAnalysis {
  const existing = current ?? {};
  return {
    ...existing,
    ...patch,
    fast: {
      ...(existing.fast ?? {}),
      ...(patch.fast ?? {}),
    },
    basic: {
      ...(existing.basic ?? {}),
      ...(patch.basic ?? {}),
    },
    plus: {
      ...(existing.plus ?? {}),
      ...(patch.plus ?? {}),
    },
  };
}
