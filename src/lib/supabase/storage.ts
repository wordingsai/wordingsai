import { supabaseServer } from "../supabase-server";

export const SUPABASE_BUCKET_NAME =
  process.env.SUPABASE_STORAGE_BUCKET || "contracts";

/**
 * Generates a signed upload URL for Supabase Storage.
 */
export async function generateSupabaseUploadUrl(filePath: string) {
  const { data, error } = await supabaseServer.storage
    .from(SUPABASE_BUCKET_NAME)
    .createSignedUploadUrl(filePath);

  if (error) {
    console.error(
      "[Supabase Storage] Failed to generate signed upload URL:",
      error,
    );
    throw error;
  }

  // Supabase returns a signedUrl and a token/path.
  return {
    signedUrl: data.signedUrl,
    token: data.token,
    path: data.path,
  };
}

/**
 * Gets a public URL for a file in Supabase Storage.
 */
export function getSupabasePublicUrl(filePath: string) {
  const { data } = supabaseServer.storage
    .from(SUPABASE_BUCKET_NAME)
    .getPublicUrl(filePath);

  return data.publicUrl;
}

/**
 * Creates a short-lived signed READ url for a stored file. Used to stream
 * large files (e.g. PDFs) through our API without buffering the whole file
 * into the serverless function's memory first.
 */
export async function getSupabaseSignedReadUrl(
  filePath: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const { data, error } = await supabaseServer.storage
    .from(SUPABASE_BUCKET_NAME)
    .createSignedUrl(filePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    console.error("[Supabase Storage] Signed URL failed:", error);
    return null;
  }
  return data.signedUrl;
}

/**
 * Downloads a file buffer from Supabase Storage.
 */
export async function downloadFromSupabase(filePath: string): Promise<Buffer> {
  const { data, error } = await supabaseServer.storage
    .from(SUPABASE_BUCKET_NAME)
    .download(filePath);

  if (error) {
    console.error("[Supabase Storage] Download failed:", error);
    throw error;
  }

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Deletes a file from Supabase Storage.
 */
export async function deleteFromSupabase(filePath: string): Promise<boolean> {
  const { data, error } = await supabaseServer.storage
    .from(SUPABASE_BUCKET_NAME)
    .remove([filePath]);

  if (error) {
    console.error("[Supabase Storage] Delete failed:", error);
    return false;
  }

  return true;
}

/**
 * Extracts the relative file path from a Supabase Storage URL.
 * Handles both public and signed URLs.
 */
export function extractPathFromSupabaseUrl(fullUrl: string): string | null {
  try {
    const url = new URL(fullUrl);
    if (!url.hostname.includes("supabase.co")) return null;

    // Supabase URLs usually follow: /storage/v1/object/(public|sign)/BUCKET_NAME/FILE_PATH
    const parts = url.pathname.split("/");
    const bucketIndex = parts.indexOf(SUPABASE_BUCKET_NAME);

    if (bucketIndex === -1 || bucketIndex === parts.length - 1) {
      // Fallback for custom structures: look for segments after 'public', 'sign', 'authenticated', or 'object'
      const storageIndex = parts.findIndex((p) =>
        ["public", "sign", "authenticated", "object"].includes(p),
      );
      if (storageIndex !== -1 && storageIndex < parts.length - 2) {
        // If we found 'object', the bucket name is the next segment, so we slice + 2
        // If we found 'public'/'sign', the bucket name is also usually the next segment
        return parts.slice(storageIndex + 2).join("/");
      }
      return null;
    }

    return parts.slice(bucketIndex + 1).join("/");
  } catch {
    return null;
  }
}
