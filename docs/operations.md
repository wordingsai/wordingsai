# Operations and quota controls

## Design principles

1. **Neon** — Relational data and analysis state only; avoid storing embeddings when Astra is enabled.
2. **Astra** — All semantic search and `$vectorize` calls; batch where possible.
3. **Supabase** — File storage only; no repeated downloads during analysis if `file_content` is cached in Neon.

## Implemented optimizations

| Area              | Behavior                                                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Checklist batches | Candidates staged once in `contracts.analysis.checklistStaging`; each batch reads staging instead of rebuilding the map (~30 fewer heavy reads). |
| Staging cleanup   | `checklistStaging` removed after checklist completes to limit JSONB size.                                                                        |
| UI polling        | `?polling=true` skips rule joins and full `analysis_results`; checklist API not called on poll ticks.                                            |
| Poll interval     | 5s during fast analysis, 8s during deep rules.                                                                                                   |
| Astra             | `ASTRA_SKIP_NEON_CHUNK_MIRROR=true` avoids dual-writing clause chunks to Neon.                                                                   |
| Clause embed      | New clauses embed to Astra only when vector mode is on.                                                                                          |

## Environment tuning

```env
USE_ASTRA_VECTOR=true
ASTRA_SKIP_NEON_CHUNK_MIRROR=true
ASTRA_VECTORIZE_MAX_CHARS=720
```

## Neon

- Use connection pooling (Neon pooler URL) in serverless.
- Avoid `select *` on large JSONB during polling.
- Index foreign keys used in `rule_results` and `analysis_events` (Drizzle migrations).

## Astra

- Import clause library once per environment: `pnpm astra:import-clauses`
- Contract chunks: migrate when using contract RAG: `pnpm astra:migrate-contracts`
- War exclusions: `pnpm astra:migrate-war`

## Supabase

- OCR path reads `file_url` once per analysis; extracted text stored in `contracts.file_content` for reuse.
- Re-analysis with `force: true` skips OCR when `file_content` is already populated.

## Monitoring

Watch for:

- Inngest step failures (`checklist-batch-*`, `document-map-ai-window-*`)
- `total_rules = 0` after prepare step (indicates no active rules or missing rule versions)
- Checklist count mismatch warnings in logs

## Manual operations

```bash
# Re-queue full analysis
pnpm analysis:rerun <contract-id>

# Typecheck before release
pnpm exec tsc --noEmit
```
