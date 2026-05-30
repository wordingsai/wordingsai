import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createGroq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createMistral } from "@ai-sdk/mistral";
import { createHuggingFace } from "@ai-sdk/huggingface";
import { vertex } from "./gcp/vertex";
import { generateObject, generateText, type ModelMessage } from "ai";
import { z } from "zod";
import { getGlobalCache, setGlobalCache } from "./cache";
import { createHash } from "node:crypto";

// We run Gemini-only, so only the Gemini keys are required. The other provider
// clients below are kept for the explicit catch-all path but are not part of any
// active fallback chain, so we don't warn about their (deliberately unset) keys.
if (!process.env.GEMINI_FAST_API_KEY) {
  console.warn("GEMINI_FAST_API_KEY is not set in .env");
}
if (!process.env.GEMINI_DEEP_API_KEY) {
  console.warn("GEMINI_DEEP_API_KEY is not set in .env");
}

export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export const googleFast = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_FAST_API_KEY,
});

export const googleDeep = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_DEEP_API_KEY,
});

export const mistral = createMistral({
  apiKey: process.env.MISTRAL_API_KEY,
});

export const huggingface = createHuggingFace({
  apiKey: process.env.HUGGING_FACE_API_KEY,
});

// Priority models for WordingsAI GCP Pipeline (2026 Best Value)
export const MODEL_FLASH = "vertex:gemini-2.5-flash";
export const MODEL_PRO = "vertex:gemini-2.5-pro";

// New 2026 High-Efficiency Models
export const MODEL_GEMINI_3_FLASH = "direct-google:gemini-3-flash-preview";
export const MODEL_GEMMA_4_31B = "direct-google:gemma-4-31b-it";
export const MODEL_FLASH_LITE_PREVIEW =
  "direct-google:gemini-3.1-flash-lite-preview";

// Fallbacks for direct access
export const MODEL_GOOGLE_FLASH = "direct-google:gemini-2.5-flash";
export const MODEL_GOOGLE_PRO = "direct-google:gemini-2.5-pro";

// Default model for high-performance analysis
export const DEFAULT_MODEL = MODEL_FLASH;

// Token cap for safety (increased to 16k to accommodate reasoning models)
const OPENROUTER_MAX_TOKENS_CAP = 16384;

function getAICacheKey(
  model: string,
  system: string | undefined,
  messages: ModelMessage[],
  schema: z.ZodTypeAny,
): string {
  const schemaStr = JSON.stringify((schema as any)._def);
  const messagesStr = JSON.stringify(messages);
  const input = `${model}:${system}:${messagesStr}:${schemaStr}`;
  return `ai:json:${createHash("sha256").update(input).digest("hex")}`;
}

/**
 * Fast, local token estimation (approx 4 chars per token).
 */
export function estimateTokens(text: string | undefined): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export function estimateMessagesTokens(messages: ModelMessage[]): number {
  if (!messages || !Array.isArray(messages)) return 0;
  return messages.reduce((acc, m) => {
    const content =
      typeof m.content === "string" ? m.content : JSON.stringify(m.content);
    return acc + estimateTokens(content);
  }, 0);
}

export type OrganizationPlan = "basic" | "plus";

/**
 * Centralized Quota Management (2026 Updated for High-Throughput Mini Models)
 */
type Quota = {
  rpm: number;
  tpm: number;
  rpd: number;
};

// Model Quota Mapping: RPM | TPM | RPD
const QUOTAS: Record<string, Quota> = {
  google: { rpm: 15, tpm: 1000000, rpd: 1500 }, // Standard Google Gemini Free Tier Quota
  "google-flash-lite": { rpm: 15, tpm: 250000, rpd: 500 },
  "google-flash": { rpm: 5, tpm: 250000, rpd: 20 },
  gemma: { rpm: 15, tpm: 1000000, rpd: 1500 },
  "gemini-embedding": { rpm: 100, tpm: 30000, rpd: 1000 },
  vertex: { rpm: 3000, tpm: 4000000, rpd: 10000 },
  openai: { rpm: 5000, tpm: 2000000, rpd: 10000 },
  groq: { rpm: 30, tpm: 100000, rpd: 1000 },
  mistral: { rpm: 50, tpm: 500000, rpd: 1000 },
  openrouter: { rpm: 100, tpm: 500000, rpd: 1000 },
};

