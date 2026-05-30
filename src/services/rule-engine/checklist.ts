/**
 * Foundational checklist: document-map -> candidate provisions, MRC noise
 * filtering, Task #25 "(As attached)" by-name pull-through and two-column
 * de-fragmentation, code/name library resolution, batch matching, and the
 * legacy neural-scan detector. Extracted verbatim from the original
 * src/services/rule-engine.ts during modularization (only the moved type and
 * cross-module imports differ; logic is unchanged).
 */
import { db } from "@/db/drizzle";
import { eq, and, or, sql } from "drizzle-orm";
import { contracts, clauses, analysisEvents, workspaces } from "@/db/schema";
import {
  type StructuredContract,
  countDocumentMapHeadings,
  isFallbackSectionHeading,
  isQualityStructuredMap,
  sanitizeStructuredMap,
  structureTextHeuristically,
} from "@/lib/contract-structuring";
import {
  CHECKLIST_SEMANTIC_FLOOR,
  CHECKLIST_MATCHED_APPROVED_THRESHOLD,
  CHECKLIST_VARIATION_FLOOR,
  CHECKLIST_MATCH_MARGIN,
  fastChecklistStatusForSimilarity,
  prepareEmbeddingText,
} from "./text-utils";
import type {
  ChecklistCandidate,
  ChecklistBatchPlan,
  AnalysisResult,
} from "./types";
import { findClosestLibraryMatchesBatch } from "./library-matching";
import { splitTextForSegmentation } from "./segmentation";

/** Batches per Inngest step (each step must finish within Vercel 60s). */
export const CHECKLIST_BATCH_SIZE = 5;

/**
 * MRC slips open with an administrative header block — client / reinsured
 * names, broker references, dates — laid out as field:value rows. Those are
 * not contract provisions, so they must not enter the clause checklist (they
 * still appear in the document map). Without this filter they get force-matched
 * to the nearest library clause at low similarity, producing noise such as
 * "CLIENT SHORTNAME ≈ Extra contractual obligations clause".
 *
 * Deliberately conservative: it targets recognised administrative field labels
 * and generic container headings only, so real provisions (Reinsuring Clause,
 * Premium, Exclusions, Governing Law, named LSW/NMA clauses, …) are kept.
 */
const NON_CLAUSE_HEADINGS = new Set([
  "introduction",
  "contract details",
  "risk details",
  "client information",
  "agreement information",
  "contract administration",
  "agreement number",
  "order hereon",
  "unique market reference",
  "umr",
]);

/**
 * Normalized comparison key for a heading: lowercased, punctuation stripped,
 * whitespace collapsed. Used to dedupe running headers and to compare a
 * reference row against an existing candidate / library clause name.
 */
