import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateJSON } from "@/lib/ai-router";
import { z } from "zod";
import { getGlobalCache, setGlobalCache } from "@/lib/cache";
import { generateObject, generateText } from "ai";

// Mock the AI SDK and local modules
vi.mock("ai", () => ({
  generateObject: vi.fn(),
  generateText: vi.fn(),
}));

vi.mock("@/lib/cache", () => ({
  getGlobalCache: vi.fn(),
  setGlobalCache: vi.fn(),
}));

describe("AI Router Stability & Caching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return cached result if available", async () => {
    const mockSchema = z.object({ test: z.string() });
    const mockResult = { test: "cached" };

    vi.mocked(getGlobalCache).mockResolvedValueOnce(mockResult);

    const result = await generateJSON(
      mockSchema,
      [{ role: "user", content: "hello" }],
      undefined,
      "vertex:gemini-2.0-flash",
    );

    expect(result).toEqual(mockResult);
    expect(generateObject).not.toHaveBeenCalled();
    expect(getGlobalCache).toHaveBeenCalled();
  });

  it("should call AI and cache result if no cache hit", async () => {
    const mockSchema = z.object({ test: z.string() });
    const mockResult = { test: "fresh" };

    vi.mocked(getGlobalCache).mockResolvedValueOnce(null);

    // For Groq models, the router uses generateText, not generateObject
    vi.mocked(generateText).mockResolvedValueOnce({
      text: JSON.stringify(mockResult),
    } as any);

    const result = await generateJSON(
      mockSchema,
      [{ role: "user", content: "hello" }],
      undefined,
      "direct-groq:llama-3-8b-instruct",
    );

    expect(result).toEqual(mockResult);
    // For Groq, generateText is used, not generateObject
    expect(generateText).toHaveBeenCalled();
    expect(setGlobalCache).toHaveBeenCalled();
  });
});
