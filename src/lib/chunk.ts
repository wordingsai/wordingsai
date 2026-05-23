import "dotenv/config";
import { db } from "@/db/drizzle";
import { clauseChunks, clauses } from "@/db/schema";
import { createEmbeddings } from "@/lib/embedding";
import {
  isAstraVectorEnabled,
  skipNeonClauseChunkMirror,
} from "@/lib/astra/config";
import { splitTextForAstraVectorize } from "@/lib/astra/chunking";
import {
  deleteAstraClauseChunks,
  insertAstraClauseChunks,
} from "@/lib/astra/vector-store";
import { eq } from "drizzle-orm";

export function splitText(text: string, maxChunkSize: number = 1000): string[] {
  if (!text) return [];
  const chunks: string[] = [];
  let currentChunk = "";
  const paragraphs = text.split(/\n\n+/);

  for (const paragraph of paragraphs) {
    if ((currentChunk + paragraph).length <= maxChunkSize) {
      currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      if (paragraph.length > maxChunkSize) {
        let remaining = paragraph;
        while (remaining.length > maxChunkSize) {
          chunks.push(remaining.substring(0, maxChunkSize));
          remaining = remaining.substring(maxChunkSize);
        }
        currentChunk = remaining;
      } else {
        currentChunk = paragraph;
      }
    }
  }

  if (currentChunk) chunks.push(currentChunk);
  return chunks;
}

export async function embedSingleClause(clauseId: string) {
  const [clause] = await db
    .select()
    .from(clauses)
    .where(eq(clauses.id, clauseId))
    .limit(1);

  if (!clause || !clause.clauseText) return;

  if (!skipNeonClauseChunkMirror()) {
    await db.delete(clauseChunks).where(eq(clauseChunks.clauseId, clauseId));
  }
  if (isAstraVectorEnabled()) {
    await deleteAstraClauseChunks(clauseId);
  }

  const chunks = isAstraVectorEnabled()
    ? splitTextForAstraVectorize(clause.clauseText)
    : splitText(clause.clauseText);
  console.log(
    `[Sync] Processing clause ${clause.clauseName}: ${chunks.length} chunks (Astra: ${isAstraVectorEnabled()})`,
  );

  if (isAstraVectorEnabled()) {
    await insertAstraClauseChunks({
      clauseId: clause.id,
      organizationId: clause.organizationId,
      workspaceId: clause.workspaceId,
      isGlobal: clause.isGlobal,
      clauseName: clause.clauseName,
      library: clause.library,
      category: clause.category,
      chunks: chunks.map((c) => c.trim()),
    });
    return;
  }

  const BATCH_SIZE = 10;
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    try {
      const embeddings = (await createEmbeddings(batch)) as number[][];
      const results = batch.map((chunk, index) => ({
        clauseId: clause.id,
        content: chunk.trim(),
        embedding: embeddings[index],
        library: clause.library,
        category: clause.category,
      }));

      if (results.length > 0) {
        await db.insert(clauseChunks).values(results);
      }
    } catch (err) {
      console.error(
        `[Sync] Batch failed for clause ${clause.clauseName}:`,
        err,
      );
    }
  }
}

export async function embedAllClauseChunks(BATCH_SIZE: number = 10) {
  const allClauses = await db
    .select({
      id: clauses.id,
      clauseText: clauses.clauseText,
      clauseName: clauses.clauseName,
    })
    .from(clauses);

  for (const clause of allClauses) {
    if (!clause.clauseText) continue;
    await embedSingleClause(clause.id);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  embedAllClauseChunks(10).catch((error) => {
    console.error("[chunk] failed", error);
    process.exit(1);
  });
}
