/**
 * Library clause matching (exact + semantic) and war-exclusion matching.
 * Extracted verbatim from the original src/services/rule-engine.ts during
 * modularization (no logic changes).
 */
import { db } from "@/db/drizzle";
import { eq, and, or, sql, inArray, desc, isNull } from "drizzle-orm";
import {
  clauses,
  clauseChunks,
  warExclusions,
  workspaceClauses,
} from "@/db/schema";
import { createEmbeddings } from "@/lib/embedding";
import { isAstraVectorEnabled } from "@/lib/astra/config";
import {
  searchAstraClauseChunks,
  searchAstraWarExclusions,
} from "@/lib/astra/vector-store";
import { normalizeText, prepareEmbeddingText, headingMatchBoost } from "./text-utils";

export async function findClosestLibraryMatches(
  clauseText: string,
  organizationId: string,
  workspaceId: string,
  limit = 3,
) {
  const normText = normalizeText(clauseText);

  const exactMatches = await db
    .select({
      id: clauses.id,
      clauseName: clauses.clauseName,
      clauseText: clauses.clauseText,
      library: clauses.library,
      code: clauses.code,
      status: clauses.status,
      similarity: sql<number>`1.0`,
      keywords: clauses.keywords,
    })
    .from(clauses)
    .leftJoin(workspaceClauses, eq(clauses.id, workspaceClauses.clauseId))
    .where(
      and(
        or(
          eq(clauses.isGlobal, true),
          and(
            eq(clauses.organizationId, organizationId),
            or(
              eq(clauses.workspaceId, workspaceId),
              eq(workspaceClauses.workspaceId, workspaceId),
              and(
                sql`${clauses.workspaceId} IS NULL`,
                sql`${workspaceClauses.workspaceId} IS NULL`,
              ),
            ),
          ),
        ),
        sql`trim(regexp_replace(regexp_replace(lower(${clauses.clauseText}), '[^a-z0-9\\s]', '', 'g'), '\\s+', ' ', 'g')) = ${normText}`,
      ),
    )
    .limit(limit);

  if (exactMatches.length > 0) {
    return exactMatches;
  }

  if (isAstraVectorEnabled()) {
    const hits = await searchAstraClauseChunks({
      queryText: prepareEmbeddingText(clauseText),
      organizationId,
      workspaceId,
      limit,
    });
    const clauseIds = [
      ...new Set(hits.map((h) => String(h.metadata.clauseId ?? h.id))),
    ];
    if (clauseIds.length === 0) return [];

    const hydrated = await db
      .select({
        id: clauses.id,
        clauseName: clauses.clauseName,
        clauseText: clauses.clauseText,
        library: clauses.library,
        code: clauses.code,
        status: clauses.status,
        keywords: clauses.keywords,
      })
      .from(clauses)
      .where(inArray(clauses.id, clauseIds));

    const simByClause = new Map(
      hits.map((h) => [String(h.metadata.clauseId ?? h.id), h.similarity]),
    );

    return hydrated
      .map((row) => ({
        ...row,
        similarity: simByClause.get(row.id) ?? 0,
      }))
      .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
      .slice(0, limit);
  }

  const [embedding] = await createEmbeddings([normText]);
  if (!embedding) return [];
  const vec = sql`${"[" + embedding.join(",") + "]"}::vector`;

  const matches = await db
    .select({
      id: clauses.id,
      clauseName: clauses.clauseName,
      clauseText: clauses.clauseText,
      library: clauses.library,
      code: clauses.code,
      status: clauses.status,
      similarity: sql<number>`1 - (${clauseChunks.embedding} <=> ${vec})`,
      keywords: clauses.keywords,
    })
    .from(clauseChunks)
    .innerJoin(clauses, eq(clauses.id, clauseChunks.clauseId))
    .leftJoin(workspaceClauses, eq(clauses.id, workspaceClauses.clauseId))
    .where(
      and(
        or(
          eq(clauses.isGlobal, true),
          and(
            eq(clauses.organizationId, organizationId),
            or(
              eq(clauses.workspaceId, workspaceId),
              eq(workspaceClauses.workspaceId, workspaceId),
              and(
                sql`${clauses.workspaceId} IS NULL`,
                sql`${workspaceClauses.workspaceId} IS NULL`,
              ),
            ),
          ),
        ),
        sql`${clauseChunks.embedding} <=> ${vec} < 0.6`,
      ),
    )
    .orderBy(sql`${clauseChunks.embedding} <=> ${vec}`)
    .limit(limit);

  return matches;
}

/** Max cosine distance for a vector hit (same as single-match path). */
const SEMANTIC_MATCH_MAX_DISTANCE = 0.6;

