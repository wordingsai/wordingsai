import type { StructuredContract } from "@/lib/structured-contract";

export type AnalysisStatus = "pending" | "reviewing" | "completed" | "failed";

export type Contract = {
  id: string;
  contractName: string;
  reinsured: string;
  broker: string | null;
  contractType: string;
  periodFrom: string | null;
  periodTo: string | null;
  tags: string[];
  fileSize?: number;
  createdAt?: string;
  executionDate?: string;
  riskScore?: number;
  analysisProgress?: number;
  analysisStatus?: string | null;
  analysisStage?: string;
  totalRules?: number;
  updatedAt?: string;
  lastAnalyzedAt?: string;
  fileURL?: string | null;
  compressedFileUrl?: string | null;
  structuredContent?: StructuredContract | null;
  currentRuleCount?: number;
  analysis?: any;
  analysisResults?: Array<AnalysisResult>;
};

export type AnalysisResult = {
  id: string;
  status: "Green" | "Amber" | "Red";
  reasoning: string;
  comments?: string | null;
  ruleVersionId?: string;
  evaluatedAt?: string;
  confidence?: number;
  triggeredConditions?: string[];
  keyTerms?: string[];
  bias?: string | null;
  rule: {
    id: string;
    name: string;
    definition?: any;
    currentVersionId?: string;
  };
  granularGuidance?: {
    matchedKeywords?: string[];
    conditionMatrix?: Record<string, string>;
    legalCommentary?: string;
    standardWordingMatch?: string;
    standardWordingText?: string;
  };
  evidence: Array<{
    content: string;
    similarity: number;
    sourceFileName?: string;
    headingLine?: string | null;
    clauseBody?: string | null;
    sourceType?: "analyzed_clause" | "chunk" | "unknown";
    sourceId?: string | null;
  }>;
};

export interface AnalysisEvent {
  id: string;
  status: "Matched" | "Custom" | "Missing" | string;
  metadata: {
    clauseName: string;
    documentText?: string;
    libraryText?: string;
    reasoning?: string;
    confidence?: number;
    category?: string;
    libraryStandard?: string;
    cognitiveReasoning?: string;
    status?: string;
    isGlobal?: boolean;
    clauseCode?: string | null;
    /** How this clause was matched: "code" = exact library-code reference
     * (Rule A/C, 100%), "semantic" = vector similarity (Rule B). */
    matchType?: "code" | "semantic";
    /** Rule C: the contract carries the coded library clause PLUS extra
     * contract-specific wording (vs pure incorporation-by-reference). */
    libraryPlusContext?: boolean;
  };
  timestamp: string;
}
