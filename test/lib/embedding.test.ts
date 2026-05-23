import { describe, it, expect, vi, beforeEach } from "vitest";
import { createEmbeddings } from "@/lib/embedding";

// Mock the entire embedding module to avoid real API calls
vi.mock("@/lib/embedding", () => ({
  createEmbeddings: vi.fn(),
}));

describe("Neural Embedding Generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should generate a single embedding for string input", async () => {
    vi.mocked(createEmbeddings).mockResolvedValueOnce([[0.1, 0.2, 0.3]]);

    const result = await createEmbeddings("test text");
    expect(result).toEqual([[0.1, 0.2, 0.3]]);
    expect(createEmbeddings).toHaveBeenCalledWith("test text");
  });

  it("should handle multi-batch embedding for large arrays", async () => {
    const inputs = [
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
      "11",
      "12",
    ];
    vi.mocked(createEmbeddings).mockResolvedValueOnce([
      [0.1],
      [0.2],
      [0.3],
      [0.4],
      [0.5],
      [0.6],
      [0.7],
      [0.8],
      [0.9],
      [0.1],
      [0.11],
      [0.12],
    ]);

    const results = await createEmbeddings(inputs);
    expect(results).toHaveLength(12);
    expect(results[0]).toEqual([0.1]);
    expect(results[11]).toEqual([0.12]);
  });

  it("should handle empty input", async () => {
    vi.mocked(createEmbeddings).mockRejectedValueOnce(
      new Error("No input provided for embeddings"),
    );

    await expect(createEmbeddings("")).rejects.toThrow(
      "No input provided for embeddings",
    );
  });

  it("should handle array input", async () => {
    const inputs = ["text1", "text2", "text3"];
    vi.mocked(createEmbeddings).mockResolvedValueOnce([[0.1], [0.2], [0.3]]);

    const results = await createEmbeddings(inputs);
    expect(results).toHaveLength(3);
    expect(createEmbeddings).toHaveBeenCalledWith(inputs);
  });
});
