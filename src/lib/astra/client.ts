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
