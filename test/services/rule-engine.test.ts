import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  findWarExclusionMatches,
  fastChecklistStatusForSimilarity,
} from "@/services/rule-engine";
import { db } from "@/db/drizzle";
import { createEmbeddings } from "@/lib/embedding";

const { dbMock, createEmbeddingsMock } = vi.hoisted(() => ({
  dbMock: {
    select: vi.fn(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        {
          organizationId: "org_123",
          id: "1",
          title: "War Exclusion A",
          similarity: 0.85,
        },
      ]),
    })),
    update: vi.fn(() => ({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue({}),
    })),
    insert: vi.fn(() => ({
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: "clause_1" }]),
    })),
  },
  createEmbeddingsMock: vi.fn(async () => [[0.1, 0.2, 0.3]]),
}));

vi.mock("@/db/drizzle", () => ({
  db: dbMock,
}));

vi.mock("@/lib/embedding", () => ({
  createEmbeddings: createEmbeddingsMock,
}));

describe("Rule Engine Intelligence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fastChecklistStatusForSimilarity (Stage 2)", () => {
    it("classifies 92% raw similarity as Variation, not Matched–Approved", () => {
      expect(fastChecklistStatusForSimilarity(0.92)).toBe("Variation");
    });

    it("classifies 99% as Matched–Approved", () => {
      expect(fastChecklistStatusForSimilarity(0.99)).toBe("Matched");
    });

    it("classifies below semantic floor as Not Matched (red)", () => {
      expect(fastChecklistStatusForSimilarity(0.5)).toBe("Not Matched");
    });
  });

  describe("findWarExclusionMatches", () => {
    it("should return matches when valid input is provided", async () => {
      const mockMatches = [
        { id: "1", title: "War Exclusion A", similarity: 0.85 },
      ];

      // Override mock for this specific test
      (db.select as any).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => mockMatches),
            })),
          })),
        })),
      });

      // The function signature is: findWarExclusionMatches(clauseText, organizationId, limit?, bypassDelay?)
      const results = await findWarExclusionMatches(
        "clause text",
        "org_123",
        2,
      );
      expect(createEmbeddings).toHaveBeenCalledWith(["clause text"]);
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("War Exclusion A");
    });

    it("should return empty array on error", async () => {
      // Override mock to throw error
      vi.mocked(createEmbeddings).mockRejectedValueOnce(
        new Error("Embedding failed"),
      );

      const results = await findWarExclusionMatches(
        "clause text",
        "org_123",
        2,
      );
      expect(results).toEqual([]);
    });
  });
});

// NOTE: evaluateRuleWithOpenRouter and segmentContractIntoClauses tests are skipped
// because they require real AI API calls. To test these, use integration tests
// with actual API keys configured.
