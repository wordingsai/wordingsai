import { randomUUID } from "node:crypto";
import {
  estimateVectorizeTokens,
  getAstraVectorizeMaxChars,
  NVIDIA_VECTORIZE_TOKEN_LIMIT,
} from "./chunking";

export function vectorizePayloadText(text: string): string {
  const trimmed = text.trim().slice(0, getAstraVectorizeMaxChars());
  if (estimateVectorizeTokens(trimmed) > NVIDIA_VECTORIZE_TOKEN_LIMIT) {
    const ratio =
      (NVIDIA_VECTORIZE_TOKEN_LIMIT - 16) / estimateVectorizeTokens(trimmed);
    return trimmed.slice(0, Math.max(100, Math.floor(trimmed.length * ratio)));
  }
  return trimmed;
}

/**
 * One Astra document for `clause_chunks` collection (vectorize on `content`).
 */
export function buildAstraClauseChunkDocument(args: {
  clauseId: string;
  organizationId: string | null;
  workspaceId: string | null;
  isGlobal: boolean;
  clauseName: string;
  library: string | null;
  category: string | null;
  content: string;
  _id?: string;
  createdAt?: string;
}) {
  const text = vectorizePayloadText(args.content);
  const now = args.createdAt ?? new Date().toISOString();

  return {
    _id: args._id ?? randomUUID(),
    docType: "clause_chunk" as const,
    clauseId: args.clauseId,
    organizationId: args.organizationId,
    workspaceId: args.workspaceId,
    isGlobal: args.isGlobal,
    clauseName: args.clauseName,
    library: args.library,
    category: args.category,
    content: text,
    $vectorize: text,
    createdAt: now,
  };
}

/**
 * One Astra document for `contract_chunks` collection.
 */
export function buildAstraContractChunkDocument(args: {
  contractId: string;
  contractVersionId: string;
  content: string;
  sourceFileName?: string | null;
  _id?: string;
  createdAt?: string;
}) {
  const text = vectorizePayloadText(args.content);
  const now = args.createdAt ?? new Date().toISOString();

  return {
    _id: args._id ?? randomUUID(),
    docType: "contract_chunk" as const,
    contractId: args.contractId,
    contractVersionId: args.contractVersionId,
    content: text,
    sourceFileName: args.sourceFileName ?? null,
    $vectorize: text,
    createdAt: now,
  };
}
