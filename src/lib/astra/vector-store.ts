import { randomUUID } from "node:crypto";
import { ASTRA_COLLECTIONS, ASTRA_MAX_DISTANCE } from "./config";
import { getAstraCollection, withAstraRetry } from "./client";
import {
  buildAstraClauseChunkDocument,
  buildAstraContractChunkDocument,
  vectorizePayloadText,
} from "./documents";
import type {
  AiGenerationDocument,
  AiGenerationKind,
  ChunkDocType,
  VectorSearchHit,
} from "./types";

function similarityFromDoc(doc: Record<string, unknown>): number {
  if (typeof doc.$similarity === "number") return doc.$similarity;
  if (typeof doc.similarity === "number") return doc.similarity;
  return 0;
}

const vectorizeText = vectorizePayloadText;

// ─── Clause chunks ───────────────────────────────────────────────────────────

export async function deleteAstraClauseChunks(clauseId: string): Promise<void> {
  const col = await getAstraCollection(ASTRA_COLLECTIONS.clauseChunks);
  await withAstraRetry(
    () => col.deleteMany({ clauseId }, { timeout: 60_000 }),
    { label: "deleteAstraClauseChunks" },
  );
}

export async function insertAstraClauseChunks(args: {
  clauseId: string;
  organizationId: string | null;
  workspaceId: string | null;
  isGlobal: boolean;
  clauseName: string;
  library: string | null;
  category: string | null;
  chunks: string[];
}): Promise<number> {
  if (args.chunks.length === 0) return 0;

  await deleteAstraClauseChunks(args.clauseId);

  const col = await getAstraCollection(ASTRA_COLLECTIONS.clauseChunks);
  const now = new Date().toISOString();
  const docs = args.chunks.map((content) =>
    buildAstraClauseChunkDocument({
      ...args,
      content,
      createdAt: now,
    }),
  );

  await withAstraRetry(
    () => col.insertMany(docs, { timeout: 120_000 }),
    { label: "insertAstraClauseChunks" },
  );
  return docs.length;
}

export async function searchAstraClauseChunks(args: {
  queryText: string;
  organizationId: string;
  workspaceId: string;
  limit?: number;
  maxDistance?: number;
}): Promise<VectorSearchHit[]> {
  const col = await getAstraCollection(ASTRA_COLLECTIONS.clauseChunks);
  const limit = args.limit ?? 3;

  const cursor = col.find(
    {
      $or: [
        { isGlobal: true },
        {
          organizationId: args.organizationId,
          $or: [{ workspaceId: args.workspaceId }, { workspaceId: null }],
        },
      ],
    },
    {
      sort: { $vectorize: vectorizeText(args.queryText) },
      limit,
      includeSimilarity: true,
      timeout: 60_000,
    },
  );

  const hits: VectorSearchHit[] = [];
  for await (const doc of cursor) {
    const sim = similarityFromDoc(doc as Record<string, unknown>);
    const distance = 1 - sim;
    if (distance >= (args.maxDistance ?? ASTRA_MAX_DISTANCE)) continue;

    hits.push({
      id: String(doc.clauseId ?? doc._id),
      content: String(doc.content ?? ""),
      similarity: sim,
      metadata: {
        clauseId: doc.clauseId,
        clauseName: doc.clauseName,
        library: doc.library,
        category: doc.category,
        chunkId: doc._id,
      },
    });
  }
  return hits;
}

// ─── Contract chunks (RAG) ───────────────────────────────────────────────────

export async function deleteAstraContractChunks(
  contractVersionId: string,
): Promise<void> {
  const col = await getAstraCollection(ASTRA_COLLECTIONS.contractChunks);
  await withAstraRetry(
    () => col.deleteMany({ contractVersionId }, { timeout: 60_000 }),
    { label: "deleteAstraContractChunks" },
  );
}

