export type ChunkDocType = "clause_chunk" | "contract_chunk" | "war_exclusion";

export type AiGenerationKind =
  | "structured_content"
  | "analysis"
  | "summary"
  | "fast_summary"
  | "rule_evidence";

export interface ClauseChunkDocument {
  _id: string;
  docType: "clause_chunk";
  clauseId: string;
  organizationId: string | null;
  workspaceId: string | null;
  isGlobal: boolean;
  clauseName: string;
  library: string | null;
  category: string | null;
  content: string;
  /** Astra vectorize source — must match collection vectorize config */
  $vectorize: string;
  createdAt: string;
}

export interface ContractChunkDocument {
  _id: string;
  docType: "contract_chunk";
  contractId: string;
  contractVersionId: string;
  content: string;
  sourceFileName?: string | null;
  $vectorize: string;
  createdAt: string;
}

export interface AiGenerationDocument {
  _id: string;
  docType: "ai_generation";
  kind: AiGenerationKind;
  contractId: string;
  organizationId?: string | null;
  workspaceId?: string | null;
  /** Deprecated: the large payload is NOT stored in Astra (8 KB indexed-field
   *  cap). It lives in Postgres (contracts.structuredContent / .analysis). */
  payload?: unknown;
  /** Short text used for vectorize + preview search */
  content: string;
  $vectorize: string;
  createdAt: string;
  updatedAt: string;
}

export interface VectorSearchHit {
  id: string;
  content: string;
  similarity: number;
  metadata: Record<string, unknown>;
}
