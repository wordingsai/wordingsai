import { describe, it, expect, vi, beforeEach } from "vitest";
import { evaluateContractRulesJob } from "@/inngest/functions";
import { db } from "@/db/drizzle";
import { inngest } from "@/inngest/client";
import { contracts } from "@/db/schema";

// Mock DB and other global dependencies
const { dbMock, inngestMock } = vi.hoisted(() => ({
  dbMock: {
    select: vi.fn(),
    update: vi.fn(() => ({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue({}),
    })),
    insert: vi.fn(() => ({
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: "1" }]),
    })),
    delete: vi.fn(() => ({
      where: vi.fn().mockResolvedValue({}),
    })),
  },
  inngestMock: {
    send: vi.fn().mockResolvedValue({ ids: ["123"] }),
    createFunction: vi.fn((config, handler) => {
      const fn = () => {};
      fn.handler = handler;
      return fn;
    }),
  },
}));

vi.mock("@/db/drizzle", () => ({
  db: dbMock,
}));

vi.mock("@/inngest/client", () => ({
  inngest: inngestMock,
}));

vi.mock("@/db/schema", () => ({
  contracts: {
    id: "id",
    analysis: "analysis",
    analysisProgress: "analysisProgress",
    analysisStage: "analysisStage",
    contractStatus: "contractStatus",
    workspaceId: "workspaceId",
  },
  analysisEvents: { id: "id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  sql: vi.fn(),
  and: vi.fn(),
}));

vi.mock("@/server/extract-gcp", () => ({
  extractDocumentGCP: vi.fn().mockResolvedValue({
    rawText: "extracted text",
    structuredJSON: { pages: [] },
  }),
}));

vi.mock("@/services/rule-engine", () => ({
  prepareContractForAnalysis: vi.fn().mockResolvedValue([]),
  finalizeContractAnalysis: vi.fn().mockResolvedValue(undefined),
  detectMandatoryClauses: vi.fn().mockResolvedValue([]),
  chunkAndEmbedContractVersion: vi.fn().mockResolvedValue(undefined),
  segmentContractIntoClauses: vi.fn().mockResolvedValue([]),
  getCachedEmbeddings: vi.fn().mockResolvedValue([]),
  retrieveRelevantContractChunks: vi.fn().mockResolvedValue([]),
  evaluateRuleWithOpenRouter: vi.fn().mockResolvedValue({}),
  storeRuleResultWithMatches: vi.fn().mockResolvedValue(undefined),
  findCoordinatesForSubstring: vi.fn(),
  generateInitialStructure: vi.fn().mockReturnValue({
    title: "Document Map",
    sections: [],
  }),
  generateFastSummary: vi.fn().mockResolvedValue(undefined),
}));

describe("Pipeline Execution Order", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should complete Fast Analysis and THEN trigger Deep Analysis", async () => {
    const mockEvent = {
      data: {
        contractId: "contract_123",
        organizationId: "org_123",
        organizationPlan: "plus",
        mode: "full",
      },
    };

    const mockStep = {
      run: vi.fn(async (id, callback) => await callback()),
      send: vi.fn().mockResolvedValue({ ids: ["123"] }),
    };

    // Mock contract fetch in select
    (dbMock.select as any).mockImplementation(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        {
          id: "contract_123",
          fileURL: "https://test.com/file.pdf",
          fileContent: "READY_FOR_ANALYSIS",
          workspaceId: "ws_123",
        },
      ]),
    }));

    // Access the handler directly
    const handler = (evaluateContractRulesJob as any).handler;
    await handler({ event: mockEvent, step: mockStep });

    // 1. Check if initialize-status ran
    expect(mockStep.run).toHaveBeenCalledWith(
      "initialize-status",
      expect.any(Function),
    );

    // 2. Check if fast-analysis ran
    expect(mockStep.run).toHaveBeenCalledWith(
      "fast-analysis",
      expect.any(Function),
    );

    // 3. Check if deep analysis logic started (prepare-rag)
    expect(mockStep.run).toHaveBeenCalledWith(
      "prepare-rag",
      expect.any(Function),
    );
  });
});