export async function findClosestLibraryMatchesBatch(
  clauseTexts: string[],
  organizationId: string,
  workspaceId: string,
  limit = 3,
  documentHeadings?: string[],
) {
  if (clauseTexts.length === 0) return [];

  const embeddingInputs = clauseTexts.map((t) => prepareEmbeddingText(t));
  const normalizedQueryTexts = clauseTexts.map((t) => normalizeText(t));
  const emptyRow = () => Array(clauseTexts.length).fill([]);

  if (isAstraVectorEnabled()) {
    const matchesBatch: Awaited<
      ReturnType<typeof findClosestLibraryMatches>
    >[] = [];

    for (let i = 0; i < clauseTexts.length; i++) {
      const normText = normalizedQueryTexts[i];
      const docHeading = documentHeadings?.[i] || "";

      if (!normText || normText.length < 8) {
        matchesBatch.push([]);
        continue;
      }

      try {
        const exactMatches = await db
          .select({
            id: clauses.id,
            clauseName: clauses.clauseName,
            clauseText: clauses.clauseText,
            library: clauses.library,
            code: clauses.code,
            status: clauses.status,
            category: clauses.category,
            similarity: sql<number>`1.0`,
            keywords: clauses.keywords,
          })
          .from(clauses)
          .leftJoin(workspaceClauses, eq(clauses.id, workspaceClauses.clauseId))
          .where(
            and(
              or(
                eq(clauses.isGlobal, true),
                and(
                  eq(clauses.organizationId, organizationId),
                  or(
                    eq(clauses.workspaceId, workspaceId),
                    eq(workspaceClauses.workspaceId, workspaceId),
                    and(
                      sql`${clauses.workspaceId} IS NULL`,
                      sql`${workspaceClauses.workspaceId} IS NULL`,
                    ),
                  ),
                ),
              ),
              sql`trim(regexp_replace(regexp_replace(lower(${clauses.clauseText}), '[^a-z0-9\\s]', '', 'g'), '\\s+', ' ', 'g')) = ${normText}`,
            ),
          )
          .limit(limit);

        if (exactMatches.length > 0) {
          matchesBatch.push(exactMatches);
          continue;
        }

        const hits = await searchAstraClauseChunks({
          queryText: embeddingInputs[i],
          organizationId,
          workspaceId,
          limit: Math.max(limit, 5),
        });

        const clauseIds = [
          ...new Set(hits.map((h) => String(h.metadata.clauseId ?? h.id))),
        ];
        if (clauseIds.length === 0) {
          matchesBatch.push([]);
          continue;
        }

        const hydrated = await db
          .select({
            id: clauses.id,
            clauseName: clauses.clauseName,
            clauseText: clauses.clauseText,
            library: clauses.library,
            code: clauses.code,
            status: clauses.status,
            category: clauses.category,
            keywords: clauses.keywords,
          })
          .from(clauses)
          .where(inArray(clauses.id, clauseIds));

        const simByClause = new Map(
          hits.map((h) => [String(h.metadata.clauseId ?? h.id), h.similarity]),
        );

        const merged = hydrated
          .map((row) => {
            const base = simByClause.get(row.id) ?? 0;
            const boost = headingMatchBoost(docHeading, row.clauseName);
            return {
              ...row,
              similarity: Math.min(1, base + boost),
            };
          })
          .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
          .slice(0, limit);

        matchesBatch.push(merged);
      } catch (err) {
        console.warn(`[Checklist] Astra match failed for index ${i}:`, err);
        matchesBatch.push([]);
      }
    }

    return matchesBatch;
  }

  let embeddings: number[][] = [];
  try {
    embeddings = await createEmbeddings(embeddingInputs);
  } catch (err) {
    console.error("[Checklist] Embedding batch failed:", err);
    return emptyRow();
  }

  if (!embeddings || embeddings.length === 0) return emptyRow();

  const scopeFilter = or(
    eq(clauses.isGlobal, true),
    and(
      eq(clauses.organizationId, organizationId),
      or(
        eq(clauses.workspaceId, workspaceId),
        eq(workspaceClauses.workspaceId, workspaceId),
        and(
          sql`${clauses.workspaceId} IS NULL`,
          sql`${workspaceClauses.workspaceId} IS NULL`,
        ),
      ),
    ),
  );

  const matchesBatch: Awaited<ReturnType<typeof findClosestLibraryMatches>>[] =
    [];

  for (let i = 0; i < clauseTexts.length; i++) {
    const normText = normalizedQueryTexts[i];
    const embedding = embeddings[i];

    if (!normText || normText.length < 8) {
      matchesBatch.push([]);
      continue;
    }

    try {
      const exactMatches = await db
        .select({
          id: clauses.id,
          clauseName: clauses.clauseName,
          clauseText: clauses.clauseText,
          library: clauses.library,
          code: clauses.code,
          status: clauses.status,
          similarity: sql<number>`1.0`,
          keywords: clauses.keywords,
        })
        .from(clauses)
        .leftJoin(workspaceClauses, eq(clauses.id, workspaceClauses.clauseId))
        .where(
          and(
            scopeFilter,
            sql`trim(regexp_replace(regexp_replace(lower(${clauses.clauseText}), '[^a-z0-9\\s]', '', 'g'), '\\s+', ' ', 'g')) = ${normText}`,
          ),
        )
        .limit(limit);

      if (exactMatches.length > 0) {
        matchesBatch.push(exactMatches);
        continue;
      }

      if (!embedding?.length) {
        matchesBatch.push([]);
        continue;
      }

      const vec = sql`${"[" + embedding.join(",") + "]"}::vector`;
      const rawMatches = await db
        .select({
          id: clauses.id,
          clauseName: clauses.clauseName,
          clauseText: clauses.clauseText,
          library: clauses.library,
          code: clauses.code,
          status: clauses.status,
          similarity: sql<number>`1 - (${clauseChunks.embedding} <=> ${vec})`,
          keywords: clauses.keywords,
        })
        .from(clauseChunks)
        .innerJoin(clauses, eq(clauses.id, clauseChunks.clauseId))
        .leftJoin(workspaceClauses, eq(clauses.id, workspaceClauses.clauseId))
        .where(
          and(
            scopeFilter,
            sql`${clauseChunks.embedding} <=> ${vec} < ${SEMANTIC_MATCH_MAX_DISTANCE}`,
          ),
        )
        .orderBy(sql`${clauseChunks.embedding} <=> ${vec}`)
        .limit(limit);

      const docHeading = documentHeadings?.[i] || "";
      const ranked = rawMatches
        .map((m) => {
          const base = Number(m.similarity) || 0;
          const boost = headingMatchBoost(docHeading, m.clauseName || "");
          return { ...m, similarity: Math.min(1, base + boost) };
        })
        .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));

      matchesBatch.push(ranked);
    } catch (err) {
      console.warn(
        `[Checklist] Semantic match failed for query index ${i}:`,
        err,
      );
      matchesBatch.push([]);
    }
  }

  return matchesBatch;
}

