import { supabase } from "@/integrations/supabase/client";

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Resolve a stored attachment reference to a short lived viewable URL.
 * Only R2 references are accepted. Legacy storage references stay unavailable so
 * attachment URLs can never expose the application's database storage host.
 */
export async function resolveAttachmentUrl(stored: string): Promise<string | null> {
  if (!stored) return null;

  if (!stored.startsWith("r2:")) return null;
  const { data, error } = await supabase.functions.invoke("r2-attachments", {
    body: { action: "sign", key: stored },
  });
  if (error || !data?.url) return null;
  return data.url as string;
}

/**
 * Upload a ticket attachment to private Cloudflare R2 storage. There is
 * intentionally no fallback to the application's database storage.
 */
export async function uploadTicketAttachment(file: File, ticketId: string): Promise<string> {
  if (file.size > MAX_BYTES) throw new Error("Attachments must be 5MB or smaller.");

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Please sign in again before uploading an attachment.");

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const response = await fetch(`https://${projectId}.supabase.co/functions/v1/r2-attachments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": file.type || "application/octet-stream",
      "X-Attachment-Name": encodeURIComponent(file.name),
      "X-Ticket-Id": ticketId,
      "X-File-Size": String(file.size),
    },
    body: file,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.key) {
    throw new Error(payload?.error || "The attachment could not be uploaded. Please try again.");
  }
  return payload.key as string;
}
