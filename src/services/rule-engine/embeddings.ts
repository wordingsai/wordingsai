/**
 * Embedding generation, RAG chunk persistence and semantic chunk retrieval.
 * Extracted verbatim from the original src/services/rule-engine.ts during
 * modularization (no logic changes).
 */
import { db } from "@/db/drizzle";
import { eq, and, sql } from "drizzle-orm";
import { contracts, contractChunks, contractVersions } from "@/db/schema";
import { createEmbeddings } from "@/lib/embedding";
import { isAstraVectorEnabled } from "@/lib/astra/config";
import {
  deleteAstraContractChunks,
  insertAstraContractChunks,
  searchAstraContractChunks,
} from "@/lib/astra/vector-store";
import {
  getGlobalCache,
  setGlobalCache,
  getEmbeddingCacheKey,
  getRetrievalCacheKey,
} from "@/lib/cache";

export async function getCachedEmbeddings(
  queries: string[],
  bypassDelay = false,
): Promise<number[][]> {
  if (isAstraVectorEnabled()) {
    return queries.map(() => []);
  }

  const queryEmbeddings: number[][] = [];
  const queriesToEmbed: string[] = [];
  const queryToIndex: Map<string, number> = new Map();

  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    const cacheKey = getEmbeddingCacheKey(q);
    const cached = await getGlobalCache<number[]>(cacheKey);

    if (cached) {
      queryEmbeddings[i] = cached;
    } else {
      queriesToEmbed.push(q);
      queryToIndex.set(q, i);
    }
  }

  if (queriesToEmbed.length > 0) {
    const newEmbeddings = await createEmbeddings(queriesToEmbed);

    queriesToEmbed.forEach((q, idx) => {
      const originalIdx = queryToIndex.get(q)!;
      queryEmbeddings[originalIdx] = newEmbeddings[idx];
      // Cache for global reuse
      setGlobalCache(getEmbeddingCacheKey(q), newEmbeddings[idx]);
    });
  }

  return queryEmbeddings;
}

/**
 * Chunks a contract version and generates embeddings for RAG retrieval.
 */
export async function chunkAndEmbedContractVersion(
  contractId: string,
  versionId: string,
  text: string,
  onProgress?: (current: number, total: number) => Promise<void>,
) {
  if (!text?.trim()) return;

  const { splitText } = await import("@/lib/chunk");
  const { createEmbeddings } = await import("@/lib/embedding");

  const chunks = splitText(text, 1000);
  if (chunks.length === 0) return;

  // Check if we already have chunks for this version in the database
  const existingChunks = await db
    .select({ id: contractChunks.id })
    .from(contractChunks)
    .where(eq(contractChunks.contractVersionId, versionId));

  // Verify version exists (sanity check for FK race conditions)
  const [versionCheck] = await db
    .select({ id: contractVersions.id })
    .from(contractVersions)
    .where(eq(contractVersions.id, versionId))
    .limit(1);

  if (!versionCheck) {
    console.error(
      `[RAG] Fatal: Contract version ${versionId} not found in database. Aborting embedding.`,
    );
    throw new Error(`Contract version ${versionId} not found`);
  }

  if (isAstraVectorEnabled()) {
    await deleteAstraContractChunks(versionId);
  }

  if (existingChunks.length > 0) {
    if (existingChunks.length === chunks.length && !isAstraVectorEnabled()) {
      console.log(
        `[RAG] Reuse: Found all ${existingChunks.length} existing embeddings/chunks for contract ${contractId} version ${versionId}. Skipping generation.`,
      );
      return;
    }

    console.log(
      `[RAG] Partial/stale chunks found (${existingChunks.length} vs expected ${chunks.length}). Rebuilding chunks...`,
    );
    await db
      .delete(contractChunks)
      .where(eq(contractChunks.contractVersionId, versionId));
  }

  console.log(
    `[RAG] Chunking ${chunks.length} segments for contract ${contractId} (Version: ${versionId}, Astra: ${isAstraVectorEnabled()})...`,
  );

  if (isAstraVectorEnabled()) {
    await insertAstraContractChunks({
      contractId,
      contractVersionId: versionId,
      chunks: chunks.map((content) => ({ content: content.trim() })),
    });
    const values = chunks.map((content) => ({
      contractVersionId: versionId,
      content: content.trim(),
      embedding: null,
    }));
    if (values.length > 0) {
      await db.insert(contractChunks).values(values);
    }
    if (onProgress) await onProgress(chunks.length, chunks.length);
    return;
  }

  const BATCH_SIZE = 10;
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    try {
      const embeddings = (await createEmbeddings(batch)) as number[][];
      const values = batch.map((content, idx) => ({
        contractVersionId: versionId,
        content: content.trim(),
        embedding: embeddings[idx],
      }));

      if (values.length > 0) {
        await db.insert(contractChunks).values(values);
      }

      if (onProgress) {
        await onProgress(
          Math.min(i + BATCH_SIZE, chunks.length),
          chunks.length,
        );
      }
    } catch (err) {
      console.error(`[RAG] Embedding batch ${i / BATCH_SIZE} failed:`, err);
      throw err;
    }
  }
}

