/**
 * Clause Matching Service
 * Handles semantic matching of document clauses to library clauses
 * with confidence scoring and caching
 */

import { db } from "@/db/drizzle";
import { clauses, workspaces, workspaceClauses } from "@/db/schema";
import { createEmbeddings } from "@/lib/embedding";
import { isAstraVectorEnabled } from "@/lib/astra/config";
import { findClosestLibraryMatches } from "@/services/rule-engine";
import { getGlobalCache, setGlobalCache } from "@/lib/cache";
import { eq, and, or, sql } from "drizzle-orm";
import type {
  ClauseMatchingRequest,
  ClauseMatchingResult,
} from "@/types/evidence";

const CACHE_TTL = 24 * 60 * 60; // 24 hours

/**
 * Computes cosine similarity between two embedding vectors
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * Get cached embedding for text, or compute and cache it
 */
async function getOrCreateEmbedding(text: string): Promise<number[]> {
  const cacheKey = `embedding:${Buffer.from(text).toString("base64")}`;

  // Try cache first
  const cached = await getGlobalCache(cacheKey);
  if (cached) {
    try {
      return JSON.parse(String(cached));
    } catch (e) {
      // Cache corrupted, regenerate
    }
  }

  // Generate embedding
  const embeddings = await createEmbeddings(text);
  const embedding = embeddings[0];

  if (!embedding) {
    throw new Error("Failed to generate embedding");
  }

  // Cache it
  await setGlobalCache(cacheKey, JSON.stringify(embedding), CACHE_TTL);

  return embedding;
}

/**
 * Match a document clause to library clauses
 * Returns top N matches with confidence scores
 */
