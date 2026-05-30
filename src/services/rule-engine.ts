/**
 * Rule-engine service — barrel entry point.
 *
 * The implementation was split into cohesive modules under
 * `src/services/rule-engine/` (types, text-utils, embeddings, library-matching,
 * document-map, segmentation, checklist, summary, rules) during a
 * behavior-preserving modularization. This file re-exports the package barrel so
 * every existing `@/services/rule-engine` import across the app keeps working
 * unchanged.
 *
 * Add new code to the relevant module under `rule-engine/` and export it from
 * `rule-engine/index.ts`; do not reintroduce logic here.
 */
export * from "./rule-engine/index";
