import "dotenv/config";
import { Redis } from "@upstash/redis";
import "dotenv/config";
import { Ratelimit } from "@upstash/ratelimit";

// Create a new Redis instance
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Create a new Ratelimit instance
export const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1m"), // 10 requests per 1 minute
  analytics: true,
  prefix: "@upstash/ratelimit",
});