class ProviderRateLimiter {
  private queue: Array<{
    tokens: number;
    resolve: (done: () => void) => void;
  }> = [];
  private tokensUsedInWindow = 0;
  private requestsMadeInWindow = 0;
  private activeRequests = 0;
  private windowStartTime = Date.now();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private maxConcurrent = 10; // Increased for better parallelization

  constructor(private readonly provider: string) {}

  private get quota(): Quota {
    return QUOTAS[this.provider] || { rpm: 5, tpm: 20000 };
  }

  async schedule(estimatedTokens: number): Promise<() => void> {
    const { tpm } = this.quota;
    if (estimatedTokens > tpm) {
      console.warn(
        `[RateLimiter:${this.provider}] Request tokens (${estimatedTokens}) exceed TPM limit (${tpm}). Capping for scheduler.`,
      );
      estimatedTokens = tpm - 1;
    }

    return new Promise((resolve) => {
      this.queue.push({ tokens: estimatedTokens, resolve });
      this.processQueue();
    });
  }

  private resetWindowIfNeeded() {
    const now = Date.now();
    const elapsed = now - this.windowStartTime;
    if (elapsed >= 60000) {
      this.windowStartTime = now;
      this.tokensUsedInWindow = 0;
      this.requestsMadeInWindow = 0;

      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
      return true;
    }

    if (!this.timer && this.queue.length > 0) {
      const timeUntilReset = 60000 - elapsed;
      this.timer = setTimeout(
        () => {
          this.timer = null;
          this.processQueue();
        },
        Math.max(10, timeUntilReset),
      );
    }

    return false;
  }

  private processQueue() {
    if (this.queue.length === 0) return;
    this.resetWindowIfNeeded();

    const { rpm, tpm } = this.quota;

    if (this.activeRequests >= this.maxConcurrent) return;

    const index = this.queue.findIndex(
      (req) => this.tokensUsedInWindow + req.tokens <= tpm,
    );

    if (index !== -1 && this.requestsMadeInWindow < rpm) {
      const [nextReq] = this.queue.splice(index, 1);
      this.requestsMadeInWindow++;
      this.tokensUsedInWindow += nextReq.tokens;
      this.activeRequests++;

      nextReq.resolve(() => {
        this.activeRequests--;
        this.processQueue();
      });

      this.processQueue();
      return;
    }

    if (!this.timer) {
      const delay = 60000 - (Date.now() - this.windowStartTime) + 100;
      this.timer = setTimeout(
        () => {
          this.timer = null;
          this.processQueue();
        },
        Math.max(0, delay),
      );
    }
  }
}

const limiters: Record<string, ProviderRateLimiter> = {
  groq: new ProviderRateLimiter("groq"),
  google: new ProviderRateLimiter("google"),
  vertex: new ProviderRateLimiter("vertex"),
  mistral: new ProviderRateLimiter("mistral"),
  openrouter: new ProviderRateLimiter("openrouter"),
};

export type OpenRouterModelAttempt<T> = {
  ok: boolean;
  model: string;
  latencyMs: number;
  value?: T;
  error?: unknown;
};

function parseModelList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
}

/** Merges caller-specified models (unchanged names) with plan fallbacks, deduped. */
export function resolveTierAwareModels(
  plan: OrganizationPlan,
  explicit?: string[],
): string[] {
  const planModels = getPlanModels(plan);
  if (!explicit || explicit.length === 0) return planModels;
  return [...new Set([...explicit, ...planModels])];
}

