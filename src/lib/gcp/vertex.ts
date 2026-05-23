import { createVertex } from "@ai-sdk/google-vertex";
import { gcpAuthClient } from "./auth";

const GCP_PROJECT_ID =
  process.env.GCP_PROJECT_ID || process.env.GCP_PROJECT_NUMBER;
// Models like gemini-2.5-flash have much better availability in us-central1 or europe-west1
const VERTEX_LOCATION = "europe-west1";

/**
 * Vertex AI Instance configured for Vercel OIDC + Workload Identity.
 * Falls back to default credentials (ADC) or explicit keys if OIDC is not configured.
 */
export const vertex = createVertex({
  project: GCP_PROJECT_ID,
  location: VERTEX_LOCATION,
  googleAuthOptions: gcpAuthClient
    ? {
        authClient: gcpAuthClient as any,
        projectId: GCP_PROJECT_ID,
      }
    : {
        projectId: GCP_PROJECT_ID,
      },
});
