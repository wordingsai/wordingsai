/**
 * Migrate contract_chunks from Postgres → Astra contract_chunks collection.
 *
 * Usage:
 *   npx tsx scripts/migrate-contract-chunks-to-astra.ts
 *   npx tsx scripts/migrate-contract-chunks-to-astra.ts --dry-run
 */
import "dotenv/config";
import { setTimeout } from "node:timers/promises";
import { db } from "../src/db/drizzle";
import { contractChunks, contractVersions } from "../src/db/schema";
import {
  isAstraVectorEnabled,
  getAstraCredentials,
  ASTRA_COLLECTIONS,
} from "../src/lib/astra/config";
import { getAstraCollection } from "../src/lib/astra/client";
import { buildAstraContractChunkDocument } from "../src/lib/astra/documents";
import { eq } from "drizzle-orm";

const BATCH_SIZE = 50;
const DELAY_MS = 300;

async function main() {
  if (!isAstraVectorEnabled() || !getAstraCredentials()) {
    console.error("Configure Astra env vars first. See docs/astra-db.md");
    process.exit(1);
  }

  const dryRun = process.argv.includes("--dry-run");

  const rows = await db
    .select({
      chunkId: contractChunks.id,
      content: contractChunks.content,
      sourceFileName: contractChunks.sourceFileName,
      contractVersionId: contractChunks.contractVersionId,
      contractId: contractVersions.contractId,
    })
    .from(contractChunks)
    .innerJoin(
      contractVersions,
      eq(contractChunks.contractVersionId, contractVersions.id),
    );

  const documents = rows
    .filter((r) => r.content?.trim())
    .map((r) =>
      buildAstraContractChunkDocument({
        _id: r.chunkId,
        contractId: r.contractId,
        contractVersionId: r.contractVersionId,
        content: r.content,
        sourceFileName: r.sourceFileName,
      }),
    );

  console.log(`[ContractMigrate] Documents: ${documents.length}`);
  console.log(
    `[ContractMigrate] Collection: ${ASTRA_COLLECTIONS.contractChunks}`,
  );

  if (dryRun) {
    console.log(JSON.stringify(documents[0], null, 2));
    return;
  }

  const col = await getAstraCollection(ASTRA_COLLECTIONS.contractChunks);
  let inserted = 0;

  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const batch = documents.slice(i, i + BATCH_SIZE);
    await col.insertMany(batch, { timeout: 120_000 });
    inserted += batch.length;
    console.log(`[ContractMigrate] ${inserted} / ${documents.length}`);
    if (i + BATCH_SIZE < documents.length) await setTimeout(DELAY_MS);
  }

  console.log("[ContractMigrate] Complete.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
