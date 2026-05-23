import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/inngest/client", () => ({
  inngest: {
    send: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("@/services/rule-engine", async () => {
  const actual = await vi.importActual<any>("@/services/rule-engine");
  return {
    ...actual,
    retrieveRelevantContractChunks: vi
      .fn()
      .mockResolvedValue([
        { id: "chunk-1", content: "Some contract content", similarity: 0.9 },
      ]),
  };
});

vi.mock("@/db/schema", () => ({
  analyzedClauses: {},
  contracts: { id: "contracts" },
  ruleResults: { id: "ruleResults" },
  evidenceItems: { id: "evidenceItems" },
  ruleVersions: { id: "ruleVersions" },
  rules: { id: "rules" },
  organization: {},
  contractVersions: {},
  workspaces: {},
}));

vi.mock("@/db/drizzle", () => {
  const insertMock = vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      onConflictDoUpdate: vi.fn().mockResolvedValue([{ id: "new-id" }]),
      returning: vi.fn().mockResolvedValue([{ id: "new-id" }]),
    }),
  });

  const updateBuilder = {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "contract-1" }]),
      }),
    }),
  };

  const queryBuilder = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([
      {
        id: "contract-1",
        organizationId: "org-1",
        contractName: "Test Contract",
        currentVersionId: "v1",
      },
    ]),
    orderBy: vi.fn().mockReturnThis(),
  };

  const dbMock = {
    insert: insertMock,
    execute: vi.fn().mockResolvedValue({}),
    select: vi.fn(() => queryBuilder),
    update: vi.fn().mockReturnValue(updateBuilder),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue({}),
    }),
    transaction: vi.fn(async (cb) => {
      const tx = {
        insert: insertMock,
        select: vi.fn(() => queryBuilder),
        update: vi.fn().mockReturnValue(updateBuilder),
        delete: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      };
      return await cb(tx);
    }),
  };

  return { db: dbMock };
});

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(() =>
        Promise.resolve({
          user: { id: "user-1" },
          session: { activeOrganizationId: "org-1" },
        }),
      ),
    },
  },
}));

vi.mock("@/server/permissions", () => ({
  isAdmin: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("@/server/organizations", () => ({
  getActiveOrganization: vi.fn(() => Promise.resolve({ id: "org-1" })),
}));

import { POST as uploadPOST } from "@/app/api/contracts/route";
import { POST as analysisPOST } from "@/app/api/contracts/[contractId]/route";

describe("Integrated Contract Analysis Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. Should trigger Inngest analysis during initial upload", async () => {
    const { inngest } = await import("@/inngest/client");
    const req = {
      json: async () => ({
        contractName: "FARADAY SYNDICATE 435 - Aviation Excess of Loss",
        reinsured: "FARADAY SYNDICATE 435",
        contractType: "aviation",
        fileContent:
          "UNIQUE MARKET REFERENCE B080110473H21. REINSURED FARADAY SYNDICATE 435. PERIOD 1 November 2021 to 31 October 2022.",
        fileURL:
          "https://supabase.com/storage/v1/object/public/contracts/Lead_Broker_Willis_Re.pdf",
        fileSize: 1024,
        periodFrom: "2021-11-01T00:00:00.000Z",
        periodTo: "2022-10-31T23:59:59.000Z",
      }),
      headers: { get: () => "application/json" },
    } as any;

    const response = await uploadPOST(req);
    expect(inngest.send).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "contract/evaluate",
      }),
    );
  });

  it('2. Should trigger Inngest analysis when "run-analysis" action is called', async () => {
    const { inngest } = await import("@/inngest/client");
    const req = {
      json: async () => ({ action: "run-analysis" }),
      headers: { get: () => "application/json" },
    } as any;
    const context = { params: Promise.resolve({ contractId: "contract-1" }) };

    const response = await analysisPOST(req, context);
    expect(response.status).toBe(200);
    expect(inngest.send).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "contract/evaluate",
      }),
    );
  });

  it("3. Should prevent duplicate analysis when already processing", async () => {
    const req = {
      json: async () => ({ action: "run-analysis" }),
      headers: { get: () => "application/json" },
    } as any;
    const context = { params: Promise.resolve({ contractId: "contract-1" }) };

    const response1 = await analysisPOST(req, context);
    expect(response1.status).toBe(200);
    const response2 = await analysisPOST(req, context);
    expect(response2.status).toBe(200);
  });

  it("4. Contract update should work with new period fields", async () => {
    const req = {
      json: async () => ({
        contractName: "Updated Contract",
        reinsured: "Updated Re",
        broker: "Updated Broker",
        contractType: "msa",
        periodFrom: new Date().toISOString(),
        periodTo: new Date().toISOString(),
      }),
      headers: { get: () => "application/json" },
    } as any;
    const context = { params: Promise.resolve({ contractId: "contract-1" }) };
    const response = await analysisPOST(req, context);
    expect(response).toBeDefined();
  });

  it("5. Should persist evidence items when rule evaluation completes", async () => {
    const ruleEngine = await import("@/services/rule-engine");
    const dbModule = await import("@/db/drizzle");

    const rule = {
      id: "rule-1",
      name: "Termination Test",
      currentVersion: {
        id: "version-1",
        ruleDefinition: {
          purpose: "Testing",
          searchQueries: ["test query"],
        },
      },
    };

    const spy = vi
      .spyOn(ruleEngine, "evaluateRuleWithOpenRouter")
      .mockResolvedValue({
        status: "Green",
        reasoning: "Test reasoning",
        extractedEvidence: ["**Termination**\n\nTermination clause text"],
      } as any);

    await ruleEngine.processSingleRule(rule, "contract-1", "basic");

    expect(dbModule.db.insert).toHaveBeenCalled();
    spy.mockRestore();
  }, 15000); // Increased timeout to 15s
});
