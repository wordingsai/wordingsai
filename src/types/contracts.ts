export type AnalysisStage =
  | "uploading"
  | "ocr"
  | "fast"
  | "basic"
  | "plus"
  | "completed"
  | "failed";

export interface AnalysisPipelineStep {
  key: AnalysisStage;
  label: string;
  status: "pending" | "active" | "completed" | "failed";
}

export interface ChecklistItem {
  id: string;
  clauseName: string;
  status: "Matched" | "Custom" | "Missing";
  category?: string | null;
  reasoning?: string | null;
  confidence?: number | null;
  documentText?: string | null;
  libraryText?: string | null;
  sourceClauseId?: string | null;
  sourceMethod?: "ocr" | "segmentation" | "library_match" | "none";
  matchType?: "matched" | "custom" | "missing";
}

export interface ChecklistSummary {
  total: number;
  matched: number;
  custom: number;
  missing: number;
}

export interface ContractAnalysis {
  status?: string;
  summary?: string;
  metadata?: Record<string, string>;
  riskConsensus?: string;
  keyHighlights?: string[];
  lastError?: string;
  stage?: AnalysisStage;
  steps?: AnalysisPipelineStep[];
  selectedModules?: string[];
  fast?: {
    checklist?: ChecklistItem[];
    summary?: ChecklistSummary;
    updatedAt?: string;
  };
  basic?: {
    resultsCount?: number;
    updatedAt?: string;
  };
  plus?: {
    enabled?: boolean;
    resultsCount?: number;
    placeholder?: string;
    updatedAt?: string;
    clauseCoverage?: {
      coverageScore: number;
      missingClauses: string[];
      unusualClauses: string[];
    };
    riskBreakdown?: {
      categories: Record<string, string>;
      topDrivers: string[];
    };
    obligations?: Array<{
      party: string;
      task: string;
      deadline?: string;
      type: "critical" | "standard";
    }>;
    timeline?: Array<{
      date: string;
      event: string;
      isRisky: boolean;
    }>;
    evidenceSnippets?: Array<{
      finding: string;
      verbatimText: string;
      explanation: string;
    }>;
  };
}

export type AuditStatus = "pending" | "reviewing" | "completed" | "failed";
