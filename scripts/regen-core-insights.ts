/**
 * Regenerate AI insights for the CORE (global) clause library with the
 * upgraded reinsurance prompt + model. Updates only the AI insight fields on
 * each clause (summary / favourability / recommendedUse / note); it does NOT
 * touch embeddings/chunks or clause versions.
 *
 * Resumable: by default it skips clauses already at aiVersion v2-reinsurance,
 * so a re-run continues after a quota stop. Pass --all to force every clause.
 *
 * Usage:  DOTENV_CONFIG_PATH=/d/Richard/_prod.env npx tsx scripts/regen-core-insights.ts
 */
import "dotenv/config";
import { db } from "../src/db/drizzle";
import { clauses } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { RateLimiter } from "../src/lib/rate-limiter";
import { withResilience } from "../src/lib/resilience";
import { buildClauseInsightPrompt, CLAUSE_INSIGHT_SYSTEM } from "../src/lib/ai";

const FORCE_ALL = process.argv.includes("--all");

// Prefer the deep/fast tier keys (separate quota from GEMINI_API_KEY, which the
// extractor uses heavily) so this batch doesn't fight the extraction quota.
const GEMINI_KEY =
  process.env.GEMINI_DEEP_API_KEY ??
  process.env.GEMINI_FAST_API_KEY ??
  process.env.GEMINI_API_KEY ??
  process.env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!GEMINI_KEY) {
  console.error("No Gemini API key found (GEMINI_API_KEY / GEMINI_FAST_API_KEY).");
  process.exit(1);
}
const genAI = new GoogleGenerativeAI(GEMINI_KEY);
// gemini-2.5-flash free-tier quota is exhausted today; flash-lite has far
// higher free limits and the reinsurance prompt + clause context (the real
// quality lever) work on it. Override with MODEL=gemini-2.5-flash off-peak
// for the best-quality pass.
const MODEL = process.env.REGEN_MODEL ?? "gemini-3.1-flash-lite-preview";
const model = genAI.getGenerativeModel({
  model: MODEL,
  systemInstruction: CLAUSE_INSIGHT_SYSTEM,
  generationConfig: { responseMimeType: "application/json" },
});
const aiLimiter = new RateLimiter({ rpm: 15, tpm: 250000 }, "GeminiAI");

async function genInsight(clause: {
  clauseText: string;
  clauseName?: string | null;
  code?: string | null;
  category?: string | null;
}) {
  const prompt = buildClauseInsightPrompt(clause);
  await aiLimiter.acquire(Math.ceil(prompt.length / 3) + 500);
  const text = await withResilience(
    async () => {
      const res = await model.generateContent(prompt);
      return (await res.response).text();
    },
    { name: "GeminiAI" },
  );
  return JSON.parse(text) as {
    summary: string;
    favorability: string;
    recommendedUse: string[];
    note: string;
  };
}

async function main() {
  const rows = await db
    .select({
      id: clauses.id,
      clauseName: clauses.clauseName,
      code: clauses.code,
      category: clauses.category,
      clauseText: clauses.clauseText,
      aiVersion: clauses.aiVersion,
    })
    .from(clauses)
    .where(eq(clauses.isGlobal, true));

  const targets = FORCE_ALL
    ? rows
    : rows.filter((r) => r.aiVersion !== "v2-reinsurance");
  console.log(
    `Core (global) clauses: ${rows.length} | to regenerate: ${targets.length}${FORCE_ALL ? " (--all)" : " (skipping v2-reinsurance)"}`,
  );

  let ok = 0;
  let fail = 0;
  const BATCH = 5;
  for (let i = 0; i < targets.length; i += BATCH) {
    const batch = targets.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (c) => {
        try {
          const ai = await genInsight(c);
          await db
            .update(clauses)
            .set({
              aiSummary: ai.summary,
              aiFavorability: ai.favorability,
              aiRecommendedUse: ai.recommendedUse,
              aiNote: ai.note,
              aiGeneratedAt: new Date(),
              aiVersion: "v2-reinsurance",
              updatedAt: new Date(),
            })
            .where(eq(clauses.id, c.id));
          ok++;
        } catch (e) {
          fail++;
          console.error(
            `  fail ${c.code || c.clauseName}: ${(e as Error).message?.slice(0, 90)}`,
          );
        }
      }),
    );
    console.log(
      `[${Math.min(i + BATCH, targets.length)}/${targets.length}] ok=${ok} fail=${fail}`,
    );
  }

  // Spot-check: print a few regenerated insights to eyeball quality.
  const samples = await db
    .select({
      name: clauses.clauseName,
      code: clauses.code,
      fav: clauses.aiFavorability,
      sum: clauses.aiSummary,
      use: clauses.aiRecommendedUse,
      note: clauses.aiNote,
    })
    .from(clauses)
    .where(eq(clauses.isGlobal, true))
    .limit(5);
  console.log("\n=== SAMPLES ===");
  for (const s of samples) {
    console.log(`\n[${s.code || "-"}] ${s.name}  (favours: ${s.fav})`);
    console.log(`  summary: ${s.sum}`);
    console.log(`  use: ${(s.use || []).map((u) => "• " + u).join("  ")}`);
    console.log(`  note: ${s.note}`);
  }
  console.log(`\nDONE ok=${ok} fail=${fail}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