export async function insertAstraContractChunks(args: {
  contractId: string;
  contractVersionId: string;
  chunks: Array<{ content: string; sourceFileName?: string | null }>;
}): Promise<number> {
  if (args.chunks.length === 0) return 0;

  await deleteAstraContractChunks(args.contractVersionId);

  const col = await getAstraCollection(ASTRA_COLLECTIONS.contractChunks);
  const now = new Date().toISOString();
  const docs = args.chunks.map((c) =>
    buildAstraContractChunkDocument({
      contractId: args.contractId,
      contractVersionId: args.contractVersionId,
      content: c.content,
      sourceFileName: c.sourceFileName,
      createdAt: now,
    }),
  );

  await withAstraRetry(
    () => col.insertMany(docs, { timeout: 120_000 }),
    { label: "insertAstraContractChunks" },
  );
  return docs.length;
}

export async function searchAstraContractChunks(args: {
  contractVersionId: string;
  queryText: string;
  limit?: number;
  maxDistance?: number;
}): Promise<VectorSearchHit[]> {
  const col = await getAstraCollection(ASTRA_COLLECTIONS.contractChunks);

  const cursor = col.find(
    { contractVersionId: args.contractVersionId },
    {
      sort: { $vectorize: vectorizeText(args.queryText) },
      limit: args.limit ?? 5,
      includeSimilarity: true,
      timeout: 60_000,
    },
  );

  const hits: VectorSearchHit[] = [];
  for await (const doc of cursor) {
    const sim = similarityFromDoc(doc as Record<string, unknown>);
    if (1 - sim >= (args.maxDistance ?? ASTRA_MAX_DISTANCE)) continue;
    hits.push({
      id: String(doc._id),
      content: String(doc.content ?? ""),
      similarity: sim,
      metadata: {
        sourceFileName: doc.sourceFileName,
        contractVersionId: doc.contractVersionId,
      },
    });
  }
  return hits;
}

// ─── AI generations (high payload) ───────────────────────────────────────────

export async function upsertAstraAiGeneration(args: {
  contractId: string;
  kind: AiGenerationKind;
  organizationId?: string | null;
  workspaceId?: string | null;
  /** Deprecated/ignored. The full payload (e.g. the document map) lives in
   *  Postgres (contracts.structuredContent / contracts.analysis); it is the
   *  source of truth and is read from there, never from Astra. We intentionally
   *  do NOT store it here: Astra auto-indexes every field and caps an indexed
   *  string at 8000 bytes, so a large `paragraphs` value (e.g. a 33 KB block on
   *  contract UMR001) made the whole insert fail with "Document size limitation
   *  violated", which failed analysis at 50%. Only the short, truncated
   *  `searchText` is needed here for $vectorize search. */
  payload?: unknown;
  /** Text excerpt for $vectorize (e.g. summary or section headings) */
  searchText: string;
}): Promise<string> {
  const col = await getAstraCollection(ASTRA_COLLECTIONS.aiGenerations);
  const docId = `${args.contractId}:${args.kind}`;
  const now = new Date().toISOString();
  const content = vectorizeText(args.searchText);

  const doc: AiGenerationDocument = {
    _id: docId,
    docType: "ai_generation",
    kind: args.kind,
    contractId: args.contractId,
    organizationId: args.organizationId ?? null,
    workspaceId: args.workspaceId ?? null,
    // payload intentionally omitted — see note above (Astra 8 KB indexed-field cap).
    content,
    $vectorize: content,
    createdAt: now,
    updatedAt: now,
  };

  await withAstraRetry(() => col.deleteOne({ _id: docId }), {
    label: "upsertAstraAiGeneration:delete",
  });
  await withAstraRetry(() => col.insertOne(doc, { timeout: 60_000 }), {
    label: "upsertAstraAiGeneration:insert",
  });
  return docId;
}

export async function getAstraAiGeneration<T = unknown>(
  contractId: string,
  kind: AiGenerationKind,
): Promise<T | null> {
  const col = await getAstraCollection(ASTRA_COLLECTIONS.aiGenerations);
  const doc = await col.findOne(
    { _id: `${contractId}:${kind}` },
    { timeout: 30_000 },
  );
  if (!doc?.payload) return null;
  return doc.payload as T;
}

export async function searchAstraAiGenerations(args: {
  contractId?: string;
  queryText: string;
  kind?: AiGenerationKind;
  limit?: number;
}): Promise<
  Array<{ id: string; kind: string; similarity: number; payload: unknown }>
