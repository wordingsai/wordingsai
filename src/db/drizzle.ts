import "dotenv/config";
import { neonConfig, Pool as NeonPool } from "@neondatabase/serverless";
import { drizzle as neonDrizzle } from "drizzle-orm/neon-serverless";
import pg from "pg";
import { drizzle as nodeDrizzle } from "drizzle-orm/node-postgres";
import ws from "ws";
import { schema } from "./schema";

const connectionString = process.env.DATABASE_URL ?? "";
// Guard against an empty/undefined DATABASE_URL at module-load time. During
// `next build` page-data collection the env isn't populated, and calling
// `.includes` on `undefined` would throw and fail the whole build (it surfaced
// as "Cannot read properties of undefined (reading 'includes')" on whichever
// API route a build worker happened to collect first). When the URL is absent
// we default to the Neon (non-local) driver; real queries only run at request
// time when DATABASE_URL is present.
const isLocal =
  connectionString.length > 0 &&
  (connectionString.includes("localhost") ||
    connectionString.includes("127.0.0.1") ||
    !connectionString.includes("neon.tech"));

const globalForDb = global as unknown as {
  pool: any | undefined;
};

let pool: any;

if (isLocal) {
  pool =
    globalForDb.pool ??
    new pg.Pool({
      connectionString,
    });
} else {
  // Set WebSocket constructor for the serverless pooler
  neonConfig.webSocketConstructor = ws;
  pool =
    globalForDb.pool ??
    new NeonPool({
      connectionString,
    });
}

if (!globalForDb.pool) {
  globalForDb.pool = pool;

  // Add error handling to prevent "Connection terminated unexpectedly" from crashing the process
  pool.on("error", (err: Error) => {
    console.error("[Postgres Pool Error]", err);
  });
}

export const db = isLocal
  ? nodeDrizzle(pool, { schema })
  : neonDrizzle(pool as NeonPool, { schema });
