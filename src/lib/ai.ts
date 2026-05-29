import { generateJSON, MODEL_GOOGLE_FLASH } from "./ai-router";
import { z } from "zod";

/**
 * Per-clause AI insight generation.
 *
 * Reinsurance-specific by design: the previous prompt was generic ("a concise
 * professional summary", vendor/customer/neutral favourability) and produced
 * corporate-legal platitudes the client flagged as "not very good for
 * describing reinsurance". This version:
 *   - reasons as a London-market treaty wordings practitioner,
 *   - frames favourability as cedant / reinsurer / balanced,
 *   - anchors on the clause's name + market/library code (e.g. LSW307A) so it
 *     recognises the standard wording instead of guessing from raw text,
 *   - is told to stay accurate and not invent specifics the text doesn't support.
 *
 * Exported so the batch enrichment / regeneration scripts share exactly the
 * same prompt, system and schema and never drift from the runtime path.
 */
export const CLAUSE_INSIGHT_SYSTEM = `You are a senior reinsurance treaty wordings specialist working in the London / Lloyd's market. Analyse clauses the way an experienced underwriter and wordings/claims practitioner would: what the clause actually does to cover, liability, claims handling and the balance of interest between the cedant (reinsured) and the reinsurer. You know market-standard wordings (LSW, NMA, LMA, JELC, IUA), follow-the-fortunes / follow-the-settlements, claims control vs claims co-operation, aggregation and hours clauses, retention / limit / reinstatement mechanics, exclusion scope, and the reinsurance implications of arbitration and governing-law choices. Be precise, concrete and reinsurance-specific, never generic corporate-legal commentary. Accuracy comes first: if the clause text (or a given market code) does not support a point, do not invent it — describe only what the wording actually supports.`;

const CLAUSE_INSIGHT_INSTRUCTIONS = `Analyse the following reinsurance/insurance clause and return structured JSON insights for a reinsurance professional reviewing a treaty.

If a clause name or market/library code is given (e.g. an LSW / NMA / LMA / IUA code), treat it as a strong signal of the recognised standard wording and do not contradict that standard. If you are unsure what the clause does, describe only what the text supports.

Return JSON with:
- summary: one or two sentences on what this clause actually does in a reinsurance treaty and its practical effect on cover, liability or claims. Name the market-standard basis if you recognise it. No filler.
- favorability: whose interest the wording favours, one of "cedant", "reinsurer", or "balanced".
- recommendedUse: 2 to 4 specific, actionable points covering when a reinsured or reinsurer would use or insist on this clause and the concrete risk or negotiation points to watch (notification deadlines, aggregation triggers, carve-outs, control of claims, etc.). Each point must be reinsurance-specific, never a generic platitude.
- note: one sharp practitioner note on a risk, a common amendment, or how this clause interacts with other treaty terms.`;

/** Build the full user prompt, anchoring on clause name/code/category when known. */
export function buildClauseInsightPrompt(input: {
  clauseText: string;
  clauseName?: string | null;
  code?: string | null;
  category?: string | null;
}): string {
  const ctx: string[] = [];
  if (input.clauseName) ctx.push(`Clause name: ${input.clauseName}`);
  if (input.code) ctx.push(`Market / library code: ${input.code}`);
  if (input.category) ctx.push(`Category: ${input.category}`);
  const header = ctx.length ? ctx.join("\n") + "\n\n" : "";
  return `${CLAUSE_INSIGHT_INSTRUCTIONS}\n\n${header}Clause text:\n${input.clauseText}`;
}

/** Template form for callers that only substitute the clause text. */
export const CLAUSE_INSIGHT_PROMPT = `${CLAUSE_INSIGHT_INSTRUCTIONS}\n\nClause text:\n{{CLAUSE_TEXT}}`;

export const clauseInsightSchema = z.object({
  summary: z.string(),
  favorability: z.enum(["cedant", "reinsurer", "balanced"]),
  recommendedUse: z.array(z.string()),
  note: z.string(),
});

export async function generateClauseAI(
  clauseText: string,
  context?: {
    clauseName?: string | null;
    code?: string | null;
    category?: string | null;
  },
) {
  const prompt = buildClauseInsightPrompt({ clauseText, ...context });

  try {
    const parsed = await generateJSON(
      clauseInsightSchema,
      [{ role: "user", content: prompt }],
      CLAUSE_INSIGHT_SYSTEM,
      MODEL_GOOGLE_FLASH,
      2000,
    );

    return {
      aiSummary: parsed.summary,
      aiFavorability: parsed.favorability,
      aiRecommendedUse: parsed.recommendedUse,
      aiNote: parsed.note,
      aiGeneratedAt: new Date(),
      aiVersion: "v2-reinsurance",
    };
  } catch (error) {
    console.error("AI Clause Generation failed:", error);
    throw new Error("AI response generation for clause failed");
  }
}
