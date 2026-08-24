import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID")!;
const BUCKET = Deno.env.get("R2_BUCKET")!;
const ACCESS_KEY = Deno.env.get("R2_ACCESS_KEY_ID")!;
const SECRET_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY")!;
const HOST = `${ACCOUNT_ID}.r2.cloudflarestorage.com`;
const REGION = "auto";
const SERVICE = "s3";
const MAX_BYTES = 5 * 1024 * 1024;
const RETENTION_DAYS = 15;

const enc = new TextEncoder();

async function hmac(key: ArrayBuffer | Uint8Array, msg: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey("raw", key as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return await crypto.subtle.sign("HMAC", k, enc.encode(msg));
}

function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === "string" ? enc.encode(data) : data;
  return hex(await crypto.subtle.digest("SHA-256", bytes as BufferSource));
}

async function signingKey(dateStamp: string): Promise<ArrayBuffer> {
  let k: ArrayBuffer | Uint8Array = enc.encode("AWS4" + SECRET_KEY);
  k = await hmac(k, dateStamp);
  k = await hmac(k, REGION);
  k = await hmac(k, SERVICE);
  return await hmac(k, "aws4_request");
}

function amzDate(d: Date) {
  const iso = d.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amz: iso, stamp: iso.slice(0, 8) };
}

function encodeKey(key: string) {
  return key.split("/").map(encodeURIComponent).join("/");
}

/** Presign a GET URL valid for `expires` seconds. */
async function presignGet(key: string, expires: number): Promise<string> {
  const { amz, stamp } = amzDate(new Date());
  const credential = `${ACCESS_KEY}/${stamp}/${REGION}/${SERVICE}/aws4_request`;
  const params = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": credential,
    "X-Amz-Date": amz,
    "X-Amz-Expires": String(expires),
    "X-Amz-SignedHeaders": "host",
  });
  const canonicalUri = `/${BUCKET}/${encodeKey(key)}`;
  const canonical = [
    "GET",
    canonicalUri,
    params.toString(),
    `host:${HOST}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const sts = ["AWS4-HMAC-SHA256", amz, `${stamp}/${REGION}/${SERVICE}/aws4_request`, await sha256Hex(canonical)].join("\n");
  const sig = hex(await hmac(await signingKey(stamp), sts));
  return `https://${HOST}${canonicalUri}?${params.toString()}&X-Amz-Signature=${sig}`;
}

/** Signed request against R2 (PUT object, lifecycle config, etc). */
async function signedFetch(method: string, path: string, body: Uint8Array, extraHeaders: Record<string, string> = {}) {
  const { amz, stamp } = amzDate(new Date());
  const payloadHash = await sha256Hex(body);
  const headers: Record<string, string> = {
    host: HOST,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amz,
    ...extraHeaders,
  };
  const sortedKeys = Object.keys(headers).map((h) => h.toLowerCase()).sort();
  const canonicalHeaders = sortedKeys.map((h) => `${h}:${headers[Object.keys(headers).find((k) => k.toLowerCase() === h)!].trim()}\n`).join("");
  const signedHeaders = sortedKeys.join(";");
  const [rawPath, query = ""] = path.split("?");
  const canonical = [method, rawPath, query, canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const sts = ["AWS4-HMAC-SHA256", amz, `${stamp}/${REGION}/${SERVICE}/aws4_request`, await sha256Hex(canonical)].join("\n");
  const sig = hex(await hmac(await signingKey(stamp), sts));
  headers["Authorization"] =
    `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY}/${stamp}/${REGION}/${SERVICE}/aws4_request, SignedHeaders=${signedHeaders}, Signature=${sig}`;
  return await fetch(`https://${HOST}${path}`, { method, headers, body: method === "GET" ? undefined : body });
}

async function ensureLifecycle() {
  const xml = `<LifecycleConfiguration><Rule><ID>expire-attachments</ID><Status>Enabled</Status><Filter><Prefix></Prefix></Filter><Expiration><Days>${RETENTION_DAYS}</Days></Expiration></Rule></LifecycleConfiguration>`;
  const body = enc.encode(xml);
  const res = await signedFetch("PUT", `/${BUCKET}?lifecycle`, body, { "content-type": "application/xml" });
  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "You need to be logged in." }, 401);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Your session expired. Please log in again." }, 401);

    const contentType = req.headers.get("content-type") || "";

    // Upload (multipart form-data)
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return json({ error: "No file was received." }, 400);
      if (file.size > MAX_BYTES) return json({ error: "File is larger than 5MB." }, 400);

      const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
      const key = `tickets/${user.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
      const bytes = new Uint8Array(await file.arrayBuffer());
      const res = await signedFetch("PUT", `/${BUCKET}/${encodeKey(key)}`, bytes, {
        "content-type": file.type || "application/octet-stream",
      });
      if (!res.ok) return json({ error: "Upload failed. Please try again." }, 502);
      return json({ key: `r2:${key}` });
    }

    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action === "sign") {
      const raw = String(body?.key || "");
      const key = raw.startsWith("r2:") ? raw.slice(3) : raw;
      if (!key || key.includes("..")) return json({ error: "Invalid attachment reference." }, 400);

      // Staff can view any attachment, users only their own.
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const isStaff = (roles || []).some((r: { role: string }) => r.role === "admin" || r.role === "support");
      if (!isStaff && !key.startsWith(`tickets/${user.id}/`)) {
        return json({ error: "You cannot view this attachment." }, 403);
      }
      return json({ url: await presignGet(key, 60 * 10) });
    }

    if (action === "init-lifecycle") {
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const isAdmin = (roles || []).some((r: { role: string }) => r.role === "admin");
      if (!isAdmin) return json({ error: "Admins only." }, 403);
      const ok = await ensureLifecycle();
      return json({ success: ok, retention_days: RETENTION_DAYS });
    }

    return json({ error: "Unknown request." }, 400);
  } catch {
    return json({ error: "Something went wrong handling the attachment." }, 500);
  }
});
