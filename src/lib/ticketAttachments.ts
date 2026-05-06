import { supabase } from "@/integrations/supabase/client";

const BUCKET = "ticket-attachments";

/**
 * Resolve an attachment_url field to a viewable URL.
 * - If it looks like a full http(s) URL (legacy public bucket entries), returns as-is.
 * - Otherwise treats it as a storage path and generates a 1-hour signed URL.
 */
export async function resolveAttachmentUrl(stored: string): Promise<string | null> {
  if (!stored) return null;
  if (/^https?:\/\//i.test(stored)) return stored;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(stored, 60 * 60); // 1 hour
  if (error) {
    console.error("signed url error");
    return null;
  }
  return data?.signedUrl ?? null;
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
