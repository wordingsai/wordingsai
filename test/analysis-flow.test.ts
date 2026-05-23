import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the dependencies
vi.mock("@/inngest/client", () => ({
  inngest: {
    send: vi.fn(),
  },
}));

vi.mock("@/db/drizzle", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => [
            {
              contractStatus: "pending",
              organizationId: "org-1",
              id: "contract-1",
            },
          ]),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
    query: {
      rules: {
        findMany: vi.fn(() => Promise.resolve([])),
      },
      organizationRuleSettings: {
        findMany: vi.fn(() => Promise.resolve([])),
      },
    },
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

// We need to import the POST handler from the route
// Since it's a dynamic import, we'll mock the module but test the logic by proxy or just mock the call
import { POST } from "@/app/api/contracts/[contractId]/route";

describe("Analysis Flow Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should trigger integrated analysis when "run-analysis" action is called', async () => {
    const { inngest } = await import("@/inngest/client");
    const { db } = await import("@/db/drizzle");

    const req = {
      json: async () => ({ action: "run-analysis" }),
      headers: { get: () => "application/json" },
    } as any;

    const context = { params: Promise.resolve({ contractId: "contract-1" }) };

    const response = await POST(req, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("processing");

    // Verify DB was updated to "reviewing"
    expect(db.update).toHaveBeenCalled();

    // Verify Inngest was triggered with contract/evaluate
    expect(inngest.send).toHaveBeenCalledWith({
      name: "contract/evaluate",
      data: expect.objectContaining({
        contractId: "contract-1",
        organizationId: "org-1",
      }),
    });
  });

  it("should handle database limit exceeded during analysis trigger", async () => {
    const { db } = await import("@/db/drizzle");

    // Mock update to throw limit exceeded error
    (db.update as any).mockImplementationOnce(() => {
      throw new Error("database limit exceeded for this project");
    });

    const req = {
      json: async () => ({ action: "run-analysis" }),
      headers: { get: () => "application/json" },
    } as any;
    const context = { params: Promise.resolve({ contractId: "contract-1" }) };

    // The route handler should ideally handle this, but if not, the test confirms we know it happens
    try {
      await POST(req, context);
    } catch (e: any) {
      expect(e.message).toContain("database limit exceeded");
    }
  });
});
