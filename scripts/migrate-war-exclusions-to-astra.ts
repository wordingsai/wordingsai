/**
 * Migrate war_exclusions from Postgres → Astra war_exclusions collection.
 *
 * Usage:
 *   npx tsx scripts/migrate-war-exclusions-to-astra.ts
 *   npx tsx scripts/migrate-war-exclusions-to-astra.ts --fresh
 *   npx tsx scripts/migrate-war-exclusions-to-astra.ts --dry-run
 */
import "dotenv/config";
import { setTimeout } from "node:timers/promises";
import { db } from "../src/db/drizzle";
import { warExclusions } from "../src/db/schema";
import {
  isAstraVectorEnabled,
  getAstraCredentials,
  ASTRA_COLLECTIONS,
} from "../src/lib/astra/config";
import { getAstraCollection } from "../src/lib/astra/client";
import {
  estimateVectorizeTokens,
  NVIDIA_VECTORIZE_TOKEN_LIMIT,
} from "../src/lib/astra/chunking";
import type { WarExclusionAstraInput } from "../src/lib/astra/vector-store";

const BATCH_SIZE = 25;
const DELAY_MS = 400;

function toAstraDoc(row: typeof warExclusions.$inferSelect) {
  const title = row.title?.trim() || "War Exclusion";
  const clauseText = row.clauseText?.trim() || "";
  const parts = [title, clauseText].filter(Boolean);
  let text = parts.join("\n\n").trim().slice(0, 720);
  if (estimateVectorizeTokens(text) > NVIDIA_VECTORIZE_TOKEN_LIMIT - 16) {
    text = text.slice(0, 500);
  }

  return {
    _id: row.id,
    docType: "war_exclusion" as const,
    organizationId: row.organizationId,
    title,
    clauseText,
    category: row.category,
    bias: row.bias,
    type: row.type,
    treatyFac: row.treatyFac,
    conditions: row.conditions,
    keywords: row.keywords,
    legalComments: row.legalComments,
    content: text,
    $vectorize: text,
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
  };
}

async function main() {
  if (!isAstraVectorEnabled() || !getAstraCredentials()) {
    console.error("Configure USE_ASTRA_VECTOR and Astra credentials first.");
    process.exit(1);
  }

  const dryRun = process.argv.includes("--dry-run");
  const fresh = process.argv.includes("--fresh");

  const rows = await db.select().from(warExclusions);
  console.log(`[WarMigrate] Postgres war_exclusions: ${rows.length}`);

  const documents = rows.filter((r) => r.clauseText?.trim()).map(toAstraDoc);

  if (dryRun) {
    console.log("[WarMigrate] Sample:", JSON.stringify(documents[0], null, 2));
    return;
  }

  const col = await getAstraCollection(ASTRA_COLLECTIONS.warExclusions);

  if (fresh) {
    console.log("[WarMigrate] --fresh: clearing war_exclusion documents...");
    try {
      await col.deleteMany({ docType: "war_exclusion" }, { timeout: 300_000 });
    } catch (e) {
      console.warn("[WarMigrate] Bulk delete warning:", e);
    }
  }

  let inserted = 0;
  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const batch = documents.slice(i, i + BATCH_SIZE);
    try {
      await col.insertMany(batch, { timeout: 120_000 });
      inserted += batch.length;
    } catch {
      for (const doc of batch) {
        try {
          await col.deleteOne({ _id: doc._id });
          await col.insertOne(doc, { timeout: 60_000 });
          inserted++;
        } catch (oneErr) {
          console.error(`[WarMigrate] Skipped ${doc._id}:`, oneErr);
        }
        await setTimeout(100);
      }
    }
    console.log(`[WarMigrate] ${inserted} / ${documents.length}`);
    if (i + BATCH_SIZE < documents.length) await setTimeout(DELAY_MS);
  }

  console.log(
    "[WarMigrate] Done. Run: npx tsx scripts/cleanup-neon-vectors.ts --war",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
