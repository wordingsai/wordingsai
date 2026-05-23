# Analysis pipeline

## Triggering analysis

| Method                 | Event                                                               | Mode                                             |
| ---------------------- | ------------------------------------------------------------------- | ------------------------------------------------ |
| Upload contract        | `contract/evaluate`                                                 | `full` for Basic/Plus orgs, `fast` for Fast plan |
| Contract page → Re-run | `POST /api/contracts/:id` `{ action: "run-analysis", force: true }` | `full`                                           |
| Rules only             | `POST /api/contracts/:id/evaluate-rules`                            | `rules-only`                                     |
| CLI                    | `pnpm analysis:rerun <contractId>`                                  | `full`, `force: true`                            |

## Full pipeline (coordinator)

Inngest function: `evaluate-contract-rules` (`contract/evaluate`).

1. **initialize-status** — `contract_status = reviewing`, progress 5%
2. **process-ocr** — GCP extraction if needed; heuristic or GCP structure → `structured_content`
3. **document-map-baseline** — Reuse quality map or build heuristic baseline
4. **document-map-ai-window-N** — Up to 8 AI windows (one step each, 48s timeout)
5. **document-map-merge-save** — Merge windows, persist map, optional Astra `structured_content`
6. **generate-summary** — Fast executive summary → `analysis` JSON + Astra `fast_summary`
7. **checklist-prepare** — Build candidates, clear old checklist events, stage candidates in Neon once
8. **checklist-batch-0 … N** — Semantic match vs clause library (Astra), insert `analysis_events`
9. **checklist-complete** — Verify count vs map headings, clear staging, `fast_complete`, progress 100%
10. **Rules** — Not auto-started; user runs **Evaluate rules** separately

## Rules pipeline

Inngest function: `main-analysis` (`contract/analyze.main`).

1. **prepare-analysis-ids** — `evaluateAllActive: true` loads all active org + global rules with versions; sets `total_rules`
2. **fan-out-rules** — Sends `contract/rule.evaluate` per rule (batches of 50)
3. **evaluate-rule-worker** — RAG + LLM per rule, writes `rule_results`
4. **finalize-analysis-collector** — When `count(rule_results) >= total_rules`, runs synthesis and marks complete

### Why `total_rules` was zero (fixed)

Previously `prepareContractForAnalysis(contractId, true)` filtered rules by checklist clause names. Headings rarely matched rule metadata, so **zero rules** were queued.

Current behavior: `evaluateAllActive: true`, `filterByDetection: false` for deep evaluation.

## Checklist vs document map

Checklist items are built from the same headings as the document map outline:

- One row per **section** heading (non-fallback)
- One row per **subsection** heading

The UI shows `checklist count / map headings` (e.g. `42 / 42 map headings`). Mismatch is logged server-side.

## Client workflow (recommended)

1. Upload contract and wait for **Fast Analysis Complete**.
2. Review **Document map** (outline) and **Summary** checklist (library alignment).
3. Open **Rules Evaluation** → **Run rules evaluation** when satisfied with fast results.
4. Review Green / Amber / Red rule outcomes and evidence.

## Failure recovery

- Vercel 60s timeout: checklist uses per-batch steps; re-run with `force: true`.
- Stalled progress: UI watchdog may auto-retry; manual **Re-run analysis** on contract page.
- Inngest dev: must be running locally for jobs to execute.
