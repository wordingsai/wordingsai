import { getVercelOidcToken } from "@vercel/oidc";
import {
  ExternalAccountClient,
  ExternalAccountSupplierContext,
} from "google-auth-library";

// Load and trim all environment variables to avoid trailing whitespace issues
export const GCP_PROJECT_NUMBER = process.env.GCP_PROJECT_NUMBER?.trim();
export const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID?.trim();
export const GCP_SERVICE_ACCOUNT_EMAIL =
  process.env.GCP_SERVICE_ACCOUNT_EMAIL?.trim();
export const GCP_WORKLOAD_IDENTITY_POOL_ID =
  process.env.GCP_WORKLOAD_IDENTITY_POOL_ID?.trim() || "vercel";
export const GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID =
  process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID?.trim() || "vercel";
export const GCP_CLOUD_LOCATION =
  process.env.GCP_CLOUD_LOCATION?.trim() || "europe-west2";

// Check if we are running on Vercel
const IS_VERCEL = !!process.env.VERCEL || !!process.env.NEXT_PUBLIC_VERCEL_ENV;

/**
 * The audience MUST match what is configured in the GCP Workload Identity Provider.
 * Format: //iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_ID/providers/PROVIDER_ID
 */
const audience =
  GCP_PROJECT_NUMBER && /^\d+$/.test(GCP_PROJECT_NUMBER)
    ? `//iam.googleapis.com/projects/${GCP_PROJECT_NUMBER}/locations/global/workloadIdentityPools/${GCP_WORKLOAD_IDENTITY_POOL_ID}/providers/${GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID}`
    : null;

// Validation warning for local dev
if (GCP_PROJECT_NUMBER && !/^\d+$/.test(GCP_PROJECT_NUMBER)) {
  console.warn(
    "[GCP Auth] GCP_PROJECT_NUMBER is not numeric. Ensure you use the numeric Project Number, not the Project ID.",
  );
}

/**
 * Subject Token Supplier for Vercel OIDC.
 * This function is called by google-auth-library to get the identity token from Vercel.
 */
const getSubjectToken = async (
  _context: ExternalAccountSupplierContext,
): Promise<string> => {
  if (!IS_VERCEL) {
    throw new Error(
      "[GCP Auth] Vercel OIDC is only available on Vercel deployments. For local development, use service account keys (GOOGLE_APPLICATION_CREDENTIALS).",
    );
  }

  try {
    // getVercelOidcToken() retrieves the JWT from Vercel's environment.
    // The audience in the emitted JWT is pre-configured by Vercel.
    // Ensure "OIDC Token" is enabled in your Vercel Project Settings -> Security.
    if (!audience) {
      throw new Error("[GCP Auth] Audience is null. Check GCP_PROJECT_NUMBER.");
    }

    const token = await getVercelOidcToken();
    if (!token) {
      throw new Error(
        "[GCP Auth] Vercel OIDC token returned empty. Check if OIDC is enabled in Vercel settings.",
      );
    }
    console.log("[GCP Auth] Successfully retrieved Vercel OIDC token");
    return token;
  } catch (err: any) {
    console.error(
      "[GCP Auth] Failed to fetch Vercel OIDC token:",
      err?.message || String(err),
    );
    throw err;
  }
};

/**
 * Reusable GCP Auth Client for Vercel OIDC Integration.
 * Uses Service Account Impersonation to act as the target service account.
 */
export const gcpAuthClient =
  audience && GCP_SERVICE_ACCOUNT_EMAIL && IS_VERCEL
    ? (() => {
        const client = ExternalAccountClient.fromJSON({
          type: "external_account",
          audience: audience,
          subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
          token_url: "https://sts.googleapis.com/v1/token",
          service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${GCP_SERVICE_ACCOUNT_EMAIL}:generateAccessToken`,
          subject_token_supplier: {
            getSubjectToken,
          },
        } as any);

        // Polyfill for newer Google Cloud SDKs that expect getUniverseDomain on any auth client
        if (client && typeof (client as any).getUniverseDomain !== "function") {
          (client as any).getUniverseDomain = () => "googleapis.com";
        }

        // Polyfill for getClient which is expected by many Google Cloud service builders (like Document AI)
        if (client && typeof (client as any).getClient !== "function") {
          (client as any).getClient = async () => client;
        }

        // Polyfill for getCredentialsAsync which is expected by @google-cloud/storage
        // ExternalAccountClient inherits this from AuthClient but returns null client_email
        // since it uses WIF/OIDC instead of static keys. Override to return the real email.
        (client as any).getCredentialsAsync = async () => {
          return { client_email: GCP_SERVICE_ACCOUNT_EMAIL };
        };

        // Polyfill for sign() method required for GCS Signed URLs (signBlob API)
        if (client && typeof (client as any).sign !== "function") {
          (client as any).sign = async (blob: Buffer) => {
            console.log(
              `[GCP Auth] Signing blob via IAM API for ${GCP_SERVICE_ACCOUNT_EMAIL}...`,
            );
            const token = await client.getAccessToken();
            const url = `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${GCP_SERVICE_ACCOUNT_EMAIL}:signBlob`;
            const response = await fetch(url, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token.token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                payload: blob.toString("base64"),
              }),
            });

            if (!response.ok) {
              const error = await response.text();
              throw new Error(`[GCP Auth] IAM signBlob failed: ${error}`);
            }

            const data = await response.json();
            return Buffer.from(data.signedBlob, "base64");
          };
        }

        // Explicitly set scopes for the impersonated token
        (client as any).scopes = [
          "https://www.googleapis.com/auth/cloud-platform",
        ];

        return client;
      })()
    : null;

// Debug log (only on server, masked)
if (IS_VERCEL) {
  if (audience && GCP_SERVICE_ACCOUNT_EMAIL) {
    console.log(
      `[GCP Auth] Initialized with Audience: ...${audience.slice(-30)}`,
    );
    console.log(
      `[GCP Auth] Target Service Account: ${GCP_SERVICE_ACCOUNT_EMAIL}`,
    );
  } else {
    console.warn(
      "[GCP Auth] Missing configuration for Vercel OIDC. Falling back to Application Default Credentials.",
    );
    if (!GCP_PROJECT_NUMBER)
      console.warn("[GCP Auth] GCP_PROJECT_NUMBER is missing.");
    if (GCP_PROJECT_NUMBER && !/^\d+$/.test(GCP_PROJECT_NUMBER))
      console.warn(
        `[GCP Auth] GCP_PROJECT_NUMBER ("${GCP_PROJECT_NUMBER}") is NOT numeric. It MUST be the numeric ID (e.g., 582123456789), not the string project-id.`,
      );
    if (!GCP_SERVICE_ACCOUNT_EMAIL)
      console.warn("[GCP Auth] GCP_SERVICE_ACCOUNT_EMAIL is missing.");
  }
}

/**
 * [TROUBLESHOOTING CHECKLIST]
 * If auth fails in production:
 * 1. Ensure "OIDC Token" is enabled in Vercel Project Settings -> Security.
 * 2. Verify GCP_PROJECT_NUMBER is the NUMERIC ID from IAM -> Settings.
 * 3. In GCP Console, ensure the Workload Identity Provider "Allowed Audience" matches "https://vercel.com/[TEAM_SLUG]".
 * 4. IMPORTANT: Ensure the WIF Principal has 'roles/iam.serviceAccountTokenCreator' role on the target Service Account.
 *    Principal format: principal://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_ID/subject/owner:TEAM:project:PROJ:environment:ENV
 */

export const isVercelOidcEnabled = !!gcpAuthClient;