/**
 * Model fallback chains. Gemini-only by design: WordingsAI runs on the free
 * Gemini tier (plus optional Vertex via GCP credits when GCP_PROJECT_ID is set),
 * so resilience comes from spreading across multiple Gemini models — each with
 * its own independent quota (2.5 Pro/Flash, 3.x Flash-lite, Gemma) — not from
 * foreign vendors. The previous chains listed Groq/Mistral/OpenAI(OpenRouter)
 * fallbacks whose keys are never set, so on a Gemini rate-limit they only failed
 * and wasted an attempt before reaching the next Gemini model. If a foreign
 * provider key is ever added, reintroduce it here intentionally.
 */
export function getPlanModels(plan: OrganizationPlan): string[] {
  if (plan === "plus") {
    return [
      MODEL_PRO, // Gemini 2.5 Pro (Vertex if GCP creds, else direct Gemini)
      MODEL_FLASH, // Gemini 2.5 Flash
      MODEL_GOOGLE_PRO, // direct Gemini 2.5 Pro
      MODEL_GEMINI_3_FLASH, // Gemini 3 Flash
      MODEL_GEMMA_4_31B, // Gemma 4 31B
    ];
  }
  // Cost-Efficient Tier — Gemini fast models, independent quotas.
  return [
    MODEL_FLASH, // Gemini 2.5 Flash
    MODEL_FLASH_LITE_PREVIEW, // Gemini 3.1 Flash-lite
    MODEL_GOOGLE_FLASH, // direct Gemini 2.5 Flash
    MODEL_GEMMA_4_31B, // Gemma 4 31B
  ];
}

function toErrorMessage(err: unknown): string {
  if (!err) return "";
  if (err instanceof Error) return err.message || String(err);
  return String(err);
}

export function isAbortOrTimeoutError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof Error) {
    if (err.name === "AbortError") return true;
    const msg = err.message.toLowerCase();
    if (
      msg.includes("aborted") ||
      msg.includes("timeout") ||
      msg.includes("timed out")
    ) {
      return true;
    }
  }
  const code = (err as { code?: number }).code;
  return code === 20;
}

function isRetryableModelError(err: unknown): boolean {
  const msg = toErrorMessage(err).toLowerCase();
  return (
    msg.includes("402") ||
    msg.includes("insufficient") ||
    msg.includes("credit") ||
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("429") ||
    msg.includes("timed out") ||
    msg.includes("timeout") ||
    msg.includes("aborted") ||
    msg.includes("is not found") ||
    msg.includes("model not found") ||
    msg.includes("no such model") ||
    msg.includes("overloaded") ||
    msg.includes("try again") ||
    msg.includes("failed to parse json") ||
    msg.includes("invalid json")
  );
}

export function resolveModelProvider(
  modelName: string,
  context: "fast" | "deep" = "fast",
) {
  const client = context === "fast" ? googleFast : googleDeep;

  let targetModel = modelName;

  // Vertex AI Priority: Use Vertex if Project ID is set, even if other keys exist.
  // This ensures the user uses their GCP credits (€225) instead of the low-limit free tier.
  if (targetModel.startsWith("vertex:")) {
    const rawModel = targetModel.replace("vertex:", "");
    if (process.env.GCP_PROJECT_ID) {
      return vertex(rawModel);
    }
    return client(rawModel);
  }

  if (targetModel.startsWith("direct-groq:")) {
    return groq(targetModel.replace("direct-groq:", ""));
  }
  if (targetModel.startsWith("direct-google:")) {
    return client(targetModel.replace("direct-google:", ""));
  }
  if (targetModel.startsWith("gemini-embedding-")) {
    return googleFast.embeddingModel(targetModel);
  }
  if (targetModel.startsWith("direct-mistral:")) {
    return mistral(targetModel.replace("direct-mistral:", ""));
  }
  return openrouter(targetModel);
}

