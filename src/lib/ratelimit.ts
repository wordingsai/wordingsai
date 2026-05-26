import "dotenv/config";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

// Create a Redis instance only if credentials are configured
export const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

// Create a Ratelimit instance only if Redis is available
export const ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "1m"), // 10 requests per 1 minute
      analytics: true,
      prefix: "@upstash/ratelimit",
    })
  : null;
