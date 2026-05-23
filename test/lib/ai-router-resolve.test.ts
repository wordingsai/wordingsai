import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveModelProvider } from "@/lib/ai-router";

// Mock Vertex & other external providers to prevent actual API/library load issues during test
vi.mock("@ai-sdk/google-vertex", () => ({
  createVertex: () => vi.fn(() => ({})),
}));
vi.mock("@openrouter/ai-sdk-provider", () => ({
  createOpenRouter: () => vi.fn(() => ({})),
}));

describe("AI Router Model Resolution & Fallbacks", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  it("should map direct-google:gemma-4-31b-it to stable gemini-2.5-flash in fast context", () => {
    process.env.GEMINI_FAST_API_KEY = "test-fast-key";

    // We expect resolveModelProvider to rewrite and return standard gemini-2.5-flash
    // We can verify this by checking if the client/model initialization succeeds or has standard props
    const model = resolveModelProvider("direct-google:gemma-4-31b-it", "fast");
    expect(model).toBeDefined();
    expect(model.modelId).toBe("gemini-2.5-flash");
  });

  it("should map direct-google:gemma-4-31b-it to stable gemini-2.5-pro in deep context", () => {
    process.env.GEMINI_FAST_API_KEY = "test-deep-key";
    process.env.GEMINI_DEEP_API_KEY = "test-deep-key";

    const model = resolveModelProvider("direct-google:gemma-4-31b-it", "deep");
    expect(model).toBeDefined();
    expect(model.modelId).toBe("gemini-2.5-pro");
  });

  it("should fall back vertex:gemini-2.5-flash to direct-google (AI Studio) gemini-2.5-flash when GCP is not configured", () => {
    process.env.GEMINI_FAST_API_KEY = "test-fast-key";
    delete process.env.GCP_PROJECT_ID; // No GCP

    const model = resolveModelProvider("vertex:gemini-2.5-flash", "fast");
    expect(model).toBeDefined();
    // Since it falls back, it should resolve using googleFast client, hence returning gemini-2.5-flash as standard model
    expect(model.modelId).toBe("gemini-2.5-flash");
  });

  it("should fall back vertex:gemini-2.5-flash to direct-google when GEMINI_FAST_API_KEY is present to honor free keys", () => {
    process.env.GEMINI_FAST_API_KEY = "test-fast-key";
    process.env.GCP_PROJECT_ID = "gcp-project-123"; // Even if GCP is configured, fast API key overrides it

    const model = resolveModelProvider("vertex:gemini-2.5-flash", "fast");
    expect(model).toBeDefined();
    expect(model.modelId).toBe("gemini-2.5-flash");
  });
});