/**
 * High-performance semantic retrieval for contract chunks.
 */
export async function retrieveRelevantContractChunks(
  contractId: string,
  queries: string[],
  queryEmbeddings: number[][],
  topKPerQuery = 5,
  distanceThreshold = 0.5,
  useCache = true,
) {
  if (!queries.length) return [];

  const cacheKey = getRetrievalCacheKey(contractId, queries);
  if (useCache) {
    const cached = await getGlobalCache<any[]>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  console.log(`[RuleEngine] Fetching contract ${contractId}...`);
  const query = db
    .select({ currentVersionId: contracts.currentVersionId })
    .from(contracts)
    .where(eq(contracts.id, contractId));

  const contractResult = await query;
  console.log(`[RuleEngine] Query result:`, contractResult);
  const [contract] = contractResult;

  if (!contract?.currentVersionId) return [];

  const versionId = contract.currentVersionId;

  let allChunksResults: Array<
    Array<{
      id: string;
      content: string;
      sourceFileName?: string | null;
      similarity: number;
    }>
  >;

  if (isAstraVectorEnabled()) {
    allChunksResults = await Promise.all(
      queries.map(async (q) => {
        const hits = await searchAstraContractChunks({
          contractVersionId: versionId,
          queryText: q,
          limit: topKPerQuery,
          maxDistance: distanceThreshold,
        });
        return hits.map((h) => ({
          id: h.id,
          content: h.content,
          sourceFileName: (h.metadata.sourceFileName as string) ?? null,
          similarity: h.similarity,
        }));
      }),
    );
  } else {
    allChunksResults = await Promise.all(
      queries.map(async (_, i) => {
        if (!queryEmbeddings[i]) return [];

        const queryVec = sql`${"[" + queryEmbeddings[i].join(",") + "]"}::vector`;

        return await db
          .select({
            id: contractChunks.id,
            content: contractChunks.content,
            embedding: contractChunks.embedding,
            sourceFileName: contractChunks.sourceFileName,
            similarity: sql<number>`1 - (${contractChunks.embedding} <=> ${queryVec})`,
          })
          .from(contractChunks)
          .where(
            and(
              eq(contractChunks.contractVersionId, versionId),
              sql`${contractChunks.embedding} <=> ${queryVec} < ${distanceThreshold}`,
            ),
          )
          .orderBy(sql`${contractChunks.embedding} <=> ${queryVec}`)
          .limit(topKPerQuery);
      }),
    );
  }

  const allChunks = allChunksResults.flat();
  const unique = new Map<string, any>();
  for (const c of allChunks) {
    const existing = unique.get(c.id);
    if (!existing || c.similarity > existing.similarity) unique.set(c.id, c);
  }

  const finalChunks = Array.from(unique.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 10);

  if (useCache && finalChunks.length > 0) {
    await setGlobalCache(cacheKey, finalChunks, 60 * 30);
  }

  return finalChunks;
}

export async function waitForChunks(
  versionId: string,
  maxAttempts = 20,
): Promise<boolean> {
  console.log(`[RuleEngine] Waiting for chunks for version: ${versionId}...`);
  for (let i = 0; i < maxAttempts; i++) {
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(contractChunks)
      .where(eq(contractChunks.contractVersionId, versionId));

    const count = Number(countResult?.count || 0);
    if (count > 0) {
      console.log(`[RuleEngine] Chunks found for version: ${versionId}`);
      return true;
    }

    if (i % 5 === 0 && i > 0) {
      console.log(
        `[RuleEngine] Still waiting for chunks (${i * 3}s elapsed)...`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  throw new Error(
    `Timeout waiting for contract chunks for version ${versionId}. Ensure text extraction completed successfully.`,
  );
}
