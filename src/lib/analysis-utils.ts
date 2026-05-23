import { Contract } from "@/types/analysis";

// All status substrings that indicate an analysis is actively in progress
const ACTIVE_STATUS_KEYWORDS = [
  "Processing",
  "Neural",
  "Vetting",
  "Mapping",
  "Evaluating",
  "Extracting",
  "OCR",
  "Clause",
  "Scanning",
  "Initializing",
  "Rule",
  "Analysis",
  "Structure",
  "reviewing",
  "Preparing",
  "Segmenting",
  "1/5",
  "2/5",
  "3/5",
  "4/5",
  "5/5",
];

function isActiveStatus(status: string | undefined | null): boolean {
  if (!status) return false;
  // "Analysis Complete" is terminal, not active
  if (status === "Analysis Complete") return false;
  // "Analysis timed out" is terminal
  if (status.includes("timed out")) return false;
  // Any failure status is terminal
  if (status.includes("failed") || status.includes("Failed")) return false;
  return ACTIVE_STATUS_KEYWORDS.some((kw) => status.includes(kw));
}

export function getAuditStatus(contract: Contract | null): string {
  if (!contract) return "pending";

  const statusText = contract.analysisStatus || contract.analysis?.status || "";
  const stage = (contract as { analysisStage?: string }).analysisStage;

  // Check explicit failure first
  if (
    statusText.includes("failed") ||
    statusText.includes("Failed") ||
    statusText.includes("timed out")
  ) {
    return "failed";
  }

  // Fast analysis done — show map/checklist even while rules run in background
  if (
    stage === "fast_complete" ||
    statusText.includes("Fast Analysis Complete")
  ) {
    return "completed";
  }

  // Rules-only background work must not block the fast-analysis UI
  if (stage === "deep" && statusText.includes("[Rules]")) {
    if (
      contract.analysisProgress !== undefined &&
      contract.analysisProgress >= 100
    ) {
      return "completed";
    }
  }

  // Check completion
  if (
    contract.analysisProgress !== undefined &&
    contract.analysisProgress >= 100
  ) {
    return "completed";
  }

  // Check if status text indicates active processing
  if (isActiveStatus(statusText)) {
    return "reviewing";
  }

  // Fallback: if progress is between 1-99, it's still reviewing even if status text is unrecognized
  if (
    contract.analysisProgress !== undefined &&
    contract.analysisProgress > 0 &&
    contract.analysisProgress < 100
  ) {
    return "reviewing";
  }

  return "pending";
}

export function getStatusFromData(data: Contract): string {
  const statusText = data.analysisStatus || data.analysis?.status || "";
  const stage = (data as { analysisStage?: string }).analysisStage;

  if (
    stage === "fast_complete" ||
    statusText.includes("Fast Analysis Complete")
  ) {
    return "completed";
  }

  if (stage === "deep" && statusText.includes("[Rules]")) {
    if ((data.analysisProgress ?? 0) >= 100) return "completed";
  }

  // Check explicit failure first
  if (
    statusText.includes("failed") ||
    statusText.includes("Failed") ||
    statusText.includes("timed out")
  ) {
    return "failed";
  }

  // Check completion
  if (
    (data.analysisProgress !== undefined && data.analysisProgress >= 100) ||
    (data.analysisResults && data.analysisResults.length > 0)
  ) {
    return "completed";
  }

  // Check if status text indicates active processing
  if (isActiveStatus(statusText)) {
    return "reviewing";
  }

  // Fallback: progress-based detection
  if (
    data.analysisProgress !== undefined &&
    data.analysisProgress > 0 &&
    data.analysisProgress < 100
  ) {
    return "reviewing";
  }

  return "pending";
}
