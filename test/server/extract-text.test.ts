import { describe, it, expect, vi } from "vitest";

// Mock all GCP dependencies so the module loads cleanly in unit tests
vi.mock("@google-cloud/documentai", () => ({
  DocumentProcessorServiceClient: vi.fn().mockImplementation(() => ({
    getProjectId: vi.fn().mockResolvedValue("test-project"),
    processDocument: vi
      .fn()
      .mockResolvedValue([{ document: { text: "Extracted text" } }]),
  })),
}));

vi.mock("@google-cloud/vision", () => ({
  default: {
    ImageAnnotatorClient: vi.fn().mockImplementation(() => ({
      documentTextDetection: vi
        .fn()
        .mockResolvedValue([{ fullTextAnnotation: { text: "Vision text" } }]),
    })),
  },
}));

vi.mock("@/lib/gcp/storage", () => ({
  gcpStorage: {
    bucket: vi.fn().mockReturnValue({
      file: vi.fn().mockReturnValue({
        download: vi.fn().mockResolvedValue([Buffer.from("%PDF-test")]),
        getMetadata: vi.fn().mockResolvedValue([{ size: "100000" }]),
      }),
    }),
  },
  GCP_BUCKET_NAME: "test-bucket",
}));

vi.mock("@/lib/gcp/auth", () => ({ gcpAuthClient: null }));

describe("GCP Document Extraction", () => {
  it("should export extractDocumentGCP", async () => {
    const mod = await import("@/server/extract-gcp");
    expect(typeof mod.extractDocumentGCP).toBe("function");
  });
});
