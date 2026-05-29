import { generateJSON } from "./ai-router";
import { z } from "zod";

/**
 * Per-clause AI insight generation.
 *
 * The wording here is deliberately reinsurance-specific: the previous prompt
 * was generic ("professional summary", vendor/customer/neutral favourability)
 * and produced corporate-legal platitudes that the client flagged as "not very
 * good for describing reinsurance". This prompt makes the model reason as a
 * London-market treaty wordings practitioner and frames favourability in
 * reinsurance terms (cedant vs reinsurer vs balanced).
 *
 * Exported so the batch enrichment script (scripts/enrich-clauses.ts) shares
 * exactly the same prompt and never drifts from the runtime path.
 */
export const CLAUSE_INSIGHT_SYSTEM = `You are a senior reinsurance treaty wordings specialist working in the London / Lloyd's market. Analyse clauses the way an experienced underwriter and wordings/claims practitioner would: what the clause actually does to cover, liability, claims handling and the balance of interest between the cedant (reinsured) and the reinsurer. You know market-standard wordings (LSW, NMA, LMA, JELC, IUA), follow-the-fortunes / follow-the-settlements, claims control vs claims co-operation, aggregation and hours clauses, retention / limit / reinstatement mechanics, exclusion scope, and the reinsurance implications of arbitration and governing-law choices. Be precise, concrete and reinsurance-specific. Never produce generic corporate-legal commentary.`;

export const CLAUSE_INSIGHT_PROMPT = `Analyse the following reinsurance/insurance clause and return structured JSON insights for a reinsurance professional reviewing a treaty.

Return JSON with:
- summary: one or two sentences on what this clause actually does in a reinsurance treaty and its practical effect on cover, liability or claims. Name the market-standard basis if you recognise it (e.g. an LSW / NMA / LMA wording). No filler.
- favorability: whose interest the wording favours, one of "cedant", "reinsurer", or "balanced".
- recommendedUse: 2 to 4 specific, actionable points covering when a reinsured or reinsurer would use or insist on this clause and the concrete risk or negotiation points to watch (notification deadlines, aggregation triggers, carve-outs, control of claims, etc.). Each point must be reinsurance-specific, never a generic platitude.
- note: one sharp practitioner note on a risk, a common amendment, or how this clause interacts with other treaty terms.

Clause:
{{CLAUSE_TEXT}}`;

export const clauseInsightSchema = z.object({
  summary: z.string(),
  favorability: z.enum(["cedant", "reinsurer", "balanced"]),
  recommendedUse: z.array(z.string()),
  note: z.string(),
});

export async function generateClauseAI(clauseText: string) {
  const prompt = CLAUSE_INSIGHT_PROMPT.replace("{{CLAUSE_TEXT}}", clauseText);

  try {
    const parsed = await generateJSON(
      clauseInsightSchema,
      [{ role: "user", content: prompt }],
      CLAUSE_INSIGHT_SYSTEM,
      "direct-google:gemini-3.1-flash-lite-preview",
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
