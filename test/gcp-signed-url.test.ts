import { describe, it, expect, vi } from "vitest";
import { generateSupabaseUploadUrl } from "@/lib/supabase/storage";

// Mock Supabase Server
vi.mock("@/lib/supabase-server", () => ({
  supabaseServer: {
    storage: {
      from: vi.fn().mockReturnValue({
        createSignedUploadUrl: vi.fn().mockResolvedValue({
          data: {
            signedUrl: "https://mock-supabase.co/signed-url",
            token: "token",
            path: "path",
          },
          error: null,
        }),
      }),
    },
  },
}));

describe("Supabase Signed URL Generation", () => {
  it("should generate a signed upload URL", async () => {
    const filePath = `test-uploads/${Date.now()}_test.pdf`;

    try {
      const { signedUrl } = await generateSupabaseUploadUrl(filePath);
      console.log(`[Test] Generated Supabase URL: ${signedUrl}`);
      expect(signedUrl).toBeDefined();
      expect(signedUrl).toContain("supabase.co");
    } catch (err: any) {
      console.error("[Test] Failed to generate signed URL:", err.message);
      throw err;
    }
  });
});
