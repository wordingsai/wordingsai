import { describe, it, expect } from "vitest";
import { chunkText } from "@/lib/text-processing";

describe("Semantic Text Chunking", () => {
  it("should return an empty array for empty input", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   ")).toEqual([]);
  });

  it("should create a single chunk for short text", () => {
    const text = "This is a short clause for testing.";
    const chunks = chunkText(text, "test.pdf", 500);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe(text);
    expect(chunks[0].sourceFileName).toBe("test.pdf");
  });

  it("should split text that exceeds maxChunkSize", () => {
    // 1000 characters of 'a'
    const longText = "a".repeat(1000);
    const chunks = chunkText(longText, "long.pdf", 400);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].content.length).toBeLessThanOrEqual(500); // Buffer allowed in logic
  });

  it("should preserve paragraph boundaries where possible", () => {
    const text =
      "Paragraph 1 is here.\n\nParagraph 2 is over here.\n\nParagraph 3 is also here.";
    const chunks = chunkText(text, "para.pdf", 40);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0].content).toContain("Paragraph 1");
    expect(chunks[1].content).toContain("Paragraph 2");
  });

  it("should handle multi-document markers correctly", () => {
    const text =
      "--- DOCUMENT: doc1.pdf ---\n\nContent 1\n\n--- DOCUMENT: doc2.pdf ---\n\nContent 2";
    // The chunker doesn't handle markers itself (it's handled in the workflow loop),
    // but it should at least chunk the combined content properly.
    const chunks = chunkText(text, "combined.pdf", 800);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toContain("doc1.pdf");
    expect(chunks[0].content).toContain("doc2.pdf");
  });

  it("should filter out extremely short noise paragraphs", () => {
    const text =
      "Valid paragraph with enough content for analysis.\n\nTiny\n\nAnother valid paragraph.";
    const chunks = chunkText(text, "noise.pdf", 800);
    const combined = chunks.map((c) => c.content).join(" ");
    expect(combined).not.toContain("Tiny");
  });
});
