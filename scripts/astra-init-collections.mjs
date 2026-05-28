// One-shot: create the 4 Astra collections the pipeline expects.
// Idempotent — skips collections that already exist.
//
// Usage: node scripts/astra-init-collections.mjs

const TOKEN = process.env.ASTRA_DB_APPLICATION_TOKEN;
const ENDPOINT = process.env.ASTRA_DB_API_ENDPOINT;

if (!TOKEN || !ENDPOINT) {
  console.error(
    "Missing env vars. Set ASTRA_DB_APPLICATION_TOKEN and ASTRA_DB_API_ENDPOINT.",
  );
  console.error(
    "  PowerShell:  $env:ASTRA_DB_APPLICATION_TOKEN='AstraCS:...'; $env:ASTRA_DB_API_ENDPOINT='https://...'",
  );
  console.error(
    "  bash:        export ASTRA_DB_APPLICATION_TOKEN='AstraCS:...' ASTRA_DB_API_ENDPOINT='https://...'",
  );
  process.exit(1);
}

// NVIDIA NV-Embed-QA via Astra Vectorize, 1024 dims, cosine
// Matches NVIDIA_VECTORIZE_TOKEN_LIMIT = 512 cap in chunking.ts
const COLLECTIONS = [
  "clause_chunks",
  "contract_chunks",
  "ai_generations",
  "war_exclusions",
];

const KEYSPACE = "default_keyspace";
const API_BASE = `${ENDPOINT}/api/json/v1/${KEYSPACE}`;

async function listCollections() {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "Token": TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({ findCollections: {} }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.status?.collections ?? [];
}

async function createCollection(name) {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "Token": TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({
      createCollection: {
        name,
        options: {
          vector: {
            dimension: 1024,
            metric: "cosine",
            service: {
              provider: "nvidia",
              modelName: "NV-Embed-QA",
            },
          },
        },
      },
    }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(`[${name}] ${JSON.stringify(json.errors)}`);
  return json.status;
}

async function main() {
  console.log(`Astra endpoint: ${ENDPOINT}`);
  console.log(`Keyspace: ${KEYSPACE}`);

  const existing = await listCollections();
  console.log(`Existing collections: ${existing.length ? existing.join(", ") : "(none)"}`);

  for (const name of COLLECTIONS) {
    if (existing.includes(name)) {
      console.log(`  [skip] ${name} already exists`);
      continue;
    }
    process.stdout.write(`  [create] ${name}... `);
    try {
      await createCollection(name);
      console.log("ok");
    } catch (e) {
      console.log(`FAIL: ${e.message}`);
    }
  }

  const after = await listCollections();
  console.log(`\nFinal state: ${after.join(", ")}`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
