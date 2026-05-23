import { generateJSON, DEFAULT_MODEL } from "./ai-router";
import { z } from "zod";
import type { ModelMessage } from "ai";

const PROMPT = `Analyze the following insurance/reinsurance clause and return structured insights in JSON format.
The JSON must have:
- summary: A concise professional summary
- favorability: One of "vendor", "customer", or "neutral"
- recommendedUse: Array of strings describing when to use it
- note: A brief legal/professional note

Clause:
{{CLAUSE_TEXT}}`;

export async function generateClauseAI(clauseText: string) {
  const prompt = PROMPT.replace("{{CLAUSE_TEXT}}", clauseText);

  try {
    const parsed = await generateJSON(
      z.object({
        summary: z.string(),
        favorability: z.enum(["vendor", "customer", "neutral"]),
        recommendedUse: z.array(z.string()),
        note: z.string(),
      }),
      [{ role: "user", content: prompt }],
      "You are a professional insurance/reinsurance legal AI. Provide high-fidelity, accurate structured insights.",
      "direct-google:gemini-3.1-flash-lite-preview",
      2000,
    );

    return {
      aiSummary: parsed.summary,
      aiFavorability: parsed.favorability,
      aiRecommendedUse: parsed.recommendedUse,
      aiNote: parsed.note,
      aiGeneratedAt: new Date(),
      aiVersion: "v1",
    };
  } catch (error) {
    console.error("AI Clause Generation failed:", error);
    throw new Error("AI response generation for clause failed");
  }
}
