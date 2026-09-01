import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

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

    const { data: subs } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").in("user_id", staffIds);
    if (!subs?.length) return json({ sent: 0 });

    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const privateJwkRaw = Deno.env.get("VAPID_PRIVATE_JWK");
    if (!publicKey || !privateJwkRaw) return json({ error: "Push notifications are not configured." }, 503);
    const privateJwk = JSON.parse(privateJwkRaw);
    if (!privateJwk?.d) return json({ error: "Push notifications are not configured." }, 503);
    webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") || "mailto:support@quickfollowers.online", publicKey, privateJwk.d);

    const payload = JSON.stringify({
      title: kind === "ticket" ? "New support message" : "New staff request",
      body: kind === "ticket" ? "A customer sent a new ticket message." : "A staff member sent a new request.",
      tag: kind === "ticket" ? "support-ticket" : "staff-request",
      url: kind === "ticket" ? "/admin/tickets" : "/admin/messages",
    });

    let sent = 0;
    const dead: string[] = [];

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { TTL: 3600 },
        );
        sent++;
      } catch (error) {
        const statusCode = Number((error as { statusCode?: number })?.statusCode || 0);
        if (statusCode === 404 || statusCode === 410) dead.push(sub.id);
        // Ignore a single failing endpoint and keep notifying the rest.
      }
    }

    if (dead.length) await admin.from("push_subscriptions").delete().in("id", dead);

    return json({ sent });
  } catch {
    return json({ error: "Could not send the notification." }, 500);
  }
});
