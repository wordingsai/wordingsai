/**
 * Barrel for the rule-engine service. Re-exports EVERY symbol that the original
 * monolithic src/services/rule-engine.ts exported, so all existing
 * `@/services/rule-engine` imports across the app keep working unchanged after
 * the module split. Behavior-preserving: this file adds no logic.
 */

// types.ts
export {
  sanitizeEvidenceItems,
  genAI,
} from "./types";
export type {
  RuleDefinition,
  RuleEvaluationResult,
  RuleEvidenceItem,
  KnownContractType,
  GetApplicableRulesOptions,
  SegmentedClause,
  ChecklistCandidate,
  ChecklistBatchPlan,
  AnalysisResult,
} from "./types";

// text-utils.ts
export {
  CHECKLIST_SEMANTIC_FLOOR,
  CHECKLIST_MATCHED_APPROVED_THRESHOLD,
  CHECKLIST_VARIATION_FLOOR,
  CHECKLIST_MATCH_MARGIN,
  fastChecklistStatusForSimilarity,
  stripLegalNoise,
  calibrateSimilarity,
  prepareEmbeddingText,
  headingMatchBoost,
  normalizeText,
  normalizeContractType,
  classifyContractType,
} from "./text-utils";

// embeddings.ts
export {
  getCachedEmbeddings,
  chunkAndEmbedContractVersion,
  retrieveRelevantContractChunks,
  waitForChunks,
} from "./embeddings";

// library-matching.ts
export {
  findClosestLibraryMatches,
  findClosestLibraryMatchesBatch,
  findWarExclusionMatches,
} from "./library-matching";

// document-map.ts
export {
  generateInitialStructure,
  findCoordinatesForSubstring,
} from "./document-map";

// segmentation.ts
export {
  SEGMENTATION_CHUNK_SIZE,
  SEGMENTATION_OVERLAP,
  splitTextForSegmentation,
  segmentSingleChunk,
  deduplicateSegments,
  segmentContractIntoClauses,
} from "./segmentation";

// checklist.ts
export {
  CHECKLIST_BATCH_SIZE,
  loadChecklistCandidates,
  clearChecklistStaging,
  prepareDocumentMapChecklist,
  runDocumentMapChecklistBatch,
  runDocumentMapChecklist,
  detectMandatoryClauses,
} from "./checklist";

// summary.ts
export {
  finalizeContractAnalysis,
  generateFastSummary,
} from "./summary";

// rules.ts
export {
  matchRuleToClauses,
  getApplicableRules,
  prepareContractForAnalysis,
  evaluateContractRules,
  processSingleRule,
  getAdvancedRuleSystemPrompt,
  getRuleSystemPrompt,
  prepareRuleEvaluationPayloads,
  evaluateRulePayloadWithOpenRouter,
  evaluateRuleWithOpenRouter,
  storeRuleResultWithMatches,
  buildStructuredEvidence,
  evaluateRuleAndStructureEvidence,
} from "./rules";
