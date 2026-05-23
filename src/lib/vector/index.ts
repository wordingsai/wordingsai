/**
 * Unified vector layer: Astra DB ($vectorize) when configured, else Neon PGVector.
 */
import { isAstraVectorEnabled } from "@/lib/astra/config";
import {
  deleteAstraClauseChunks,
  insertAstraClauseChunks,
  searchAstraClauseChunks,
  deleteAstraContractChunks,
  insertAstraContractChunks,
  searchAstraContractChunks,
  upsertAstraAiGeneration,
  searchAstraWarExclusions,
  syncWarExclusionToAstra,
  deleteAstraWarExclusion,
  type WarExclusionAstraInput,
} from "@/lib/astra/vector-store";
import type { AiGenerationKind, VectorSearchHit } from "@/lib/astra";

export { isAstraVectorEnabled };
export type { AiGenerationKind, VectorSearchHit };

export async function vectorStoreClauseChunks(args: {
  clauseId: string;
  organizationId: string | null;
  workspaceId: string | null;
  isGlobal: boolean;
  clauseName: string;
  library: string | null;
  category: string | null;
  chunks: string[];
}): Promise<{ provider: "astra" | "postgres"; count: number }> {
  if (!isAstraVectorEnabled()) {
    return { provider: "postgres", count: 0 };
  }
  const count = await insertAstraClauseChunks(args);
  return { provider: "astra", count };
}

export async function vectorClearClauseChunks(clauseId: string): Promise<void> {
  if (!isAstraVectorEnabled()) return;
  await deleteAstraClauseChunks(clauseId);
}

export async function vectorSearchLibrary(args: {
  queryText: string;
  organizationId: string;
  workspaceId: string;
  limit?: number;
}): Promise<VectorSearchHit[]> {
  if (!isAstraVectorEnabled()) return [];
  return searchAstraClauseChunks(args);
}

export async function vectorStoreContractChunks(args: {
  contractId: string;
  contractVersionId: string;
  chunks: Array<{ content: string; sourceFileName?: string | null }>;
}): Promise<{ provider: "astra" | "postgres"; count: number }> {
  if (!isAstraVectorEnabled()) {
    return { provider: "postgres", count: 0 };
  }
  const count = await insertAstraContractChunks(args);
  return { provider: "astra", count };
}

export async function vectorClearContractChunks(
  contractVersionId: string,
): Promise<void> {
  if (!isAstraVectorEnabled()) return;
  await deleteAstraContractChunks(contractVersionId);
}

export async function vectorSearchContract(args: {
  contractVersionId: string;
  queryText: string;
  limit?: number;
  maxDistance?: number;
}): Promise<VectorSearchHit[]> {
  if (!isAstraVectorEnabled()) return [];
  return searchAstraContractChunks(args);
}

export async function vectorStoreAiPayload(args: {
  contractId: string;
  kind: AiGenerationKind;
  organizationId?: string | null;
  workspaceId?: string | null;
  payload: unknown;
  searchText: string;
}): Promise<void> {
  if (!isAstraVectorEnabled()) return;
  await upsertAstraAiGeneration(args);
}

export async function vectorSearchWarExclusions(args: {
  queryText: string;
  organizationId: string;
  limit?: number;
}): Promise<VectorSearchHit[]> {
  if (!isAstraVectorEnabled()) return [];
  return searchAstraWarExclusions({
    ...args,
    minSimilarity: 0.4,
  });
}

export async function vectorSyncWarExclusion(
  row: WarExclusionAstraInput,
): Promise<void> {
  if (!isAstraVectorEnabled()) return;
  await syncWarExclusionToAstra(row);
}

export async function vectorDeleteWarExclusion(id: string): Promise<void> {
  if (!isAstraVectorEnabled()) return;
  await deleteAstraWarExclusion(id);
}
