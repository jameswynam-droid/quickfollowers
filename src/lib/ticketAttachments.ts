import { supabase } from "@/integrations/supabase/client";

const BUCKET = "ticket-attachments";

/**
 * Extract a storage path from a legacy public URL like:
 *   https://<ref>.supabase.co/storage/v1/object/public/ticket-attachments/<path>
 * Returns null if it doesn't match.
 */
function extractPathFromLegacyUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const signedMarker = `/storage/v1/object/sign/${BUCKET}/`;
    let idx = u.pathname.indexOf(marker);
    if (idx >= 0) return decodeURIComponent(u.pathname.substring(idx + marker.length));
    idx = u.pathname.indexOf(signedMarker);
    if (idx >= 0) return decodeURIComponent(u.pathname.substring(idx + signedMarker.length).split("?")[0]);
    return null;
  } catch {
    return null;
  }
}

/**
 * Resolve an attachment_url field to a viewable URL.
 * - Bare storage paths get a fresh 1-hour signed URL.
 * - Legacy full URLs that point at our bucket are converted to signed URLs
 *   (the bucket is now private so the old public URL would 404).
 * - Anything else is returned as-is.
 */
export async function resolveAttachmentUrl(stored: string): Promise<string | null> {
  if (!stored) return null;

  let path: string | null = null;
  if (/^https?:\/\//i.test(stored)) {
    path = extractPathFromLegacyUrl(stored);
    if (!path) return stored; // unknown external URL, keep it
  } else {
    path = stored;
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function uploadTicketAttachment(file: File, userId: string): Promise<string | null> {
  const ext = file.name.split(".").pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
  const filePath = `${userId}/${fileName}`;
  const { error } = await supabase.storage.from(BUCKET).upload(filePath, file);
  if (error) {
    console.error("upload error");
    return null;
  }
  // Store the path; signed URLs are generated at view time.
  return filePath;
}