export async function findWarExclusionMatches(
  clauseText: string,
  organizationId: string,
  limit = 2,
) {
  try {
    if (isAstraVectorEnabled()) {
      const hits = await searchAstraWarExclusions({
        queryText: clauseText,
        organizationId,
        limit: Math.max(limit, 5),
        minSimilarity: 0.4,
      });
      if (hits.length === 0) return [];

      const ids = hits.map((h) => h.id);
      const rows = await db
        .select({
          id: warExclusions.id,
          title: warExclusions.title,
          clauseText: warExclusions.clauseText,
          category: warExclusions.category,
          bias: warExclusions.bias,
          conditions: warExclusions.conditions,
          keywords: warExclusions.keywords,
        })
        .from(warExclusions)
        .where(inArray(warExclusions.id, ids));

      const simById = new Map(hits.map((h) => [h.id, h.similarity]));

      return rows
        .map((row) => ({
          ...row,
          similarity: simById.get(row.id) ?? 0,
        }))
        .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
        .slice(0, limit);
    }

    const [embedding] = await createEmbeddings([clauseText]);
    if (!embedding) return [];

    const similarityThreshold = 0.4;
    const matches = await db
      .select({
        id: warExclusions.id,
        title: warExclusions.title,
        clauseText: warExclusions.clauseText,
        category: warExclusions.category,
        bias: warExclusions.bias,
        conditions: warExclusions.conditions,
        keywords: warExclusions.keywords,
        similarity: sql<number>`1 - (${warExclusions.embedding} <=> ${JSON.stringify(embedding)}::vector)`,
      })
      .from(warExclusions)
      .where(
        and(
          or(
            eq(warExclusions.organizationId, organizationId),
            isNull(warExclusions.organizationId),
          ),
          sql`1 - (${warExclusions.embedding} <=> ${JSON.stringify(embedding)}::vector) > ${similarityThreshold}`,
        ),
      )
      .orderBy((t) => desc(t.similarity))
      .limit(limit);

    return matches;
  } catch (error) {
    console.error("[findWarExclusionMatches] Error:", error);
    return [];
  }
}
