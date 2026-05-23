/**
 * Load clause chunks into Astra (NVIDIA vectorize on insert).
 *
 * Usage:
 *   npx tsx scripts/import-clause-chunks-to-astra.ts
 *   npx tsx scripts/import-clause-chunks-to-astra.ts --fresh
 *   npx tsx scripts/import-clause-chunks-to-astra.ts --from-json data/astra-clause-chunks-export.json
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import { db } from "../src/db/drizzle";
import { clauses } from "../src/db/schema";
import {
  isAstraVectorEnabled,
  getAstraCredentials,
  ASTRA_COLLECTIONS,
} from "../src/lib/astra/config";
import { getAstraCollection } from "../src/lib/astra/client";
import { buildAstraClauseChunkDocument } from "../src/lib/astra/documents";
import {
  estimateVectorizeTokens,
  getAstraVectorizeMaxChars,
  NVIDIA_VECTORIZE_TOKEN_LIMIT,
  splitTextForAstraVectorize,
} from "../src/lib/astra/chunking";

const BATCH_SIZE = 25;
const DELAY_MS = 400;

function buildDocumentsFromClauses(
  allClauses: (typeof clauses.$inferSelect)[],
) {
  const documents: ReturnType<typeof buildAstraClauseChunkDocument>[] = [];
  let maxTokens = 0;

  for (const clause of allClauses) {
    if (!clause.clauseText?.trim()) continue;

    const parts = splitTextForAstraVectorize(clause.clauseText);
    for (const part of parts) {
      const tokens = estimateVectorizeTokens(part);
      if (tokens > maxTokens) maxTokens = tokens;

      documents.push(
        buildAstraClauseChunkDocument({
          clauseId: clause.id,
          organizationId: clause.organizationId,
          workspaceId: clause.workspaceId,
          isGlobal: clause.isGlobal,
          clauseName: clause.clauseName,
          library: clause.library,
          category: clause.category,
          content: part,
        }),
      );
    }
  }

  console.log(
    `[Import] Chunk settings: max ~${getAstraVectorizeMaxChars()} chars, NVIDIA limit ${NVIDIA_VECTORIZE_TOKEN_LIMIT} tokens, peak chunk ~${maxTokens} tokens`,
  );
  return documents;
}

async function insertBatchWithFallback(
  col: Awaited<ReturnType<typeof getAstraCollection>>,
  batch: ReturnType<typeof buildAstraClauseChunkDocument>[],
) {
  try {
    await col.insertMany(batch, { timeout: 120_000 });
    return batch.length;
  } catch (batchErr) {
    console.warn(
      `[Import] Batch insert failed (${batch.length} docs), retrying one-by-one...`,
      batchErr instanceof Error ? batchErr.message : batchErr,
    );
    let ok = 0;
    for (const doc of batch) {
      try {
        await col.insertOne(doc, { timeout: 60_000 });
        ok++;
      } catch (oneErr) {
        console.error(
          `[Import] Skipped clause ${doc.clauseId} chunk (${estimateVectorizeTokens(doc.content)} tokens):`,
          oneErr instanceof Error ? oneErr.message : oneErr,
        );
      }
      await setTimeout(100);
    }
    return ok;
  }
}

async function main() {
  if (!isAstraVectorEnabled() || !getAstraCredentials()) {
    console.error(
      "Astra is not configured. Set USE_ASTRA_VECTOR=true, ASTRA_DB_APPLICATION_TOKEN, ASTRA_DB_API_ENDPOINT in .env",
    );
    process.exit(1);
  }

  const dryRun = process.argv.includes("--dry-run");
  const fresh = process.argv.includes("--fresh");
  const jsonFlagIdx = process.argv.indexOf("--from-json");
  const jsonPath =
    jsonFlagIdx >= 0 && process.argv[jsonFlagIdx + 1]
      ? resolve(process.cwd(), process.argv[jsonFlagIdx + 1])
      : process.argv
          .find((a) => a.startsWith("--from-json="))
          ?.split("=")
          .slice(1)
          .join("=");

  let documents: ReturnType<typeof buildAstraClauseChunkDocument>[];

  if (jsonPath) {
    console.log(
      `[Import] Reading ${jsonPath} — re-chunking for NVIDIA 512 token limit...`,
    );
    const raw = JSON.parse(readFileSync(jsonPath, "utf-8")) as Array<{
      clauseId: string;
      organizationId: string | null;
      workspaceId: string | null;
      isGlobal: boolean;
      clauseName: string;
      library: string | null;
      category: string | null;
      content: string;
    }>;
    const byClause = new Map<string, typeof raw>();
    for (const row of raw) {
      const list = byClause.get(row.clauseId) ?? [];
      list.push(row);
      byClause.set(row.clauseId, list);
    }
    documents = [];
    for (const [, rows] of byClause) {
      const first = rows[0];
      const combined = rows.map((r) => r.content).join("\n\n");
      const parts = splitTextForAstraVectorize(combined);
      for (const part of parts) {
        documents.push(
          buildAstraClauseChunkDocument({
            clauseId: first.clauseId,
            organizationId: first.organizationId,
            workspaceId: first.workspaceId,
            isGlobal: first.isGlobal,
            clauseName: first.clauseName,
            library: first.library,
            category: first.category,
            content: part,
          }),
        );
      }
    }
  } else {
    console.log(
      "[Import] Building documents from clauses (Astra-sized chunks, not legacy 1000-char PG chunks)...",
    );
    const allClauses = await db.select().from(clauses);
    documents = buildDocumentsFromClauses(allClauses);
  }

  console.log(`[Import] Total documents: ${documents.length}`);
  console.log(`[Import] Target collection: ${ASTRA_COLLECTIONS.clauseChunks}`);

  if (dryRun) {
    const sample = documents.reduce((a, b) =>
      estimateVectorizeTokens(a.content) > estimateVectorizeTokens(b.content)
        ? a
        : b,
    );
    console.log("[Import] Dry run — largest chunk sample:");
    console.log(
      JSON.stringify(
        {
          tokens: estimateVectorizeTokens(sample.content),
          chars: sample.content.length,
          clauseName: sample.clauseName,
        },
        null,
        2,
      ),
    );
    return;
  }

  const col = await getAstraCollection(ASTRA_COLLECTIONS.clauseChunks);

  if (fresh) {
    console.warn(
      "[Import] --fresh: delete all documents in clause_chunks (may take a minute)...",
    );
    try {
      await col.deleteMany({ docType: "clause_chunk" }, { timeout: 300_000 });
    } catch {
      console.warn(
        "[Import] Bulk delete failed — clear collection in Astra UI if re-import duplicates.",
      );
    }
  }

  let inserted = 0;
  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const batch = documents.slice(i, i + BATCH_SIZE);
    inserted += await insertBatchWithFallback(col, batch);
    console.log(`[Import] Inserted ${inserted} / ${documents.length}...`);
    if (i + BATCH_SIZE < documents.length) {
      await setTimeout(DELAY_MS);
    }
  }

  console.log("[Import] Done.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[Import] Failed:", err);
    process.exit(1);
  });
