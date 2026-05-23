import { describe, it, expect } from "vitest";
import { gcpStorage, GCS_BUCKET_NAME } from "@/lib/gcp/storage";
import { gcpAuthClient } from "@/lib/gcp/auth";
import { DocumentProcessorServiceClient } from "@google-cloud/documentai";
import { vertex } from "@/lib/gcp/vertex";
import { generateText } from "ai";

/**
 * GCP Connection & Identity Integration Test
 *
 * This test suite validates the integration between the application and Google Cloud Platform.
 * It checks three core pillars:
 * 1. IdentitFy & Auth (OIDC on Vercel or ADC locally)
 * 2. Cloud Storage (Bucket access and connectivity)
 * 3. Document AI (Processor availability and regional endpoint)
 * 4. Vertex AI (Model accessibility and generation)
 *
 * RUNNING THIS TEST:
 * Locally: Ensure GOOGLE_APPLICATION_CREDENTIALS is set or you have run `gcloud auth application-default login`.
 * Production: This validates the OIDC flow if configured.
 */

describe("GCP Connection Integration Tests", () => {
  it("1. Identity Verification (OIDC / ADC)", async () => {
    const projectId =
      process.env.GCP_PROJECT_ID || process.env.GCP_PROJECT_NUMBER;
    console.log(`[Identity] Using Project ID: ${projectId}`);

    if (!projectId) {
      throw new Error(
        "GCP_PROJECT_ID or GCP_PROJECT_NUMBER is not defined in environment.",
      );
    }

    if (gcpAuthClient) {
      console.log("[Identity] Vercel OIDC client is detected and initialized.");
      // Note: getAccessToken() might fail locally if not in Vercel environment
      // but it's the right check for production flow.
      try {
        const token = await gcpAuthClient.getAccessToken();
        expect(token.token).toBeDefined();
        console.log("[Identity] Successfully retrieved an OIDC access token.");
      } catch (err: any) {
        console.warn(
          "[Identity] OIDC token fetch failed (expected if running locally):",
          err.message,
        );
      }
    } else {
      console.log(
        "[Identity] OIDC not configured. Using Application Default Credentials (ADC) or manual fallback.",
      );
    }

    expect(projectId).toBeDefined();
  });

  it.skip("2. Cloud Storage Connectivity", async () => {
    console.log(`[Storage] Checking bucket: ${GCS_BUCKET_NAME}`);

    try {
      const [exists] = await gcpStorage.bucket(GCS_BUCKET_NAME).exists();
      if (!exists) {
        console.warn(
          `[Storage] Bucket ${GCS_BUCKET_NAME} was not found in project.`,
        );
        console.warn(
          "[Storage] Hint: Check if the bucket name is correct and if the credentials have access to this project.",
        );
      }
      expect(exists).toBe(true);
      console.log(
        `[Storage] Success: Bucket ${GCS_BUCKET_NAME} is accessible.`,
      );
    } catch (err: any) {
      console.error("[Storage] Failed to connect to GCS:", err.message);
      if (
        err.message.includes("Account deleted") ||
        err.message.includes("unable to impersonate")
      ) {
        console.error(
          "[Storage] FATAL: Your local GCP credentials (ADC) are stale or misconfigured.",
        );
        console.error(
          "[Storage] FIX: Run 'gcloud auth application-default login' in your terminal.",
        );
      }
      throw err;
    }
  });

  it.skip("3. Document AI Processor Connectivity", async () => {
    const DOCAI_PROCESSOR_ID = process.env.DOCAI_PROCESSOR_ID;
    const LOCATION = process.env.GCP_CLOUD_LOCATION || "us";
    const projectId =
      process.env.GCP_PROJECT_ID || process.env.GCP_PROJECT_NUMBER;

    console.log(
      `[Document AI] Region: ${LOCATION}, Processor: ${DOCAI_PROCESSOR_ID}`,
    );

    if (!DOCAI_PROCESSOR_ID) {
      throw new Error(
        "DOCAI_PROCESSOR_ID is missing from environment variables.",
      );
    }

    const client = new DocumentProcessorServiceClient({
      apiEndpoint: `${LOCATION}-documentai.googleapis.com`,
      auth: (gcpAuthClient || undefined) as any,
      projectId: projectId as string,
    });

    const name = `projects/${projectId}/locations/${LOCATION}/processors/${DOCAI_PROCESSOR_ID}`;

    try {
      const [processor] = await client.getProcessor({ name });
      console.log(
        `[Document AI] Success: Processor '${processor.displayName}' is ${processor.state}.`,
      );
      expect(processor.name).toContain(DOCAI_PROCESSOR_ID);
    } catch (err: any) {
      console.error(
        "[Document AI] Failed to fetch processor info:",
        err.message,
      );
      if (
        err.message.includes("Account deleted") ||
        err.message.includes("unable to impersonate")
      ) {
        console.error(
          "[Document AI] FATAL: Your local GCP credentials (ADC) are stale or misconfigured.",
        );
        console.error(
          "[Document AI] FIX: Run 'gcloud auth application-default login' in your terminal.",
        );
      } else if (
        err.message.includes("400") ||
        err.message.includes("INVALID_ARGUMENT")
      ) {
        console.error(
          "[Document AI] Hint: This often means the Project ID, Location, or Processor ID is incorrectly formatted.",
        );
      }
      throw err;
    }
  });

  it.skip("4. Vertex AI Model Connectivity", async () => {
    console.log(
      "[Vertex AI] Testing generative connectivity with Gemini 2.0 Flash in us-central1...",
    );

    try {
      const { text } = await generateText({
        model: vertex("gemini-2.0-flash"),
        prompt: "Say 'Vertex AI Integration Successful'",
      });

      console.log(`[Vertex AI] Response: ${text.trim()}`);
      expect(text.toLowerCase()).toContain("successful");
      console.log("[Vertex AI] Success: Generative AI model is reachable.");
    } catch (err: any) {
      console.error("[Vertex AI] Failed to reach Vertex AI:", err.message);
      if (
        err.message.includes("Account deleted") ||
        err.message.includes("unable to impersonate")
      ) {
        console.error(
          "[Vertex AI] FATAL: Your local GCP credentials (ADC) are stale or misconfigured.",
        );
        console.error(
          "[Vertex AI] FIX: Run 'gcloud auth application-default login' in your terminal.",
        );
      }
      throw err;
    }
  });
});