function getProviderFromModel(modelName: string): string {
  if (modelName === MODEL_GEMINI_3_FLASH) return "google-live";
  if (modelName.includes("gemma-4-31b")) return "gemma-31b";
  if (modelName.includes("gemini-embedding")) return "gemini-embedding";
  if (modelName.startsWith("vertex:")) return "vertex";
  if (modelName.startsWith("direct-groq:")) return "groq";
  if (modelName.startsWith("direct-google:")) return "google";
  if (modelName.startsWith("direct-mistral:")) return "mistral";
  if (
    modelName.startsWith("openai/") ||
    modelName.startsWith("deepseek/") ||
    modelName.startsWith("anthropic/")
  )
    return "openrouter";
  return "openrouter";
}

/**
 * Unified helper to generate structured objects via OpenRouter or Groq
 */
export async function generateJSON<T extends z.ZodTypeAny>(
  schema: T,
  messages: ModelMessage[],
  system?: string,
  modelName: string = DEFAULT_MODEL,
  maxTokens: number = 12000,
  timeoutMs: number = 60000,
): Promise<z.output<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const safeMaxTokens = Math.min(maxTokens, OPENROUTER_MAX_TOKENS_CAP);

  const cacheKey = getAICacheKey(modelName, system, messages, schema);
  const cached = await getGlobalCache<z.output<T>>(cacheKey);
  if (cached) {
    console.log(`[AI:Router] Cache HIT for model: ${modelName}`);
    return cached;
  }

  const provider = getProviderFromModel(modelName);
  const limiter = limiters[provider] || limiters.openrouter;
  const estimatedTokens =
    estimateMessagesTokens(messages) + estimateTokens(system) + safeMaxTokens;

  const release = await limiter.schedule(estimatedTokens);
  try {
    if (provider === "groq") {
      const schemaDef = JSON.stringify((schema as any)._def || schema, null, 2);
      const promptParts = messages.map((m) => {
        const content =
          typeof m.content === "string" ? m.content : JSON.stringify(m.content);
        return `${m.role.toUpperCase()}:\n${content}`;
      });
      const wrapper = `You must output a single JSON object that conforms to the following schema definition (do not include any explanatory text):\n${schemaDef}\n\n`;
      const fullPrompt = wrapper + "\n\n" + promptParts.join("\n\n");

      const text = await generateContent(
        fullPrompt,
        system,
        modelName,
        timeoutMs,
        safeMaxTokens,
      );
      const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error("Failed to parse JSON output from model");
      let parsed: any;
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (e) {
        throw new Error("Model returned invalid JSON");
      }

      await setGlobalCache(cacheKey, parsed);
      return parsed as z.output<T>;
    }

    const { object } = await generateObject({
      model: resolveModelProvider(modelName) as any,
      schema,
      messages,
      system,
      temperature: 0.1,
      maxOutputTokens: safeMaxTokens,
      abortSignal: controller.signal,
      output: "object",
    });

    if (object) {
      await setGlobalCache(cacheKey, object);
    }

    return object as z.output<T>;
  } finally {
    release();
    clearTimeout(timeoutId);
  }
}

async function generateJSONWithModel<T extends z.ZodTypeAny>(
  schema: T,
  messages: ModelMessage[],
  system: string | undefined,
  modelName: string,
  maxTokens: number,
  timeoutMs: number,
): Promise<OpenRouterModelAttempt<z.output<T>>> {
  const start = Date.now();
  try {
    const value = await generateJSON(
      schema,
      messages,
      system,
      modelName,
      maxTokens,
      timeoutMs,
    );
    return { ok: true, model: modelName, latencyMs: Date.now() - start, value };
  } catch (error) {
    return {
      ok: false,
      model: modelName,
      latencyMs: Date.now() - start,
      error,
    };
  }
}

