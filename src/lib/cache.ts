import { redis } from "./ratelimit";

/**
 * Cache configuration
 */
const CACHE_TTL = 60 * 60 * 24; // 24 hours in seconds
const GLOBAL_CACHE_PREFIX = "wordings:global:";

export async function getGlobalCache<T>(key: string): Promise<T | null> {
  try {
    const data = await redis.get<T>(`${GLOBAL_CACHE_PREFIX}${key}`);
    if (data) {
      console.log(`[Cache] HIT for key: ${key}`);
      return data;
    }
  } catch (error) {
    console.error(`[Cache] Error GET for key: ${key}`, error);
  }
  return null;
}

export async function setGlobalCache<T>(
  key: string,
  value: T,
  ttl = CACHE_TTL,
): Promise<void> {
  try {
    await redis.set(`${GLOBAL_CACHE_PREFIX}${key}`, value, { ex: ttl });
    console.log(`[Cache] SET for key: ${key} (ttl: ${ttl}s)`);
  } catch (error) {
    console.error(`[Cache] Error SET for key: ${key}`, error);
  }
}

/**
 * Helper to generate a cache key for query embeddings
 */
export function getEmbeddingCacheKey(query: string): string {
  // Simple normalization: lowercase and trim
  const normalized = query.toLowerCase().trim();
  // Using the raw string as key since Redis handles it fine (and we want readability in console)
  // If queries are massive, we could SHA-256 hash them.
  return `emb:${normalized}`;
}

/**
 * Helper to generate a cache key for retrieval results
 * Retrieval is contract-specific because chunks belong to a contract.
 */
export function getRetrievalCacheKey(
  contractId: string,
  queries: string[],
): string {
  const sortedQueries = [...queries]
    .sort()
    .map((q) => q.toLowerCase().trim())
    .join("|");
  return `retr:${contractId}:${sortedQueries}`;
}
