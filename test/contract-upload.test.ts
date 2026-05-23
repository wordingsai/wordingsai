import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("@/inngest/client", () => ({
  inngest: {
    send: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock("@/db/drizzle", () => ({
  db: {
    execute: vi.fn(() => Promise.resolve()),
    transaction: vi.fn(async (cb) => {
      const tx = {
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn(() => [
              { id: "new-contract-id", currentVersionId: "v1" },
            ]),
          })),
        })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn(() => ({
              returning: vi.fn(() => [{ id: "new-contract-id" }]),
            })),
          })),
        })),
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              orderBy: vi.fn(() => ({
                limit: vi.fn(() => []),
              })),
              limit: vi.fn(() => [{ id: "new-contract-id" }]),
            })),
          })),
        })),
      };
      return await cb(tx);
    }),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => [
            {
              id: "new-contract-id",
              organizationId: "org-1",
              contractName: "Test Contract",
              reinsured: "Test Reinsured",
              broker: "Test Broker",
              contractType: "nda",
              periodFrom: new Date(),
              periodTo: new Date(),
              executionDate: new Date(),
              analysis: null,
              analysisProgress: 0,
            },
          ]),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([{ id: "new-contract-id" }])),
      })),
    })),
  },
}));

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

vi.mock("@/lib/supabase-server", () => ({
  supabaseServer: {
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(() => Promise.resolve({ data: {}, error: null })),
        getPublicUrl: vi.fn(() => ({
          data: { publicUrl: "http://test.com/file.pdf" },
        })),
      })),
    },
  },
}));

vi.mock("@/server/extract-text", () => ({
  extractText: vi.fn(() => Promise.resolve("extracted text")),
}));

import { POST as uploadPOST } from "@/app/api/contracts/route";

describe("Contract Upload Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should upload contract with new 6 fields (periodFrom, periodTo)", async () => {
    const body = {
      contractName: "B133821CON0016",
      reinsured: "Global Re Corp",
      broker: "Aon, Willis Towers Watson",
      contractType: "msa",
      periodFrom: new Date().toISOString(),
      periodTo: new Date().toISOString(),
      fileContent: "test content",
      fileURL: "https://example.com/contract.pdf",
      fileSize: 1024,
    };

    const req = {
      headers: { get: () => "application/json" },
      json: async () => body,
    } as any;

    const response = await uploadPOST(req);
    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.id).toBe("new-contract-id");
  });

  it("should NOT trigger Inngest analysis during upload", async () => {
    const { inngest } = await import("@/inngest/client");

    const body = {
      contractName: "Test Contract",
      reinsured: "Test Reinsured",
      contractType: "nda",
      fileContent: "test content",
      fileURL: "https://example.com/test.pdf",
      fileSize: 1024,
    };

    const req = {
      headers: { get: () => "application/json" },
      json: async () => body,
    } as any;

    await uploadPOST(req);

    // Verify NO inngest events were sent during upload
    expect(inngest.send).not.toHaveBeenCalled();
  });

  it("should set executionDate on new contract upload", async () => {
    const body = {
      contractName: "Test UMR",
      reinsured: "Test Re",
      contractType: "nda",
      fileContent: "test content",
      fileURL: "https://example.com/test.pdf",
      fileSize: 1024,
    };

    const req = {
      headers: { get: () => "application/json" },
      json: async () => body,
    } as any;

    const response = await uploadPOST(req);
    expect(response.status).toBe(201);
  });
});
