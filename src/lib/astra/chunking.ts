import { splitText } from "@/lib/chunk";

/** NVIDIA vectorize on Astra is capped at 512 tokens per request. */
export const NVIDIA_VECTORIZE_TOKEN_LIMIT = 512;

/** Stay under provider limit (default 480 tokens ≈ ~720 chars for legal text). */
export function getAstraVectorizeMaxChars(): number {
  const fromEnv = process.env.ASTRA_VECTORIZE_MAX_CHARS;
  if (fromEnv) return Math.max(200, Number(fromEnv));
  return 720;
}

/** Rough token estimate for embedding providers (legal text ~1.3–1.6 chars/token). */
export function estimateVectorizeTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 1.35);
}

/**
 * Chunks clause text small enough for NVIDIA $vectorize (512 token cap).
 */
export function splitTextForAstraVectorize(text: string): string[] {
  const maxChars = getAstraVectorizeMaxChars();
  const parts = splitText(text, maxChars);
  const safe: string[] = [];

  for (const part of parts) {
    if (estimateVectorizeTokens(part) <= NVIDIA_VECTORIZE_TOKEN_LIMIT - 16) {
      safe.push(part);
      continue;
    }
    let remaining = part;
    const subMax = Math.floor(maxChars * 0.6);
    while (remaining.length > 0) {
      if (remaining.length <= subMax) {
        safe.push(remaining);
        break;
      }
      safe.push(remaining.slice(0, subMax));
      remaining = remaining.slice(subMax);
    }
  }

  return safe.filter((p) => p.trim().length > 0);
}