export async function generateJSONTierAware<T extends z.ZodTypeAny>(args: {
  schema: T;
  messages: ModelMessage[];
  system?: string;
  plan: OrganizationPlan;
  models?: string[];
  maxTokens?: number;
  timeoutMs?: number;
  merge?: (values: Array<z.output<T>>) => unknown;
  parallelModelConcurrency?: number;
}) {
  const {
    schema,
    messages,
    system,
    plan,
    maxTokens = 12000,
    timeoutMs = 60000,
    merge,
    parallelModelConcurrency = 3,
  } = args;

  const models = resolveTierAwareModels(plan, args.models);
  if (models.length === 0) {
    return await generateJSON(
      schema,
      messages,
      system,
      DEFAULT_MODEL,
      maxTokens,
      timeoutMs,
    );
  }

  const overallStart = Date.now();
  const perModelTimeout = Math.max(
    14_000,
    Math.floor(timeoutMs / Math.max(1, models.length)),
  );
  const getDynamicTimeout = () => {
    const elapsed = Date.now() - overallStart;
    const remaining = timeoutMs - elapsed;
    return Math.max(perModelTimeout, remaining);
  };

  if (plan === "basic") {
    let lastErr: unknown;
    for (const model of models) {
      if (Date.now() - overallStart >= timeoutMs) break;
      try {
        return await generateJSON(
          schema,
          messages,
          system,
          model,
          maxTokens,
          getDynamicTimeout(),
        );
      } catch (err) {
        lastErr = err;
        if (!isRetryableModelError(err)) throw err;
        console.warn(
          `[AI:Router] Model ${model} failed (${toErrorMessage(err)}), trying next fallback...`,
        );
      }
    }
    throw lastErr ?? new Error("All tier-aware model attempts failed");
  }

  const concurrency = Math.max(
    1,
    Math.min(parallelModelConcurrency, models.length),
  );
  const winners: Array<OpenRouterModelAttempt<z.output<T>>> = [];
  const errors: Array<OpenRouterModelAttempt<z.output<T>>> = [];

  let index = 0;
  const worker = async () => {
    while (index < models.length) {
      const modelName = models[index++];
      const attempt = await generateJSONWithModel(
        schema,
        messages,
        system,
        modelName,
        maxTokens,
        getDynamicTimeout(),
      );
      if (attempt.ok) {
        winners.push(attempt);
        if (!merge) return;
      } else {
        errors.push(attempt);
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  if (winners.length === 0) {
    const retryable = errors.find((e) => isRetryableModelError(e.error));
    const first = errors[0]?.error;
    throw (
      retryable?.error ??
      first ??
      new Error("All OpenRouter free model attempts failed")
    );
  }

  if (merge) {
    const merged = merge(winners.map((w) => w.value as z.output<T>));
    const parsed = schema.safeParse(merged);
    if (parsed.success) return parsed.data;
  }

  winners.sort((a, b) => a.latencyMs - b.latencyMs);
  return winners[0].value as z.output<T>;
}

/**
 * Unified helper to generate text via OpenRouter
 */
export async function generateContent(
  prompt: string,
  system?: string,
  modelName: string = DEFAULT_MODEL,
  timeoutMs: number = 60000,
  maxTokens: number = 2000,
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const provider = getProviderFromModel(modelName);
  const limiter = limiters[provider] || limiters.openrouter;
  const estimatedTokens =
    estimateTokens(prompt) + estimateTokens(system) + maxTokens;

  const release = await limiter.schedule(estimatedTokens);
  try {
    const { text } = await generateText({
      model: resolveModelProvider(modelName) as any,
      prompt,
      system,
      temperature: 0.2,
      maxOutputTokens: Math.min(maxTokens, OPENROUTER_MAX_TOKENS_CAP),
      providerOptions: {
        openrouter: {
          max_tokens: Math.min(maxTokens, OPENROUTER_MAX_TOKENS_CAP),
        },
      },
      abortSignal: controller.signal,
    });
    return text;
  } finally {
    release();
    clearTimeout(timeoutId);
  }
}
