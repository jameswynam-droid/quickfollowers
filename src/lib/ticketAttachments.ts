import { supabase } from "@/integrations/supabase/client";

const BUCKET = "ticket-attachments";
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Extract a storage path from a legacy public/signed URL of our old bucket.
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
 * Resolve a stored attachment reference to a short lived viewable URL.
 * - `r2:<key>` values are signed by the R2 edge function (10 minutes).
 * - Legacy Supabase storage paths/URLs still resolve through signed storage URLs.
 */
export async function resolveAttachmentUrl(stored: string): Promise<string | null> {
  if (!stored) return null;

  if (stored.startsWith("r2:")) {
    const { data, error } = await supabase.functions.invoke("r2-attachments", {
      body: { action: "sign", key: stored },
    });
    if (error || !data?.url) return null;
    return data.url as string;
  }

  let path: string | null = null;
  if (/^https?:\/\//i.test(stored)) {
    path = extractPathFromLegacyUrl(stored);
    if (!path) return stored;
  } else {
    path = stored;
  }

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/**
 * Upload a ticket attachment to Cloudflare R2 through the edge proxy.
 * Falls back to the private Supabase bucket if R2 is unavailable.
 */
export async function uploadTicketAttachment(file: File, userId: string): Promise<string | null> {
  if (file.size > MAX_BYTES) return null;

  try {
    const form = new FormData();
    form.append("file", file);
    const { data, error } = await supabase.functions.invoke("r2-attachments", { body: form });
    if (!error && data?.key) return data.key as string;
  } catch {
    // fall through to the storage fallback below
  }

  const ext = file.name.split(".").pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
  const filePath = `${userId}/${fileName}`;
  const { error } = await supabase.storage.from(BUCKET).upload(filePath, file);
  if (error) return null;
  return filePath;
}
