import { supabase } from "@/integrations/supabase/client";

/**
 * Extract the storage path from a full public URL or return as-is if already a path.
 * Handles legacy URLs stored before buckets were made private.
 */
export function extractStoragePath(urlOrPath: string, bucket: string): string {
  if (urlOrPath.includes("/storage/v1/object/public/")) {
    const marker = `/storage/v1/object/public/${bucket}/`;
    const idx = urlOrPath.indexOf(marker);
    if (idx >= 0) return urlOrPath.substring(idx + marker.length).split("?")[0];
  }
  return urlOrPath;
}

/**
 * Generate a signed URL for a file in a private bucket.
 * Handles both legacy full URLs and plain paths.
 */
export async function getSignedUrl(
  bucket: string,
  urlOrPath: string,
  expiresIn = 3600
): Promise<string | null> {
  const path = extractStoragePath(urlOrPath, bucket);
  const isHeif = /\.(heic|heif)$/i.test(path);
  const options: any = {};
  if (isHeif) options.transform = { format: "origin" };
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn, options);
  if (error) {
    console.error("Failed to create signed URL:", error.message);
    return null;
  }
  return data.signedUrl;
}

export type SignedUrlResult = {
  signedUrl: string | null;
  error: string | null;
};

/**
 * Generate signed URLs for multiple files in a batch.
 * Returns per-path results including errors so callers can detect missing files.
 */
export async function getSignedUrls(
  bucket: string,
  urlsOrPaths: string[],
  expiresIn = 3600
): Promise<Map<string, SignedUrlResult>> {
  const entries: Array<{ original: string; path: string }> = [];
  const paths: string[] = [];

  for (const urlOrPath of urlsOrPaths) {
    const path = extractStoragePath(urlOrPath, bucket);
    entries.push({ original: urlOrPath, path });
    paths.push(path);
  }

  const result = new Map<string, SignedUrlResult>();

  if (paths.length === 0) return result;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(paths, expiresIn);

  if (error || !data) {
    // Total failure — mark all as error
    for (const entry of entries) {
      result.set(entry.original, { signedUrl: null, error: error?.message || "Unknown error" });
    }
    return result;
  }

  // Match by index — createSignedUrls returns in same order
  for (let i = 0; i < entries.length; i++) {
    const item = data[i];
    if (item?.error) {
      result.set(entries[i].original, { signedUrl: null, error: item.error });
    } else if (item?.signedUrl) {
      result.set(entries[i].original, { signedUrl: item.signedUrl, error: null });
    } else {
      result.set(entries[i].original, { signedUrl: null, error: "No URL returned" });
    }
  }
  return result;
}
