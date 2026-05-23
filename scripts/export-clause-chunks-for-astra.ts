/**
 * Export clause library data as Astra-ready JSON (content + $vectorize per chunk).
 *
 * Usage:
 *   npx tsx scripts/export-clause-chunks-for-astra.ts
 *   npx tsx scripts/export-clause-chunks-for-astra.ts --out data/my-export.json
 *
 * Output: JSON array of documents to load into the `clause_chunks` Astra collection.
 * Astra will embed each row when you insert with $vectorize (NVIDIA 1024-dim).
 */
import "dotenv/config";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { db } from "../src/db/drizzle";
import { clauses } from "../src/db/schema";
import { splitTextForAstraVectorize } from "../src/lib/astra/chunking";
import { buildAstraClauseChunkDocument } from "../src/lib/astra/documents";
import { eq } from "drizzle-orm";

const DEFAULT_OUT = "data/astra-clause-chunks-export.json";

async function main() {
  const outArg = process.argv.find((a) => a.startsWith("--out="));
  const outPath = resolve(process.cwd(), outArg?.split("=")[1] ?? DEFAULT_OUT);

  console.log("[Export] Loading clauses from Postgres...");

  const allClauses = await db.select().from(clauses);

  const documents: ReturnType<typeof buildAstraClauseChunkDocument>[] = [];

  for (const clause of allClauses) {
    if (!clause.clauseText?.trim()) continue;

    const parts = splitTextForAstraVectorize(clause.clauseText);
    for (const part of parts) {
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

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(documents, null, 2), "utf-8");

  console.log(`[Export] Clauses in DB: ${allClauses.length}`);
  console.log(`[Export] Documents written: ${documents.length}`);
  console.log(`[Export] Chunks sized for NVIDIA 512-token vectorize limit.`);
  console.log(`[Export] File: ${outPath}`);
  console.log(`
Next steps:
  1) Import via script (recommended): npx tsx scripts/import-clause-chunks-to-astra.ts
  2) Or load ${outPath} with Astra Data API insertMany / your loader (each doc needs content + $vectorize)
`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[Export] Failed:", err);
    process.exit(1);
  });
