import "dotenv/config";
/**
 * Client-side embeddings for PGVector fallback.
 * When USE_ASTRA_VECTOR=true, chunk inserts use Astra $vectorize instead — see src/lib/astra/.
 */
import { googleFast } from "./ai-router";
import { vertex } from "./gcp/vertex";
import { embedMany, embed } from "ai";
import { setTimeout } from "node:timers/promises";

const DIMENSIONS = 1024;
const VERTEX_TPM_LIMIT = 500000; // Vertex has much higher limits than AI Studio free
const GOOGLE_TPM_LIMIT = 28000;
const ESTIMATED_TOKENS_PER_CHAR = 0.25;

// Direct Hugging Face API call since AI SDK doesn't support embeddings via provider
async function fetchHF(text: string, model: string): Promise<number[]> {
  const response = await fetch(
    `https://api-inference.huggingface.co/models/${model}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HUGGING_FACE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: text }),
    },
  );
  if (!response.ok) throw new Error(`HF API error: ${response.statusText}`);
  return await response.json();
}

function normalizeDimension(embedding: number[]): number[] {
  if (embedding.length === DIMENSIONS) return embedding;
  if (embedding.length > DIMENSIONS) return embedding.slice(0, DIMENSIONS);

  const padded = new Array(DIMENSIONS).fill(0);
  for (let i = 0; i < embedding.length; i++) padded[i] = embedding[i];
  return padded;
}

function chunkByTokens(values: string[], limit: number): string[][] {
  const chunks: string[][] = [];
  let currentChunk: string[] = [];
  let currentTokens = 0;

  for (const val of values) {
    const tokens = Math.ceil(val.length * ESTIMATED_TOKENS_PER_CHAR);
    if (currentTokens + tokens > limit && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentTokens = 0;
    }
    currentChunk.push(val);
    currentTokens += tokens;
  }
  if (currentChunk.length > 0) chunks.push(currentChunk);
  return chunks;
}

export async function createEmbeddings(inputs: string | string[]) {
  if (!inputs || (Array.isArray(inputs) && inputs.length === 0))
    throw new Error("No input");

  const values = Array.isArray(inputs) ? inputs : [inputs];
  const results: number[][] = [];

  // Use Vertex limit as primary, then fallback chunks will be handled
  const valueChunks = chunkByTokens(values, VERTEX_TPM_LIMIT);

  for (const chunk of valueChunks) {
    let chunkResult: number[][] | null = null;

    // 1. Primary: Vertex AI (text-embedding-004) - Professional Grade
    try {
      if (process.env.GCP_PROJECT_ID) {
        const { embeddings } = await embedMany({
          model: vertex.embeddingModel("text-embedding-004"),
          values: chunk,
        });
        chunkResult = embeddings.map((e: number[]) =>
          normalizeDimension(Array.from(e)),
        );
        console.log(
          `[Embedding] Successfully embedded ${chunk.length} items using Vertex text-embedding-004.`,
        );
      }
    } catch (vertexErr: any) {
      console.warn(
        `[Embedding] Vertex text-embedding-004 failed: ${vertexErr?.message || vertexErr}. Trying Google AI Studio fallback...`,
      );
    }

    // 2. Secondary: Google AI Studio (Free Tier)
    if (!chunkResult) {
      // Re-chunk if needed for lower AI Studio limits
      const subChunks = chunkByTokens(chunk, GOOGLE_TPM_LIMIT);
      const subResults: number[][] = [];

      for (const subChunk of subChunks) {
        try {
          let success: any = null;
          try {
            success = await embedMany({
              model: googleFast.embeddingModel("text-embedding-004"), // AI Studio also supports 004
              values: subChunk,
            });
          } catch (err1) {
            success = await embedMany({
              model: googleFast.embeddingModel("gemini-embedding-1"),
              values: subChunk,
            });
          }

          if (success) {
            subResults.push(
              ...success.embeddings.map((e: number[]) =>
                normalizeDimension(Array.from(e)),
              ),
            );
          }
        } catch (err) {
          console.warn(`[Embedding] AI Studio fallback failed for subchunk.`);
          break;
        }
      }

      if (subResults.length === chunk.length) {
        chunkResult = subResults;
        console.log(
          `[Embedding] Successfully embedded ${chunk.length} items using AI Studio fallback.`,
        );
      }
    }

    // 3. Last Resort: Hugging Face API (Specialized Legal Model)
    if (!chunkResult) {
      try {
        chunkResult = await Promise.all(
          chunk.map(async (text) => {
            const emb = await fetchHF(
              text,
              "nlpaueb/bert-base-uncased-contracts",
            );
            return normalizeDimension(emb);
          }),
        );
        console.log(
          `[Embedding] Successfully embedded ${chunk.length} items using Legal-BERT (Hugging Face).`,
        );
      } catch (hfErr: any) {
        console.warn(
          `[Embedding] Legal-BERT fallback failed, trying BGE-M3 as final safety...`,
        );
        try {
          chunkResult = await Promise.all(
            chunk.map(async (text) => {
              const emb = await fetchHF(text, "BAAI/bge-m3");
              return normalizeDimension(emb);
            }),
          );
        } catch (finalErr: any) {
          console.error(
            `[Embedding] All Hugging Face fallbacks failed: ${finalErr?.message}`,
          );
          throw new Error(
            `All embedding providers failed. Last error: ${finalErr?.message}`,
          );
        }
      }
    }

    if (!chunkResult) throw new Error("All embedding providers failed.");
    results.push(...chunkResult);

    // Safety delay to prevent aggressive rate limiting
    await setTimeout(200);
  }

  return results;
}

export async function createEmbedding(text: string) {
  const res = await createEmbeddings([text]);
  return res[0];
}
