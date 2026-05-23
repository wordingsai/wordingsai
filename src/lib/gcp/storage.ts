import { Storage } from "@google-cloud/storage";
import {
  GCP_PROJECT_ID,
  GCP_PROJECT_NUMBER,
  GCP_SERVICE_ACCOUNT_EMAIL,
  gcpAuthClient,
} from "./auth";

export const GCS_BUCKET_NAME = (
  process.env.GCP_STORAGE_BUCKET || "wordingsai-contracts-prod-001"
).trim();

console.log(`[GCS] Using bucket: ${GCS_BUCKET_NAME}`);

function getGCSOptions() {
  const options: any = {};

  const projectId = GCP_PROJECT_ID || GCP_PROJECT_NUMBER;
  if (projectId) {
    options.projectId = projectId;
  }

  if (gcpAuthClient) {
    // Use the OIDC client for authentication (Vercel Production)
    console.log("[GCS] Using Vercel OIDC Auth Client");
    options.auth = gcpAuthClient;
    options.authClient = gcpAuthClient;
  }
  // Fallback: If no gcpAuthClient (Local Dev), the SDK will automatically
  // find your local ADC (e.g. from 'gcloud auth application-default login').
  // Otherwise, the SDK will automatically look for Application Default Credentials (ADC)
  // This handles Cloud Run environment naturally.

  return options;
}

export const gcpStorage = new Storage(getGCSOptions());

/**
 * Generates a signed upload URL for Google Cloud Storage.
 */
export async function generateGCSUploadUrl(
  filePath: string,
  contentType: string,
) {
  const bucket = gcpStorage.bucket(GCS_BUCKET_NAME);
  const file = bucket.file(filePath);

  // For GCS V4 signing with WIF/OIDC, we pass the service account email explicitly here
  // so it doesn't interfere with standard download/delete authentication.
  const signedUrlResults = await file.getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    contentType: contentType,
    // Cast to any to bypass strict type check if the SDK version is slightly different
    // but the underlying API supports it.
    clientEmail: GCP_SERVICE_ACCOUNT_EMAIL as any,
  } as any);

  const signedUrl = signedUrlResults[0];

  return {
    signedUrl,
    publicUrl: `https://storage.googleapis.com/${GCS_BUCKET_NAME}/${filePath}`,
    filePath,
  };
}

/**
 * Gets a public URL for a file in GCS.
 */
export function getGCSPublicUrl(filePath: string) {
  return `https://storage.googleapis.com/${GCS_BUCKET_NAME}/${filePath}`;
}

/**
 * Downloads a file buffer from GCS.
 */
export async function downloadFromGCS(filePath: string): Promise<Buffer> {
  const bucket = gcpStorage.bucket(GCS_BUCKET_NAME);
  const file = bucket.file(filePath);
  const [content] = await file.download();
  return content;
}

/**
 * Deletes a file from GCS.
 */
export async function deleteFromGCS(filePath: string): Promise<void> {
  const bucket = gcpStorage.bucket(GCS_BUCKET_NAME);
  const file = bucket.file(filePath);
  await file.delete();
}

/**
 * Extracts the relative file path from a GCS URL.
 */
export function extractPathFromGCSUrl(fullUrl: string): string | null {
  try {
    const url = new URL(fullUrl);
    if (!url.hostname.includes("storage.googleapis.com")) return null;

    // GCS URLs: /BUCKET_NAME/FILE_PATH
    const pathname = url.pathname.startsWith("/")
      ? url.pathname.slice(1)
      : url.pathname;
    const parts = pathname.split("/");

    if (parts[0] === GCS_BUCKET_NAME) {
      return parts.slice(1).join("/");
    }

    return null;
  } catch {
    return null;
  }
}
