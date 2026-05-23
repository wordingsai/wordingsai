/**
 * Structured evidence types for rule evaluations
 * Provides clean, hierarchical representation of extracted evidence
 * with clause-library matching and confidence scoring
 */

/**
 * Represents a single piece of evidence extracted from a document
 * with clean formatting and library clause linking
 */
export interface StructuredEvidenceItem {
  /** Unique identifier for this evidence item */
  id: string;

  /** The section/heading this evidence belongs to in the document */
  section: string;

  /** Type of clause this evidence represents (e.g., "Termination", "Liability") */
  clauseType: string;

  /** Clean extracted text from document (no OCR artifacts or markup) */
  text: string;

  /** Reference to matched library clause if matched */
  libraryClauseId?: string | null;

  /** Name/title of the matched library clause */
  libraryClauseName?: string | null;

  /** Confidence score for library match (0-1), higher is better */
  matchConfidence: number;

  /** Whether this match was manually overridden by a user */
  isManuallyMatched: boolean;

  /** Source reference information */
  source: {
    /** Original chunk/paragraph from document */
    chunk: string;

    /** Position/line number in document */
    position: number;

    /** File name if multi-file document */
    fileName?: string | null;
  };

  /** Similarity score to query/rule (0-1) */
  similarity?: number | null;

  /** Metadata for audit trail */
  metadata?: {
    extractedAt?: string;
    matchedAt?: string;
    matchedBy?: string;
  };
}

/**
 * Hierarchical grouping of evidence by section and clause type
 */
export interface StructuredEvidenceGroup {
  /** Section identifier and title */
  section: string;

  /** Evidence items grouped under this section */
  items: StructuredEvidenceItem[];

  /** Total evidence items in this section */
  count: number;
}

/**
 * Complete structured evidence result for a rule evaluation
 */
export interface StructuredEvidenceResult {
  /** ID of the rule being evaluated */
  ruleId: string;

  /** ID of the contract being analyzed */
  contractId: string;

  /** Evaluation status (Green/Amber/Red) */
  status: "Green" | "Amber" | "Red";

  /** Overall reasoning for the status */
  reasoning: string;

  /** Confidence in the overall evaluation (0-1) */
  confidence?: number | null;

  /** Detected bias if applicable */
  detectedBias?: string | null;

  /** All evidence items (flat list) */
  allEvidence: StructuredEvidenceItem[];

  /** Evidence grouped by section for hierarchical display */
  groupedEvidence: StructuredEvidenceGroup[];

  /** Summary statistics */
  statistics: {
    totalEvidence: number;
    totalSections: number;
    matchedToLibrary: number;
    manuallyMatched: number;
    averageConfidence: number;
  };

  /** Timestamp of evaluation */
  evaluatedAt: string;

  /** Version of rule that was evaluated */
  ruleVersionId?: string | null;
}

/**
 * Request to match a document clause to library clauses
 */
export interface ClauseMatchingRequest {
  /** Document text to match */
  documentClauseText: string;

  /** Section/context where this clause appears */
  section?: string | null;

  /** Clause type hint if known */
  clauseTypeHint?: string | null;

  /** Number of top matches to return */
  topN?: number;

  /** Minimum confidence threshold (0-1) */
  minConfidence?: number;
}

/**
 * Result of matching a document clause to library clauses
 */
export interface ClauseMatchingResult {
  /** Document clause text that was matched */
  documentClauseText: string;

  /** Top matching library clauses with confidence scores */
  matches: Array<{
    /** Library clause ID */
    id: string;

    /** Library clause name */
    name: string;

    /** Clause type */
    type: string;

    /** Matching confidence (0-1) */
    confidence: number;

    /** Why this clause matches */
    reason?: string | null;
  }>;

  /** Whether any high-confidence match was found */
  hasHighConfidenceMatch: boolean;

  /** Recommended match if confidence > threshold */
  recommendedMatch?: {
    id: string;
    name: string;
    confidence: number;
  } | null;
}

/**
 * Manual clause match override
 */
export interface ManualClauseMatchOverride {
  /** Evidence item ID being matched */
  evidenceId: string;

  /** Selected library clause ID */
  libraryClauseId: string;

  /** User who made the override */
  overriddenBy: string;

  /** Reason for override */
  reason?: string | null;

  /** Timestamp of override */
  overriddenAt: string;
}

// Compatibility export for tests
export type RuleEvaluationResult = any;