export async function matchClauseToLibrary(
  request: ClauseMatchingRequest,
  organizationId?: string,
  workspaceId?: string,
): Promise<ClauseMatchingResult> {
  const {
    documentClauseText,
    section,
    clauseTypeHint,
    topN = 5,
    minConfidence = 0.5,
  } = request;

  if (!documentClauseText?.trim()) {
    return {
      documentClauseText,
      matches: [],
      hasHighConfidenceMatch: false,
    };
  }

  try {
    if (isAstraVectorEnabled() && organizationId && workspaceId) {
      const semantic = await findClosestLibraryMatches(
        documentClauseText,
        organizationId,
        workspaceId,
        topN,
      );

      const matches = semantic
        .filter((m) => (m.similarity ?? 0) >= minConfidence)
        .map((m) => ({
          id: m.id,
          name: m.clauseName,
          type: m.library || "General Provision",
          confidence: m.similarity ?? 0,
          code: (m as { code?: string | null }).code ?? null,
          approvalStatus: (m as { status?: string | null }).status ?? null,
          heading: null as string | null,
          text: m.clauseText,
          reason: `Semantic match (${Math.round((m.similarity ?? 0) * 100)}%)`,
          isExactMatch: (m.similarity ?? 0) >= 0.99,
        }));

      const recommended = matches[0];
      return {
        documentClauseText,
        matches,
        hasHighConfidenceMatch: matches.some((m) => m.confidence >= 0.85),
        recommendedMatch: recommended
          ? {
              id: recommended.id,
              name: recommended.name,
              confidence: recommended.confidence,
            }
          : undefined,
      };
    }

    const workspaceRes = workspaceId
      ? await db
          .select({ type: workspaces.type, isGlobal: workspaces.isGlobal })
          .from(workspaces)
          .where(eq(workspaces.id, workspaceId))
          .limit(1)
      : [];
    const isGlobalWorkspace = workspaceRes[0]?.isGlobal ?? false;
    const workspaceType = workspaceRes[0]?.type ?? null;

    // Fetch clauses with strict workspace isolation (like rules)
    let libraryClausesList: any[] = [];

    if (isGlobalWorkspace && workspaceType) {
      // For global workspaces, show all clauses linked to ANY global workspace of the same TYPE
      const results = await db
        .select({ clause: clauses })
        .from(clauses)
        .innerJoin(workspaceClauses, eq(clauses.id, workspaceClauses.clauseId))
        .innerJoin(workspaces, eq(workspaceClauses.workspaceId, workspaces.id))
        .where(
          and(
            eq(workspaces.type, workspaceType),
            eq(workspaces.isGlobal, true),
          ),
        )
        .limit(2000);
      libraryClausesList = results.map((r) => r.clause);
    } else {
      // For non-global workspaces, show org's linked clauses OR system-wide global clauses
      const results = await db
        .select({ clause: clauses })
        .from(clauses)
        .leftJoin(workspaceClauses, eq(clauses.id, workspaceClauses.clauseId))
        .where(
          or(
            eq(clauses.isGlobal, true),
            and(
              organizationId
                ? eq(clauses.organizationId, organizationId)
                : undefined,
              workspaceId
                ? or(
                    eq(clauses.workspaceId, workspaceId),
                    eq(workspaceClauses.workspaceId, workspaceId),
                    and(
                      sql`${clauses.workspaceId} IS NULL`,
                      sql`${workspaceClauses.workspaceId} IS NULL`,
                    ),
                  )
                : undefined,
            ),
          ),
        )
        .limit(2000);

      // Deduplicate by ID
      const seen = new Set();
      libraryClausesList = results
        .map((r) => r.clause)
        .filter((c) => {
          if (seen.has(c.id)) return false;
          seen.add(c.id);
          return true;
        });
    }

    if (libraryClausesList.length === 0) {
      return {
        documentClauseText,
        matches: [],
        hasHighConfidenceMatch: false,
      };
    }

    // 1. Check for exact match first
    const exactMatch = libraryClausesList.find(
      (lc) => lc.clauseText.trim() === documentClauseText.trim(),
    );

    if (exactMatch) {
      return {
        documentClauseText,
        matches: [
          {
            id: exactMatch.id,
            name: exactMatch.clauseName,
            type: exactMatch.category || "General Provision",
            confidence: 1.0,
            code: exactMatch.code ?? null,
            approvalStatus: exactMatch.status ?? null,
            heading: exactMatch.heading,
            text: exactMatch.clauseText,
            reason: "Exact word-for-word match",
            isExactMatch: true,
          } as any,
        ],
        hasHighConfidenceMatch: true,
        recommendedMatch: {
          id: exactMatch.id,
          name: exactMatch.clauseName,
          confidence: 1.0,
        },
      };
    }

    // 2. Get embedding for document clause if no exact match
    const documentEmbedding = await getOrCreateEmbedding(documentClauseText);

    // Compute similarities in parallel
    const matchesWithScores = await Promise.all(
      libraryClausesList.map(async (libClause) => {
        try {
          const libEmbedding = await getOrCreateEmbedding(libClause.clauseText);
          const similarity = cosineSimilarity(documentEmbedding, libEmbedding);

          // Boost score if clause type hint matches
          let confidence = similarity;
          if (clauseTypeHint) {
            const clauseCategoryMatch =
              libClause.category?.toLowerCase() ===
              clauseTypeHint.toLowerCase();
            if (clauseCategoryMatch) {
              confidence = Math.min(1, confidence * 1.1); // 10% boost
            }
          }

          // Boost score if section matches library heading
          if (section && libClause.heading) {
            const sectionMatch =
              section.toLowerCase().includes(libClause.heading.toLowerCase()) ||
              libClause.heading.toLowerCase().includes(section.toLowerCase());
            if (sectionMatch) {
              confidence = Math.min(1, confidence * 1.15); // 15% boost
            }
          }

          return {
            id: libClause.id,
            name: libClause.clauseName,
            type: libClause.category,
            confidence,
            code: libClause.code ?? null,
            approvalStatus: libClause.status ?? null,
            heading: libClause.heading,
            text: libClause.clauseText,
          };
        } catch (e) {
          console.error(
            `[ClauseMatching] Error computing similarity for clause ${libClause.id}:`,
            e,
          );
          return {
            id: libClause.id,
            name: libClause.clauseName,
            type: libClause.category,
            confidence: 0,
            code: libClause.code ?? null,
            approvalStatus: libClause.status ?? null,
            heading: libClause.heading,
            text: libClause.clauseText,
          };
        }
      }),
    );

    // Filter and sort by confidence
    const matches = matchesWithScores
      .filter((m) => m.confidence >= minConfidence)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, topN)
      .map((m) => ({
        id: m.id,
        name: m.name,
        type: m.type,
        confidence: parseFloat(m.confidence.toFixed(3)),
        code: m.code ?? null,
        approvalStatus: m.approvalStatus ?? null,
        reason: `Semantic similarity match${m.heading ? ` in section "${m.heading}"` : ""}`,
      }));

    const recommendedMatch =
      matches.length > 0 && matches[0].confidence >= 0.75
        ? {
            id: matches[0].id,
            name: matches[0].name,
            confidence: matches[0].confidence,
          }
        : null;

    return {
      documentClauseText,
      matches,
      hasHighConfidenceMatch: (matches[0]?.confidence ?? 0) >= 0.75,
      recommendedMatch,
    };
  } catch (error) {
    console.error("[ClauseMatching] Error during matching:", error);
    return {
      documentClauseText,
      matches: [],
      hasHighConfidenceMatch: false,
    };
  }
}

