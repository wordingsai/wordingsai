/**
 * Astra DB (DataStax) — vector store + high-payload AI documents.
 *
 * Collections must be created in Astra with **vectorize** enabled on the `content` field.
 * @see docs/astra-db.md
 */

export const ASTRA_COLLECTIONS = {
  clauseChunks: process.env.ASTRA_COLLECTION_CLAUSE_CHUNKS ?? "clause_chunks",
  contractChunks:
    process.env.ASTRA_COLLECTION_CONTRACT_CHUNKS ?? "contract_chunks",
  aiGenerations:
    process.env.ASTRA_COLLECTION_AI_GENERATIONS ?? "ai_generations",
  warExclusions:
    process.env.ASTRA_COLLECTION_WAR_EXCLUSIONS ?? "war_exclusions",
} as const;

export type AstraCollectionKey = keyof typeof ASTRA_COLLECTIONS;

/** When true, do not store clause chunk rows in Neon (vectors live in Astra only). */
export function skipNeonClauseChunkMirror(): boolean {
  const flag = process.env.ASTRA_SKIP_NEON_CHUNK_MIRROR?.toLowerCase();
  if (flag === "false" || flag === "0") return false;
  return isAstraVectorEnabled();
}

/** When true, chunks + vector search + AI payloads use Astra ($vectorize). */
export function isAstraVectorEnabled(): boolean {
  const flag = process.env.USE_ASTRA_VECTOR?.toLowerCase();
  if (flag === "false" || flag === "0") return false;
  if (flag === "true" || flag === "1") return true;
  return Boolean(
    process.env.ASTRA_DB_APPLICATION_TOKEN && process.env.ASTRA_DB_API_ENDPOINT,
  );
}

export function getAstraCredentials(): {
  token: string;
  endpoint: string;
} | null {
  const token =
    process.env.ASTRA_DB_APPLICATION_TOKEN || process.env.ASTRA_DB_TOKEN || "";
  const endpoint = process.env.ASTRA_DB_API_ENDPOINT || "";
  if (!token || !endpoint) return null;
  return { token, endpoint };
}

/** Max cosine distance (Astra returns similarity when includeSimilarity is set). */
export const ASTRA_MAX_DISTANCE = Number(
  process.env.ASTRA_VECTOR_MAX_DISTANCE ?? "0.6",
);
