import { setTimeout } from "node:timers/promises";

interface ResilienceOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  name?: string;
}

export class ResilienceError extends Error {
  constructor(
    public originalError: any,
    message: string,
  ) {
    super(message);
    this.name = "ResilienceError";
  }
}

/**
 * Executes a function with automatic retries for network issues and rate limits.
 * If network is down, it waits indefinitely until connectivity is restored.
 */
export async function withResilience<T>(
  fn: () => Promise<T>,
  options: ResilienceOptions = {},
): Promise<T> {
  const {
    maxRetries = 5,
    initialDelayMs = 1000,
    maxDelayMs = 12000,
    name = "Operation",
  } = options;

  let attempt = 0;
  let networkAttempt = 0;
  let delay = initialDelayMs;

  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      const statusCode =
        error.httpResponse?.status || error.status || error.statusCode;
      const errorCode = String(error.code || "");

      const isNetworkError =
        errorCode.includes("ENOTFOUND") ||
        errorCode.includes("ECONNRESET") ||
        errorCode.includes("ETIMEDOUT") ||
        errorCode.includes("EAI_AGAIN") ||
        error.message?.toLowerCase().includes("fetch failed");

      const isRateLimit = statusCode === 429;
      const isServiceUnavailable = statusCode === 503 || statusCode === 504;

      if (isNetworkError) {
        networkAttempt++;
        if (networkAttempt > 15) {
          throw new ResilienceError(
            error,
            `Max network retries (15) reached for ${name}`,
          );
        }
        console.warn(
          `[${name}] 📡 Network connection lost (Attempt ${networkAttempt}/15). Waiting for restoration...`,
        );
        // Wait longer when network is down to avoid spamming
        await setTimeout(10000);
        continue;
      }

      attempt++;

      if (isRateLimit || isServiceUnavailable) {
        const type = isRateLimit
          ? "Quota Exceeded (429)"
          : "Service Busy (503/504)";
        console.warn(
          `[${name}] ⏳ ${type}. Attempt ${attempt}. Retrying in ${delay}ms...`,
        );

        await setTimeout(delay);
        // Exponential backoff
        delay = Math.min(delay * 2, maxDelayMs);
        continue;
      }

      // If we reached max retries for non-network errors, give up
      if (attempt >= maxRetries) {
        throw new ResilienceError(
          error,
          `Max retries (${maxRetries}) reached for ${name}`,
        );
      }

      console.error(
        `[${name}] ❌ Unexpected error. Attempt ${attempt}/${maxRetries}.`,
        error.message || error,
      );
      await setTimeout(delay);
      delay = Math.min(delay * 2, maxDelayMs);
    }
  }
}
