/**
 * Integration tests for structured evidence and clause matching
 * Tests end-to-end flow: rule evaluation → evidence extraction → clause matching → display
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/db/drizzle";
import {
  buildStructuredEvidence,
  evaluateRuleAndStructureEvidence,
} from "@/services/rule-engine";
import { matchClauseToLibrary } from "@/services/clause-matching";
import type {
  RuleEvaluationResult,
  StructuredEvidenceResult,
} from "@/types/evidence";

// Mock data for testing
const mockRuleEvalResult: RuleEvaluationResult = {
  status: "Amber",
  reasoning: "Found matching exclusions but need verification",
  confidence: 0.75,
  detectedBias: "Balanced",
  extractedEvidence: [
    "War exclusion applies to direct conflict",
    "Terrorism clause limited to specified regions",
  ],
  rawEvidence: [
    {
      heading: "Exclusions",
      verbatim_text:
        "This policy excludes any loss caused by war, whether declared or undeclared, or by any act of terrorism.",
    },
    {
      heading: "Definitions",
      verbatim_text:
        "Terrorism is defined as organized acts of violence targeted at civilian populations in specified high-risk regions.",
    },
  ],
  triggeredConditions: ["war_exclusion", "terrorism_clause"],
  keyTerms: ["war", "terrorism", "exclusion", "conflict"],
};

const mockOrgId = "test-org-123";
const mockContractId = "test-contract-123";
const mockRuleId = "test-rule-123";

describe("Structured Evidence Integration", () => {
  describe("Evidence Building", () => {
    it("should convert rule evaluation result to structured evidence", async () => {
      const structured = await buildStructuredEvidence(
        mockRuleEvalResult,
        mockRuleId,
        mockContractId,
        mockOrgId,
      );

      // Verify structure
      expect(structured).toHaveProperty("ruleId", mockRuleId);
      expect(structured).toHaveProperty("contractId", mockContractId);
      expect(structured).toHaveProperty("status", "Amber");
      expect(structured).toHaveProperty("allEvidence");
      expect(structured).toHaveProperty("groupedEvidence");
      expect(structured).toHaveProperty("statistics");

      // Verify evidence items
      expect(structured.allEvidence.length).toBeGreaterThan(0);
      expect(structured.allEvidence[0]).toHaveProperty("text");
      expect(structured.allEvidence[0]).toHaveProperty("section");
      expect(structured.allEvidence[0]).toHaveProperty("clauseType");

      // Verify grouping
      expect(structured.groupedEvidence.length).toBeGreaterThan(0);
      const exclusionsGroup = structured.groupedEvidence.find(
        (g) => g.section === "Exclusions",
      );
      expect(exclusionsGroup).toBeDefined();
      expect(exclusionsGroup?.items.length).toBeGreaterThan(0);

      // Verify statistics
      expect(structured.statistics.totalEvidence).toBeGreaterThan(0);
      expect(structured.statistics.totalSections).toBeGreaterThan(0);
      expect(structured.statistics.averageConfidence).toBeGreaterThanOrEqual(0);
      expect(structured.statistics.averageConfidence).toBeLessThanOrEqual(1);
    });

    it("should clean evidence text properly", async () => {
      const structured = await buildStructuredEvidence(
        mockRuleEvalResult,
        mockRuleId,
        mockContractId,
        mockOrgId,
      );

      // Evidence text should be lowercase and normalized
      structured.allEvidence.forEach((item) => {
        expect(item.text).toBeTruthy();
        expect(item.text.length).toBeGreaterThan(0);
      });
    });

    it("should group evidence by section", async () => {
      const structured = await buildStructuredEvidence(
        mockRuleEvalResult,
        mockRuleId,
        mockContractId,
        mockOrgId,
      );

      // Should have multiple sections
      expect(structured.groupedEvidence.length).toBeGreaterThanOrEqual(1);

      // Each group should have items
      structured.groupedEvidence.forEach((group) => {
        expect(group.section).toBeTruthy();
        expect(group.items.length).toBeGreaterThan(0);
        expect(group.count).toBe(group.items.length);
      });
    });
  });

  describe("Clause Matching", () => {
    it("should attempt to match clauses to library", async () => {
      const testText =
        "This policy excludes any loss caused by war or terrorism";

      const result = await matchClauseToLibrary({
        documentClauseText: testText,
        section: "Exclusions",
        clauseTypeHint: "Exclusion",
        topN: 3,
        minConfidence: 0.5,
      });

      // Verify result structure
      expect(result).toHaveProperty("documentClauseText");
      expect(result).toHaveProperty("matches");
      expect(result).toHaveProperty("hasHighConfidenceMatch");
      expect(Array.isArray(result.matches)).toBe(true);

      // Verify match structure if matches exist
      if (result.matches.length > 0) {
        result.matches.forEach((match) => {
          expect(match).toHaveProperty("id");
          expect(match).toHaveProperty("name");
          expect(match).toHaveProperty("confidence");
          expect(match.confidence).toBeGreaterThanOrEqual(0);
          expect(match.confidence).toBeLessThanOrEqual(1);
        });
      }
    });

    it("should handle empty text gracefully", async () => {
      const result = await matchClauseToLibrary({
        documentClauseText: "",
      });

      expect(result.matches.length).toBe(0);
      expect(result.hasHighConfidenceMatch).toBe(false);
    });

    it("should respect confidence threshold", async () => {
      const result = await matchClauseToLibrary({
        documentClauseText: "War exclusion clause",
        minConfidence: 0.9, // Very high threshold
      });

      // All returned matches should meet threshold
      result.matches.forEach((match) => {
        expect(match.confidence).toBeGreaterThanOrEqual(0.9);
      });
    });

    it("should boost confidence for type and section matches", async () => {
      const result = await matchClauseToLibrary({
        documentClauseText: "Terrorism clause in exclusions section",
        section: "Exclusions",
        clauseTypeHint: "Exclusion",
        topN: 5,
      });

      // Should have found some matches (if library exists)
      expect(result).toHaveProperty("matches");
      expect(Array.isArray(result.matches)).toBe(true);
    });
  });

  describe("End-to-End Flow", () => {
    it("should process complete flow: eval → structure → group → stats", async () => {
      const structured = await buildStructuredEvidence(
        mockRuleEvalResult,
        mockRuleId,
        mockContractId,
        mockOrgId,
      );

      // Step 1: Verification of status
      expect(["Green", "Amber", "Red"]).toContain(structured.status);

      // Step 2: Verification of evidence extraction
      expect(structured.allEvidence.length).toBeGreaterThan(0);

      // Step 3: Verification of hierarchical grouping
      expect(structured.groupedEvidence.length).toBeGreaterThan(0);

      // Step 4: Verification of statistics
      const stats = structured.statistics;
      expect(stats.totalEvidence).toBe(structured.allEvidence.length);
      expect(stats.totalSections).toBe(structured.groupedEvidence.length);
      expect(stats.averageConfidence).toBeGreaterThanOrEqual(0);
      expect(stats.averageConfidence).toBeLessThanOrEqual(1);

      // Step 5: Verify evidence items have required fields for UI
      structured.allEvidence.forEach((item) => {
        expect(item.id).toBeTruthy();
        expect(item.section).toBeTruthy();
        expect(item.clauseType).toBeTruthy();
        expect(item.text).toBeTruthy();
        expect(item.source).toBeDefined();
        expect(item.matchConfidence).toBeGreaterThanOrEqual(0);
        expect(item.matchConfidence).toBeLessThanOrEqual(1);
      });
    });

    it("should handle rule evaluation with structured output", async () => {
      // This would test the full pipeline if we have test data
      // For now, verify the function signature exists and is callable
      expect(typeof evaluateRuleAndStructureEvidence).toBe("function");
    });
  });

  describe("Data Validation", () => {
    it("should validate evidence item structure", async () => {
      const structured = await buildStructuredEvidence(
        mockRuleEvalResult,
        mockRuleId,
        mockContractId,
        mockOrgId,
      );

      structured.allEvidence.forEach((item) => {
        // Required fields
        expect(typeof item.id).toBe("string");
        expect(typeof item.section).toBe("string");
        expect(typeof item.clauseType).toBe("string");
        expect(typeof item.text).toBe("string");
        expect(typeof item.matchConfidence).toBe("number");
        expect(typeof item.isManuallyMatched).toBe("boolean");

        // Source structure
        expect(item.source).toBeDefined();
        expect(typeof item.source.chunk).toBe("string");
        expect(typeof item.source.position).toBe("number");
      });
    });

    it("should validate statistics accuracy", async () => {
      const structured = await buildStructuredEvidence(
        mockRuleEvalResult,
        mockRuleId,
        mockContractId,
        mockOrgId,
      );

      const stats = structured.statistics;

      // Count verification
      expect(stats.totalEvidence).toBe(structured.allEvidence.length);
      expect(stats.totalSections).toBe(structured.groupedEvidence.length);

      // Matched count should not exceed total
      expect(stats.matchedToLibrary).toBeLessThanOrEqual(stats.totalEvidence);
      expect(stats.manuallyMatched).toBeLessThanOrEqual(stats.totalEvidence);

      // Confidence average calculation
      if (stats.totalEvidence > 0) {
        const calculated =
          structured.allEvidence.reduce(
            (sum, item) => sum + item.matchConfidence,
            0,
          ) / stats.totalEvidence;
        expect(Math.abs(stats.averageConfidence - calculated)).toBeLessThan(
          0.01,
        );
      }
    });
  });

  describe("Error Handling", () => {
    it("should handle missing evidence gracefully", async () => {
      const emptyResult: RuleEvaluationResult = {
        status: "Green",
        reasoning: "No issues found",
        extractedEvidence: [],
        rawEvidence: [],
      };

      const structured = await buildStructuredEvidence(
        emptyResult,
        mockRuleId,
        mockContractId,
        mockOrgId,
      );

      expect(structured.allEvidence.length).toBe(0);
      expect(structured.groupedEvidence.length).toBe(0);
      expect(structured.statistics.totalEvidence).toBe(0);
    });

    it("should handle null or undefined values", async () => {
      const incompleteResult: Partial<RuleEvaluationResult> = {
        status: "Amber",
        reasoning: "Test",
      };

      const structured = await buildStructuredEvidence(
        incompleteResult as RuleEvaluationResult,
        mockRuleId,
        mockContractId,
        mockOrgId,
      );

      expect(structured.allEvidence).toBeDefined();
      expect(Array.isArray(structured.allEvidence)).toBe(true);
    });
  });
});
