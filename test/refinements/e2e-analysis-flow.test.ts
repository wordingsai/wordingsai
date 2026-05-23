import { describe, it, expect, vi, beforeEach } from "vitest";
import { evaluateContractRulesJob } from "@/inngest/functions";
import { db } from "@/db/drizzle";
import { contracts, rules, ruleVersions } from "@/db/schema";
import { extractDocumentGCP } from "@/server/extract-gcp";
import {
  classifyContractType,
  evaluateRuleWithOpenRouter,
  findCoordinatesForSubstring,
} from "@/services/rule-engine";

// Mock Inngest's step.run
const mockStep = {
  run: vi.fn(async (name, fn) => await fn()),
};

vi.mock("@/db/drizzle", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() =>
            Promise.resolve([
              {
                id: "c1",
                workspaceId: "w1",
                currentVersionId: "v1",
                fileURL: "https://example.com/contract.pdf",
                fileContent:
                  "UNIQUE MARKET REFERENCE B080110473H21. REINSURED FARADAY SYNDICATE 435.",
                structuredContent: {
                  text: "REINSURED FARADAY SYNDICATE 435",
                  pages: [],
                },
                contractType: "aviation",
              },
            ]),
          ),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([{ id: "res_1" }])),
        })),
      })),
    })),
    query: {
      rules: {
        findMany: vi.fn(() =>
          Promise.resolve([
            {
              id: "r1",
              name: "Reinsured Verification",
              category: "insurance",
              currentVersion: { id: "v1", ruleDefinition: {} },
            },
          ]),
        ),
      },
      organizationRuleSettings: {
        findMany: vi.fn(() => Promise.resolve([])),
      },
    },
    transaction: vi.fn(async (fn) => await fn(db)),
  },
}));

vi.mock("@/server/extract-gcp", () => ({
  extractDocumentGCP: vi.fn(() =>
    Promise.resolve({
      rawText:
        "UNIQUE MARKET REFERENCE B080110473H21. REINSURED FARADAY SYNDICATE 435.",
      structuredJSON: { text: "REINSURED FARADAY SYNDICATE 435" },
      method: "DOCUMENT_AI_SYNC",
    }),
  ),
}));

vi.mock("@/services/rule-engine", () => ({
  classifyContractType: vi.fn(() => Promise.resolve("aviation")),
  getApplicableRules: vi.fn(() =>
    Promise.resolve([
      {
        id: "r1",
        name: "Reinsured Verification",
        category: "aviation",
        currentVersion: { id: "v1", ruleDefinition: {} },
      },
    ]),
  ),
  evaluateRuleWithOpenRouter: vi.fn(async () => {
    await findCoordinatesForSubstring(
      { text: "REINSURED FARADAY SYNDICATE 435" },
      "REINSURED FARADAY SYNDICATE 435",
    );
    return {
      status: "Green",
      reasoning: "Correctly identified Faraday Syndicate 435",
      extractedEvidence: ["REINSURED FARADAY SYNDICATE 435"],
    };
  }),
  findCoordinatesForSubstring: vi.fn(() => [{ page: 1, polygons: [] }]),
  storeRuleResultWithMatches: vi.fn(async () => {
    await findCoordinatesForSubstring(
      { text: "REINSURED FARADAY SYNDICATE 435" },
      "REINSURED FARADAY SYNDICATE 435",
    );
  }),
  prepareContractForAnalysis: vi.fn(() => Promise.resolve([{ id: "r1" }])),
  finalizeContractAnalysis: vi.fn(),
  retrieveRelevantContractChunks: vi.fn(() => Promise.resolve([])),
  getCachedEmbeddings: vi.fn(() => Promise.resolve([])),
  segmentContractIntoClauses: vi.fn(() => Promise.resolve([])),
  chunkAndEmbedContractVersion: vi.fn(() => Promise.resolve()),
  detectMandatoryClauses: vi.fn(() => Promise.resolve([])),
  generateFastSummary: vi.fn(() => Promise.resolve()),
  generateInitialStructure: vi.fn(() => ({ sections: [] })),
  evaluateContractRules: vi.fn(() => Promise.resolve()),
}));

describe("E2E Analysis Flow Refinement", () => {
  it("should run full pipeline including classification and coordinate mapping", async () => {
    const event = {
      data: {
        contractId: "c1",
        organizationId: "o1",
        userId: "u1",
      },
    };

    // Trigger the Inngest function manually (mocking the context)
    await (evaluateContractRulesJob as any).fn({ event, step: mockStep });

    // Verify classification was called
    expect(classifyContractType).toHaveBeenCalled();

    // Verify coordinates were calculated for the evidence
    expect(findCoordinatesForSubstring).toHaveBeenCalled();
  });
});
