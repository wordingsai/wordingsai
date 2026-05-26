import { getAstraCredentials, isAstraVectorEnabled } from "./config";

type DataAPIClient = import("@datastax/astra-db-ts").DataAPIClient;
type Db = ReturnType<DataAPIClient["db"]>;
type Collection = ReturnType<Db["collection"]>;

let clientPromise: Promise<DataAPIClient> | null = null;

/** Fixes common copy-paste typo (.om → .com). */
export function normalizeAstraEndpoint(endpoint: string): string {
  const trimmed = endpoint.trim();
  if (trimmed.endsWith(".astra.datastax.om")) {
    console.warn(
      "[Astra] ASTRA_DB_API_ENDPOINT ends with .om — auto-correcting to .com",
    );
    return trimmed.replace(/\.astra\.datastax\.om$/i, ".astra.datastax.com");
  }
  return trimmed;
}

async function loadClient(): Promise<DataAPIClient> {
  const creds = getAstraCredentials();
  if (!creds) {
    throw new Error(
      "Astra DB is not configured. Set ASTRA_DB_APPLICATION_TOKEN and ASTRA_DB_API_ENDPOINT.",
    );
  }
  const { DataAPIClient } = await import("@datastax/astra-db-ts");
  // v2 SDK: token on client or db(); endpoint only on db(), not client options.
  return new DataAPIClient(creds.token);
}

export async function getAstraClient(): Promise<DataAPIClient> {
  if (!isAstraVectorEnabled()) {
    throw new Error("Astra vector store is disabled (USE_ASTRA_VECTOR).");
  }
  if (!clientPromise) {
    clientPromise = loadClient();
  }
  return clientPromise;
}

export async function getAstraDb(): Promise<Db> {
  const creds = getAstraCredentials();
  if (!creds) {
    throw new Error("Astra credentials missing.");
  }
  const client = await getAstraClient();
  const endpoint = normalizeAstraEndpoint(creds.endpoint);
  return client.db(endpoint, { token: creds.token });
}

const collectionCache = new Map<string, Promise<Collection>>();

export async function getAstraCollection(
  collectionName: string,
): Promise<Collection> {
  let pending = collectionCache.get(collectionName);
  if (!pending) {
    pending = (async () => {
      const db = await getAstraDb();
      return db.collection(collectionName);
    })();
    collectionCache.set(collectionName, pending);
  }
  return pending;
}

/**
 * Astra DB Free tier hibernates after inactivity. The first request after wake
 * returns HTTP 400 with "resuming from hibernation" and the DB becomes
 * available within ~30s. This wrapper retries hibernation errors with
 * exponential backoff so callers don't have to think about it.
 */
const HIBERNATION_PATTERNS = [
  /resuming from hibernation/i,
  /database is being initialized/i,
  /will be available in the next few minutes/i,
];

function isHibernationError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return HIBERNATION_PATTERNS.some((re) => re.test(msg));
}

export async function withAstraRetry<T>(
  op: () => Promise<T>,
  {
    maxAttempts = 6,
    initialDelayMs = 3_000,
    maxDelayMs = 20_000,
    label = "astra-op",
  }: {
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    label?: string;
  } = {},
): Promise<T> {
  let lastErr: unknown;
  let delay = initialDelayMs;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await op();
    } catch (err) {
      lastErr = err;
      if (!isHibernationError(err) || attempt === maxAttempts) {
        throw err;
      }
      console.warn(
        `[Astra] ${label} hit hibernation (attempt ${attempt}/${maxAttempts}); waiting ${delay}ms before retry`,
      );
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * 2, maxDelayMs);
    }
  }
  throw lastErr;
}
