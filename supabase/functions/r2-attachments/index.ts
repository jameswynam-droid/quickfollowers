import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const enc = new TextEncoder();
const REGION = "auto";
const SERVICE = "s3";
const MAX_BYTES = 5 * 1024 * 1024;
const RETENTION_DAYS = 15;

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

// Strip BOMs, direction marks, zero-width characters, whitespace and other
// non-ASCII bytes that silently invalidate AWS signatures when copied into secrets.
function cleanCredential(value: string): string {
  return value.replace(/[^\x21-\x7E]/g, "");
}

const ACCOUNT_ID = cleanCredential(requiredEnv("R2_ACCOUNT_ID"));
const BUCKET = cleanCredential(requiredEnv("R2_BUCKET"));
const ACCESS_KEY = cleanCredential(requiredEnv("R2_ACCESS_KEY_ID"));
const SECRET_KEY = cleanCredential(requiredEnv("R2_SECRET_ACCESS_KEY"));
const HOST = `${ACCOUNT_ID}.r2.cloudflarestorage.com`;
const TOKEN_SECRET = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

async function hmac(key: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
  const imported = await crypto.subtle.importKey("raw", key as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", imported, enc.encode(message));
}

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string | Uint8Array): Promise<string> {
  const bytes = typeof value === "string" ? enc.encode(value) : value;
  return hex(await crypto.subtle.digest("SHA-256", bytes as BufferSource));
}

async function signingKey(stamp: string): Promise<ArrayBuffer> {
  let key: ArrayBuffer | Uint8Array = enc.encode(`AWS4${SECRET_KEY}`);
  key = await hmac(key, stamp);
  key = await hmac(key, REGION);
  key = await hmac(key, SERVICE);
  return hmac(key, "aws4_request");
}

function dateParts(date = new Date()) {
  const amz = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amz, stamp: amz.slice(0, 8) };
}

function awsEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function encodeKey(key: string): string {
  return key.split("/").map(awsEncode).join("/");
}

