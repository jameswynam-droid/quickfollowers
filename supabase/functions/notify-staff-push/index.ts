import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const enc = new TextEncoder();

function b64url(bytes: Uint8Array) {
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function vapidHeader(audience: string): Promise<string | null> {
  const jwkRaw = Deno.env.get("VAPID_PRIVATE_JWK");
  const subject = Deno.env.get("VAPID_SUBJECT") || "mailto:support@quickfollowers.online";
  if (!jwkRaw) return null;

  const key = await crypto.subtle.importKey("jwk", JSON.parse(jwkRaw), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const header = b64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64url(
    enc.encode(JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, sub: subject })),
  );
  const data = `${header}.${claims}`;
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(data)));
  return `${data}.${b64url(sig)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "You need to be logged in." }, 401);

    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Your session expired. Please log in again." }, 401);

    const body = await req.json().catch(() => ({}));
    const kind = String(body?.kind || "ticket");
    if (!["ticket", "internal"].includes(kind)) return json({ error: "Unsupported notification type." }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Only staff receive these notifications.
    const { data: staff } = await admin.from("user_roles").select("user_id").in("role", ["admin", "support"]);
    const staffIds = [...new Set((staff || []).map((s: { user_id: string }) => s.user_id))].filter((id) => id !== user.id);
    if (staffIds.length === 0) return json({ sent: 0 });

    const { data: subs } = await admin.from("push_subscriptions").select("id, endpoint").in("user_id", staffIds);
    if (!subs?.length) return json({ sent: 0 });

    let sent = 0;
    const dead: string[] = [];

    for (const sub of subs) {
      try {
        const url = new URL(sub.endpoint);
        const jwt = await vapidHeader(`${url.protocol}//${url.host}`);
        if (!jwt) break;
        const res = await fetch(sub.endpoint, {
          method: "POST",
          headers: {
            TTL: "3600",
            Authorization: `vapid t=${jwt}, k=${Deno.env.get("VAPID_PUBLIC_KEY")}`,
            "Content-Length": "0",
          },
        });
        if (res.status === 404 || res.status === 410) dead.push(sub.id);
        else if (res.ok) sent++;
      } catch {
        // Ignore a single failing endpoint and keep notifying the rest.
      }
    }

    if (dead.length) await admin.from("push_subscriptions").delete().in("id", dead);

    return json({ sent });
  } catch {
    return json({ error: "Could not send the notification." }, 500);
  }
});
