import "dotenv/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Lazily-constructed server Supabase client.
 *
 * Previously this module ran `createClient(process.env.SUPABASE_URL!, ...)` at
 * import time. During `next build` page-data collection the env isn't populated,
 * so `createClient(undefined, undefined)` threw "supabaseUrl is required" — and
 * because this module is imported across the API routes, that failed the whole
 * production build/deployment. We now construct the client on first use (request
 * time, when the env is present) and cache it, via a Proxy so existing
 * `supabaseServer.storage...` call sites keep working unchanged.
 */
let cached: SupabaseClient | null = null;

function getSupabaseServer(): SupabaseClient {
  if (cached) return cached;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Supabase server env not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).",
    );
  }
  cached = createClient(supabaseUrl, supabaseKey);
  return cached;
}

export const supabaseServer: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getSupabaseServer();
    const value = Reflect.get(client as unknown as object, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
