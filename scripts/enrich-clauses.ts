import "dotenv/config";
import { db } from "../src/db/drizzle";
import { clauses, clauseVersions, clauseChunks } from "../src/db/schema";
import { createEmbeddings } from "../src/lib/embedding";
import { sql, eq, count, isNotNull } from "drizzle-orm";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { RateLimiter } from "../src/lib/rate-limiter";
import { withResilience } from "../src/lib/resilience";
import { buildClauseInsightPrompt, CLAUSE_INSIGHT_SYSTEM } from "../src/lib/ai";

const genAI = new GoogleGenerativeAI(
  (process.env.GEMINI_API_KEY ??
    process.env.GEMINI_FAST_API_KEY ??
    process.env.GOOGLE_GENERATIVE_AI_API_KEY)!,
);
const model = genAI.getGenerativeModel({
  // Upgraded from flash-lite to gemini-2.5-flash for stronger reasoning on
  // reinsurance wordings, sharing the runtime system prompt.
  model: "gemini-2.5-flash",
  systemInstruction: CLAUSE_INSIGHT_SYSTEM,
  generationConfig: {
    responseMimeType: "application/json",
  },
});

// User Requirements: RPM 15, TPM 250k
const aiLimiter = new RateLimiter({ rpm: 15, tpm: 250000 }, "GeminiAI");

async function generateLocalClauseAI(clause: {
  clauseText: string;
  clauseName?: string | null;
  code?: string | null;
  category?: string | null;
}) {
  // Anchor the prompt on the clause's name/code/category for accuracy.
  const prompt = buildClauseInsightPrompt(clause);
  // Estimate tokens (roughly 3 chars per token for safety)
  const estimatedTokens = Math.ceil(prompt.length / 3) + 500;

  await aiLimiter.acquire(estimatedTokens);

  const result = await withResilience(
    async () => {
      const res = await model.generateContent(prompt);
      const response = await res.response;
      return response.text();
    },
    { name: "GeminiAI" },
  );

  const parsed = JSON.parse(result);

  return {
    aiSummary: parsed.summary,
    aiFavorability: parsed.favorability,
    aiRecommendedUse: parsed.recommendedUse,
    aiNote: parsed.note,
    aiGeneratedAt: new Date(),
    aiVersion: "v2-reinsurance",
  };
}

async function main() {
  console.log("Starting Clause Enrichment (Direct Gemini + HuggingFace)...");

  if (
    !process.env.GEMINI_API_KEY &&
    !process.env.GEMINI_FAST_API_KEY &&
    !process.env.GOOGLE_GENERATIVE_AI_API_KEY
  ) {
    throw new Error("No Gemini API key is set (GEMINI_API_KEY)");
  }

  // 1. Fetch only clauses that haven't been chunked/enriched yet
  const pendingClauses = await db
    .select()
    .from(clauses)
    .where(
      sql`NOT EXISTS (SELECT 1 FROM ${clauseChunks} WHERE ${clauseChunks.clauseId} = ${clauses.id})`,
    );

  console.log(`Found ${pendingClauses.length} pending clauses to process.`);

  const BATCH_SIZE = 5;
  for (let i = 0; i < pendingClauses.length; i += BATCH_SIZE) {
    const batch = pendingClauses.slice(i, i + BATCH_SIZE);
    console.log(
      `Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(pendingClauses.length / BATCH_SIZE)}...`,
    );

    await Promise.all(
      batch.map(async (clause) => {
        try {
          console.log(`  Processing: ${clause.clauseName}`);

          // 1. Generate AI Details via Direct Gemini
          const aiDetails = await generateLocalClauseAI(clause);

          // 2. Generate Embedding via HuggingFace (with resilience)
          const [embedding] = await withResilience(
            async () => {
              return await createEmbeddings(clause.clauseText);
            },
            { name: "HuggingFaceEmbedding" },
          );

          // 3. Update Database in a Transaction
          await db.transaction(async (tx) => {
            // Update Clause with AI details
            await tx
              .update(clauses)
              .set({
                ...aiDetails,
                updatedAt: new Date(),
              })
              .where(eq(clauses.id, clause.id));

            // Create Version 1 (Audit Trail)
            await tx.insert(clauseVersions).values({
              clauseId: clause.id,
              versionNumber: 1,
              clauseText: clause.clauseText,
              heading: clause.heading || clause.clauseName,
              source: clause.source,
              aiSummary: aiDetails.aiSummary,
              aiFavorability: aiDetails.aiFavorability,
              aiRecommendedUse: aiDetails.aiRecommendedUse,
              aiNote: aiDetails.aiNote,
              keywords: clause.keywords,
              changedByName: "System Migration",
              changeNote: "Initial version with direct Gemini enrichment",
              createdAt: new Date(),
            });

            // Create Chunk (Vector Search)
            await tx.insert(clauseChunks).values({
              clauseId: clause.id,
              content: clause.clauseText,
              library: clause.library,
              category: clause.category,
              embedding: embedding,
            });
          });

          console.log(`    ✅ Processed: ${clause.clauseName}`);
        } catch (err) {
          console.error(`    ❌ Failed to process ${clause.clauseName}:`, err);
        }
      }),
    );
  }

  console.log("\n--- Verification ---");
  const [totalClauses] = await db.select({ value: count() }).from(clauses);
  const [enrichedClauses] = await db
    .select({ value: count() })
    .from(clauses)
    .where(isNotNull(clauses.aiSummary));
  const [embeddedChunks] = await db
    .select({ value: count() })
    .from(clauseChunks);

  console.log(`Total Clauses: ${totalClauses.value}`);
  console.log(`Enriched Clauses: ${enrichedClauses.value}`);
  console.log(`Embedded Chunks: ${embeddedChunks.value}`);

  if (
    enrichedClauses.value === totalClauses.value &&
    embeddedChunks.value === totalClauses.value
  ) {
    console.log(
      "🚀 ALL AI ENRICHMENT AND EMBEDDINGS ARE COMPLETE AND VERIFIED!",
    );
  } else {
    console.warn("⚠️ SOME CLAUSES ARE STILL PENDING. RUN THE SCRIPT AGAIN.");
  }

  console.log("Enrichment process finished.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error in enrichment script:", err);
  process.exit(1);
});
