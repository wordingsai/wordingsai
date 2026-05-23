/**
 * Remove vector data from Neon after Astra migration.
 *
 * Usage:
 *   npx tsx scripts/cleanup-neon-vectors.ts --dry-run
 *   npx tsx scripts/cleanup-neon-vectors.ts --clauses          # null embeddings on clause_chunks
 *   npx tsx scripts/cleanup-neon-vectors.ts --clauses --delete-rows  # delete all clause_chunks rows
 *   npx tsx scripts/cleanup-neon-vectors.ts --contracts
 *   npx tsx scripts/cleanup-neon-vectors.ts --war
 */
import "dotenv/config";
import { db } from "../src/db/drizzle";
import { clauseChunks, contractChunks, warExclusions } from "../src/db/schema";
import { sql } from "drizzle-orm";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const deleteRows = process.argv.includes("--delete-rows");
  const doClauses =
    process.argv.includes("--clauses") || process.argv.length === 2;
  const doContracts = process.argv.includes("--contracts");
  const doWar = process.argv.includes("--war");

  if (dryRun) {
    console.log("[Cleanup] DRY RUN — no changes will be made.\n");
  }

  if (doClauses) {
    const [count] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(clauseChunks);
    console.log(`[Cleanup] clause_chunks rows: ${count?.n ?? 0}`);

    if (!dryRun) {
      if (deleteRows) {
        await db.delete(clauseChunks);
        console.log("[Cleanup] Deleted all clause_chunks rows.");
      } else {
        await db.execute(
          sql`UPDATE clause_chunks SET embedding = NULL WHERE embedding IS NOT NULL`,
        );
        console.log(
          "[Cleanup] Set clause_chunks.embedding = NULL (text rows kept for legacy UI).",
        );
      }
    }
  }

  if (doContracts) {
    const [count] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(contractChunks);
    console.log(`[Cleanup] contract_chunks rows: ${count?.n ?? 0}`);

    if (!dryRun) {
      if (deleteRows) {
        await db.delete(contractChunks);
        console.log("[Cleanup] Deleted all contract_chunks rows.");
      } else {
        await db.execute(
          sql`UPDATE contract_chunks SET embedding = NULL WHERE embedding IS NOT NULL`,
        );
        console.log("[Cleanup] Set contract_chunks.embedding = NULL.");
      }
    }
  }

  if (doWar) {
    const [count] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(warExclusions);
    console.log(`[Cleanup] war_exclusions rows: ${count?.n ?? 0}`);

    if (!dryRun) {
      if (deleteRows) {
        console.warn(
          "[Cleanup] --delete-rows for war_exclusions not supported (keeps clause text).",
        );
      }
      await db.execute(
        sql`UPDATE war_exclusions SET embedding = NULL WHERE embedding IS NOT NULL`,
      );
      console.log("[Cleanup] Set war_exclusions.embedding = NULL.");
    }
  }

  console.log(`
Done. With USE_ASTRA_VECTOR=true, new clauses sync only to Astra (see ASTRA_SKIP_NEON_CHUNK_MIRROR).
Re-run import if needed: pnpm astra:import-clauses
`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
