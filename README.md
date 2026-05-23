# WordingsAI

Contract vetting platform for insurance and reinsurance teams. WordingsAI extracts structure from uploaded agreements, aligns each section against your clause library, and evaluates organization rules with traceable evidence.

## Capabilities

| Area                   | Description                                                                   |
| ---------------------- | ----------------------------------------------------------------------------- |
| **Contract intake**    | PDF upload, GCP Document AI extraction, version history                       |
| **Document map**       | Hierarchical outline (articles, sections, subsections) from the contract text |
| **Clause library**     | Organization and global clauses with semantic search (Astra DB)               |
| **Analysis checklist** | One checklist row per map heading, matched to library standards               |
| **Rule engine**        | Configurable rules with Green / Amber / Red outcomes and evidence             |
| **Plans**              | Fast (checklist only), Basic (+ rules), Plus (+ semantic intelligence)        |

## Stack

- **Application**: Next.js 16 (App Router), React 19, Tailwind CSS 4
- **Database**: PostgreSQL on Neon (relational data, analysis state)
- **Vectors**: DataStax Astra DB with NVIDIA vectorize (`clause_chunks`, `contract_chunks`, `war_exclusions`, `ai_generations`)
- **Files**: Supabase Storage (contract PDFs)
- **Jobs**: Inngest (analysis pipeline, per-step Vercel 60s limits)
- **Auth**: Better Auth with organizations, Stripe billing
- **AI**: Google Vertex / Gemini, OpenRouter fallbacks (routing in `src/lib/ai-router.ts`)

## Documentation

| Document                                               | Purpose                                               |
| ------------------------------------------------------ | ----------------------------------------------------- |
| [docs/architecture.md](docs/architecture.md)           | System design, data stores, pipeline stages           |
| [docs/analysis-pipeline.md](docs/analysis-pipeline.md) | Fast vs deep analysis, Inngest steps, client workflow |
| [docs/deployment.md](docs/deployment.md)               | Vercel, env vars, Inngest, production checklist       |
| [docs/astra-db.md](docs/astra-db.md)                   | Vector collections and migration commands             |
| [docs/client-handoff.md](docs/client-handoff.md)       | Acceptance criteria and demo script for stakeholders  |
| [docs/operations.md](docs/operations.md)               | Quota usage, polling, and cost controls               |

## Quick start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Neon PostgreSQL database
- Supabase project (storage)
- Inngest account (or dev server locally)
- Astra DB (optional but recommended for semantic search)

### Install

```bash
pnpm install
cp .env.example .env
# Edit .env with your keys (see docs/deployment.md)
pnpm db:push
```

### Run locally

Terminal 1 — application:

```bash
pnpm dev
```

Terminal 2 — background jobs:

```bash
npx inngest-cli@latest dev
```

Open `http://localhost:3000`, sign in, upload a contract, and open the contract analysis page.

### Re-queue analysis for a contract

```bash
pnpm analysis:rerun <contract-id>
```

Default contract ID in the script matches the staging contract used during delivery (`c058f8bd-0d36-41e0-9081-40190bf3932b`). Override with your own UUID.

## Scripts

| Command                     | Description                            |
| --------------------------- | -------------------------------------- |
| `pnpm dev`                  | Next.js development server             |
| `pnpm build`                | Production build                       |
| `pnpm test`                 | Vitest unit tests                      |
| `pnpm db:push`              | Apply Drizzle schema to Neon           |
| `pnpm analysis:rerun`       | Send `contract/evaluate` Inngest event |
| `pnpm astra:import-clauses` | Import clause library vectors to Astra |
| `pnpm astra:migrate-war`    | Migrate war exclusions to Astra        |

## Repository layout

```
src/
  app/              # Routes (protected app, API, Inngest webhook)
  components/       # UI (contracts, checklist, document map)
  db/               # Drizzle schema
  inngest/          # Analysis coordinator and workers
  lib/              # Astra client, AI router, auth
  services/         # Rule engine, clause matching
admin/              # Platform super-admin portal
docs/               # Technical and handoff documentation
scripts/            # Migrations and operational utilities
```

## Admin portal

The `admin/` app manages global clauses, global rules, and platform users. Run from that directory with `pnpm dev` (separate port from the main app).

## License

Proprietary. All rights reserved by the project owner unless otherwise agreed in writing.
