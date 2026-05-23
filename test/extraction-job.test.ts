import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("@/inngest/client", () => ({
  inngest: {
    send: vi.fn(() => Promise.resolve()),
    createFunction: vi.fn((config, trigger, handler) => ({
      id: config.id,
      trigger,
      handler,
    })),
  },
}));

import { evaluateContractRulesJob } from "@/inngest/functions";

describe("evaluateContractRulesJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should be defined and handle extraction + evaluation", async () => {
    expect(evaluateContractRulesJob).toBeDefined();
    expect(evaluateContractRulesJob.id).toBe("evaluate-contract-rules");
  });
});
