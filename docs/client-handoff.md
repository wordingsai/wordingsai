# Client handoff guide

This document describes what to verify before release of escrow and repository transfer. It matches the delivery scope: clause library alignment, connected analysis pages, and operational rule evaluation.

## Acceptance criteria

### 1. Clause library alignment

- [ ] Document **map** shows a clear contract outline (section and subsection headings).
- [ ] **Foundational checklist** row count matches map headings (display shows `N / N map headings`).
- [ ] Each checklist row shows contract text vs library standard with Matched / Custom / Unidentified status.
- [ ] Semantic matches use the organization clause library (Astra `clause_chunks` imported).

### 2. Analysis pages connected

- [ ] **Summary** tab: risk summary, checklist, detail drawer when a row is selected.
- [ ] **Document map** tab: outline + provision preview; selecting a heading highlights context.
- [ ] **Rules evaluation** tab: available on Basic/Plus; runs after fast analysis via **Run rules evaluation**.
- [ ] **Plus analysis** tab: available on Plus plan after rules complete.
- [ ] Cross-link: checklist → map via search / map to document.

### 3. Rule evaluation

- [ ] `contracts.total_rules` reflects active rules in the organization (not zero).
- [ ] Rule results appear in **Rules evaluation** with evidence and status.
- [ ] Re-evaluate rules works without re-running OCR.

### 4. Repository and operations

- [ ] README and `docs/` describe setup, pipeline, and deployment.
- [ ] `.env.example` lists required variables (no secrets committed).
- [ ] Production deployed on Vercel with Inngest connected.

## Demo script (15 minutes)

1. Log in as organization admin.
2. Open the reference contract (or upload a reinsurance slip PDF).
3. Run analysis; wait for **Fast Analysis Complete** (~2–5 minutes depending on length).
4. Walk through **Document map** — point out section hierarchy.
5. Open **Summary** — filter Matched / Custom; open one row and compare contract vs library text.
6. Go to **Rules evaluation** → **Run rules evaluation**; show progress and results.
7. Optional: open **Plus analysis** on Plus plan.

## Plans

| Plan  | Fast analysis (map + checklist) | Rules evaluation | Plus insights |
| ----- | ------------------------------- | ---------------- | ------------- |
| Fast  | Yes                             | Locked           | Locked        |
| Basic | Yes                             | Yes              | Locked        |
| Plus  | Yes                             | Yes              | Yes           |

## Support contacts

Document your support channel and escalation path here before handoff.

## Known operational limits

- Vercel Hobby: 60 seconds per serverless invocation; long work is split across Inngest steps.
- Astra vectorize: ~512 tokens per embed request; chunks are split accordingly.
- Neon: polling uses lightweight queries; full rule payloads load only on full page refresh.

Details: [operations.md](./operations.md).