function normalizeHeadingKey(heading: string): string {
  return (heading || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Library clause codes that, when present, mark a heading as a real provision. */
const CLAUSE_CODE_IN_HEADING =
  /\b(?:LSW|LMA|NMA|JELC|JCC|JC|LPO|IUA|NMR|MAP|CL)\s?\d{2,4}[A-Z]?\b/i;
/** High-confidence structural heading (ARTICLE 3, SECTION II, PART 1, …). */
const STRUCTURAL_HEADING =
  /^(?:article|section|part|schedule|appendix|annex(?:ure)?|exhibit|endorsement)\s+(?:[ivxlcdm]+|\d+)/i;

/**
 * A heading we must NEVER drop as noise: an explicit structural heading or a
 * heading carrying a real library code. Guards the noise filters below so a
 * genuine provision (e.g. "ARTICLE 5 - PREMIUM CLAUSE", "Interest Clause
 * (LSW 300)") is always kept even if it also looks numbered/short.
 */
function isProtectedClauseHeading(headingRaw: string): boolean {
  const h = headingRaw.trim();
  return STRUCTURAL_HEADING.test(h) || CLAUSE_CODE_IN_HEADING.test(h);
}

/** Currency/number-only line: "USD 27,100,000.", "2,900,000", "50%". */
const MONEY_OR_NUMBER_ONLY =
  /^(?:usd|gbp|eur|aud|cad|chf|jpy|sgd|hkd)?\s*[\d][\d,]*(?:\.\d+)?\s*%?\.?$/i;
/** Pure numeric / roman-numeral / punctuation line (no letters of substance). */
const NUMERIC_ONLY_LINE = /^[\dIVXLCDM.,()%\-\s]+$/i;
/** Leading enumerator of a list item: "1. ", "12) ", "(3) ". */
const LIST_ITEM_PREFIX = /^\(?\d{1,3}[.)]\s+\S/;
/** Sentence-like words that mark a numbered line as prose, not a heading. */
const SENTENCE_LIKE =
  /\b(?:shall|will|agrees?|hereby|means|includes?|being|other than|cover(?:s|ing)?|which|that|where|including)\b/i;

/**
 * Decides whether a document-map heading is administrative/noise rather than a
 * real contract provision. Builds on the original MRC field-label filter and
 * adds (Task #25) three precision filters that only fire for clearly non-clause
 * lines, always deferring to {@link isProtectedClauseHeading}:
 *   - running headers/footers (a line repeated >3× across the document, passed
 *     in `runningHeaderKeys`) — e.g. "UMR B080118299H22" appearing on every page;
 *   - money / pure-number lines — e.g. "USD 27,100,000.";
 *   - mid-clause numbered list items — e.g. "1. Policies underwritten by the
 *     Reinsured which specifically cover only…" (numbered AND long/sentence-like).
 * A bare "1. Definitions" style numbered heading is short and non-sentencey, so
 * it is kept.
 */
function isNonClauseHeading(
  headingRaw: string,
  runningHeaderKeys?: Set<string>,
): boolean {
  const raw = headingRaw.trim();
  const h = raw
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/:+$/, "");
  if (!h) return true;
  if (NON_CLAUSE_HEADINGS.has(h)) return true;
  // Field labels: "<party> SHORTNAME/LONGNAME", references, dates.
  if (/\b(short ?name|long ?name)$/.test(h)) return true;
  if (/^(previous |client |reinsured |broker |cedant |cedent )?ref\.?(\s*\/\s*contact)?$/.test(h))
    return true;
  if (/(^|\b)(contract )?document date$/.test(h)) return true;
  if (/^(client|reinsured|cedant|cedent|broker|insured) (name|number|code|contact)$/.test(h))
    return true;

  // Real provisions are exempt from the heuristic noise filters below.
  if (isProtectedClauseHeading(raw)) return false;

  // Running header/footer repeated across the document.
  if (runningHeaderKeys && runningHeaderKeys.size > 0) {
    const key = normalizeHeadingKey(raw);
    if (key && runningHeaderKeys.has(key)) return true;
  }

  // Money / pure-number / numeric-only lines.
  const stripped = raw.replace(/\.+$/, "");
  if (MONEY_OR_NUMBER_ONLY.test(stripped) || NUMERIC_ONLY_LINE.test(stripped))
    return true;

  // Mid-clause numbered list item (numbered AND long or sentence-like).
  if (LIST_ITEM_PREFIX.test(raw)) {
    const wordCount = raw.split(/\s+/).length;
    if (wordCount > 6 || SENTENCE_LIKE.test(raw)) return true;
  }

  return false;
}

/**
 * Builds the set of normalized lines that repeat more than three times across
 * the raw document text — running headers/footers such as the page-level UMR
 * reference. Only short lines (≤60 chars) are considered so we never flag a
 * legitimately repeated clause body. Passed to {@link isNonClauseHeading}.
 */
function buildRunningHeaderKeys(text: string): Set<string> {
  const counts = new Map<string, number>();
  for (const line of (text || "").split("\n")) {
    const key = normalizeHeadingKey(line);
    if (key && key.length <= 60) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const running = new Set<string>();
  for (const [key, n] of counts) {
    if (n > 3) running.add(key);
  }
  return running;
}

/**
 * Trailing connector words that mark a short ALL-CAPS heading as the first half
 * of a two-column wrapped label (e.g. "LIMITS AND", "CLASS OF", "MODE OF").
 */
const FRAGMENT_TAIL_WORD =
  /\b(AND|OR|OF|BY|TO|THE|FOR|WITH|FROM|PAYABLE|ADMINISTERED|IN)$/;

/**
 * De-fragments a two-column wrapped heading. When the heading is a short
 * ALL-CAPS fragment ending in a connector word and its body begins with the
 * continuation label (e.g. heading "LIMITS AND" + body "RETENTIONS: USD …"),
 * returns the joined heading "LIMITS AND RETENTIONS". Otherwise returns the
 * heading unchanged. Body text is never modified.
 */
function defragmentHeading(heading: string, body: string): string {
  const h = heading.trim();
  if (h.length > 40) return heading;
  if (!/^[A-Z0-9][A-Z0-9\s/&\-]*$/.test(h)) return heading;
  if (!FRAGMENT_TAIL_WORD.test(h)) return heading;

  const b = body.trim();
  const headingKey = normalizeHeadingKey(h);

  // A valid continuation is a clean ALL-CAPS label that does NOT merely repeat
  // the heading and is not OCR garble. Returns the joined heading or null.
  const tryJoin = (rawCont: string): string | null => {
    const cont = rawCont.trim();
    if (!cont) return null;
    // Clean caps words only (allow & / -); reject if it contains lowercase/digits
    // garble like "REINSURERtSf".
    if (!/^[A-Z][A-Z&/\- ]*[A-Z]$/.test(cont)) return null;
    const contKey = normalizeHeadingKey(cont);
    if (!contKey) return null;
    // Don't echo the heading back (e.g. "TAXES PAYABLE" + "TAXES PAYABLE").
    if (contKey === headingKey) return null;
    if (headingKey.startsWith(contKey) || contKey.startsWith(headingKey))
      return null;
    return `${h} ${cont}`.replace(/\s+/g, " ").trim();
  };

  // Continuation as a leading "LABEL:" segment (e.g. body "RETENTIONS: …").
  const labelMatch = b.match(/^([A-Z][A-Za-z0-9 /&\-]{0,40}?):/);
  if (labelMatch) {
    const joined = tryJoin(labelMatch[1]);
    if (joined) return joined;
  }
  // Continuation as 1–3 leading ALL-CAPS tokens (e.g. body "BUSINESS Interest…").
  const capsMatch = b.match(/^([A-Z][A-Z]+(?:\s+[A-Z][A-Z]+){0,2})\b/);
  if (capsMatch) {
    const joined = tryJoin(capsMatch[1]);
    if (joined) return joined;
  }
  return heading;
}

/**
 * Matches a by-reference incorporation row in a Conditions/Wordings list, e.g.
 * "Interlocking Clause (As attached)", "Period Clause (As per attached)",
 * "Loss Settlements Clause (As expiring)". Captures the clause name preceding
 * the parenthetical. Coded references like "(LSW 307A)" are handled separately
 * by the existing code-index path, so this only targets the UNcoded by-name case.
 */
const AS_ATTACHED_REF =
  /([A-Z][A-Za-z0-9 ,/&'\-]{2,60}?)\s*\(\s*as (?:attached|per attached|expiring)\s*\)/gi;

/**
 * Extracts UNcoded "(As attached)" by-name reference rows from contract text.
 * Returns one entry per distinct clause name (order preserved). A name only
 * qualifies if it reads like a clause title (contains the word "Clause" or is at
 * least two words), so stray fragments are skipped — those simply fall through
 * to the existing semantic path with no regression.
 */
function extractAsAttachedRefs(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  AS_ATTACHED_REF.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = AS_ATTACHED_REF.exec(text)) !== null) {
    let name = m[1].replace(/\s+/g, " ").trim().replace(/^[,.\-]+|[,.\-]+$/g, "");
    if (!name) continue;
    // The capture can bleed back into a preceding ALL-CAPS column label or a
    // line-wrapped fragment (e.g. "PERIOD Period Clause", "RETENTIONS Reinsuring
    // Clause"). When a Title-Case clause name follows leading ALL-CAPS tokens,
    // keep only the Title-Case clause name.
    const trimmed = name.match(
      /([A-Z][a-z][A-Za-z0-9 ,/&'\-]*?\bClause\b[A-Za-z0-9 ,/&'\-]*)$/,
    );
    if (trimmed) name = trimmed[1].trim();
    const looksLikeClause = /\bClause\b/i.test(name) || name.split(/\s+/).length >= 2;
    if (!looksLikeClause) continue;
    if (name.length < 3 || name.length > 70) continue;
    const key = normalizeHeadingKey(name);
    // Drop names that collapse to nothing distinctive once the generic "clause"
    // word is stripped (e.g. a bare "Clause (As attached)" that wrapped from a
    // longer name) — they are too ambiguous to resolve by name.
    if (!key || nameKey(name).replace(/\s/g, "").length < 4) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

function buildChecklistCandidates(
  docMap: StructuredContract,
): ChecklistCandidate[] {
  const candidates: ChecklistCandidate[] = [];
  const seenKeys = new Set<string>();
  const buildSemanticQuery = (heading: string, body: string) => {
    const parts = [heading?.trim(), body?.trim()].filter(Boolean);
    return parts.join("\n\n").slice(0, 4000);
  };

  // Reconstruct the full document text (headings + bodies) so we can detect
  // running headers (repeated lines) and pull "(As attached)" reference rows
  // that live inline inside section bodies. Each paragraph is its own line so
  // repeat-counting matches the original page layout.
  const textLines: string[] = [];
  for (const section of docMap.sections || []) {
    if (section.heading) textLines.push(section.heading);
    for (const p of section.paragraphs || []) textLines.push(p);
    for (const sub of section.subsections || []) {
      if (sub.heading) textLines.push(sub.heading);
      for (const p of sub.paragraphs || []) textLines.push(p);
    }
  }
  const fullText = textLines.join("\n");
  const runningHeaderKeys = buildRunningHeaderKeys(fullText);

  const pushHeading = (headingRaw: string, body: string, fallback: string) => {
    const bodyText = body.trim();
    // De-fragment two-column wrapped labels ("LIMITS AND" + "RETENTIONS:" →
    // "LIMITS AND RETENTIONS") before filtering / keying.
    const heading =
      defragmentHeading(headingRaw?.trim() || fallback, bodyText) || fallback;
    if (isFallbackSectionHeading(heading)) return;
    // Skip MRC administrative/metadata fields, running headers, money/number
    // lines and mid-clause list items — they belong in the document map, not
    // the clause checklist.
    if (isNonClauseHeading(heading, runningHeaderKeys)) return;
    const sectionQuery = buildSemanticQuery(heading, bodyText);
    candidates.push({
      heading,
      fullText: bodyText || heading,
      semanticQuery: sectionQuery,
      embeddingQuery: prepareEmbeddingText(sectionQuery),
    });
    const key = normalizeHeadingKey(heading);
    if (key) seenKeys.add(key);
  };

  for (const section of docMap.sections || []) {
    const sectionText = (section.paragraphs || []).join("\n").trim();
    pushHeading(section.heading, sectionText, "Section");

    for (const sub of section.subsections || []) {
      const subText = (sub.paragraphs || []).join("\n").trim();
      pushHeading(sub.heading, subText, section.heading?.trim() || "Section");
    }
  }

  // Task #25: surface UNcoded "(As attached)" by-name reference rows. These are
  // standard/appendix clauses incorporated by reference inside a Conditions or
  // Wordings list (e.g. "Interlocking Clause (As attached)"). They normally land
  // inside a parent section body and are never analysed against real wording.
  // Emit each distinct one as its own candidate carrying `referenceName`; the
  // batch runner resolves it by clause NAME (or to an appendix section in the
  // same document). Coded refs like "(LSW 307A)" already pull wording via the
  // code index, so only by-name rows not already present are added.
  for (const refName of extractAsAttachedRefs(fullText)) {
    const key = normalizeHeadingKey(refName);
    if (!key || seenKeys.has(key)) continue;
    if (isNonClauseHeading(refName, runningHeaderKeys)) continue;
    seenKeys.add(key);
    const sectionQuery = buildSemanticQuery(refName, refName);
    candidates.push({
      heading: refName,
      fullText: refName,
      semanticQuery: sectionQuery,
      embeddingQuery: prepareEmbeddingText(sectionQuery),
      referenceName: refName,
    });
  }

  return candidates;
}

/** Load document map and flatten sections into checklist candidates. */
export async function loadChecklistCandidates(contractId: string): Promise<{
  orgId: string;
  candidates: ChecklistCandidate[];
  expectedHeadingCount: number;
} | null> {
  const [contract] = await db
    .select({
      structuredContent: contracts.structuredContent,
      fileContent: contracts.fileContent,
      organizationId: contracts.organizationId,
    })
    .from(contracts)
    .where(eq(contracts.id, contractId))
    .limit(1);

  if (!contract) {
    console.warn(`[Checklist] Contract ${contractId} not found`);
    return null;
  }

  let docMap = contract.structuredContent as StructuredContract | null;

  if (!isQualityStructuredMap(docMap) && contract.fileContent?.trim()) {
    console.warn(
      `[Checklist] Rebuilding document map from text for ${contractId}`,
    );
    docMap = structureTextHeuristically(contract.fileContent);
    await db
      .update(contracts)
      .set({ structuredContent: docMap, updatedAt: new Date() })
      .where(eq(contracts.id, contractId));
  }

  if (!isQualityStructuredMap(docMap)) {
    console.warn(
      `[Checklist] No usable document map for contract ${contractId}`,
    );
    return null;
  }

  const sanitized = sanitizeStructuredMap(docMap as StructuredContract);
  const candidates = buildChecklistCandidates(sanitized);
  // expectedHeadingCount must track the provisions we will actually check —
  // the filtered candidate count, not every document-map heading (MRC metadata
  // fields are excluded in buildChecklistCandidates). This keeps the stored
  // checklistExpectedCount and the stored-vs-expected check consistent.
  const mapHeadingCount = countDocumentMapHeadings(sanitized);
  const expectedHeadingCount = candidates.length;
  if (mapHeadingCount > candidates.length) {
    console.log(
      `[Checklist] Skipped ${mapHeadingCount - candidates.length} non-clause/metadata heading(s); ${candidates.length} provision(s) to check for ${contractId}`,
    );
  }

  if (candidates.length === 0) {
    console.warn(
      `[Checklist] Document map is empty for contract ${contractId}`,
    );
    return null;
  }

  if (candidates.length !== expectedHeadingCount) {
    console.warn(
      `[Checklist] Candidate count ${candidates.length} !== document map headings ${expectedHeadingCount} for ${contractId}`,
    );
  }

  return { orgId: contract.organizationId, candidates, expectedHeadingCount };
}

/**
 * Prepare checklist: clear prior events and return batch plan for Inngest fan-out.
 */
type ChecklistStagingRow = {
  heading: string;
  fullText: string;
  embeddingQuery: string;
  referenceName?: string;
};

async function persistChecklistStaging(
  contractId: string,
  orgId: string,
  candidates: ChecklistCandidate[],
  expectedHeadingCount: number,
) {
  const staging: ChecklistStagingRow[] = candidates.map((c) => ({
    heading: c.heading,
    fullText: c.fullText.slice(0, 4000),
    embeddingQuery: c.embeddingQuery,
    ...(c.referenceName ? { referenceName: c.referenceName } : {}),
  }));

  await db
    .update(contracts)
    .set({
      analysis: sql`jsonb_set(
        jsonb_set(
          COALESCE(${contracts.analysis}, '{}'::jsonb),
          '{checklistStaging}',
          ${JSON.stringify(staging)}::jsonb
        ),
        '{checklistExpectedCount}',
        to_jsonb(${expectedHeadingCount}::int)
      )`,
      updatedAt: new Date(),
    })
    .where(eq(contracts.id, contractId));
}

async function loadStagedChecklistCandidates(contractId: string): Promise<{
  orgId: string;
  candidates: ChecklistCandidate[];
  expectedHeadingCount: number;
} | null> {
  const [row] = await db
    .select({
      organizationId: contracts.organizationId,
      analysis: contracts.analysis,
    })
    .from(contracts)
    .where(eq(contracts.id, contractId))
    .limit(1);

  if (!row) return null;

  const staging = (row.analysis as { checklistStaging?: ChecklistStagingRow[] })
    ?.checklistStaging;
  if (!staging?.length) return loadChecklistCandidates(contractId);

  const expected =
    (row.analysis as { checklistExpectedCount?: number })
      ?.checklistExpectedCount ?? staging.length;

  return {
    orgId: row.organizationId,
    candidates: staging.map((s) => ({
      heading: s.heading,
      fullText: s.fullText,
      semanticQuery: s.fullText,
      embeddingQuery: s.embeddingQuery,
      ...(s.referenceName ? { referenceName: s.referenceName } : {}),
    })),
    expectedHeadingCount: expected,
  };
}

export async function clearChecklistStaging(contractId: string) {
  await db
    .update(contracts)
    .set({
      analysis: sql`${contracts.analysis} - 'checklistStaging'`,
      updatedAt: new Date(),
    })
    .where(eq(contracts.id, contractId));
}

export async function prepareDocumentMapChecklist(
  contractId: string,
  workspaceId: string,
): Promise<ChecklistBatchPlan | null> {
  console.log(`[Checklist] Preparing for ${contractId}`);

  const loaded = await loadChecklistCandidates(contractId);
  if (!loaded) return null;

  await db
    .delete(analysisEvents)
    .where(
      and(
        eq(analysisEvents.contractId, contractId),
        eq(analysisEvents.eventType, "clause_detected"),
      ),
    );

  await persistChecklistStaging(
    contractId,
    loaded.orgId,
    loaded.candidates,
    loaded.expectedHeadingCount,
  );

  const totalBatches = Math.ceil(
    loaded.candidates.length / CHECKLIST_BATCH_SIZE,
  );
  console.log(
    `[Checklist] ${loaded.candidates.length} candidates → ${totalBatches} batches (staged in Neon once)`,
  );

  return {
    orgId: loaded.orgId,
    workspaceId,
    candidateCount: loaded.candidates.length,
    expectedHeadingCount: loaded.expectedHeadingCount,
    totalBatches,
    batchSize: CHECKLIST_BATCH_SIZE,
  };
}

/**
 * Process a single checklist batch (one Inngest step — stays under Vercel 60s).
 */
/**
 * Clause-code classification (Richard's Rule A / B / C).
 *
 * Reinsurance contracts frequently incorporate a library clause purely by
 * reference: the contract shows only a heading + a market code (e.g.
 * "Errors and Omissions - LSW321") with no clause body, meaning the library
 * wording is authoritative and must be "read in". When that happens the
 * provision is a 100% match to the coded library clause, regardless of
 * semantic similarity.
 *
 *   Rule A  heading carries a code, no substantive body   -> 100% (read-in)
 *   Rule C  heading carries a code, plus extra body text   -> 100% (+ context)
 *   Rule B  bespoke/amended body, no code match            -> semantic (Amber)
 *
 * We match against the ACTUAL library codes (loaded into an index) rather
 * than guessing a regex, so only real references count.
 */
type CodeIndexRow = {
  id: string;
  clauseName: string;
  clauseText: string;
  library: string | null;
  category: string | null;
  code: string;
};

/** Uppercase + strip everything but A-Z0-9 so "LSW 321", "lsw-321" all match. */
function normalizeCodeToken(s: string): string {
  return (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Index key for a library code. Library codes often carry an edition /
 * variant suffix in parentheses, e.g. "LSW307A (05/00)" or
 * "LSW1001 (Reinsurance) (08/94)". A contract references only the base code
 * ("LSW 307A"), so we drop the parenthetical groups before normalizing.
 * The result ("LSW307A") substring-matches the normalized contract text.
 */
function baseCodeKey(s: string): string {
  return (s || "")
    .toUpperCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

/** Build a normalized-code -> clause index for all coded clauses in scope. */
async function buildWorkspaceCodeIndex(
  organizationId: string,
): Promise<Map<string, CodeIndexRow>> {
  const rows = await db
    .select({
      id: clauses.id,
      clauseName: clauses.clauseName,
      clauseText: clauses.clauseText,
      library: clauses.library,
      category: clauses.category,
      code: clauses.code,
    })
    .from(clauses)
    .where(
      and(
        or(
          eq(clauses.isGlobal, true),
          eq(clauses.organizationId, organizationId),
        ),
        sql`${clauses.code} IS NOT NULL AND ${clauses.code} <> ''`,
      ),
    );

  const index = new Map<string, CodeIndexRow>();
  for (const r of rows) {
    if (!r.code) continue;
    const norm = baseCodeKey(r.code);
    // Codes shorter than 5 normalized chars are too ambiguous to substring-match.
    if (norm.length < 5) continue;
    // First writer wins; core (global) rows are returned first by default.
    if (!index.has(norm)) index.set(norm, r as CodeIndexRow);
  }
  return index;
}

/**
 * Find a library clause whose code appears in the given heading/lead text.
 * Returns the longest (most specific) matching code's clause, or null.
 */
function findCodeReference(
  text: string,
  codeIndex: Map<string, CodeIndexRow>,
): CodeIndexRow | null {
  const hay = normalizeCodeToken(text);
  if (!hay) return null;
  let best: CodeIndexRow | null = null;
  let bestLen = 0;
  for (const [norm, row] of codeIndex) {
    if (norm.length > bestLen && hay.includes(norm)) {
      best = row;
      bestLen = norm.length;
    }
  }
  return best;
}

type NameIndexRow = {
  id: string;
  clauseName: string;
  clauseText: string;
  library: string | null;
  category: string | null;
  code: string | null;
};

/**
 * Index key for a clause name: lowercased, parenthetical variants dropped (e.g.
 * "(A)", "(Reinsurance)"), a trailing "clause" word removed, punctuation
 * stripped, whitespace collapsed. So "Interlocking Clause", "interlocking
 * clause", and a contract row "Interlocking Clause (As attached)" all key to
 * "interlocking". Empty for names too generic to match.
 */
function nameKey(s: string): string {
  const base = (s || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\bclauses?\b\s*$/u, "")
    .trim();
  return base;
}

/**
 * Build a normalized-name -> clause index for all clauses in scope. Used to
 * resolve UNcoded "(As attached)" by-name reference rows (Task #25) to their
 * authoritative library wording.
 */
async function buildWorkspaceNameIndex(
  organizationId: string,
): Promise<Map<string, NameIndexRow>> {
  const rows = await db
    .select({
      id: clauses.id,
      clauseName: clauses.clauseName,
      clauseText: clauses.clauseText,
      library: clauses.library,
      category: clauses.category,
      code: clauses.code,
    })
    .from(clauses)
    .where(
      or(eq(clauses.isGlobal, true), eq(clauses.organizationId, organizationId)),
    );

  const index = new Map<string, NameIndexRow>();
  for (const r of rows) {
    const key = nameKey(r.clauseName);
    // Single-token keys shorter than 4 chars are too ambiguous to trust.
    if (!key || key.replace(/\s/g, "").length < 4) continue;
    // First writer wins; global rows are returned first.
    if (!index.has(key)) index.set(key, r as NameIndexRow);
  }
  return index;
}

/**
 * Resolve a by-name reference (e.g. "Interlocking Clause (As attached)") to a
 * library clause by normalized name. Returns the matching clause or null.
 */
function findNameReference(
  referenceName: string,
  nameIndex: Map<string, NameIndexRow>,
): NameIndexRow | null {
  const key = nameKey(referenceName);
  if (!key || key.replace(/\s/g, "").length < 4) return null;
  return nameIndex.get(key) ?? null;
}

/**
 * Look for the authoritative wording of a by-name reference row inside an
 * appendix/attachment section of the SAME document. Reinsurance slips often
 * incorporate "X Clause (As attached)" and then reproduce the full wording in a
 * later appendix. We match a section whose heading shares the reference's name
 * key and which carries substantive body text. Returns the body text or null.
 */
function findAppendixSectionText(
  referenceName: string,
  docMap: StructuredContract | null | undefined,
): string | null {
  if (!docMap?.sections?.length) return null;
  const target = nameKey(referenceName);
  if (!target || target.replace(/\s/g, "").length < 4) return null;

  let best: string | null = null;
  const consider = (heading: string, body: string) => {
    const h = (heading || "").trim();
    if (!h) return;
    // Skip the reference row itself (no substantive body).
    if (/\(\s*as (?:attached|per attached|expiring)\s*\)/i.test(h)) return;
    if (nameKey(h) !== target) return;
    const text = (body || "").replace(/\s+/g, " ").trim();
    if (text.length > 80 && (!best || text.length > best.length)) {
      best = text;
    }
  };

  for (const section of docMap.sections) {
    consider(section.heading, (section.paragraphs || []).join("\n"));
    for (const sub of section.subsections || []) {
      consider(sub.heading, (sub.paragraphs || []).join("\n"));
    }
  }
  return best;
}

export async function runDocumentMapChecklistBatch(
  contractId: string,
  workspaceId: string,
  batchIndex: number,
): Promise<{ stored: number; expectedHeadingCount: number }> {
  const loaded = await loadStagedChecklistCandidates(contractId);
  if (!loaded) return { stored: 0, expectedHeadingCount: 0 };

  const { orgId, candidates } = loaded;
  const start = batchIndex * CHECKLIST_BATCH_SIZE;
  const batch = candidates.slice(start, start + CHECKLIST_BATCH_SIZE);
  if (batch.length === 0)
    return { stored: 0, expectedHeadingCount: loaded.expectedHeadingCount };

  const totalBatches = Math.ceil(candidates.length / CHECKLIST_BATCH_SIZE);
  console.log(
    `[Checklist] Batch ${batchIndex + 1}/${totalBatches} (${batch.length} items) for ${contractId}`,
  );

  let matchesBatch: Awaited<ReturnType<typeof findClosestLibraryMatchesBatch>> =
    batch.map(() => []);

  try {
    matchesBatch = await findClosestLibraryMatchesBatch(
      batch.map((c) => c.embeddingQuery),
      orgId,
      workspaceId,
      3,
      batch.map((c) => c.heading),
    );
  } catch (err) {
    console.error(`[Checklist] Batch ${batchIndex + 1} failed:`, err);
  }

  // Code index for Rule A/C: any contract heading that carries a real
  // library code is an incorporation-by-reference and counts as a 100% match.
  let codeIndex = new Map<string, CodeIndexRow>();
  try {
    codeIndex = await buildWorkspaceCodeIndex(orgId);
  } catch (err) {
    console.warn("[Checklist] code index build failed:", err);
  }

  // Name index + document map for Task #25 by-name "(As attached)" rows: resolve
  // an UNcoded reference row to its library clause by NAME, and (failing that) to
  // an appendix section reproducing the wording in the SAME document. Only built
  // when this batch actually contains reference rows, to avoid extra queries.
  const batchHasRefRows = batch.some((c) => c.referenceName);
  let nameIndex = new Map<string, NameIndexRow>();
  let docMap: StructuredContract | null = null;
  if (batchHasRefRows) {
    try {
      nameIndex = await buildWorkspaceNameIndex(orgId);
    } catch (err) {
      console.warn("[Checklist] name index build failed:", err);
    }
    try {
      const [row] = await db
        .select({ structuredContent: contracts.structuredContent })
        .from(contracts)
        .where(eq(contracts.id, contractId))
        .limit(1);
      docMap = (row?.structuredContent as StructuredContract | null) ?? null;
    } catch (err) {
      console.warn("[Checklist] document map load failed:", err);
    }
  }

  const eventValues = batch.map((candidate, idx) => {
    // ── Task #25: by-name "(As attached)" reference row ──
    // These have no body in the slip; the authoritative wording is the library
    // clause of the same name, or an appendix section in the same document.
    if (candidate.referenceName) {
      const nameHit = findNameReference(candidate.referenceName, nameIndex);
      const appendixText = findAppendixSectionText(
        candidate.referenceName,
        docMap,
      );

      if (nameHit || appendixText) {
        const libraryStandard =
          nameHit?.clauseText ||
          appendixText ||
          "No library standard found.";
        const sourceNote = nameHit
          ? appendixText
            ? `matched to library clause "${nameHit.clauseName}"${nameHit.code ? ` (${nameHit.code})` : ""}; full wording also attached in this document`
            : `matched to library clause "${nameHit.clauseName}"${nameHit.code ? ` (${nameHit.code})` : ""}`
          : "full wording attached in this document";
        return {
          workspaceId,
          contractId,
          organizationId: orgId,
          eventType: "clause_detected" as const,
          status: "Matched" as const,
          metadata: {
            clauseName: candidate.heading,
            category: nameHit?.category || "Contract Provision",
            documentText: candidate.fullText,
            documentTextSnippet: candidate.fullText.substring(0, 300),
            libraryStandard,
            reasoning: `Incorporated by reference "(As attached)" — ${sourceNote}. The attached wording is authoritative (100% match).`,
            confidence: 1,
            clauseCode: nameHit?.code || null,
            matchType: "name-ref" as const,
            libraryPlusContext: Boolean(nameHit && appendixText),
            isGlobal: true,
          },
        };
      }
      // No by-name or appendix wording found: fall through to the semantic /
      // code paths below so behaviour is no worse than before (reference-only).
    }

    // ── Rule A / C: code reference in the heading (or its lead text) ──
    // Look in the heading first, then a short lead of the body, since the
    // code sometimes lands at the very start of the section body.
    const codeHaystack = `${candidate.heading}\n${candidate.fullText.slice(0, 200)}`;
    const codeHit = findCodeReference(codeHaystack, codeIndex);

    if (codeHit) {
      // Does the provision carry substantive body text beyond the heading?
      // buildChecklistCandidates sets fullText = body || heading, so an
      // empty body means fullText === heading.
      const bodyOnly =
        candidate.fullText.trim() === candidate.heading.trim()
          ? ""
          : candidate.fullText.trim();
      const hasContext = bodyOnly.replace(/\s+/g, " ").length > 60;

      const reasoning = hasContext
        ? `Library clause ${codeHit.code} incorporated by reference, with contract-specific additions (100% match).`
        : `Incorporated by reference to ${codeHit.code} — the library wording is authoritative (100% match).`;

      return {
        workspaceId,
        contractId,
        organizationId: orgId,
        eventType: "clause_detected" as const,
        status: "Matched" as const,
        metadata: {
          clauseName: candidate.heading,
          category: codeHit.category || "Contract Provision",
          documentText: candidate.fullText,
          documentTextSnippet: candidate.fullText.substring(0, 300),
          libraryStandard: codeHit.clauseText || "No library standard found.",
          reasoning,
          confidence: 1,
          clauseCode: codeHit.code,
          matchType: "code" as const,
          libraryPlusContext: hasContext,
          isGlobal: true,
        },
      };
    }

    // ── Rule B: no code reference, fall back to semantic similarity ──
    // Sort descending so we can compare the top hit against the runner-up.
    const matches = (matchesBatch[idx] || [])
      .slice()
      .sort((a: any, b: any) => (b.similarity ?? 0) - (a.similarity ?? 0));
    const bestMatch = matches[0] ?? null;
    const similarity = bestMatch ? Number(bestMatch.similarity) : 0;
    const runnerUpSim = matches[1] ? Number(matches[1].similarity) : 0;

    // Ambiguity guard: a sub-Matched hit that barely beats the runner-up is an
    // arbitrary nearest neighbour, not a real equivalence — treat as bespoke.
    const ambiguous =
      similarity < CHECKLIST_MATCHED_APPROVED_THRESHOLD &&
      runnerUpSim > 0 &&
      similarity - runnerUpSim < CHECKLIST_MATCH_MARGIN;

    let status: "Matched" | "Variation" | "Custom" = "Custom";
    if (similarity >= CHECKLIST_MATCHED_APPROVED_THRESHOLD) {
      status = "Matched";
    } else if (similarity >= CHECKLIST_VARIATION_FLOOR && !ambiguous) {
      status = "Variation";
    }

    // Only carry a library reference when we actually asserted a match. A
    // Custom (bespoke) provision must NOT inherit the weak nearest-neighbour's
    // code/standard — that was the source of misleading "Variation" noise.
    const hasLibraryRef = status !== "Custom";
    const pct = Math.round(similarity * 100);
    const reasoning =
      status === "Matched"
        ? `Closely matches library clause "${bestMatch?.clauseName}" (${pct}% similarity) — treat as the company standard wording.`
        : status === "Variation"
          ? `Resembles library clause "${bestMatch?.clauseName}" (${pct}% similarity) — review for departures from the standard wording.`
          : "Bespoke provision with no close library equivalent — review on its own terms.";

    return {
      workspaceId,
      contractId,
      organizationId: orgId,
      eventType: "clause_detected" as const,
      status,
      metadata: {
        clauseName: candidate.heading,
        category: hasLibraryRef
          ? bestMatch?.category || "Contract Provision"
          : "Contract Provision",
        documentText: candidate.fullText,
        documentTextSnippet: candidate.fullText.substring(0, 300),
        libraryStandard: hasLibraryRef
          ? bestMatch?.clauseText || "No library standard found."
          : "No close library equivalent.",
        reasoning,
        confidence: similarity,
        clauseCode: hasLibraryRef ? bestMatch?.code || null : null,
        matchType: "semantic" as const,
        libraryPlusContext: false,
        isGlobal: true,
      },
    };
  });

  if (eventValues.length > 0) {
    await db.insert(analysisEvents).values(eventValues);
  }

  return {
    stored: eventValues.length,
    expectedHeadingCount: loaded.expectedHeadingCount,
  };
}

/**
 * Analysis Checklist Stage (Fast Analysis 2.5)
 * Driven by the AI-generated Document Map.
 * Prefer prepareDocumentMapChecklist + runDocumentMapChecklistBatch from Inngest.
 */
export async function runDocumentMapChecklist(
  contractId: string,
  workspaceId: string,
) {
  console.log(`[Checklist] Running Document Map Checklist for ${contractId}`);
  const plan = await prepareDocumentMapChecklist(contractId, workspaceId);
  if (!plan) return;

  let totalStored = 0;
  for (let b = 0; b < plan.totalBatches; b++) {
    const { stored } = await runDocumentMapChecklistBatch(
      contractId,
      workspaceId,
      b,
    );
    totalStored += stored;
  }

  console.log(
    `[Checklist] Stored ${totalStored} checklist items for contract ${contractId}`,
  );
}

export async function detectMandatoryClauses(
  contractId: string,
  workspaceId: string,
  text: string,
): Promise<AnalysisResult[]> {
  console.log(
    `[RuleEngine] Running local detectMandatoryClauses for contract ${contractId}`,
  );

  // 1. Fetch Registry (Workspace Defaults + Library Clauses)
  const [workspaceData] = await db
    .select({
      mandatoryRegistry: workspaces.mandatoryRegistry,
      organizationId: workspaces.organizationId,
    })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!workspaceData) {
    console.error(`[RuleEngine] Workspace ${workspaceId} not found`);
    return [];
  }

  // 1b. Idempotency Check
  const existingEvents = await db
    .select({ id: analysisEvents.id })
    .from(analysisEvents)
    .where(
      and(
        eq(analysisEvents.contractId, contractId),
        eq(analysisEvents.eventType, "clause_detected"),
      ),
    );

  if (existingEvents.length > 0) {
    console.log(
      `[RuleEngine] Reuse: Found ${existingEvents.length} existing detection events for contract ${contractId}. Skipping neural scan.`,
    );
    return []; // We return empty as the data is already in DB events table
  }

  const orgId = workspaceData.organizationId || "";

  // 2. Segment document into provisions (paragraph split, then semantic chunks as fallback)
  let docSegments = text
    .split(/\n\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30);

  if (docSegments.length === 0) {
    docSegments = splitTextForSegmentation(text).filter(
      (s) => s.trim().length > 30,
    );
  }

  console.log(
    `[RuleEngine] Segmented doc into ${docSegments.length} segments for contract-centric matching.`,
  );

  // 3. Find matches for each segment in the library
  const BATCH_SIZE = 10;
  const results: any[] = [];

  for (let i = 0; i < docSegments.length; i += BATCH_SIZE) {
    const batch = docSegments.slice(i, i + BATCH_SIZE);

    // Update status incrementally
    const pct = Math.round((i / docSegments.length) * 100);
    await db
      .update(contracts)
      .set({
        analysis: sql`jsonb_set(
          COALESCE(${contracts.analysis}, '{}'::jsonb),
          '{status}',
          ${JSON.stringify(`[5/5] Neural scan analysis (${pct}%)...`)}::jsonb
        )`,
        updatedAt: new Date(),
      })
      .where(eq(contracts.id, contractId));

    const matchesBatch = await findClosestLibraryMatchesBatch(
      batch,
      orgId,
      workspaceId,
      1,
    );

    batch.forEach((chunkText, idx) => {
      const matches = matchesBatch[idx];
      const bestMatch = matches && matches.length > 0 ? matches[0] : null;

      const similarity = bestMatch ? bestMatch.similarity : 0;

      // Only process if it meets the minimum threshold
      if (similarity >= CHECKLIST_SEMANTIC_FLOOR && bestMatch) {
        const status = fastChecklistStatusForSimilarity(similarity);

        results.push({
          name: bestMatch.clauseName,
          category: bestMatch.category || "General",
          found: true,
          found_text: chunkText,
          status,
          reasoning:
            status === "Matched"
              ? `Library match at ${Math.round(similarity * 100)}% similarity.`
              : `Provision identified with ${Math.round(similarity * 100)}% similarity to library standard.`,
          confidence: similarity,
          libraryStandard:
            bestMatch.clauseText ||
            "No library standard found for this provision.",
          source: bestMatch.id || null,
        });
      }
    });
  }

  // Deduplicate: Keep only the BEST match for each unique library clause
  const uniqueResults = new Map<string, any>();
  for (const r of results) {
    if (!r.source) continue;
    const existing = uniqueResults.get(r.source);
    if (!existing || r.confidence > existing.confidence) {
      uniqueResults.set(r.source, r);
    }
  }

  const finalResults = Array.from(uniqueResults.values());

  // 4. Store Events in DB
  const eventValues = finalResults.map((r) => ({
    workspaceId,
    contractId,
    organizationId: orgId,
    eventType: "clause_detected",
    status: r.status,
    metadata: {
      clauseName: r.name,
      category: r.category,
      documentText: r.found_text || "",
      documentTextSnippet: (r.found_text || "").substring(0, 200),
      libraryStandard: r.libraryStandard,
      reasoning: r.reasoning,
      confidence: r.confidence,
      clauseCode: r.source,
      isGlobal: true,
    },
  }));

  try {
    // Clear old events - moved inside the try block and before insert
    await db
      .delete(analysisEvents)
      .where(
        and(
          eq(analysisEvents.contractId, contractId),
          eq(analysisEvents.eventType, "clause_detected"),
        ),
      );

    if (eventValues.length > 0) {
      await db.insert(analysisEvents).values(eventValues);
    }
  } catch (e) {
    console.error(`[RuleEngine] Failed to store analysis events:`, e);
  }

  // 5. Update Contract Summary Stats in analysis JSONB
  const redCount = finalResults.filter(
    (r) => r.status === "Not Matched",
  ).length;
  const amberCount = finalResults.filter(
    (r) => r.status === "Variation",
  ).length;
  const greenCount = finalResults.filter((r) => r.status === "Matched").length;

  await db
    .update(contracts)
    .set({
      analysis: sql`COALESCE(${contracts.analysis}, '{}'::jsonb) || ${JSON.stringify(
        {
          mandatory_registry_count: finalResults.length,
          checklistSummary: {
            matched: greenCount,
            variation: amberCount,
            missing: redCount,
            total: results.length,
          },
        },
      )}::jsonb`,
    })
    .where(eq(contracts.id, contractId));

  return results;
}

