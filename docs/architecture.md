# Architecture

## Overview

WordingsAI is a multi-tenant SaaS application. Each **organization** owns contracts, clauses, and rules. **Workspaces** scope library content (reinsurance, property, general). Analysis runs asynchronously so the web UI stays responsive on Vercel Hobby (60 second function limit per request).

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Browser   │────▶│  Next.js API │────▶│  Neon Postgres  │
│  (React)    │     │  + Inngest   │     │  (relational)   │
└─────────────┘     └──────┬───────┘     └─────────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌────────────┐
        │ Inngest  │ │ Supabase │ │  Astra DB  │
        │ workers  │ │  Storage │ │  (vectors) │
        └──────────┘ └──────────┘ └────────────┘
```

## Data stores

### Neon PostgreSQL

Source of truth for:

- Users, sessions, organizations, billing (Better Auth + Stripe)
- Contracts, versions, `structured_content` (document map JSON)
- Clause and rule definitions, `rule_results`, `analysis_events`
- Checklist rows (`analysis_events` with `event_type = clause_detected`)

Vectors in Postgres (`clause_chunks`, `contract_chunks`) are legacy. When `USE_ASTRA_VECTOR=true`, embeddings are not written to Neon for new data.

### Astra DB

Semantic search via `$vectorize` on document `content` (NVIDIA 1024-dim, ~512 token limit per request). Collections:

| Collection        | Contents                                            |
| ----------------- | --------------------------------------------------- |
| `clause_chunks`   | Clause library (split ~720 chars per chunk)         |
| `contract_chunks` | Contract text chunks for rule RAG                   |
| `war_exclusions`  | War exclusion library                               |
| `ai_generations`  | Large AI payloads (summaries, structured map cache) |

### Supabase Storage

Contract PDFs and derived assets. URLs stored on `contracts.file_url`. Upload and signed access go through `src/lib/supabase/`.

## Analysis stages

| Stage            | `analysis_stage`      | User-visible outcome             |
| ---------------- | --------------------- | -------------------------------- |
| OCR + map        | `ocr` → mapping steps | Text + document map              |
| Summary          | (in pipeline)         | Executive summary on Summary tab |
| Checklist        | checklist batches     | Library alignment per heading    |
| Fast complete    | `fast_complete`       | Map + checklist at 100% progress |
| Rules (optional) | `deep`                | Rules Evaluation tab             |
| Done             | `completed`           | All requested work finished      |

Fast analysis completes before rules run. Rules are started manually from **Rules Evaluation** or the recommendations flow.

## Key modules

| Path                              | Responsibility                                                              |
| --------------------------------- | --------------------------------------------------------------------------- |
| `src/inngest/functions.ts`        | Coordinator: OCR, map, summary, checklist batches, handoff to deep analysis |
| `src/services/rule-engine.ts`     | Checklist matching, rule evaluation, Astra/Neon vector queries              |
| `src/lib/contract-structuring.ts` | Heuristic + AI document map, heading counts                                 |
| `src/lib/astra/`                  | Astra client, chunking, vector store                                        |
| `src/lib/ai-router.ts`            | Model selection, timeouts, plan tiers                                       |

## Security model

- Session cookies via Better Auth (`nextCookies` plugin must be last in the plugin list).
- API routes check `activeOrganizationId` and contract ownership.
- Inngest functions receive `organizationId` in event payload for concurrency limits.

## Scalability notes

- Checklist: one Inngest step per batch (5 headings) to respect Vercel 60s limit.
- Checklist staging: candidates written once to `contracts.analysis.checklistStaging`, then read per batch (avoids 30+ full map rebuilds).
- UI polling: lightweight `?polling=true` contract GET (no rule joins, no checklist refetch every 5–8s).