> {
  const col = await getAstraCollection(ASTRA_COLLECTIONS.aiGenerations);
  const filter: Record<string, unknown> = {};
  if (args.contractId) filter.contractId = args.contractId;
  if (args.kind) filter.kind = args.kind;

  const cursor = col.find(filter, {
    sort: { $vectorize: vectorizeText(args.queryText) },
    limit: args.limit ?? 5,
    includeSimilarity: true,
    timeout: 60_000,
  });

  const results: Array<{
    id: string;
    kind: string;
    similarity: number;
    payload: unknown;
  }> = [];

  for await (const doc of cursor) {
    results.push({
      id: String(doc._id),
      kind: String(doc.kind),
      similarity: similarityFromDoc(doc as Record<string, unknown>),
      payload: doc.payload,
    });
  }
  return results;
}

// ─── War exclusions ──────────────────────────────────────────────────────────

export type WarExclusionAstraInput = {
  id: string;
  organizationId: string | null;
  title: string;
  clauseText: string;
  category?: string | null;
  bias?: string | null;
  type?: string | null;
  treatyFac?: string | null;
  conditions?: unknown;
  keywords?: string[] | null;
  legalComments?: string | null;
};

function warExclusionVectorizeSource(row: WarExclusionAstraInput): string {
  const parts = [row.title?.trim(), row.clauseText?.trim()].filter(Boolean);
  return vectorizeText(parts.join("\n\n"));
}

export async function deleteAstraWarExclusion(id: string): Promise<void> {
  const col = await getAstraCollection(ASTRA_COLLECTIONS.warExclusions);
  await withAstraRetry(
    () => col.deleteMany({ _id: id }, { timeout: 60_000 }),
    { label: "deleteAstraWarExclusion" },
  );
}

export async function insertAstraWarExclusion(
  args: WarExclusionAstraInput,
): Promise<void> {
  const col = await getAstraCollection(ASTRA_COLLECTIONS.warExclusions);
  const text = warExclusionVectorizeSource(args);
  await withAstraRetry(() => col.deleteOne({ _id: args.id }), {
    label: "insertAstraWarExclusion:delete",
  });
  await withAstraRetry(
    () =>
      col.insertOne(
        {
          _id: args.id,
          docType: "war_exclusion" as ChunkDocType,
          organizationId: args.organizationId,
          title: args.title,
          clauseText: args.clauseText,
          category: args.category ?? null,
          bias: args.bias ?? null,
          type: args.type ?? null,
          treatyFac: args.treatyFac ?? null,
          conditions: args.conditions ?? null,
          keywords: args.keywords ?? null,
          legalComments: args.legalComments ?? null,
          content: text,
          $vectorize: text,
          createdAt: new Date().toISOString(),
        },
        { timeout: 60_000 },
      ),
    { label: "insertAstraWarExclusion:insert" },
  );
}

/** Sync one war exclusion row to Astra (call after Postgres insert/update). */
export async function syncWarExclusionToAstra(
  row: WarExclusionAstraInput,
): Promise<void> {
  await insertAstraWarExclusion(row);
}

export async function searchAstraWarExclusions(args: {
  queryText: string;
  organizationId: string;
  limit?: number;
  minSimilarity?: number;
}): Promise<VectorSearchHit[]> {
  const col = await getAstraCollection(ASTRA_COLLECTIONS.warExclusions);
  const cursor = col.find(
    {
      $or: [{ organizationId: args.organizationId }, { organizationId: null }],
    },
    {
      sort: { $vectorize: vectorizeText(args.queryText) },
      limit: args.limit ?? 2,
      includeSimilarity: true,
      timeout: 60_000,
    },
  );

  const minSim = args.minSimilarity ?? 0.4;
  const hits: VectorSearchHit[] = [];
  for await (const doc of cursor) {
    const sim = similarityFromDoc(doc as Record<string, unknown>);
    if (sim < minSim) continue;
    hits.push({
      id: String(doc._id),
      content: String(doc.clauseText ?? doc.content ?? ""),
      similarity: sim,
      metadata: {
        title: doc.title,
        category: doc.category,
        organizationId: doc.organizationId,
      },
    });
  }
  return hits;
}
