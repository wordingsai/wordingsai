import { Resend } from "resend";

/**
 * Lazily-constructed Resend client.
 *
 * `new Resend(undefined)` throws "Missing API key" at construction. When that
 * ran at module scope it crashed `next build` page-data collection (the env
 * isn't populated then) and, because the email-sending modules are imported by
 * several API routes, failed the whole production deployment. Construct on first
 * send instead (request time, when RESEND_API_KEY is present) and cache it.
 */
let cached: Resend | null = null;

export function getResend(): Resend {
  if (cached) return cached;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error("RESEND_API_KEY is not configured.");
  }
  cached = new Resend(key);
  return cached;
}
