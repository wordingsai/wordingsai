# Deployment

## Production (Vercel)

1. Connect the GitHub repository to Vercel.
2. Set environment variables (Production and Preview) from `.env.example`.
3. Set **Function max duration** to 60 seconds for `/api/inngest`.
4. Register Inngest app with production signing key and event key.
5. Point `BETTER_AUTH_URL` to the production domain.
6. Run `pnpm db:push` against production Neon before first deploy.

### Required environment variables

| Variable                               | Purpose                          |
| -------------------------------------- | -------------------------------- |
| `DATABASE_URL`                         | Neon PostgreSQL                  |
| `BETTER_AUTH_SECRET`                   | Auth encryption                  |
| `BETTER_AUTH_URL`                      | Public app URL                   |
| `INNGEST_EVENT_KEY`                    | Send events                      |
| `INNGEST_SIGNING_KEY`                  | Verify Inngest requests          |
| `GEMINI_API_KEY` or Vertex credentials | AI models                        |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY`  | File storage                     |
| `USE_ASTRA_VECTOR`                     | `true` for Astra semantic search |
| `ASTRA_DB_APPLICATION_TOKEN`           | Astra API token                  |
| `ASTRA_DB_API_ENDPOINT`                | Must end with `.com`             |
| `STRIPE_*`                             | Billing (if enabled)             |
| `RESEND_API_KEY`                       | Transactional email              |

See [astra-db.md](./astra-db.md) for vector migration commands.

## Inngest

Production: install the Inngest Vercel integration or configure webhook URL to `https://<domain>/api/inngest`.

Local:

```bash
npx inngest-cli@latest dev
```

Registered functions (see `src/app/api/inngest/route.ts`):

- `evaluate-contract-rules`
- `main-analysis`
- `evaluate-rule-worker`
- `finalize-analysis-collector`
- `fast-analysis`, `cleanup-bin`, clause sync

## Post-deploy verification

1. Sign in and upload a test PDF.
2. Confirm progress reaches **Fast Analysis Complete** and checklist count matches map headings.
3. Run rules evaluation; confirm `total_rules > 0` in Neon `contracts` row.
4. Confirm clause library search returns matches (Astra `clause_chunks` populated).

## Re-run analysis on staging

```bash
pnpm analysis:rerun c058f8bd-0d36-41e0-9081-40190bf3932b
```

Requires `INNGEST_EVENT_KEY` (or local Inngest dev server).