/**
 * Batch match multiple document clauses
 */
export async function matchMultipleClauses(
  clauses_: ClauseMatchingRequest[],
  organizationId?: string,
  workspaceId?: string,
): Promise<ClauseMatchingResult[]> {
  return Promise.all(
    clauses_.map((req) =>
      matchClauseToLibrary(req, organizationId, workspaceId).catch((e) => {
        console.error("[ClauseMatching] Batch error:", e);
        return {
          documentClauseText: req.documentClauseText,
          matches: [],
          hasHighConfidenceMatch: false,
        };
      }),
    ),
  );
}

/**
 * Get all clauses for a library (used for building embeddings cache)
 */
export async function getAllLibraryClauses(
  organizationId?: string,
  workspaceId?: string,
): Promise<Array<{ id: string; text: string }>> {
  const libraryClausesList = await db
    .select({
      id: clauses.id,
      text: clauses.clauseText,
      organizationId: clauses.organizationId,
      isGlobal: clauses.isGlobal,
      workspaceId: clauses.workspaceId,
      linkedWorkspaceId: workspaceClauses.workspaceId,
    })
    .from(clauses)
    .leftJoin(workspaceClauses, eq(clauses.id, workspaceClauses.clauseId))
    .limit(5000);

  if (!organizationId) return libraryClausesList as any;

  // Deduplicate after join
  const seen = new Set();
  const filtered = (libraryClausesList as any).filter((lc: any) => {
    if (seen.has(lc.id)) return false;

    const isGlobal = Boolean(lc.isGlobal);
    const isOrgMatch = lc.organizationId === organizationId;

    if (workspaceId && isOrgMatch) {
      const match =
        isGlobal ||
        lc.workspaceId === workspaceId ||
        lc.linkedWorkspaceId === workspaceId;
      if (match) {
        seen.add(lc.id);
        return true;
      }
      return false;
    }

    if (isGlobal || isOrgMatch) {
      seen.add(lc.id);
      return true;
    }
    return false;
  });

  return filtered;
}

/**
 * Warm up embedding cache for library clauses
 * Should be called periodically to ensure fast matching
 */
export async function warmupEmbeddingCache(
  organizationId?: string,
): Promise<void> {
  try {
    const libraryClauses = await getAllLibraryClauses(organizationId);

    console.log(
      `[ClauseMatching] Warming up embeddings for ${libraryClauses.length} clauses...`,
    );

    // Batch warm-up
    const BATCH_SIZE = 10;
    for (let i = 0; i < libraryClauses.length; i += BATCH_SIZE) {
      const batch = libraryClauses.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map((c) =>
          getOrCreateEmbedding(c.text).catch((e) => {
            console.error(
              `[ClauseMatching] Error warming up embedding for clause ${c.id}:`,
              e,
            );
          }),
        ),
      );
    }

    console.log("[ClauseMatching] Embedding cache warmed up");
  } catch (error) {
    console.error("[ClauseMatching] Error warming up cache:", error);
  }
}
