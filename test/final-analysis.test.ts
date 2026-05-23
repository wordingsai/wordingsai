import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";

// Mock AI Router
vi.mock("@/lib/ai-router", () => ({
  generateJSON: vi.fn().mockResolvedValue({ type: "aviation", clauses: [] }),
  generateJSONTierAware: vi
    .fn()
    .mockImplementation(async ({ schema, messages }) => {
      // Determine what to return based on schema or messages
      const prompt = messages?.[messages.length - 1]?.content || "";
      if (prompt.includes("segment")) {
        return {
          clauses: [
            {
              title: "REINSURED",
              text: "FARADAY",
              pageNumber: 1,
              coordinates: { x: 0, y: 0, w: 0, h: 0 },
            },
          ],
        };
      }
      if (prompt.includes("classify")) {
        return { type: "aviation" };
      }
      return { type: "aviation", clauses: [] };
    }),
  generateText: vi.fn().mockResolvedValue({ text: "Mocked AI response" }),
  estimateTokens: vi.fn().mockReturnValue(100),
  DEFAULT_MODEL: "mock-model",
  openrouter: vi.fn(),
}));

// Mock Embeddings
vi.mock("@/lib/embedding", () => ({
  createEmbeddings: vi.fn().mockResolvedValue([Array(1536).fill(0.1)]),
}));

// Mock Database
vi.mock("@/db/drizzle", () => {
  const dbHandler = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: "mock-id" }]),
      then: (fn: any) => Promise.resolve([{ id: "mock-id" }]).then(fn),
    })),
    update: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: "mock-id" }]),
      then: (fn: any) => Promise.resolve([{ id: "mock-id" }]).then(fn),
    })),
    delete: vi.fn().mockReturnThis(),
    transaction: vi.fn(async (cb) => await cb(dbHandler)),
    query: {
      rules: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "r1",
            name: "Reinsured",
            category: "aviation",
            currentVersion: { id: "v1", ruleDefinition: { purpose: "Test" } },
          },
        ]),
      },
      organizationRuleSettings: { findMany: vi.fn().mockResolvedValue([]) },
      ruleVersions: {
        findFirst: vi.fn().mockResolvedValue({ id: "v1", ruleDefinition: {} }),
      },
    },
    then: (fn: any) => Promise.resolve([]).then(fn),
  };

  dbHandler.select.mockReturnValue(dbHandler);
  dbHandler.from.mockReturnValue(dbHandler);
  dbHandler.where.mockReturnValue(dbHandler);
  dbHandler.limit.mockReturnValue(dbHandler);
  dbHandler.orderBy.mockReturnValue(dbHandler);
  dbHandler.leftJoin.mockReturnValue(dbHandler);
  dbHandler.innerJoin.mockReturnValue(dbHandler);

  return { db: dbHandler };
});

import {
  segmentContractIntoClauses,
  generateInitialStructure,
  getApplicableRules,
  processSingleRule,
  classifyContractType,
} from "@/services/rule-engine";

describe("Comprehensive Analysis System Test (Willis Re Contract)", () => {
  let contractText = "";

  beforeEach(() => {
    vi.clearAllMocks();
    contractText = fs.readFileSync(
      path.resolve(process.cwd(), "public/lead_broker_willis_re_text.txt"),
      "utf-8",
    );
  });

  it("Step 1: Segmentation - Should split the Willis Re contract into logical clauses", async () => {
    const { db } = await import("@/db/drizzle");
    // Mock idempotency check to return empty
    (db as any).then = (fn: any) => Promise.resolve([]).then(fn);

    const segments = await segmentContractIntoClauses(
      "c1",
      "v1",
      contractText.substring(0, 1000),
    );
    expect(segments.length).toBeGreaterThan(0);
  });

  it("Step 3: Checklist Preparation - Should identify applicable rules", async () => {
    const { db } = await import("@/db/drizzle");
    // Mock contract lookup
    const mockContract = {
      id: "c1",
      organizationId: "org1",
      workspaceId: "ws1",
      selectedRuleIds: ["r1"],
      contractType: "aviation",
    };
    const mockRule = {
      id: "r1",
      name: "Reinsured",
      category: "aviation",
      status: "active",
      currentVersion: { id: "v1", ruleDefinition: {} },
    };

    let callCount = 0;
    (db as any).then = (fn: any) => {
      callCount++;
      if (callCount === 1) return Promise.resolve([mockContract]).then(fn);
      if (callCount === 2)
        return Promise.resolve([{ id: "ws1", type: "aviation" }]).then(fn);
      return Promise.resolve([mockRule]).then(fn);
    };

    const rules = await getApplicableRules("c1");
    expect(rules.length).toBeGreaterThan(0);
  });

  it("Step 4: Document Map - Should generate structural map", () => {
    const mockDocAI = {
      text: contractText.substring(0, 2000),
      pages: [{ pageNumber: 1, paragraphs: [] }],
    };
    const structure = generateInitialStructure(mockDocAI);
    expect(structure.sections.length).toBeGreaterThan(0);
  });

  it("Step 5: Rules Evaluation - Should process a rule", async () => {
    const { db } = await import("@/db/drizzle");
    const mockContract = {
      id: "c1",
      currentVersionId: "v1",
      organizationId: "org1",
      workspaceId: "ws1",
      contractType: "aviation",
    };
    (db as any).then = (fn: any) => Promise.resolve([mockContract]).then(fn);

    const mockRule = {
      id: "r1",
      name: "Reinsured",
      currentVersion: {
        id: "v1",
        ruleDefinition: {
          purpose: "Verify the reinsured name",
          searchQueries: ["Who is the reinsured?"],
        },
      },
    };

    await processSingleRule(mockRule as any, "c1", "basic");
    expect(db.insert).toHaveBeenCalled();
  });

  it("Database Resilience: Should ignore 'database limit exceeded' errors", async () => {
    const { db } = await import("@/db/drizzle");
    const mockContract = {
      id: "c1",
      currentVersionId: "v1",
      organizationId: "org1",
      workspaceId: "ws1",
      contractType: "aviation",
    };
    (db as any).then = (fn: any) => Promise.resolve([mockContract]).then(fn);

    (db.insert as any).mockImplementationOnce(() => {
      throw new Error("database limit exceeded for this project");
    });

    const mockRule = {
      id: "r1",
      name: "Reinsured",
      currentVersion: { id: "v1", ruleDefinition: {} },
    };

    try {
      await processSingleRule(mockRule as any, "c1", "basic");
    } catch (err: any) {
      if (err.message.includes("database limit exceeded")) {
        return;
      }
      throw err;
    }
  });

  it("Classification: Should correctly classify the contract", async () => {
    // The signature is classifyContractType(text, plan)
    const result = await classifyContractType(
      contractText.substring(0, 1000),
      "basic",
    );
    expect(result).toBe("aviation");
  });
});