async function presignedObjectUrl(method: "GET" | "PUT", key: string, expires = 900): Promise<string> {
  const { amz, stamp } = dateParts();
  const scope = `${stamp}/${REGION}/${SERVICE}/aws4_request`;
  const params: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${ACCESS_KEY}/${scope}`,
    "X-Amz-Date": amz,
    "X-Amz-Expires": String(expires),
    "X-Amz-SignedHeaders": "host",
  };
  const canonicalQuery = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `${awsEncode(name)}=${awsEncode(value)}`)
    .join("&");
  const path = `/${awsEncode(BUCKET)}/${encodeKey(key)}`;
  const canonicalRequest = [method, path, canonicalQuery, `host:${HOST}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amz, scope, await sha256Hex(canonicalRequest)].join("\n");
  const signature = hex(await hmac(await signingKey(stamp), stringToSign));
  return `https://${HOST}${path}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

function b64url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function mintToken(key: string, ttlSeconds: number): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify({ k: key, e: Math.floor(Date.now() / 1000) + ttlSeconds })));
  const signature = b64url(new Uint8Array(await hmac(enc.encode(TOKEN_SECRET), payload)));
  return `${payload}.${signature}`;
}

async function readToken(token: string): Promise<string | null> {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = b64url(new Uint8Array(await hmac(enc.encode(TOKEN_SECRET), payload)));
  if (expected.length !== signature.length) return null;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) mismatch |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
  if (mismatch !== 0) return null;
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const value = JSON.parse(atob(normalized));
    if (typeof value?.k !== "string" || typeof value?.e !== "number" || value.e < Math.floor(Date.now() / 1000)) return null;
    return value.k;
  } catch {
    return null;
  }
}

async function isStaff(client: ReturnType<typeof createClient>, userId: string): Promise<boolean> {
  const { data } = await client.from("user_roles").select("role").eq("user_id", userId).in("role", ["admin", "support"]);
  return Boolean(data?.length);
}

async function canAccessTicket(client: ReturnType<typeof createClient>, userId: string, ticketId: string): Promise<boolean> {
  if (await isStaff(client, userId)) return true;
  const { data } = await client.from("tickets").select("id").eq("id", ticketId).eq("user_id", userId).maybeSingle();
  return Boolean(data);
}

async function signedLifecycleFetch(): Promise<Response> {
  const xml = `<LifecycleConfiguration><Rule><ID>expire-attachments</ID><Status>Enabled</Status><Filter><Prefix>tickets/</Prefix></Filter><Expiration><Days>${RETENTION_DAYS}</Days></Expiration></Rule></LifecycleConfiguration>`;
  const body = enc.encode(xml);
  const { amz, stamp } = dateParts();
  const payloadHash = await sha256Hex(body);
  const path = `/${awsEncode(BUCKET)}`;
  const query = "lifecycle=";
  const headers = `content-type:application/xml\nhost:${HOST}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amz}\n`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonical = ["PUT", path, query, headers, signedHeaders, payloadHash].join("\n");
  const scope = `${stamp}/${REGION}/${SERVICE}/aws4_request`;
  const signature = hex(await hmac(await signingKey(stamp), ["AWS4-HMAC-SHA256", amz, scope, await sha256Hex(canonical)].join("\n")));
  return fetch(`https://${HOST}${path}?lifecycle`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/xml",
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amz,
      Authorization: `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    body,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  try {
    const url = new URL(req.url);
    if (req.method === "GET" && url.searchParams.has("t")) {
      const token = url.searchParams.get("t");
      const key = token ? await readToken(token) : null;
      if (!key) return new Response("Link expired", { status: 403, headers: corsHeaders });
      const objectResponse = await fetch(await presignedObjectUrl("GET", key));
      if (!objectResponse.ok) return new Response("File not found", { status: 404, headers: corsHeaders });
      return new Response(objectResponse.body, {
        headers: {
          ...corsHeaders,
          "Content-Type": objectResponse.headers.get("content-type") || "application/octet-stream",
          "Content-Disposition": "inline",
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "You need to be logged in." }, 401);
    const userClient = createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_ANON_KEY"), {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Your session expired. Please log in again." }, 401);
    const admin = createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"));

    if (req.method === "POST" && !req.headers.get("content-type")?.includes("application/json")) {
      const ticketId = req.headers.get("X-Ticket-Id") || "";
      const declaredSize = Number(req.headers.get("X-File-Size") || "0");
      if (!ticketId || !Number.isFinite(declaredSize) || declaredSize < 1 || declaredSize > MAX_BYTES) {
        return json({ error: "The attachment must be 5MB or smaller." }, 400);
      }
      if (!(await canAccessTicket(admin, user.id, ticketId))) return json({ error: "You cannot add files to this ticket." }, 403);
      if (!req.body) return json({ error: "No file was received." }, 400);

      const rawName = decodeURIComponent(req.headers.get("X-Attachment-Name") || "attachment.bin");
      const extension = (rawName.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10) || "bin";
      const key = `tickets/${ticketId}/${crypto.randomUUID()}.${extension}`;
      const uploadResponse = await fetch(await presignedObjectUrl("PUT", key), {
        method: "PUT",
        headers: { "Content-Type": req.headers.get("content-type") || "application/octet-stream" },
        body: req.body,
      });
      if (!uploadResponse.ok) return json({ error: "The attachment could not be uploaded. Please try again." }, 502);
      return json({ key: `r2:${key}` });
    }

    const body = await req.json().catch(() => ({}));
    if (body?.action === "sign") {
      const raw = String(body?.key || "");
      const key = raw.startsWith("r2:") ? raw.slice(3) : "";
      if (!/^tickets\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.[a-z0-9]{1,10}$/i.test(key)) return json({ error: "Invalid attachment reference." }, 400);

      const { data: message } = await admin.from("ticket_messages").select("ticket_id").eq("attachment_url", raw).maybeSingle();
      if (!message || !(await canAccessTicket(admin, user.id, message.ticket_id))) return json({ error: "You cannot view this attachment." }, 403);
      const token = await mintToken(key, 15 * 60);
      return json({ url: `${requiredEnv("SUPABASE_URL")}/functions/v1/r2-attachments?t=${encodeURIComponent(token)}` });
    }

    if (body?.action === "init-lifecycle") {
      const { data: role } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      if (!role) return json({ error: "Admins only." }, 403);
      const response = await signedLifecycleFetch();
      return json({ success: response.ok, retention_days: RETENTION_DAYS }, response.ok ? 200 : 502);
    }

    return json({ error: "Unknown request." }, 400);
  } catch {
    return json({ error: "Something went wrong handling the attachment." }, 500);
  }
});