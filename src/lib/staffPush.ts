import { supabase } from "@/integrations/supabase/client";

/** Public VAPID key. Safe to ship to the browser. */
const VAPID_PUBLIC_KEY = "BANWMlRvbt4We8luV37JPoBnjxhBmmAfTk2eagxi7JhqyUtUUGgyyUAe9Ejgq_BuTX7IBwnXLaZlfT27YB1Ev5s";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function pushPermission(): NotificationPermission | "unsupported" {
  return pushSupported() ? Notification.permission : "unsupported";
}

/**
 * Register the service worker and store a push subscription for the signed in staff member.
 * Returns a friendly message when it cannot be enabled.
 */
export async function enableStaffPush(): Promise<{ ok: boolean; message: string }> {
  if (!pushSupported()) return { ok: false, message: "This browser does not support push notifications." };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, message: "Notifications are blocked in your browser settings." };

  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    const existing = await registration.pushManager.getSubscription();
    const subscription = existing ?? (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    }));

    const raw = subscription.toJSON();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, message: "Please sign in again and retry." };

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        endpoint: subscription.endpoint,
        p256dh: raw.keys?.p256dh ?? "",
        auth: raw.keys?.auth ?? "",
        user_agent: navigator.userAgent.slice(0, 200),
      },
      { onConflict: "endpoint" },
    );
    if (error) return { ok: false, message: "Could not save your notification settings." };

    return { ok: true, message: "Push notifications are on for this device." };
  } catch {
    return { ok: false, message: "Could not turn on push notifications on this device." };
  }
}

export async function disableStaffPush(): Promise<void> {
  if (!pushSupported()) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration("/sw.js");
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
      await subscription.unsubscribe();
    }
  } catch {
    // nothing else to clean up
  }
}

/** Ask the backend to notify staff devices about new customer activity. */
export async function notifyStaff(kind: "ticket" | "internal"): Promise<void> {
  const { error } = await supabase.functions.invoke("notify-staff-push", { body: { kind } });
  if (error) throw new Error("Your message was sent, but the staff alert could not be delivered.");
}
